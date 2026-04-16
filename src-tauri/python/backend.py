#!/usr/bin/env python3
"""
Feathering Analysis Backend — NDJSON stdin/stdout wrapper for Parser_2.
Tauri sidecar로 실행됨. JSON 명령을 받아 분석 수행 후 JSON 응답 반환.
"""

import sys
import json
import traceback
import os
import re
from datetime import datetime
from difflib import SequenceMatcher
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


def _suggest_header_positions(headers: list[str]) -> tuple[str | None, str | None]:
    """Suggest sensible head/tail defaults from scanned NPD headers."""
    if not headers:
        return None, None

    exact_head = next((header for header in headers if header == "Head_Buoy"), None)
    exact_tail = next((header for header in headers if header == "Tail_Buoy"), None)
    if exact_head and exact_tail and exact_head != exact_tail:
        return exact_head, exact_tail

    head_match = next((header for header in headers if re.search(r"head|front", header, re.I)), None)
    tail_match = next((header for header in headers if re.search(r"tail|rear|end", header, re.I)), None)
    if head_match and tail_match and head_match != tail_match:
        return head_match, tail_match

    if len(headers) >= 2:
        return headers[0], headers[1]
    return headers[0], None


def handle_scan_headers(params: dict) -> dict:
    path = params["path"]
    headers = analyzer.scan_npd_headers(path)
    suggested_head, suggested_tail = _suggest_header_positions(headers)
    return {
        "headers": headers,
        "default_head_position": suggested_head,
        "default_tail_position": suggested_tail,
        "suggested_head_position": suggested_head,
        "suggested_tail_position": suggested_tail,
    }


def _numeric_summary(values: np.ndarray) -> dict:
    if values.size == 0:
        return {
            "mean": 0.0,
            "std": 0.0,
            "min": 0.0,
            "max": 0.0,
            "range": 0.0,
        }

    return {
        "mean": float(np.mean(values)),
        "std": float(np.std(values)),
        "min": float(np.min(values)),
        "max": float(np.max(values)),
        "range": float(np.ptp(values)),
    }


def _build_analysis_summary(
    feathering: np.ndarray,
    ffid_arr: np.ndarray,
    distance_m: np.ndarray,
    *,
    npd_records: int,
    track_records: int,
    matched_records: int,
    line_name: str,
    fast_match: bool,
    tolerance_s: float | None,
    head_position: str,
    tail_position: str,
    feathering_limit: float,
    run_in_ffid: int | None,
    run_out_ffid: int | None,
) -> dict:
    if feathering.size == 0:
        raise ValueError("분석 요약을 만들 데이터가 없습니다.")

    main_mask = np.ones_like(feathering, dtype=bool)
    if run_in_ffid is not None:
        main_mask &= ffid_arr >= run_in_ffid
    if run_out_ffid is not None:
        main_mask &= ffid_arr <= run_out_ffid

    if not np.any(main_mask):
        main_mask = np.ones_like(feathering, dtype=bool)

    main_indices = np.where(main_mask)[0]
    main_ffids = ffid_arr[main_indices]
    main_feathering = feathering[main_mask]

    total_distance_m = float(distance_m[-1]) if distance_m.size > 0 else 0.0
    if main_indices.size > 1:
        included_distance_m = float(distance_m[main_indices[-1]] - distance_m[main_indices[0]])
    else:
        included_distance_m = total_distance_m

    def zone_for_ffid(ffid_value: int) -> str:
        if run_in_ffid is not None and ffid_value <= run_in_ffid:
            return "run_in"
        if run_out_ffid is not None and ffid_value >= run_out_ffid:
            return "run_out"
        return "main"

    overall_stats = _numeric_summary(feathering)
    main_stats = _numeric_summary(main_feathering)

    limit_summary = None
    overall_exceeded_count = 0
    overall_exceeded_percent = 0.0
    main_exceeded_count = 0
    main_exceeded_percent = 0.0
    max_abs = float(np.max(np.abs(main_feathering))) if main_feathering.size > 0 else 0.0

    if feathering_limit > 0:
        overall_exceeded_mask = np.abs(feathering) > feathering_limit
        main_exceeded_mask = np.abs(main_feathering) > feathering_limit
        overall_exceeded_count = int(np.sum(overall_exceeded_mask))
        main_exceeded_count = int(np.sum(main_exceeded_mask))
        overall_exceeded_percent = (
            float(overall_exceeded_count / feathering.size * 100) if feathering.size > 0 else 0.0
        )
        main_exceeded_percent = (
            float(main_exceeded_count / main_feathering.size * 100) if main_feathering.size > 0 else 0.0
        )
        limit_summary = {
            "value": float(feathering_limit),
            "overall_exceeded_count": overall_exceeded_count,
            "overall_exceeded_percent": overall_exceeded_percent,
            "main_exceeded_count": main_exceeded_count,
            "main_exceeded_percent": main_exceeded_percent,
            "max_abs": max_abs,
        }

    peaks = []
    peak_order = np.argsort(np.abs(feathering[main_indices]))[::-1]
    for index in peak_order[:5]:
        original_idx = int(main_indices[index])
        ffid_value = int(ffid_arr[original_idx])
        peak_value = float(feathering[original_idx])
        peaks.append({
            "ffid": ffid_value,
            "feathering": peak_value,
            "abs_feathering": float(abs(peak_value)),
            "zone": zone_for_ffid(ffid_value),
            "exceeded": bool(feathering_limit > 0 and abs(peak_value) > feathering_limit),
        })

    changes = []
    try:
        for start_idx, end_idx, mean_shift, detection_type, peak_abs in analyzer.detect_feathering_changes(
            main_feathering,
            feathering_limit=feathering_limit,
        )[:5]:
            start_ffid = int(main_ffids[start_idx])
            end_ffid = int(main_ffids[end_idx])
            changes.append({
                "start_ffid": start_ffid,
                "end_ffid": end_ffid,
                "detection_type": detection_type,
                "peak_abs": float(peak_abs),
                "mean_shift": float(mean_shift),
                "record_count": int(end_idx - start_idx + 1),
            })
    except Exception:
        changes = []

    if feathering_limit <= 0:
        verdict = "INFO"
        headline = "No feathering limit was applied."
        detail = (
            f"Run-in/out 제외 후 {main_feathering.size:,} records를 main-line 기준으로 읽습니다. "
            "이번 실행은 pass/fail보다 분포와 변화 패턴을 읽는 리뷰 모드입니다."
        )
    elif main_exceeded_count == 0:
        verdict = "PASS"
        headline = f"Main-line feathering stays within ±{feathering_limit:.1f}°."
        detail = (
            f"Run-in/out 제외 후 {main_feathering.size:,} records가 포함되었고, "
            "main-line evidence window에서는 limit exceedance가 없습니다."
        )
    elif main_exceeded_percent <= 5.0:
        verdict = "WARN"
        headline = f"Localized exceedance detected above ±{feathering_limit:.1f}°."
        detail = (
            f"Main-line {main_exceeded_count:,} records ({main_exceeded_percent:.1f}%)가 "
            "limit을 넘었습니다. breach 위치와 change zone을 함께 확인하세요."
        )
    else:
        verdict = "FAIL"
        headline = f"Feathering repeatedly exceeds ±{feathering_limit:.1f}°."
        detail = (
            f"Main-line {main_exceeded_count:,} records ({main_exceeded_percent:.1f}%)가 "
            "limit을 넘어서, 공간적 cluster와 line 구간별 지속성을 확인해야 합니다."
        )

    if feathering_limit > 0 and main_exceeded_count > 0:
        recommended_chart = "track"
        recommended_reason = (
            "초과 지점이 공간적으로 어디에 모이는지 Track Plot에서 먼저 확인하면 "
            "회피 기동 또는 line tail pattern을 빠르게 읽을 수 있습니다."
        )
    elif changes:
        recommended_chart = "feathering"
        recommended_reason = (
            "Change zone이 감지되어 FFID 기준 변동 패턴을 Feathering Plot에서 먼저 보는 것이 좋습니다."
        )
    else:
        recommended_chart = "histogram"
        recommended_reason = (
            "Limit breach보다 전체 분포 shape를 보는 것이 중요하므로 Histogram에서 bias와 spread를 먼저 확인하세요."
        )

    return {
        "verdict": verdict,
        "headline": headline,
        "detail": detail,
        "recommended_chart": recommended_chart,
        "recommended_reason": recommended_reason,
        "matching": {
            "mode": "fast" if fast_match else "precise",
            "tolerance_s": float(tolerance_s) if tolerance_s is not None else None,
            "npd_records": int(npd_records),
            "track_records": int(track_records),
            "matched_records": int(matched_records),
            "matched_percent": float((matched_records / npd_records) * 100) if npd_records > 0 else 0.0,
            "head_position": head_position,
            "tail_position": tail_position,
            "line_name": line_name,
        },
        "window": {
            "total_records": int(feathering.size),
            "included_records": int(main_feathering.size),
            "excluded_records": int(feathering.size - main_feathering.size),
            "first_ffid": int(ffid_arr[0]) if ffid_arr.size > 0 else None,
            "last_ffid": int(ffid_arr[-1]) if ffid_arr.size > 0 else None,
            "run_in_end_ffid": int(run_in_ffid) if run_in_ffid is not None else None,
            "run_out_start_ffid": int(run_out_ffid) if run_out_ffid is not None else None,
            "total_distance_m": total_distance_m,
            "included_distance_m": included_distance_m,
        },
        "main_stats": main_stats,
        "overall_stats": overall_stats,
        "limit": limit_summary,
        "peaks": peaks,
        "changes": changes,
    }


PAIRING_STOPWORDS = {
    "npd",
    "track",
    "tracking",
    "trk",
    "nav",
    "navigation",
    "line",
    "raw",
    "export",
}


def _path_tokens(path: str) -> list[str]:
    stem = Path(path).stem.lower()
    cleaned = re.sub(r"[^a-z0-9]+", " ", stem)
    return [token for token in cleaned.split() if token and token not in PAIRING_STOPWORDS]


def _suggest_line_name(npd_path: str, track_path: str | None = None) -> str:
    preferred_path = track_path or npd_path
    stem = Path(preferred_path).stem
    stem = re.sub(r"(?i)_?track.*$", "", stem)
    stem = re.sub(r"(?i)_?npd.*$", "", stem)
    stem = stem.strip("._- ")
    return stem or Path(preferred_path).stem or "Line"


def _pair_score(npd_path: str, track_path: str) -> tuple[float, str]:
    npd_tokens = set(_path_tokens(npd_path))
    track_tokens = set(_path_tokens(track_path))
    token_overlap = 0.0
    if npd_tokens or track_tokens:
        token_overlap = len(npd_tokens & track_tokens) / max(len(npd_tokens | track_tokens), 1)

    name_ratio = SequenceMatcher(
        None,
        Path(npd_path).stem.lower(),
        Path(track_path).stem.lower(),
    ).ratio()
    dir_ratio = SequenceMatcher(
        None,
        str(Path(npd_path).parent).lower(),
        str(Path(track_path).parent).lower(),
    ).ratio()
    score = (name_ratio * 0.58) + (token_overlap * 0.32) + (dir_ratio * 0.10)
    reason = f"name {name_ratio:.2f} / tokens {token_overlap:.2f} / dir {dir_ratio:.2f}"
    return score, reason


def _safe_path_component(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    while ".." in sanitized:
        sanitized = sanitized.replace("..", "_")
    return sanitized or "line"


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
    safe_line_name = _safe_path_component(line_name)

    # Output dir 생성
    if output_dir:
        output_dir = str(Path(output_dir).expanduser().resolve())
    else:
        output_dir = str(Path(track_path).expanduser().resolve().parent)
    os.makedirs(output_dir, exist_ok=True)

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

    npd_records = len(npd_df)
    track_records = len(track_df)

    if matched.empty:
        raise ValueError("매칭 결과가 비어있습니다. 시간 범위를 확인하세요.")

    # 4. Calculate feathering
    progress("calculating", "Feathering 각도 계산 중...", 55)
    feathering = analyzer.calculate_feathering(matched, planned_azimuth)
    matched["Feathering"] = feathering

    # 5. Save CSV
    progress("saving_csv", "CSV 저장 중...", 65)
    csv_path = os.path.join(output_dir, f"{safe_line_name}_feathering.csv")
    matched.to_csv(csv_path, index=False, encoding="utf-8-sig")

    # 6. Plot feathering
    progress("plotting_feathering", "Feathering 플롯 생성 중...", 75)
    plot_path = os.path.join(output_dir, f"{safe_line_name}_feathering.png")
    stats = analyzer.plot_feathering(
        matched, feathering, planned_azimuth,
        run_in_m, run_out_m, feathering_limit,
        line_name, plot_path,
    )

    # 7. Plot track
    progress("plotting_track", "Track 플롯 생성 중...", 85)
    track_plot_path = os.path.join(output_dir, f"{safe_line_name}_trackplot.png")
    analyzer.plot_track(matched, line_name, feathering, feathering_limit, track_plot_path)

    # 8. Histogram
    progress("plotting_histogram", "히스토그램 생성 중...", 88)
    histogram_path = os.path.join(output_dir, f"{safe_line_name}_histogram.png")
    try:
        analyzer.plot_histogram(feathering, feathering_limit, line_name, histogram_path)
    except Exception as e:
        progress("histogram_warning", f"히스토그램 생성 실패 (무시): {e}", 89)
        histogram_path = None

    # 9. Generate report
    progress("generating_report", "보고서 생성 중...", 92)
    report_path = os.path.join(output_dir, f"{safe_line_name}_report.txt")
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
        "trace_no": matched["TRACENO"].tolist() if "TRACENO" in matched.columns else (
            matched["FFID"].tolist() if "FFID" in matched.columns else list(range(len(matched)))
        ),
        "feathering": feathering.tolist(),
        "sou_x": matched["SOU_X"].tolist() if "SOU_X" in matched.columns else [],
        "sou_y": matched["SOU_Y"].tolist() if "SOU_Y" in matched.columns else [],
        "front_x": matched["FRONT_X"].tolist() if "FRONT_X" in matched.columns else [],
        "front_y": matched["FRONT_Y"].tolist() if "FRONT_Y" in matched.columns else [],
        "tail_x": matched["TAIL_X"].tolist() if "TAIL_X" in matched.columns else [],
        "tail_y": matched["TAIL_Y"].tolist() if "TAIL_Y" in matched.columns else [],
    }

    # PDF 백그라운드 생성
    pdf_path = os.path.join(output_dir, f"{safe_line_name}_report.pdf")
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

    summary = _build_analysis_summary(
        feathering,
        ffid_arr,
        distance_m,
        npd_records=npd_records,
        track_records=track_records,
        matched_records=len(matched),
        line_name=line_name,
        fast_match=fast_match,
        tolerance_s=tolerance_s,
        head_position=head_position,
        tail_position=tail_position,
        feathering_limit=feathering_limit,
        run_in_ffid=run_in_ffid,
        run_out_ffid=run_out_ffid,
    )

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
        "summary": summary,
        "chart_data": chart_data,
        "output_files": output_files,
        "output_dir": output_dir,
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
    """폴더 내 NPD+Track 파일 후보를 자동 탐지하고 배치 job을 제안."""
    folder = params["folder"]
    import glob

    npd_files = glob.glob(os.path.join(folder, "**", "*.NPD"), recursive=True)
    npd_files += glob.glob(os.path.join(folder, "**", "*.npd"), recursive=True)

    track_files = glob.glob(os.path.join(folder, "**", "*track*"), recursive=True)
    track_files += glob.glob(os.path.join(folder, "**", "*Track*"), recursive=True)
    track_files = [f for f in track_files if not f.endswith((".png", ".pdf"))]

    npd_files = sorted(set(npd_files))
    track_files = sorted(set(track_files))

    jobs = []
    for index, npd_path in enumerate(npd_files, start=1):
        best_track = ""
        best_score = 0.0
        best_reason = "No suggested Track pair"

        for track_path in track_files:
            score, reason = _pair_score(npd_path, track_path)
            if score > best_score:
                best_score = score
                best_track = track_path
                best_reason = reason

        suggested_track = best_track if best_score >= 0.28 else ""
        confidence = int(round(best_score * 100))
        jobs.append({
            "id": f"job_{index}",
            "line_name": _suggest_line_name(npd_path, suggested_track or None),
            "npd_path": npd_path,
            "track_path": suggested_track,
            "confidence": confidence,
            "match_reason": best_reason,
            "selected": bool(suggested_track and confidence >= 50),
        })

    return {
        "npd_files": npd_files,
        "track_files": track_files,
        "jobs": jobs,
    }


def handle_batch_analysis(params: dict) -> dict:
    """여러 라인을 순차 분석."""
    jobs = params["jobs"]  # list of {npd_path, track_path, ...}
    output_dir = params.get("output_dir", "")
    results = []
    batch_output_dir = ""

    if output_dir:
        batch_output_dir = os.path.join(
            str(Path(output_dir).expanduser().resolve()),
            f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        )
        os.makedirs(batch_output_dir, exist_ok=True)

    for i, job in enumerate(jobs):
        progress("batch", f"배치 {i+1}/{len(jobs)}: {job.get('line_name', '...')}", int((i / len(jobs)) * 100))
        try:
            run_job = dict(job)
            line_name = run_job.get("line_name") or _suggest_line_name(run_job.get("npd_path", ""), run_job.get("track_path"))
            if batch_output_dir:
                run_output_dir = os.path.join(
                    str(Path(batch_output_dir).expanduser().resolve()),
                    f"{i + 1:02d}_{_safe_path_component(line_name)}",
                )
                os.makedirs(run_output_dir, exist_ok=True)
                run_job["output_dir"] = run_output_dir

            result = handle_run_analysis(run_job)
            results.append({
                "line_name": line_name,
                "status": "success",
                "stats": result["stats"],
                "summary": result.get("summary"),
                "output_files": result["output_files"],
                "output_dir": run_job.get("output_dir", ""),
            })
        except Exception as e:
            results.append({
                "line_name": job.get("line_name", f"Job_{i+1}"),
                "status": "error",
                "error": str(e),
                "summary": None,
                "stats": None,
                "output_files": [],
                "output_dir": "",
            })

    progress("done", f"배치 완료! {len(results)}개 라인 처리", 100)

    passed = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "batch_output_dir": batch_output_dir,
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
