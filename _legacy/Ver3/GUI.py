#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Feathering Analysis v2.2
Modern sidebar-navigation GUI for seismic feathering analysis.
"""

import json
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path
import os
import subprocess
import sys
from datetime import datetime
import time
import ctypes

import Parser_2 as analyzer

# ---------------------------------------------------------------------------
# Windows High-DPI
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Design tokens  — warm navy + teal accent
# ---------------------------------------------------------------------------
C = {
    "bg":          "#0d1117",
    "sidebar":     "#131921",
    "panel":       "#161b22",
    "card":        "#1c2333",
    "input":       "#242d3d",
    "input_focus":  "#2d3a50",

    "accent":      "#3fb8af",
    "accent_h":    "#5dd4cb",
    "accent_dim":  "#2a7f79",

    "ok":          "#56d67b",
    "warn":        "#e8b94a",
    "err":         "#f47067",

    "t1":          "#ecf0f5",
    "t2":          "#8b949e",
    "t3":          "#484f58",

    "sep":         "#21262d",
    "hover":       "#1a2233",
}

FONT = "Pretendard"
FONT_FALLBACKS = ["Pretendard", "Noto Sans KR", "Malgun Gothic",
                  "Apple SD Gothic Neo", "Segoe UI", "sans-serif"]
MONO = "Consolas"
VER = "2.2"

NAV = [
    ("input",   "01", "입력"),
    ("options", "02", "옵션"),
    ("log",     "03", "로그"),
    ("results", "04", "결과"),
    ("help",    "?",  "도움말"),
]


class FeatheringGUI(tk.Tk):
    SETTINGS_FILE = Path.home() / ".npd_feathering_gui.json"

    def __init__(self):
        super().__init__()
        self.title("Feathering Analysis")
        self.geometry("1100x780")
        self.minsize(960, 640)
        self.configure(bg=C["bg"])

        self._log_buffer: list[str] = []
        self._result_paths: list[str] = []
        self._start_time: float | None = None
        self._elapsed_timer: str | None = None
        self._running = False
        self._panels: dict[str, tk.Frame] = {}
        self._nav_items: dict[str, dict] = {}
        self._active_panel = "input"

        self._detect_font()
        self._build()
        self._load_settings()
        self._show_panel("input")
        self.bind("<Control-r>", lambda _: self._run_analysis())
        self.bind("<Control-o>", lambda _: self._select_npd())
        self.bind("<Control-s>", lambda _: self._save_settings())

    def _detect_font(self):
        global FONT
        import tkinter.font as tkfont
        available = set(tkfont.families(self))
        for name in FONT_FALLBACKS:
            if name in available:
                FONT = name
                return
        FONT = "TkDefaultFont"

    # ============================================================ BUILD
    def _build(self):
        # ---- Sidebar ----
        sidebar = tk.Frame(self, bg=C["sidebar"], width=190)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)

        # Title
        title_f = tk.Frame(sidebar, bg=C["sidebar"])
        title_f.pack(fill="x", padx=20, pady=(28, 2))
        tk.Label(title_f, text="Feathering", font=(FONT, 17, "bold"),
                 fg=C["accent"], bg=C["sidebar"]).pack(anchor="w")
        tk.Label(title_f, text="Analysis", font=(FONT, 17, "bold"),
                 fg=C["t1"], bg=C["sidebar"]).pack(anchor="w")
        tk.Label(sidebar, text=f"v{VER}  |  Seismic QC Tool", font=(FONT, 8),
                 fg=C["t3"], bg=C["sidebar"]).pack(anchor="w", padx=20, pady=(2, 24))

        tk.Frame(sidebar, bg=C["sep"], height=1).pack(fill="x", padx=14, pady=(0, 10))

        # Nav
        for nav_id, num, label in NAV:
            frame = tk.Frame(sidebar, bg=C["sidebar"], cursor="hand2")
            frame.pack(fill="x", padx=8, pady=1)

            num_lbl = tk.Label(frame, text=num, font=(MONO, 9),
                               fg=C["t3"], bg=C["sidebar"], width=3, anchor="e")
            num_lbl.pack(side="left", padx=(8, 4), pady=9)

            txt_lbl = tk.Label(frame, text=label, font=(FONT, 10),
                               fg=C["t2"], bg=C["sidebar"], anchor="w")
            txt_lbl.pack(side="left", fill="x", expand=True, pady=9)

            indicator = tk.Frame(frame, bg=C["sidebar"], width=3)
            indicator.pack(side="right", fill="y")

            self._nav_items[nav_id] = {
                "frame": frame, "num": num_lbl, "txt": txt_lbl, "bar": indicator
            }

            for w in (frame, num_lbl, txt_lbl):
                w.bind("<Button-1>", lambda e, nid=nav_id: self._show_panel(nid))
                w.bind("<Enter>", lambda e, nid=nav_id: self._nav_hover(nid, True))
                w.bind("<Leave>", lambda e, nid=nav_id: self._nav_hover(nid, False))

        # Sidebar bottom
        tk.Frame(sidebar, bg=C["sidebar"]).pack(fill="both", expand=True)
        tk.Label(sidebar, text="Ctrl+R  Run\nCtrl+O  Open\nCtrl+S  Save",
                 font=(MONO, 8), fg=C["t3"], bg=C["sidebar"],
                 justify="left").pack(anchor="w", padx=20, pady=(0, 16))

        # ---- Main ----
        main = tk.Frame(self, bg=C["bg"])
        main.pack(side="left", fill="both", expand=True)

        # Top bar
        topbar = tk.Frame(main, bg=C["panel"], height=48)
        topbar.pack(fill="x")
        topbar.pack_propagate(False)

        self.status_var = tk.StringVar(value="Ready")
        self.elapsed_var = tk.StringVar(value="")

        tk.Label(topbar, textvariable=self.status_var, font=(FONT, 10),
                 fg=C["t2"], bg=C["panel"]).pack(side="left", padx=24)
        tk.Label(topbar, textvariable=self.elapsed_var, font=(MONO, 9),
                 fg=C["t3"], bg=C["panel"]).pack(side="right", padx=24)

        # Progress
        self._progress_frame = tk.Frame(main, bg=C["sep"], height=2)
        self._progress_frame.pack(fill="x")
        self._progress_bar = tk.Frame(self._progress_frame, bg=C["accent"], height=2)
        self._progress_bar.place(x=0, y=0, height=2, relwidth=0)

        # Content
        self._content = tk.Frame(main, bg=C["bg"])
        self._content.pack(fill="both", expand=True, padx=28, pady=(20, 8))

        self._build_input_panel()
        self._build_options_panel()
        self._build_log_panel()
        self._build_results_panel()
        self._build_help_panel()

        # Bottom bar
        bottom = tk.Frame(main, bg=C["panel"], height=56)
        bottom.pack(fill="x", side="bottom")
        bottom.pack_propagate(False)

        binner = tk.Frame(bottom, bg=C["panel"])
        binner.pack(fill="x", padx=28, pady=10)

        self.run_btn = tk.Label(
            binner, text="  Run Analysis  ", font=(FONT, 11, "bold"),
            fg=C["t1"], bg=C["accent"], cursor="hand2", pady=7)
        self.run_btn.pack(side="left")
        self.run_btn.bind("<Button-1>", lambda e: self._run_analysis())
        self.run_btn.bind("<Enter>", lambda e: self.run_btn.configure(bg=C["accent_h"]))
        self.run_btn.bind("<Leave>", lambda e: self.run_btn.configure(
            bg=C["accent"] if not self._running else C["accent_dim"]))

        open_btn = tk.Label(
            binner, text="Open Output", font=(FONT, 10),
            fg=C["t2"], bg=C["card"], cursor="hand2", padx=14, pady=7)
        open_btn.pack(side="left", padx=(10, 0))
        open_btn.bind("<Button-1>", lambda e: self._open_output_dir())
        open_btn.bind("<Enter>", lambda e: open_btn.configure(bg=C["hover"]))
        open_btn.bind("<Leave>", lambda e: open_btn.configure(bg=C["card"]))

        # Toast
        self._toast_frame = tk.Frame(main, bg=C["ok"])
        self._toast_label = tk.Label(self._toast_frame, text="", font=(FONT, 10),
                                      fg=C["t1"], bg=C["ok"], pady=6)

    # ---- Panel helpers ----
    def _make_panel(self, pid):
        f = tk.Frame(self._content, bg=C["bg"])
        self._panels[pid] = f
        return f

    def _section(self, parent, title, expand=False):
        outer = tk.Frame(parent, bg=C["card"])
        outer.pack(fill="both" if expand else "x", expand=expand, pady=(0, 14))
        tk.Frame(outer, bg=C["accent"], width=3).pack(side="left", fill="y")
        inner = tk.Frame(outer, bg=C["card"])
        inner.pack(side="left", fill="both", expand=True, padx=18, pady=16)
        tk.Label(inner, text=title, font=(FONT, 11, "bold"), fg=C["t1"],
                 bg=C["card"]).pack(anchor="w", pady=(0, 12))
        return inner

    def _input_field(self, parent, label, var, btn_text=None, btn_cmd=None,
                     hint=None, width=None):
        row = tk.Frame(parent, bg=C["card"])
        row.pack(fill="x", pady=4)
        tk.Label(row, text=label, font=(FONT, 9), fg=C["t2"],
                 bg=C["card"], width=18, anchor="w").pack(side="left")
        entry = tk.Entry(row, textvariable=var, font=(FONT, 10),
                         bg=C["input"], fg=C["t1"], insertbackground=C["t1"],
                         relief="flat", bd=0, highlightthickness=1,
                         highlightcolor=C["accent"], highlightbackground=C["sep"])
        if width:
            entry.configure(width=width)
            entry.pack(side="left", padx=(0, 8), ipady=6)
        else:
            entry.pack(side="left", fill="x", expand=True, padx=(0, 8), ipady=6)
        if btn_text and btn_cmd:
            btn = tk.Label(row, text=btn_text, font=(FONT, 9),
                           fg=C["accent"], bg=C["input"], cursor="hand2",
                           padx=14, pady=5)
            btn.pack(side="left")
            btn.bind("<Button-1>", lambda e: btn_cmd())
            btn.bind("<Enter>", lambda e: btn.configure(bg=C["input_focus"]))
            btn.bind("<Leave>", lambda e: btn.configure(bg=C["input"]))
        if hint:
            tk.Label(row, text=hint, font=(FONT, 8), fg=C["t3"],
                     bg=C["card"]).pack(side="left", padx=(8, 0))
        return entry

    # ---- INPUT ----
    def _build_input_panel(self):
        p = self._make_panel("input")
        self.npd_path = tk.StringVar()
        self.track_path = tk.StringVar()
        self.line_name = tk.StringVar()

        sec = self._section(p, "File Selection")
        self._input_field(sec, "NPD File", self.npd_path,
                          btn_text="Browse", btn_cmd=self._select_npd)
        self._input_field(sec, "Track File", self.track_path,
                          btn_text="Browse", btn_cmd=self._select_track)
        self._input_field(sec, "Line Name", self.line_name,
                          hint="Leave empty = Track filename")

        self.planned_azimuth = tk.StringVar()
        self.feathering_limit = tk.StringVar(value="0")
        self.run_in_m = tk.StringVar(value="0")
        self.run_out_m = tk.StringVar(value="0")

        sec2 = self._section(p, "Parameters")
        grid = tk.Frame(sec2, bg=C["card"])
        grid.pack(fill="x")
        left = tk.Frame(grid, bg=C["card"])
        left.pack(side="left", fill="x", expand=True, padx=(0, 10))
        right = tk.Frame(grid, bg=C["card"])
        right.pack(side="left", fill="x", expand=True, padx=(10, 0))

        self._input_field(left, "Planned Azimuth (deg)", self.planned_azimuth,
                          hint="CW from N")
        self._input_field(left, "Feathering Limit (deg)", self.feathering_limit,
                          hint="0 = off")
        self._input_field(right, "Run-in Distance (m)", self.run_in_m)
        self._input_field(right, "Run-out Distance (m)", self.run_out_m)

    # ---- OPTIONS ----
    def _build_options_panel(self):
        p = self._make_panel("options")
        self.fast_match = tk.BooleanVar(value=False)
        self.match_tolerance = tk.StringVar()
        self.open_after_run = tk.BooleanVar(value=True)
        self.output_dir = tk.StringVar(value=str(Path.cwd()))

        sec = self._section(p, "Matching Options")
        chk = tk.Frame(sec, bg=C["card"])
        chk.pack(fill="x", pady=4)
        tk.Checkbutton(chk, text="Fast time matching", variable=self.fast_match,
                        font=(FONT, 9), fg=C["t2"], bg=C["card"],
                        selectcolor=C["input"], activebackground=C["card"],
                        activeforeground=C["t2"], command=self._toggle_tolerance
                        ).pack(side="left")
        tk.Label(chk, text="Tolerance (sec)", font=(FONT, 9),
                 fg=C["t3"], bg=C["card"]).pack(side="left", padx=(16, 8))
        self.tolerance_entry = tk.Entry(
            chk, textvariable=self.match_tolerance, font=(FONT, 10),
            bg=C["input"], fg=C["t1"], insertbackground=C["t1"],
            relief="flat", bd=0, width=8, highlightthickness=1,
            highlightcolor=C["accent"], highlightbackground=C["sep"],
            state="disabled")
        self.tolerance_entry.pack(side="left", ipady=5)

        sec2 = self._section(p, "Output Settings")
        self._input_field(sec2, "Output Folder", self.output_dir,
                          btn_text="Select", btn_cmd=self._select_output)
        chk2 = tk.Frame(sec2, bg=C["card"])
        chk2.pack(fill="x", pady=(8, 0))
        tk.Checkbutton(chk2, text="Open output folder on completion",
                        variable=self.open_after_run,
                        font=(FONT, 9), fg=C["t2"], bg=C["card"],
                        selectcolor=C["input"], activebackground=C["card"],
                        activeforeground=C["t2"]).pack(side="left")

    # ---- LOG ----
    def _build_log_panel(self):
        p = self._make_panel("log")
        sec = self._section(p, "Execution Log", expand=True)
        sec.master.pack_configure(fill="both", expand=True)
        self.log_text = tk.Text(
            sec, state="disabled", wrap="word",
            bg=C["bg"], fg=C["t2"], insertbackground=C["t1"],
            selectbackground=C["accent"], font=(MONO, 10),
            relief="flat", bd=0, padx=10, pady=10,
            highlightthickness=1, highlightbackground=C["sep"],
            highlightcolor=C["sep"])
        self.log_text.pack(fill="both", expand=True)
        self.log_text.tag_configure("timestamp", foreground=C["t3"])
        self.log_text.tag_configure("success", foreground=C["ok"])
        self.log_text.tag_configure("error", foreground=C["err"])
        self.log_text.tag_configure("info", foreground=C["accent_h"])

    # ---- RESULTS ----
    def _build_results_panel(self):
        p = self._make_panel("results")
        sec = self._section(p, "Generated Files", expand=True)
        sec.master.pack_configure(fill="both", expand=True)
        tk.Label(sec, text="Double-click to open", font=(FONT, 8),
                 fg=C["t3"], bg=C["card"]).pack(anchor="w", pady=(0, 6))
        self.result_list = tk.Listbox(
            sec, bg=C["bg"], fg=C["t2"],
            selectbackground=C["accent"], selectforeground=C["t1"],
            font=(MONO, 10), relief="flat", bd=0, activestyle="none",
            highlightthickness=1, highlightbackground=C["sep"],
            highlightcolor=C["sep"])
        self.result_list.pack(fill="both", expand=True)
        self.result_list.bind("<Double-Button-1>", self._open_selected_result)

    # ---- HELP / EXAMPLES ----
    def _build_help_panel(self):
        p = self._make_panel("help")

        sec = self._section(p, "Input File Formats")

        help_text = (
            "1)  NPD File  (.NPD)\n"
            "    - CSV with position data from navigation system\n"
            "    - Must contain Head_Buoy and Tail_Buoy positions\n"
            "    - Columns: Time, [separators], Position: Head_Buoy: East, North, ...\n"
            "\n"
            "    Example (header):\n"
            "    Time, D, Position: Head_Buoy: East, Position: Head_Buoy: North, "
            "D, Position: Tail_Buoy: East, ...\n"
            "\n"
            "    Example (data):\n"
            "    12:30:01.000, D, 327845.12, 3912456.78, D, 327612.34, 3912234.56\n"
            "\n"
            "\n"
            "2)  Track File  (.txt, tab-separated)\n"
            "    - Standard seismic navigation track file\n"
            "    - Required columns:\n"
            "      TRACENO  FFID  CHAN  SOU_X  SOU_Y  DAY  HOUR  MINUTE  SECOND\n"
            "\n"
            "    Example:\n"
            "    TRACENO  FFID   CHAN  SOU_X       SOU_Y        DAY  HOUR  MINUTE  SECOND\n"
            "    1        2001   1     327800.50   3912400.20   202  12    30      1.000\n"
            "    2        2002   1     327812.30   3912412.80   202  12    30      11.000\n"
            "    3        2003   1     327824.10   3912425.40   202  12    30      21.000\n"
        )

        txt = tk.Text(
            sec, bg=C["bg"], fg=C["t2"], font=(MONO, 9),
            relief="flat", bd=0, padx=12, pady=12, wrap="none",
            highlightthickness=1, highlightbackground=C["sep"],
            highlightcolor=C["sep"])
        txt.insert("1.0", help_text)

        # Syntax highlighting
        txt.tag_configure("heading", foreground=C["accent"], font=(MONO, 9, "bold"))
        txt.tag_configure("keyword", foreground=C["ok"])
        txt.tag_configure("example", foreground=C["t3"])

        for line_num, line in enumerate(help_text.split("\n"), 1):
            if line.startswith("1)") or line.startswith("2)"):
                txt.tag_add("heading", f"{line_num}.0", f"{line_num}.end")
            elif line.strip().startswith("Example"):
                txt.tag_add("keyword", f"{line_num}.0", f"{line_num}.end")
            elif line.strip().startswith("TRACENO") or line.strip().startswith("Time,"):
                txt.tag_add("example", f"{line_num}.0", f"{line_num}.end")

        txt.configure(state="disabled")
        txt.pack(fill="both", expand=True)

        # Workflow section
        sec2 = self._section(p, "Analysis Workflow")
        wf_text = (
            "NPD File  +  Track File\n"
            "       |\n"
            "  Time-based matching (searchsorted)\n"
            "       |\n"
            "  Feathering angle = arctan2(Tail-Head vector) - Planned Azimuth\n"
            "       |\n"
            "  Output:  CSV  |  Feathering Plot  |  Track Map  |  Report\n"
        )
        wf = tk.Text(sec2, bg=C["bg"], fg=C["t2"], font=(MONO, 9),
                      relief="flat", bd=0, padx=12, pady=12, height=8,
                      highlightthickness=1, highlightbackground=C["sep"],
                      highlightcolor=C["sep"])
        wf.insert("1.0", wf_text)
        wf.tag_configure("arrow", foreground=C["accent"])
        for i, line in enumerate(wf_text.split("\n"), 1):
            if "|" in line and "Output" not in line:
                wf.tag_add("arrow", f"{i}.0", f"{i}.end")
        wf.configure(state="disabled")
        wf.pack(fill="x")

    # ============================================================ NAVIGATION
    def _show_panel(self, pid):
        for _, frame in self._panels.items():
            frame.pack_forget()
        self._panels[pid].pack(fill="both", expand=True)
        self._active_panel = pid

        for nid, items in self._nav_items.items():
            active = nid == pid
            bg = C["hover"] if active else C["sidebar"]
            items["frame"].configure(bg=bg)
            items["num"].configure(bg=bg, fg=C["accent"] if active else C["t3"])
            items["txt"].configure(bg=bg, fg=C["t1"] if active else C["t2"])
            items["bar"].configure(bg=C["accent"] if active else C["sidebar"])

    def _nav_hover(self, nid, entering):
        if nid == self._active_panel:
            return
        items = self._nav_items[nid]
        bg = C["hover"] if entering else C["sidebar"]
        items["frame"].configure(bg=bg)
        items["num"].configure(bg=bg)
        items["txt"].configure(bg=bg)
        items["bar"].configure(bg=bg)

    # ============================================================ TOAST
    def _show_toast(self, message, color=None):
        color = color or C["ok"]
        self._toast_label.configure(text=message, bg=color)
        self._toast_frame.configure(bg=color)
        self._toast_frame.place(relx=0.5, y=56, anchor="n", relwidth=0.5, height=36)
        self._toast_label.pack(fill="both", expand=True)
        self.after(3500, self._hide_toast)

    def _hide_toast(self):
        self._toast_frame.place_forget()

    # ============================================================ PROGRESS
    def _pulse_start(self):
        self._pulse_pos = 0.0
        self._pulse_dir = 1
        self._pulse_active = True
        self._pulse_step()

    def _pulse_step(self):
        if not self._pulse_active:
            self._progress_bar.place_configure(relwidth=0, relx=0)
            return
        self._pulse_pos += self._pulse_dir * 0.015
        if self._pulse_pos > 0.7:
            self._pulse_dir = -1
        elif self._pulse_pos < 0:
            self._pulse_dir = 1
        self._progress_bar.place_configure(relx=self._pulse_pos, relwidth=0.3)
        self.after(25, self._pulse_step)

    def _pulse_stop(self):
        self._pulse_active = False
        self._progress_bar.place_configure(relwidth=0, relx=0)

    # ============================================================ DIALOGS
    def _select_npd(self):
        p = filedialog.askopenfilename(title="Select NPD File")
        if p:
            self.npd_path.set(p)

    def _select_track(self):
        p = filedialog.askopenfilename(title="Select Track File")
        if p:
            self.track_path.set(p)

    def _select_output(self):
        p = filedialog.askdirectory(title="Select Output Folder")
        if p:
            self.output_dir.set(p)

    # ============================================================ LOGGING
    def _append_log(self, message, tag="info"):
        self.log_text.configure(state="normal")
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{ts}] ", "timestamp")
        self.log_text.insert("end", message + "\n", tag)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        self._log_buffer.append(f"[{ts}] {message}")

    def _log(self, msg, tag="info"):
        self.after(0, self._append_log, msg, tag)

    def _clear_log(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._log_buffer.clear()

    # ============================================================ VALIDATION
    def _validate_inputs(self):
        npd = self.npd_path.get().strip()
        track = self.track_path.get().strip()
        if not npd or not track:
            self._show_toast("Select both NPD and Track files.", C["err"])
            self._show_panel("input")
            return None
        if not os.path.isfile(npd):
            self._show_toast("NPD file not found.", C["err"])
            self._show_panel("input")
            return None
        if not os.path.isfile(track):
            self._show_toast("Track file not found.", C["err"])
            self._show_panel("input")
            return None
        try:
            az = float(self.planned_azimuth.get())
        except ValueError:
            self._show_toast("Enter a valid Planned Azimuth.", C["err"])
            self._show_panel("input")
            return None
        try:
            fl = float(self.feathering_limit.get() or 0)
            ri = float(self.run_in_m.get() or 0)
            ro = float(self.run_out_m.get() or 0)
        except ValueError:
            self._show_toast("Enter valid numeric parameters.", C["err"])
            self._show_panel("input")
            return None
        ts = self.match_tolerance.get().strip()
        try:
            tol = float(ts) if ts else None
        except ValueError:
            self._show_toast("Tolerance must be a number.", C["err"])
            self._show_panel("options")
            return None
        return (npd, track, az, fl, ri, ro, tol)

    # ============================================================ ANALYSIS
    def _run_analysis(self):
        if self._running:
            return
        params = self._validate_inputs()
        if not params:
            return
        npd, track, az, fl, ri, ro, tol = params

        self._clear_results()
        self._clear_log()
        self._result_paths.clear()
        self._save_settings()
        self._running = True
        self.run_btn.configure(bg=C["accent_dim"], cursor="arrow")
        self._pulse_start()
        self._start_time = time.time()
        self.status_var.set("Running...")
        self._update_elapsed()
        self._show_panel("log")
        self._log("Analysis started...", "info")

        threading.Thread(
            target=self._run_worker,
            args=(npd, track, self.output_dir.get(), self.line_name.get().strip(),
                  az, fl, ri, ro, self.fast_match.get(), tol),
            daemon=True).start()

    def _update_elapsed(self):
        if self._start_time is None:
            return
        e = time.time() - self._start_time
        m, s = divmod(int(e), 60)
        self.elapsed_var.set(f"{m:02d}:{s:02d}")
        self._elapsed_timer = self.after(1000, self._update_elapsed)

    def _cancel_elapsed_timer(self):
        if self._elapsed_timer is not None:
            self.after_cancel(self._elapsed_timer)
            self._elapsed_timer = None

    def _run_worker(self, npd_file, track_file, output_dir, line_name_input,
                    az, fl, ri, ro, fast, tol):
        try:
            os.makedirs(output_dir, exist_ok=True)
            ln = line_name_input or Path(track_file).stem
            if "_track" in ln.lower():
                ln = ln.split("_track")[0]

            self._log(f"Parsing NPD: {Path(npd_file).name}")
            npd_df = analyzer.parse_npd_file(
                npd_file, target_positions=["Head_Buoy", "Tail_Buoy"])
            self._log(f"  {len(npd_df):,} records", "success")

            self._log(f"Parsing Track: {Path(track_file).name}")
            track_df = analyzer.parse_track_file(track_file)
            self._log(f"  {len(track_df):,} records", "success")

            if fast:
                self._log("Fast time matching...")
                matched = analyzer.match_npd_with_track_fast(npd_df, track_df, tolerance_s=tol)
            else:
                self._log("Time matching...")
                matched = analyzer.match_npd_with_track(npd_df, track_df)

            if matched.empty:
                raise RuntimeError("No matched data. Check time ranges.")
            self._log(f"  {len(matched):,} matched", "success")

            self._log("Calculating feathering...")
            feath = analyzer.calculate_feathering(matched, az)
            matched["Feathering"] = feath

            csv_p = os.path.join(output_dir, f"{ln}_feathering.csv")
            matched.to_csv(csv_p, index=False, encoding="utf-8-sig")
            self._add_result(csv_p)
            self._log("  CSV saved", "success")

            self._log("Generating feathering plot...")
            plot_p = os.path.join(output_dir, f"{ln}_feathering.png")
            stats = analyzer.plot_feathering(matched, feath, az, ri, ro, fl, ln, plot_p)
            self._add_result(plot_p)
            self._log(f"  Mean: {stats['mean']:.2f}\u00b0  Std: {stats['std']:.2f}\u00b0", "info")

            self._log("Generating track plot...")
            tp = os.path.join(output_dir, f"{ln}_trackplot.png")
            analyzer.plot_track(matched, ln, feath, fl, tp)
            self._add_result(tp)

            self._log("Generating report...")
            rp = os.path.join(output_dir, f"{ln}_report.txt")
            analyzer.generate_report(matched, feath, stats, az, ri, ro, ln, fl, rp)
            self._add_result(rp)

            lp = os.path.join(output_dir,
                              f"{ln}_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
            self._write_log(lp)
            self._add_result(lp)

            self._log("Analysis completed successfully.", "success")
            self.after(0, lambda: self._show_toast("Analysis completed."))
            if self.open_after_run.get():
                self.after(0, self._open_output_dir)
            self.after(300, lambda: self._show_panel("results"))
        except Exception as exc:
            self._log(f"Error: {exc}", "error")
            self.after(0, lambda: self._show_toast(str(exc), C["err"]))
        finally:
            self.after(0, self._finish)

    def _finish(self):
        self._pulse_stop()
        self._cancel_elapsed_timer()
        self.run_btn.configure(bg=C["accent"], cursor="hand2")
        if self._start_time:
            e = time.time() - self._start_time
            m, s = divmod(int(e), 60)
            self.elapsed_var.set(f"Done {m:02d}:{s:02d}")
        self._start_time = None
        self._running = False
        self.status_var.set("Ready")

    # ============================================================ HELPERS
    def _toggle_tolerance(self):
        self.tolerance_entry.configure(state="normal" if self.fast_match.get() else "disabled")

    def _clear_results(self):
        self.result_list.delete(0, "end")
        self._result_paths.clear()

    def _add_result(self, path):
        self._result_paths.append(path)
        fn = Path(path).name
        ext = Path(path).suffix.upper()
        self.after(0, self.result_list.insert, "end", f"  [{ext[1:]:>4}]  {fn}")

    def _open_selected_result(self, event):
        sel = self.result_list.curselection()
        if sel and sel[0] < len(self._result_paths):
            self._open_path(self._result_paths[sel[0]])

    def _open_output_dir(self):
        d = self.output_dir.get()
        if d:
            self._open_path(d)

    def _open_path(self, path):
        if not path:
            return
        try:
            if os.name == "nt":
                os.startfile(path)
            elif hasattr(os, "uname") and os.uname().sysname == "Darwin":
                subprocess.run(["open", path], check=False)
            else:
                subprocess.run(["xdg-open", path], check=False)
        except OSError:
            pass

    # ============================================================ SETTINGS
    def _load_settings(self):
        if not self.SETTINGS_FILE.exists():
            return
        try:
            d = json.loads(self.SETTINGS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return
        self.npd_path.set(d.get("npd_path", ""))
        self.track_path.set(d.get("track_path", ""))
        self.output_dir.set(d.get("output_dir", str(Path.cwd())))
        self.line_name.set(d.get("line_name", ""))
        self.planned_azimuth.set(d.get("planned_azimuth", ""))
        self.feathering_limit.set(d.get("feathering_limit", "0"))
        self.run_in_m.set(d.get("run_in_m", "0"))
        self.run_out_m.set(d.get("run_out_m", "0"))
        self.fast_match.set(bool(d.get("fast_match", False)))
        self.match_tolerance.set(d.get("match_tolerance", ""))
        self.open_after_run.set(bool(d.get("open_after_run", True)))
        self._toggle_tolerance()

    def _save_settings(self):
        d = {
            "npd_path": self.npd_path.get(),
            "track_path": self.track_path.get(),
            "output_dir": self.output_dir.get(),
            "line_name": self.line_name.get(),
            "planned_azimuth": self.planned_azimuth.get(),
            "feathering_limit": self.feathering_limit.get(),
            "run_in_m": self.run_in_m.get(),
            "run_out_m": self.run_out_m.get(),
            "fast_match": self.fast_match.get(),
            "match_tolerance": self.match_tolerance.get(),
            "open_after_run": self.open_after_run.get(),
        }
        try:
            self.SETTINGS_FILE.write_text(
                json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            pass

    def _write_log(self, path):
        try:
            Path(path).write_text("\n".join(self._log_buffer), encoding="utf-8")
        except OSError:
            self._log("Log file save failed", "error")


if __name__ == "__main__":
    app = FeatheringGUI()
    app.mainloop()
