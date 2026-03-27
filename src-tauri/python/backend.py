#!/usr/bin/env python3
"""
Feathering Analysis Backend — NDJSON stdin/stdout wrapper for Parser_2.
Tauri sidecar로 실행됨. JSON 명령을 받아 분석 수행 후 JSON 응답 반환.
"""

import sys
import json
import traceback
import os
from pathlib import Path

import numpy as np

# Parser_2가 같은 디렉토리에 있어야 함
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import Parser_2 as analyzer


def emit(obj: dict):
    """JSON 한 줄을 stdout으로 출력 (ASCII-safe for Windows cp949 compatibility)."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=True, default=_json_default) + "\n")
    sys.stdout.flush()


def _json_default(o):
    """numpy 타입 JSON 직렬화."""
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"Object of type {type(o)} is not JSON serializable")


def progress(step: str, message: str, percent: int | None = None):
    """진행 상황 이벤트 발행."""
    emit({
        "id": None,
        "event": "progress",
        "data": {"step": step, "message": message, "percent": percent},
    })


def handle_ping(_params: dict) -> dict:
    return {"pong": True, "version": "3.0.0"}


def handle_scan_headers(params: dict) -> dict:
    path = params["path"]
    headers = analyzer.scan_npd_headers(path)
    return {"headers": headers}


def handle_run_analysis(params: dict) -> dict:
    npd_path = params["npd_path"]
    track_path = params["track_path"]
    output_dir = params.get("output_dir", "")
    line_name = params.get("line_name", "")
    planned_azimuth = float(params.get("planned_azimuth", 0))
    feathering_limit = float(params.get("feathering_limit", 0))
    run_in_m = float(params.get("run_in_m", 0))
    run_out_m = float(params.get("run_out_m", 0))
    fast_match = bool(params.get("fast_match", False))
    tolerance_s = params.get("tolerance_s")
    if tolerance_s is not None:
        tolerance_s = float(tolerance_s)
    head_position = params.get("head_position", "Head_Buoy")
    tail_position = params.get("tail_position", "Tail_Buoy")

    # Line name 자동 감지
    if not line_name:
        line_name = Path(track_path).stem
        if "_track" in line_name.lower():
            line_name = line_name.split("_track")[0]

    # Output dir 생성
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    else:
        output_dir = str(Path(track_path).parent)

    target_positions = [head_position, tail_position]

    # 1. Parse NPD (진행률 콜백 연동)
    def npd_progress(pct, msg):
        # NPD 파싱은 전체의 0~30% 구간
        scaled = int(pct * 0.30)
        progress("parsing_npd", msg, scaled)

    progress("parsing_npd", f"NPD 파일 파싱 중: {Path(npd_path).name}", 0)
    npd_df = analyzer.parse_npd_file(npd_path, target_positions=target_positions,
                                      progress_cb=npd_progress)

    # 2. Parse Track
    progress("parsing_track", f"Track 파일 파싱 중: {Path(track_path).name}", 32)
    track_df = analyzer.parse_track_file(track_path)

    # 3. Time Matching
    progress("matching", "시간 매칭 중...", 45)
    if fast_match:
        matched = analyzer.match_npd_with_track_fast(npd_df, track_df, tolerance_s=tolerance_s)
    else:
        matched = analyzer.match_npd_with_track(npd_df, track_df)

    if matched.empty:
        raise ValueError("매칭 결과가 비어있습니다. 시간 범위를 확인하세요.")

    # 4. Calculate feathering
    progress("calculating", "Feathering 각도 계산 중...", 55)
    feathering = analyzer.calculate_feathering(matched, planned_azimuth)
    matched["Feathering"] = feathering

    # 5. Save CSV
    progress("saving_csv", "CSV 저장 중...", 65)
    csv_path = os.path.join(output_dir, f"{line_name}_feathering.csv")
    matched.to_csv(csv_path, index=False, encoding="utf-8-sig")

    # 6. Plot feathering
    progress("plotting_feathering", "Feathering 플롯 생성 중...", 75)
    plot_path = os.path.join(output_dir, f"{line_name}_feathering.png")
    stats = analyzer.plot_feathering(
        matched, feathering, planned_azimuth,
        run_in_m, run_out_m, feathering_limit,
        line_name, plot_path,
    )

    # 7. Plot track
    progress("plotting_track", "Track 플롯 생성 중...", 85)
    track_plot_path = os.path.join(output_dir, f"{line_name}_trackplot.png")
    analyzer.plot_track(matched, line_name, feathering, feathering_limit, track_plot_path)

    # 8. Histogram
    progress("plotting_histogram", "히스토그램 생성 중...", 88)
    histogram_path = os.path.join(output_dir, f"{line_name}_histogram.png")
    try:
        analyzer.plot_histogram(feathering, feathering_limit, line_name, histogram_path)
    except Exception as e:
        progress("histogram_warning", f"히스토그램 생성 실패 (무시): {e}", 89)
        histogram_path = None

    # 9. Generate report
    progress("generating_report", "보고서 생성 중...", 92)
    report_path = os.path.join(output_dir, f"{line_name}_report.txt")
    analyzer.generate_report(
        matched, feathering, stats, planned_azimuth,
        run_in_m, run_out_m, line_name, feathering_limit, report_path,
    )

    # 결과를 먼저 반환하고, PDF는 후속 생성
    progress("done", "분석 완료!", 100)

    # 차트 데이터 (React 인터랙티브 차트용)
    # 대용량 데이터 시 decimation은 프론트에서 처리
    exceeded_mask = (
        (np.abs(feathering) > feathering_limit) if feathering_limit > 0
        else np.zeros(len(feathering), dtype=bool)
    )

    chart_data = {
        "ffid": matched["FFID"].tolist() if "FFID" in matched.columns else list(range(len(matched))),
        "feathering": feathering.tolist(),
        "sou_x": matched["SOU_X"].tolist() if "SOU_X" in matched.columns else [],
        "sou_y": matched["SOU_Y"].tolist() if "SOU_Y" in matched.columns else [],
        "front_x": matched["FRONT_X"].tolist() if "FRONT_X" in matched.columns else [],
        "front_y": matched["FRONT_Y"].tolist() if "FRONT_Y" in matched.columns else [],
        "tail_x": matched["TAIL_X"].tolist() if "TAIL_X" in matched.columns else [],
        "tail_y": matched["TAIL_Y"].tolist() if "TAIL_Y" in matched.columns else [],
    }

    # PDF 백그라운드 생성
    pdf_path = os.path.join(output_dir, f"{line_name}_report.pdf")
    try:
        _generate_pdf(pdf_path, plot_path, track_plot_path,
                       line_name, planned_azimuth, feathering_limit, feathering,
                       histogram_path=histogram_path)
    except Exception:
        pdf_path = None

    output_files = [csv_path, plot_path, track_plot_path, report_path]
    if histogram_path and os.path.exists(histogram_path):
        output_files.append(histogram_path)
    if pdf_path and os.path.exists(pdf_path):
        output_files.append(pdf_path)
    output_files = [f for f in output_files if os.path.exists(f)]

    # Run-in/Run-out FFID 경계 계산 (프론트엔드 차트용)
    ffid_arr = matched["FFID"].values if "FFID" in matched.columns else np.arange(len(matched))
    distance_m = analyzer.calculate_distance_along_line(matched) * 1000.0
    total_dist = distance_m[-1] if len(distance_m) > 0 else 0

    run_in_ffid = None
    run_out_ffid = None
    if run_in_m > 0 and len(distance_m) > 0:
        idx = int(np.searchsorted(distance_m, run_in_m))
        run_in_ffid = int(ffid_arr[min(idx, len(ffid_arr) - 1)])
    if run_out_m > 0 and total_dist > 0:
        idx = int(np.searchsorted(distance_m, total_dist - run_out_m))
        run_out_ffid = int(ffid_arr[min(idx, len(ffid_arr) - 1)])

    return {
        "stats": {
            "mean": float(stats.get("mean", np.mean(feathering))),
            "std": float(stats.get("std", np.std(feathering))),
            "min": float(np.min(feathering)),
            "max": float(np.max(feathering)),
            "range": float(np.ptp(feathering)),
            "total_records": len(feathering),
            "exceeded_count": int(np.sum(exceeded_mask)),
            "exceeded_percent": float(np.sum(exceeded_mask) / len(feathering) * 100) if len(feathering) > 0 else 0,
            "run_in_ffid": run_in_ffid,
            "run_out_ffid": run_out_ffid,
        },
        "chart_data": chart_data,
        "output_files": output_files,
    }


def _generate_pdf(pdf_path, plot_path, track_plot_path,
                   line_name, planned_azimuth, feathering_limit, feathering,
                   histogram_path=None):
    """PDF 보고서 생성 (별도 함수로 분리)."""
    from matplotlib.backends.backend_pdf import PdfPages
    import matplotlib.pyplot as plt

    with PdfPages(pdf_path) as pdf:
        # Page 1: Stats + Feathering plot
        fig = plt.figure(figsize=(16, 10))
        fig.suptitle(f"Feathering Analysis Report — {line_name}",
                     fontsize=14, fontweight="bold", y=0.98, color="white")
        ax_text = fig.add_axes([0.05, 0.82, 0.9, 0.12])
        ax_text.axis("off")
        stats_str = (
            f"Planned Azimuth: {planned_azimuth:.1f}°    "
            f"Feathering Limit: {feathering_limit:.1f}°    "
            f"Records: {len(feathering):,}\n"
            f"Mean: {np.mean(feathering):.3f}°    "
            f"Std: {np.std(feathering):.3f}°    "
            f"Min: {np.min(feathering):.3f}°    "
            f"Max: {np.max(feathering):.3f}°    "
            f"Range: {np.ptp(feathering):.3f}°"
        )
        ax_text.text(0, 0.5, stats_str, fontsize=9, fontfamily="monospace",
                     color="white", va="center",
                     bbox=dict(boxstyle="round,pad=0.5", facecolor="#1c2333", edgecolor="#30363d"))
        feathering_img = plt.imread(plot_path)
        ax_plot = fig.add_axes([0.02, 0.02, 0.96, 0.78])
        ax_plot.imshow(feathering_img)
        ax_plot.axis("off")
        pdf.savefig(fig, facecolor="#0d1117")
        plt.close(fig)
        # Page 2: Track plot
        fig2 = plt.figure(figsize=(14, 12))
        track_img = plt.imread(track_plot_path)
        ax2 = fig2.add_axes([0.02, 0.02, 0.96, 0.96])
        ax2.imshow(track_img)
        ax2.axis("off")
        pdf.savefig(fig2, facecolor="#0d1117")
        plt.close(fig2)
        # Page 3: Histogram
        if histogram_path and os.path.exists(histogram_path):
            fig3 = plt.figure(figsize=(16, 9))
            hist_img = plt.imread(histogram_path)
            ax3 = fig3.add_axes([0.02, 0.02, 0.96, 0.96])
            ax3.imshow(hist_img)
            ax3.axis("off")
            pdf.savefig(fig3, facecolor="#0d1117")
            plt.close(fig3)


def handle_estimate_azimuth(params: dict) -> dict:
    """Track 데이터에서 계획 방위각을 빠르게 추정.

    Track 파일만 사용 — NPD 파싱/매칭 없이 즉시 결과 반환.
    """
    track_path = params.get("track_path")
    trim_pct = params.get("trim_pct", 20)

    if not track_path:
        raise ValueError("track_path가 필요합니다.")

    track_df = analyzer.parse_track_file(track_path)
    result = analyzer.estimate_planned_azimuth(track_df, trim_pct=trim_pct)
    return result


def handle_scan_folder(params: dict) -> dict:
    """폴더 내 NPD+Track 파일 쌍을 자동 탐지."""
    folder = params["folder"]
    import glob

    npd_files = glob.glob(os.path.join(folder, "**", "*.NPD"), recursive=True)
    npd_files += glob.glob(os.path.join(folder, "**", "*.npd"), recursive=True)

    track_files = glob.glob(os.path.join(folder, "**", "*track*"), recursive=True)
    track_files += glob.glob(os.path.join(folder, "**", "*Track*"), recursive=True)
    track_files = [f for f in track_files if not f.endswith((".png", ".pdf"))]

    return {
        "npd_files": sorted(set(npd_files)),
        "track_files": sorted(set(track_files)),
    }


def handle_batch_analysis(params: dict) -> dict:
    """여러 라인을 순차 분석."""
    jobs = params["jobs"]  # list of {npd_path, track_path, ...}
    results = []

    for i, job in enumerate(jobs):
        progress("batch", f"배치 {i+1}/{len(jobs)}: {job.get('line_name', '...')}", int((i / len(jobs)) * 100))
        try:
            result = handle_run_analysis(job)
            results.append({
                "line_name": job.get("line_name", f"Job_{i+1}"),
                "status": "success",
                "stats": result["stats"],
                "output_files": result["output_files"],
            })
        except Exception as e:
            results.append({
                "line_name": job.get("line_name", f"Job_{i+1}"),
                "status": "error",
                "error": str(e),
            })

    progress("done", f"배치 완료! {len(results)}개 라인 처리", 100)

    passed = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "results": results,
    }


# 메서드 레지스트리
METHODS = {
    "ping": handle_ping,
    "scan_headers": handle_scan_headers,
    "run_analysis": handle_run_analysis,
    "estimate_azimuth": handle_estimate_azimuth,
    "scan_folder": handle_scan_folder,
    "batch_analysis": handle_batch_analysis,
}


def main():
    """메인 루프: stdin에서 JSON 한 줄씩 읽고 처리."""
    # Windows cp949 문제 방지: stdout/stdin을 UTF-8로 강제
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")

    sys.stderr.write("[backend] Feathering Analysis Backend started.\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        msg_id = None
        try:
            msg = json.loads(line)
            msg_id = msg.get("id")
            method_name = msg.get("method", "")
            params = msg.get("params", {})

            handler = METHODS.get(method_name)
            if not handler:
                emit({"id": msg_id, "error": f"Unknown method: {method_name}"})
                continue

            result = handler(params)
            emit({"id": msg_id, "result": result})

        except Exception as e:
            emit({
                "id": msg_id,
                "error": str(e),
                "traceback": traceback.format_exc(),
            })


if __name__ == "__main__":
    main()
