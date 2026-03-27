#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPD Parser + Feathering Analysis v2 - Desktop GUI
Professional dark-themed interface for seismic feathering analysis.
"""

import json
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from pathlib import Path
import os
import subprocess
import sys
from datetime import datetime
import time
import ctypes

import Parser_2 as analyzer

# ---------------------------------------------------------------------------
# Windows High-DPI awareness (must be called before any tk window)
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)   # Per-monitor V2
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Color palette & constants
# ---------------------------------------------------------------------------
COLORS = {
    "bg_dark": "#1e1e2e",
    "bg_mid": "#252536",
    "bg_light": "#2e2e42",
    "bg_input": "#33334d",
    "accent": "#7c8aff",
    "accent_hover": "#9aa4ff",
    "accent_active": "#5b6adf",
    "success": "#66d9a0",
    "warning": "#ffd866",
    "error": "#ff6b6b",
    "text": "#e0e0f0",
    "text_dim": "#8888aa",
    "text_bright": "#ffffff",
    "border": "#3e3e56",
    "scrollbar": "#44445e",
}

FONT_FAMILY = "Pretendard"
FONT_FALLBACKS = ["Pretendard", "Noto Sans KR", "Malgun Gothic",
                  "Apple SD Gothic Neo", "Segoe UI", "sans-serif"]
VERSION = "2.1"


class FeatheringGUI(tk.Tk):
    SETTINGS_FILE = Path.home() / ".npd_feathering_gui.json"

    # ------------------------------------------------------------------ init
    def __init__(self):
        super().__init__()
        self.title(f"NPD Feathering Analysis v{VERSION}")
        self.geometry("1000x760")
        self.minsize(860, 640)
        self.configure(bg=COLORS["bg_dark"])

        self._log_buffer: list[str] = []
        self._result_paths: list[str] = []
        self._start_time: float | None = None
        self._elapsed_timer: str | None = None
        self._running = False

        self._detect_font()
        self._build_ui()
        self._load_settings()
        self._bind_shortcuts()

    # --------------------------------------------------------- font detection
    def _detect_font(self):
        """Pick the first available font from FONT_FALLBACKS."""
        global FONT_FAMILY
        import tkinter.font as tkfont
        available = set(tkfont.families(self))
        for name in FONT_FALLBACKS:
            if name in available:
                FONT_FAMILY = name
                return
        FONT_FAMILY = "TkDefaultFont"

    # ----------------------------------------------------------- shortcuts
    def _bind_shortcuts(self):
        self.bind("<Control-r>", lambda _: self._run_analysis())
        self.bind("<Control-o>", lambda _: self._select_npd())
        self.bind("<Control-s>", lambda _: self._save_settings())

    # ----------------------------------------------------------- theme setup
    def _apply_theme(self):
        style = ttk.Style(self)
        if "clam" in style.theme_names():
            style.theme_use("clam")

        # General
        style.configure(".", background=COLORS["bg_dark"], foreground=COLORS["text"],
                         font=(FONT_FAMILY, 10))

        # Frames
        style.configure("TFrame", background=COLORS["bg_dark"])
        style.configure("Card.TFrame", background=COLORS["bg_mid"])

        # Labels
        style.configure("TLabel", background=COLORS["bg_dark"], foreground=COLORS["text"],
                         font=(FONT_FAMILY, 10))
        style.configure("Header.TLabel", font=(FONT_FAMILY, 18, "bold"),
                         foreground=COLORS["text_bright"], background=COLORS["bg_dark"])
        style.configure("Sub.TLabel", font=(FONT_FAMILY, 9),
                         foreground=COLORS["text_dim"], background=COLORS["bg_dark"])
        style.configure("CardTitle.TLabel", font=(FONT_FAMILY, 10),
                         foreground=COLORS["accent"], background=COLORS["bg_mid"])
        style.configure("Hint.TLabel", foreground=COLORS["text_dim"],
                         background=COLORS["bg_mid"], font=(FONT_FAMILY, 9))
        style.configure("Status.TLabel", background=COLORS["bg_light"],
                         foreground=COLORS["text_dim"], font=(FONT_FAMILY, 9),
                         padding=(8, 4))

        # LabelFrame
        style.configure("Card.TLabelframe", background=COLORS["bg_mid"],
                         foreground=COLORS["accent"], borderwidth=1, relief="solid")
        style.configure("Card.TLabelframe.Label", background=COLORS["bg_mid"],
                         foreground=COLORS["accent"], font=(FONT_FAMILY, 10))

        # Buttons
        style.configure("Accent.TButton", font=(FONT_FAMILY, 10, "bold"),
                         padding=(16, 8), background=COLORS["accent"],
                         foreground=COLORS["text_bright"], borderwidth=0)
        style.map("Accent.TButton",
                  background=[("active", COLORS["accent_hover"]),
                              ("disabled", COLORS["bg_light"])],
                  foreground=[("disabled", COLORS["text_dim"])])

        style.configure("Secondary.TButton", font=(FONT_FAMILY, 9),
                         padding=(10, 6), background=COLORS["bg_light"],
                         foreground=COLORS["text"], borderwidth=0)
        style.map("Secondary.TButton",
                  background=[("active", COLORS["border"])])

        style.configure("Small.TButton", font=(FONT_FAMILY, 9),
                         padding=(8, 4), background=COLORS["bg_light"],
                         foreground=COLORS["text"], borderwidth=0)
        style.map("Small.TButton",
                  background=[("active", COLORS["border"])])

        # Entry
        style.configure("TEntry", fieldbackground=COLORS["bg_input"],
                         foreground=COLORS["text"], insertcolor=COLORS["text"],
                         borderwidth=1, padding=5)

        # Notebook
        style.configure("TNotebook", background=COLORS["bg_dark"], borderwidth=0)
        style.configure("TNotebook.Tab", background=COLORS["bg_light"],
                         foreground=COLORS["text_dim"], padding=(14, 7),
                         font=(FONT_FAMILY, 9))
        style.map("TNotebook.Tab",
                  background=[("selected", COLORS["bg_mid"])],
                  foreground=[("selected", COLORS["accent"])])

        # Checkbutton
        style.configure("TCheckbutton", background=COLORS["bg_mid"],
                         foreground=COLORS["text"], font=(FONT_FAMILY, 9))
        style.map("TCheckbutton",
                  background=[("active", COLORS["bg_mid"])])

        # Progressbar
        style.configure("Accent.Horizontal.TProgressbar",
                         troughcolor=COLORS["bg_light"],
                         background=COLORS["accent"], borderwidth=0, thickness=6)

        # Scrollbar
        style.configure("Vertical.TScrollbar",
                         background=COLORS["scrollbar"],
                         troughcolor=COLORS["bg_mid"], borderwidth=0)

    # ----------------------------------------------------------- build UI
    def _build_ui(self):
        self._apply_theme()

        container = ttk.Frame(self, padding=16)
        container.pack(fill="both", expand=True)

        # Header
        header_frame = ttk.Frame(container)
        header_frame.pack(fill="x", pady=(0, 4))
        ttk.Label(header_frame, text="NPD Feathering Analysis",
                  style="Header.TLabel").pack(side="left")
        ttk.Label(header_frame, text=f"v{VERSION}",
                  style="Sub.TLabel").pack(side="left", padx=(8, 0), pady=(8, 0))

        ttk.Label(container,
                  text="NPD/Track 파일을 선택하고 분석 파라미터를 입력한 뒤 실행하세요.  "
                       "(Ctrl+R 실행 | Ctrl+O 파일 열기 | Ctrl+S 저장)",
                  style="Sub.TLabel").pack(anchor="w", pady=(0, 12))

        # Menu
        menu_bar = tk.Menu(self, bg=COLORS["bg_light"], fg=COLORS["text"],
                           activebackground=COLORS["accent"],
                           activeforeground=COLORS["text_bright"], borderwidth=0)
        file_menu = tk.Menu(menu_bar, tearoff=0, bg=COLORS["bg_light"],
                            fg=COLORS["text"], activebackground=COLORS["accent"],
                            activeforeground=COLORS["text_bright"])
        file_menu.add_command(label="설정 저장  (Ctrl+S)", command=self._save_settings)
        file_menu.add_separator()
        file_menu.add_command(label="종료", command=self.destroy)
        menu_bar.add_cascade(label="파일", menu=file_menu)

        help_menu = tk.Menu(menu_bar, tearoff=0, bg=COLORS["bg_light"],
                            fg=COLORS["text"], activebackground=COLORS["accent"],
                            activeforeground=COLORS["text_bright"])
        help_menu.add_command(label="정보", command=self._show_about)
        menu_bar.add_cascade(label="도움말", menu=help_menu)
        self.config(menu=menu_bar)

        # Notebook
        notebook = ttk.Notebook(container)
        notebook.pack(fill="both", expand=True, pady=(0, 8))

        input_tab = ttk.Frame(notebook, style="TFrame")
        options_tab = ttk.Frame(notebook, style="TFrame")
        log_tab = ttk.Frame(notebook, style="TFrame")
        results_tab = ttk.Frame(notebook, style="TFrame")

        notebook.add(input_tab, text="  입력  ")
        notebook.add(options_tab, text="  옵션 / 출력  ")
        notebook.add(log_tab, text="  로그  ")
        notebook.add(results_tab, text="  결과  ")
        self._notebook = notebook

        # --- INPUT TAB ---
        self.npd_path = tk.StringVar()
        self.track_path = tk.StringVar()
        self.output_dir = tk.StringVar(value=str(Path.cwd()))
        self.line_name = tk.StringVar()

        file_card = self._card(input_tab, "파일 선택")
        self._file_row(file_card, "NPD 파일", self.npd_path, self._select_npd)
        self._file_row(file_card, "Track 파일", self.track_path, self._select_track)

        line_row = ttk.Frame(file_card, style="Card.TFrame")
        line_row.pack(fill="x", pady=(4, 2))
        ttk.Label(line_row, text="라인명", width=12,
                  style="TLabel", background=COLORS["bg_mid"]).pack(side="left")
        ttk.Entry(line_row, textvariable=self.line_name).pack(
            side="left", fill="x", expand=True, padx=(6, 6))
        ttk.Label(line_row, text="비워두면 Track 파일명 사용",
                  style="Hint.TLabel").pack(side="left")

        self.planned_azimuth = tk.StringVar()
        self.feathering_limit = tk.StringVar(value="0")
        self.run_in_m = tk.StringVar(value="0")
        self.run_out_m = tk.StringVar(value="0")

        param_card = self._card(input_tab, "분석 파라미터")
        self._param_row(param_card, "계획 방위각 (°)", self.planned_azimuth,
                        hint="북쪽 기준 시계방향")
        self._param_row(param_card, "Feathering 제한 (±°)", self.feathering_limit,
                        hint="0 = 표시 안 함")
        self._param_row(param_card, "Run-in 거리 (m)", self.run_in_m)
        self._param_row(param_card, "Run-out 거리 (m)", self.run_out_m)

        # --- OPTIONS TAB ---
        self.fast_match = tk.BooleanVar(value=False)
        self.match_tolerance = tk.StringVar()
        self.open_after_run = tk.BooleanVar(value=True)

        match_card = self._card(options_tab, "매칭 옵션")
        opts_inner = ttk.Frame(match_card, style="Card.TFrame")
        opts_inner.pack(fill="x", pady=(4, 2))
        ttk.Checkbutton(opts_inner, text="빠른 시간 매칭 사용",
                        variable=self.fast_match,
                        command=self._toggle_tolerance).pack(side="left")
        ttk.Label(opts_inner, text="허용 시간차 (초)",
                  background=COLORS["bg_mid"]).pack(side="left", padx=(16, 6))
        self.tolerance_entry = ttk.Entry(opts_inner, textvariable=self.match_tolerance,
                                         width=10)
        self.tolerance_entry.pack(side="left")

        output_card = self._card(options_tab, "출력 설정")
        self._file_row(output_card, "출력 폴더", self.output_dir,
                       self._select_output, is_dir=True)
        ttk.Checkbutton(output_card, text="완료 후 결과 폴더 열기",
                        variable=self.open_after_run).pack(anchor="w", pady=(6, 0))

        # --- LOG TAB ---
        log_card = self._card(log_tab, "실행 로그", expand=True)
        log_inner = ttk.Frame(log_card, style="Card.TFrame")
        log_inner.pack(fill="both", expand=True)

        self.log_text = tk.Text(
            log_inner, height=16, state="disabled", wrap="word",
            bg=COLORS["bg_dark"], fg=COLORS["text"],
            insertbackground=COLORS["text"], selectbackground=COLORS["accent"],
            font=("Consolas", 10), borderwidth=0, padx=8, pady=8,
        )
        self.log_text.pack(side="left", fill="both", expand=True)
        self.log_text.tag_configure("timestamp", foreground=COLORS["text_dim"])
        self.log_text.tag_configure("success", foreground=COLORS["success"])
        self.log_text.tag_configure("error", foreground=COLORS["error"])
        self.log_text.tag_configure("info", foreground=COLORS["accent"])

        log_scroll = ttk.Scrollbar(log_inner, command=self.log_text.yview)
        log_scroll.pack(side="right", fill="y")
        self.log_text.configure(yscrollcommand=log_scroll.set)

        # --- RESULTS TAB ---
        result_card = self._card(results_tab, "생성된 결과 파일", expand=True)
        ttk.Label(result_card, text="더블클릭으로 파일을 열 수 있습니다.",
                  style="Hint.TLabel").pack(anchor="w", pady=(0, 4))

        result_inner = ttk.Frame(result_card, style="Card.TFrame")
        result_inner.pack(fill="both", expand=True)

        self.result_list = tk.Listbox(
            result_inner, height=10,
            bg=COLORS["bg_dark"], fg=COLORS["text"],
            selectbackground=COLORS["accent"],
            selectforeground=COLORS["text_bright"],
            font=("Consolas", 10), borderwidth=0, activestyle="none",
            highlightthickness=0,
        )
        self.result_list.pack(side="left", fill="both", expand=True)
        self.result_list.bind("<Double-Button-1>", self._open_selected_result)

        result_scroll = ttk.Scrollbar(result_inner, command=self.result_list.yview)
        result_scroll.pack(side="right", fill="y")
        self.result_list.configure(yscrollcommand=result_scroll.set)

        # --- ACTION BAR ---
        action_frame = ttk.Frame(container)
        action_frame.pack(fill="x", pady=(0, 0))

        self.run_button = ttk.Button(action_frame, text="  분석 실행  ",
                                     style="Accent.TButton",
                                     command=self._run_analysis)
        self.run_button.pack(side="left")

        self.open_output_button = ttk.Button(action_frame, text="결과 폴더 열기",
                                              style="Secondary.TButton",
                                              command=self._open_output_dir)
        self.open_output_button.pack(side="left", padx=(8, 0))

        self.progress = ttk.Progressbar(action_frame, mode="indeterminate",
                                         style="Accent.Horizontal.TProgressbar")
        self.progress.pack(side="left", padx=(16, 0), fill="x", expand=True)

        # --- STATUS BAR ---
        self.status_var = tk.StringVar(value="Ready")
        self.elapsed_var = tk.StringVar(value="")
        status_frame = ttk.Frame(self, style="TFrame")
        status_frame.pack(side="bottom", fill="x")

        status_inner = tk.Frame(status_frame, bg=COLORS["bg_light"], height=28)
        status_inner.pack(fill="x")
        tk.Label(status_inner, textvariable=self.status_var, anchor="w",
                 bg=COLORS["bg_light"], fg=COLORS["text_dim"],
                 font=(FONT_FAMILY, 9), padx=10).pack(side="left")
        tk.Label(status_inner, textvariable=self.elapsed_var, anchor="e",
                 bg=COLORS["bg_light"], fg=COLORS["text_dim"],
                 font=(FONT_FAMILY, 9), padx=10).pack(side="right")

        self._toggle_tolerance()

    # ----------------------------------------------------------- card helper
    def _card(self, parent, title, expand=False):
        frame = ttk.LabelFrame(parent, text=f"  {title}  ", style="Card.TLabelframe",
                                padding=12)
        frame.pack(fill="both" if expand else "x", expand=expand, pady=(8, 4))
        return frame

    # ----------------------------------------------------------- row helpers
    def _file_row(self, parent, label, var, command, is_dir=False):
        row = ttk.Frame(parent, style="Card.TFrame")
        row.pack(fill="x", pady=(4, 2))
        ttk.Label(row, text=label, width=12,
                  background=COLORS["bg_mid"]).pack(side="left")
        ttk.Entry(row, textvariable=var).pack(
            side="left", fill="x", expand=True, padx=(6, 6))
        ttk.Button(row, text="선택" if is_dir else "찾기",
                   style="Small.TButton", command=command).pack(side="left")

    def _param_row(self, parent, label, var, hint=None):
        row = ttk.Frame(parent, style="Card.TFrame")
        row.pack(fill="x", pady=(4, 2))
        ttk.Label(row, text=label, width=20,
                  background=COLORS["bg_mid"]).pack(side="left")
        ttk.Entry(row, textvariable=var, width=18).pack(side="left")
        if hint:
            ttk.Label(row, text=hint, style="Hint.TLabel").pack(side="left", padx=(8, 0))

    # ----------------------------------------------------------- dialogs
    def _select_npd(self):
        path = filedialog.askopenfilename(title="NPD 파일 선택")
        if path:
            self.npd_path.set(path)

    def _select_track(self):
        path = filedialog.askopenfilename(title="Track 파일 선택")
        if path:
            self.track_path.set(path)

    def _select_output(self):
        path = filedialog.askdirectory(title="출력 폴더 선택")
        if path:
            self.output_dir.set(path)

    def _show_about(self):
        messagebox.showinfo(
            "정보",
            f"NPD Parser + Feathering Analysis v{VERSION}\n\n"
            "해양 탄성파 탐사 페더링 분석 도구\n"
            "Seismic Survey Feathering Analysis Tool",
        )

    # ----------------------------------------------------------- logging
    def _append_log(self, message, tag="info"):
        self.log_text.configure(state="normal")
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{ts}] ", "timestamp")
        self.log_text.insert("end", message + "\n", tag)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        self._log_buffer.append(f"[{ts}] {message}")

    def _log(self, message, tag="info"):
        self.after(0, self._append_log, message, tag)

    def _clear_log(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._log_buffer.clear()

    # ----------------------------------------------------------- validation
    def _validate_inputs(self):
        """Validate all inputs before starting analysis. Returns parsed tuple or None."""
        npd = self.npd_path.get().strip()
        track = self.track_path.get().strip()

        if not npd or not track:
            messagebox.showerror("입력 오류", "NPD 파일과 Track 파일을 모두 선택해주세요.")
            return None

        if not os.path.isfile(npd):
            messagebox.showerror("입력 오류", f"NPD 파일을 찾을 수 없습니다:\n{npd}")
            return None

        if not os.path.isfile(track):
            messagebox.showerror("입력 오류", f"Track 파일을 찾을 수 없습니다:\n{track}")
            return None

        try:
            planned_azimuth = float(self.planned_azimuth.get())
        except ValueError:
            messagebox.showerror("입력 오류", "계획 방위각을 올바르게 입력해주세요.")
            return None

        try:
            feathering_limit = float(self.feathering_limit.get() or 0)
            run_in_m = float(self.run_in_m.get() or 0)
            run_out_m = float(self.run_out_m.get() or 0)
        except ValueError:
            messagebox.showerror("입력 오류", "숫자 파라미터를 올바르게 입력해주세요.")
            return None

        tol_str = self.match_tolerance.get().strip()
        try:
            tolerance_value = float(tol_str) if tol_str else None
        except ValueError:
            messagebox.showerror("입력 오류", "허용 시간차는 숫자여야 합니다.")
            return None

        return (npd, track, planned_azimuth, feathering_limit,
                run_in_m, run_out_m, tolerance_value)

    # ----------------------------------------------------------- analysis
    def _run_analysis(self):
        if self._running:
            return

        params = self._validate_inputs()
        if params is None:
            return

        (npd, track, planned_azimuth, feathering_limit,
         run_in_m, run_out_m, tolerance_value) = params

        # Reset state
        self._clear_results()
        self._clear_log()
        self._result_paths.clear()

        self._save_settings()
        self._running = True
        self.run_button.configure(state="disabled")
        self.progress.start(10)
        self._start_time = time.time()
        self._set_status("분석 실행 중...")
        self._update_elapsed()
        self._notebook.select(2)  # log tab

        self._log("분석을 시작합니다...", "info")

        thread = threading.Thread(
            target=self._run_worker,
            args=(
                npd, track,
                self.output_dir.get(),
                self.line_name.get().strip(),
                planned_azimuth, feathering_limit,
                run_in_m, run_out_m,
                self.fast_match.get(), tolerance_value,
            ),
            daemon=True,
        )
        thread.start()

    def _update_elapsed(self):
        if self._start_time is None:
            return
        elapsed = time.time() - self._start_time
        mins, secs = divmod(int(elapsed), 60)
        self.elapsed_var.set(f"Elapsed: {mins:02d}:{secs:02d}")
        self._elapsed_timer = self.after(1000, self._update_elapsed)

    def _cancel_elapsed_timer(self):
        if self._elapsed_timer is not None:
            self.after_cancel(self._elapsed_timer)
            self._elapsed_timer = None

    def _run_worker(
        self, npd_file, track_file, output_dir, line_name_input,
        planned_azimuth, feathering_limit, run_in_m, run_out_m,
        fast_match, tolerance_value,
    ):
        try:
            os.makedirs(output_dir, exist_ok=True)

            line_name = line_name_input or Path(track_file).stem
            if "_track" in line_name.lower():
                line_name = line_name.split("_track")[0]

            self._log(f"NPD 파싱: {Path(npd_file).name}")
            npd_df = analyzer.parse_npd_file(
                npd_file, target_positions=["Head_Buoy", "Tail_Buoy"])
            self._log(f"  {len(npd_df):,} 레코드 파싱됨", "success")

            self._log(f"Track 파싱: {Path(track_file).name}")
            track_df = analyzer.parse_track_file(track_file)
            self._log(f"  {len(track_df):,} 레코드 로드됨", "success")

            if fast_match:
                self._log("빠른 시간 매칭 수행 중...")
                matched_df = analyzer.match_npd_with_track_fast(
                    npd_df, track_df, tolerance_s=tolerance_value)
            else:
                self._log("시간 매칭 수행 중...")
                matched_df = analyzer.match_npd_with_track(npd_df, track_df)

            if matched_df.empty:
                raise RuntimeError("매칭된 데이터가 없습니다. 시간 범위를 확인하세요.")

            self._log(f"  {len(matched_df):,} 레코드 매칭됨", "success")

            self._log("Feathering 계산 중...")
            feathering = analyzer.calculate_feathering(matched_df, planned_azimuth)
            matched_df["Feathering"] = feathering

            csv_path = os.path.join(output_dir, f"{line_name}_feathering.csv")
            matched_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
            self._add_result_file(csv_path)
            self._log("  CSV 저장 완료", "success")

            self._log("Feathering 그래프 생성 중...")
            plot_path = os.path.join(output_dir, f"{line_name}_feathering.png")
            stats = analyzer.plot_feathering(
                matched_df, feathering, planned_azimuth,
                run_in_m, run_out_m, feathering_limit, line_name, plot_path,
            )
            self._add_result_file(plot_path)
            self._log(f"  Mean: {stats['mean']:.2f}\u00b0  Std: {stats['std']:.2f}\u00b0", "info")

            self._log("Track plot 생성 중...")
            track_plot_path = os.path.join(output_dir, f"{line_name}_trackplot.png")
            analyzer.plot_track(matched_df, line_name, feathering,
                                feathering_limit, track_plot_path)
            self._add_result_file(track_plot_path)

            self._log("리포트 생성 중...")
            report_path = os.path.join(output_dir, f"{line_name}_report.txt")
            analyzer.generate_report(
                matched_df, feathering, stats, planned_azimuth,
                run_in_m, run_out_m, line_name, feathering_limit, report_path,
            )
            self._add_result_file(report_path)

            log_path = os.path.join(
                output_dir,
                f"{line_name}_gui_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            )
            self._write_log_file(log_path)
            self._add_result_file(log_path)

            self._log("분석이 성공적으로 완료되었습니다.", "success")
            self._notify_success("분석이 완료되었습니다.")
            if self.open_after_run.get():
                self.after(0, self._open_output_dir)
            self.after(0, lambda: self._notebook.select(3))
        except Exception as exc:
            self._log(f"오류: {exc}", "error")
            self._notify_error(str(exc))
        finally:
            self.after(0, self._finish_run)

    def _finish_run(self):
        self.progress.stop()
        self.run_button.configure(state="normal")
        self._cancel_elapsed_timer()
        if self._start_time:
            elapsed = time.time() - self._start_time
            mins, secs = divmod(int(elapsed), 60)
            self.elapsed_var.set(f"Completed in {mins:02d}:{secs:02d}")
        self._start_time = None
        self._running = False
        self._set_status("Ready")

    # ----------------------------------------------------------- notifications
    def _notify_success(self, message):
        self.after(0, messagebox.showinfo, "완료", message)

    def _notify_error(self, message):
        self.after(0, messagebox.showerror, "오류 발생", message)

    # ----------------------------------------------------------- UI helpers
    def _toggle_tolerance(self):
        state = "normal" if self.fast_match.get() else "disabled"
        self.tolerance_entry.configure(state=state)

    def _set_status(self, message):
        self.status_var.set(message)

    def _clear_results(self):
        self.result_list.delete(0, "end")
        self._result_paths.clear()

    def _add_result_file(self, path):
        self._result_paths.append(path)
        filename = Path(path).name
        ext = Path(path).suffix.upper()
        display = f"  [{ext[1:]:>4}]  {filename}"
        self.after(0, self.result_list.insert, "end", display)

    def _open_selected_result(self, event):
        selection = self.result_list.curselection()
        if not selection:
            return
        idx = selection[0]
        if idx < len(self._result_paths):
            self._open_path(self._result_paths[idx])

    def _open_output_dir(self):
        output_dir = self.output_dir.get()
        if output_dir:
            self._open_path(output_dir)

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

    # ----------------------------------------------------------- settings
    def _load_settings(self):
        if not self.SETTINGS_FILE.exists():
            return
        try:
            data = json.loads(self.SETTINGS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return

        self.npd_path.set(data.get("npd_path", ""))
        self.track_path.set(data.get("track_path", ""))
        self.output_dir.set(data.get("output_dir", str(Path.cwd())))
        self.line_name.set(data.get("line_name", ""))
        self.planned_azimuth.set(data.get("planned_azimuth", ""))
        self.feathering_limit.set(data.get("feathering_limit", "0"))
        self.run_in_m.set(data.get("run_in_m", "0"))
        self.run_out_m.set(data.get("run_out_m", "0"))
        self.fast_match.set(bool(data.get("fast_match", False)))
        self.match_tolerance.set(data.get("match_tolerance", ""))
        self.open_after_run.set(bool(data.get("open_after_run", True)))
        self._toggle_tolerance()

    def _save_settings(self):
        data = {
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
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except OSError:
            pass

    def _write_log_file(self, path):
        try:
            content = "\n".join(self._log_buffer)
            Path(path).write_text(content, encoding="utf-8")
        except OSError:
            self._log("로그 파일 저장에 실패했습니다.", "error")


if __name__ == "__main__":
    app = FeatheringGUI()
    app.mainloop()
