#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPD Parser + Feathering Analysis v2 - Desktop GUI
"""

import json
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from pathlib import Path
import os
import subprocess
from datetime import datetime

import Parser_2 as analyzer


class FeatheringGUI(tk.Tk):
    SETTINGS_FILE = Path.home() / ".npd_feathering_gui.json"

    def __init__(self):
        super().__init__()
        self.title("NPD Parser + Feathering Analysis v2")
        self.geometry("920x720")
        self.resizable(True, True)
        self._log_buffer = []

        self._build_ui()
        self._load_settings()

    def _build_ui(self):
        self._apply_theme()

        container = ttk.Frame(self, padding=12)
        container.pack(fill="both", expand=True)

        header = ttk.Label(
            container,
            text="NPD Parser + Feathering Analysis v2",
            font=("Segoe UI", 16, "bold"),
        )
        header.pack(anchor="w", pady=(0, 12))

        subtitle = ttk.Label(
            container,
            text="NPD/Track 파일을 선택하고 분석 파라미터를 입력한 뒤 실행하세요.",
            font=("Segoe UI", 10),
        )
        subtitle.pack(anchor="w", pady=(0, 12))

        menu_bar = tk.Menu(self)
        file_menu = tk.Menu(menu_bar, tearoff=0)
        file_menu.add_command(label="설정 저장", command=self._save_settings)
        file_menu.add_separator()
        file_menu.add_command(label="종료", command=self.destroy)
        menu_bar.add_cascade(label="파일", menu=file_menu)

        help_menu = tk.Menu(menu_bar, tearoff=0)
        help_menu.add_command(label="정보", command=self._show_about)
        menu_bar.add_cascade(label="도움말", menu=help_menu)
        self.config(menu=menu_bar)

        notebook = ttk.Notebook(container)
        notebook.pack(fill="both", expand=True)

        input_tab = ttk.Frame(notebook, padding=8)
        options_tab = ttk.Frame(notebook, padding=8)
        log_tab = ttk.Frame(notebook, padding=8)
        results_tab = ttk.Frame(notebook, padding=8)

        notebook.add(input_tab, text="입력")
        notebook.add(options_tab, text="옵션/출력")
        notebook.add(log_tab, text="로그")
        notebook.add(results_tab, text="결과")

        file_frame = ttk.LabelFrame(input_tab, text="파일 선택", padding=10)
        file_frame.pack(fill="x", pady=(0, 12))

        self.npd_path = tk.StringVar()
        self.track_path = tk.StringVar()
        self.output_dir = tk.StringVar(value=str(Path.cwd()))
        self.line_name = tk.StringVar()

        self._file_row(file_frame, "NPD 파일", self.npd_path, self._select_npd)
        self._file_row(file_frame, "Track 파일", self.track_path, self._select_track)

        line_frame = ttk.Frame(file_frame)
        line_frame.pack(fill="x", pady=4)
        ttk.Label(line_frame, text="라인명", width=12).pack(side="left")
        ttk.Entry(line_frame, textvariable=self.line_name).pack(
            side="left", fill="x", expand=True, padx=(6, 6)
        )
        ttk.Label(
            line_frame,
            text="(비워두면 Track 파일명 사용)",
            foreground="#666666",
        ).pack(side="left")

        param_frame = ttk.LabelFrame(input_tab, text="분석 파라미터", padding=10)
        param_frame.pack(fill="x", pady=(0, 12))

        self.planned_azimuth = tk.StringVar()
        self.feathering_limit = tk.StringVar(value="0")
        self.run_in_m = tk.StringVar(value="0")
        self.run_out_m = tk.StringVar(value="0")
        self.fast_match = tk.BooleanVar(value=False)
        self.match_tolerance = tk.StringVar()
        self.open_after_run = tk.BooleanVar(value=True)

        self._param_row(param_frame, "계획 측선 (도)", self.planned_azimuth)
        self._param_row(param_frame, "Feathering 제한 (±도)", self.feathering_limit)
        self._param_row(param_frame, "Run-in 거리 (m)", self.run_in_m)
        self._param_row(param_frame, "Run-out 거리 (m)", self.run_out_m)

        options_frame = ttk.LabelFrame(options_tab, text="매칭 옵션", padding=10)
        options_frame.pack(fill="x", pady=(0, 12))

        output_frame = ttk.LabelFrame(options_tab, text="출력 설정", padding=10)
        output_frame.pack(fill="x", pady=(0, 12))

        self._file_row(output_frame, "출력 폴더", self.output_dir, self._select_output, is_dir=True)

        output_toggle = ttk.Checkbutton(
            output_frame,
            text="완료 후 결과 폴더 열기",
            variable=self.open_after_run,
        )
        output_toggle.pack(anchor="w", pady=(6, 0))

        options_inner = ttk.Frame(options_frame)
        options_inner.pack(fill="x", pady=(6, 0))

        fast_check = ttk.Checkbutton(
            options_inner,
            text="빠른 시간 매칭 사용",
            variable=self.fast_match,
            command=self._toggle_tolerance,
        )
        fast_check.pack(side="left")

        ttk.Label(options_inner, text="허용 시간차(초)").pack(side="left", padx=(12, 6))
        self.tolerance_entry = ttk.Entry(options_inner, textvariable=self.match_tolerance, width=10)
        self.tolerance_entry.pack(side="left")

        action_frame = ttk.Frame(container)
        action_frame.pack(fill="x", pady=(8, 8))

        self.run_button = ttk.Button(action_frame, text="분석 실행", command=self._run_analysis)
        self.run_button.pack(side="left")

        self.open_output_button = ttk.Button(
            action_frame, text="결과 폴더 열기", command=self._open_output_dir
        )
        self.open_output_button.pack(side="left", padx=(8, 0))

        self.progress = ttk.Progressbar(action_frame, mode="indeterminate")
        self.progress.pack(side="left", padx=(12, 0), fill="x", expand=True)

        log_frame = ttk.LabelFrame(log_tab, text="실행 로그", padding=10)
        log_frame.pack(fill="both", expand=True)

        self.log_text = tk.Text(log_frame, height=14, state="disabled")
        self.log_text.pack(side="left", fill="both", expand=True)

        log_scroll = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        log_scroll.pack(side="right", fill="y")
        self.log_text.configure(yscrollcommand=log_scroll.set)

        result_frame = ttk.LabelFrame(results_tab, text="생성된 결과 파일", padding=10)
        result_frame.pack(fill="both", expand=True)

        self.result_list = tk.Listbox(result_frame, height=10)
        self.result_list.pack(side="left", fill="both", expand=True)
        self.result_list.bind("<Double-Button-1>", self._open_selected_result)

        result_scroll = ttk.Scrollbar(result_frame, command=self.result_list.yview)
        result_scroll.pack(side="right", fill="y")
        self.result_list.configure(yscrollcommand=result_scroll.set)

        self.status_var = tk.StringVar(value="대기 중")
        status_bar = ttk.Label(self, textvariable=self.status_var, anchor="w")
        status_bar.pack(side="bottom", fill="x")

        self._toggle_tolerance()

    def _apply_theme(self):
        style = ttk.Style(self)
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure("TButton", padding=6)
        style.configure("TLabelFrame", padding=8)
        style.configure("TEntry", padding=4)

    def _show_about(self):
        messagebox.showinfo(
            "정보",
            "NPD Parser + Feathering Analysis v2\n"
            "Desktop GUI for feathering analysis.",
        )

    def _file_row(self, parent, label, var, command, is_dir=False):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text=label, width=12).pack(side="left")
        ttk.Entry(row, textvariable=var).pack(side="left", fill="x", expand=True, padx=(6, 6))
        button_label = "찾기" if not is_dir else "선택"
        ttk.Button(row, text=button_label, command=command).pack(side="left")

    def _param_row(self, parent, label, var):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text=label, width=18).pack(side="left")
        ttk.Entry(row, textvariable=var, width=20).pack(side="left")

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

    def _append_log(self, message):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", message + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")
        self._log_buffer.append(message)

    def _log(self, message):
        self.after(0, self._append_log, message)

    def _run_analysis(self):
        self._clear_results()
        if not self.npd_path.get() or not self.track_path.get():
            messagebox.showerror("입력 오류", "NPD 파일과 Track 파일을 모두 선택해주세요.")
            return

        try:
            planned_azimuth = float(self.planned_azimuth.get())
            feathering_limit = float(self.feathering_limit.get() or 0)
            run_in_m = float(self.run_in_m.get() or 0)
            run_out_m = float(self.run_out_m.get() or 0)
        except ValueError:
            messagebox.showerror("입력 오류", "숫자 파라미터를 올바르게 입력해주세요.")
            return

        match_tolerance = self.match_tolerance.get().strip()
        try:
            tolerance_value = float(match_tolerance) if match_tolerance else None
        except ValueError:
            messagebox.showerror("입력 오류", "허용 시간차는 숫자여야 합니다.")
            return

        self._save_settings()
        self.run_button.configure(state="disabled")
        self.progress.start(10)
        self._set_status("분석 실행 중...")
        self._log("분석을 시작합니다...")

        thread = threading.Thread(
            target=self._run_worker,
            args=(
                self.npd_path.get(),
                self.track_path.get(),
                self.output_dir.get(),
                self.line_name.get().strip(),
                planned_azimuth,
                feathering_limit,
                run_in_m,
                run_out_m,
                self.fast_match.get(),
                tolerance_value,
            ),
            daemon=True,
        )
        thread.start()

    def _run_worker(
        self,
        npd_file,
        track_file,
        output_dir,
        line_name_input,
        planned_azimuth,
        feathering_limit,
        run_in_m,
        run_out_m,
        fast_match,
        tolerance_value,
    ):
        try:
            os.makedirs(output_dir, exist_ok=True)

            line_name = line_name_input or Path(track_file).stem
            if "_track" in line_name.lower():
                line_name = line_name.split("_track")[0]

            self._log(f"NPD 파일 파싱: {Path(npd_file).name}")
            npd_df = analyzer.parse_npd_file(npd_file, target_positions=["Head_Buoy", "Tail_Buoy"])
            self._log("Track 파일 파싱 중...")
            track_df = analyzer.parse_track_file(track_file)

            if fast_match:
                self._log("빠른 시간 매칭 수행 중...")
                matched_df = analyzer.match_npd_with_track_fast(
                    npd_df, track_df, tolerance_s=tolerance_value
                )
            else:
                self._log("시간 매칭 수행 중...")
                matched_df = analyzer.match_npd_with_track(npd_df, track_df)

            if matched_df.empty:
                raise RuntimeError("매칭된 데이터가 없습니다.")

            self._log("Feathering 계산 중...")
            feathering = analyzer.calculate_feathering(matched_df, planned_azimuth)
            matched_df["Feathering"] = feathering

            csv_path = os.path.join(output_dir, f"{line_name}_feathering.csv")
            matched_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
            self._add_result_file(csv_path)

            self._log("그래프 생성 중...")
            plot_path = os.path.join(output_dir, f"{line_name}_feathering.png")
            stats = analyzer.plot_feathering(
                matched_df,
                feathering,
                planned_azimuth,
                run_in_m,
                run_out_m,
                feathering_limit,
                line_name,
                plot_path,
            )
            self._add_result_file(plot_path)

            self._log("Track plot 생성 중...")
            track_plot_path = os.path.join(output_dir, f"{line_name}_trackplot.png")
            analyzer.plot_track(matched_df, line_name, feathering, feathering_limit, track_plot_path)
            self._add_result_file(track_plot_path)

            self._log("리포트 생성 중...")
            report_path = os.path.join(output_dir, f"{line_name}_report.txt")
            analyzer.generate_report(
                matched_df,
                feathering,
                stats,
                planned_azimuth,
                run_in_m,
                run_out_m,
                line_name,
                feathering_limit,
                report_path,
            )
            self._add_result_file(report_path)

            log_path = os.path.join(
                output_dir, f"{line_name}_gui_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            )
            self._write_log_file(log_path)
            self._add_result_file(log_path)

            self._log("완료! 결과 파일이 생성되었습니다.")
            self._notify_success("분석이 완료되었습니다.")
            if self.open_after_run.get():
                self.after(0, self._open_output_dir)
        except Exception as exc:
            self._log(f"오류: {exc}")
            self._notify_error(str(exc))
        finally:
            self.after(0, self._finish_run)

    def _finish_run(self):
        self.progress.stop()
        self.run_button.configure(state="normal")
        self._set_status("대기 중")

    def _notify_success(self, message):
        self.after(0, messagebox.showinfo, "완료", message)

    def _notify_error(self, message):
        self.after(0, messagebox.showerror, "오류 발생", message)

    def _toggle_tolerance(self):
        state = "normal" if self.fast_match.get() else "disabled"
        self.tolerance_entry.configure(state=state)

    def _set_status(self, message):
        self.status_var.set(message)

    def _clear_results(self):
        self.result_list.delete(0, "end")

    def _add_result_file(self, path):
        self.after(0, self.result_list.insert, "end", path)

    def _open_selected_result(self, event):
        selection = self.result_list.curselection()
        if not selection:
            return
        path = self.result_list.get(selection[0])
        self._open_path(path)

    def _open_output_dir(self):
        output_dir = self.output_dir.get()
        if output_dir:
            self._open_path(output_dir)

    def _open_path(self, path):
        if not path:
            return
        if os.name == "nt":
            os.startfile(path)
        elif os.uname().sysname == "Darwin":
            subprocess.run(["open", path], check=False)
        else:
            subprocess.run(["xdg-open", path], check=False)

    def _load_settings(self):
        if not self.SETTINGS_FILE.exists():
            return
        try:
            data = json.loads(self.SETTINGS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
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
            self._log("⚠️  로그 파일 저장에 실패했습니다.")


if __name__ == "__main__":
    app = FeatheringGUI()
    app.mainloop()
