#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPD Parser + Feathering Analysis - 통합 프로그램
Professional seismic survey feathering analysis engine.
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import AutoMinorLocator, FuncFormatter
import sys
from pathlib import Path
import re
import os
from datetime import datetime

# ---------------------------------------------------------------------------
# Matplotlib global style — publication-quality defaults
# ---------------------------------------------------------------------------
_PLOT_STYLE = {
    "bg": "#0f1117",
    "card": "#1a1b2e",
    "grid": "#2a2b3e",
    "text": "#c8cad0",
    "text_bright": "#eaecf0",
    "accent": "#7c8aff",
    "accent2": "#66d9a0",
    "warn": "#ff6b6b",
    "cyan": "#56d4e0",
    "magenta": "#c77dff",
    "orange": "#ffa348",
    "green_zone": "#2d6a4f",
    "red_zone": "#6b2038",
}

plt.rcParams.update({
    "figure.facecolor": _PLOT_STYLE["bg"],
    "axes.facecolor": _PLOT_STYLE["card"],
    "axes.edgecolor": _PLOT_STYLE["grid"],
    "axes.labelcolor": _PLOT_STYLE["text_bright"],
    "axes.titlepad": 16,
    "text.color": _PLOT_STYLE["text"],
    "xtick.color": _PLOT_STYLE["text"],
    "ytick.color": _PLOT_STYLE["text"],
    "grid.color": _PLOT_STYLE["grid"],
    "grid.alpha": 0.5,
    "grid.linewidth": 0.5,
    "legend.facecolor": _PLOT_STYLE["card"],
    "legend.edgecolor": _PLOT_STYLE["grid"],
    "legend.fontsize": 10,
    "legend.framealpha": 0.9,
    "font.family": "sans-serif",
    "font.size": 11,
    "axes.titlesize": 16,
    "axes.labelsize": 13,
    "xtick.labelsize": 11,
    "ytick.labelsize": 11,
    "figure.dpi": 150,
    "savefig.dpi": 180,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.3,
})


# ============================================================================
# NPD 파싱 함수들
# ============================================================================

def parse_npd_header(header_line):
    """NPD 헤더 파싱"""
    if 'Time,' in header_line:
        header_line = header_line[header_line.find('Time,'):]

    columns = [col.strip() for col in header_line.split(',')]

    positions = {}
    separator_counts = {}
    current_separator = None

    for i, col in enumerate(columns):
        if col in ['D', 'O', 'X']:
            if col not in separator_counts:
                separator_counts[col] = 0
            separator_counts[col] += 1
            current_separator = (col, separator_counts[col])

        if 'Position:' in col and 'East' in col:
            match = re.search(r'Position: (.*?): East', col)
            if match:
                position_name = match.group(1).strip()

                if i + 1 < len(columns) and 'North' in columns[i + 1]:
                    positions[position_name] = {
                        'separator': current_separator,
                        'east_header_idx': i,
                        'north_header_idx': i + 1
                    }

    return positions


def extract_position_data(fields, position_info):
    """Position 데이터 추출"""
    data = {}
    separator_counts = {}

    for i, field in enumerate(fields):
        field = field.strip()

        if field in ['D', 'O', 'X']:
            if field not in separator_counts:
                separator_counts[field] = 0
            separator_counts[field] += 1
            current_separator = (field, separator_counts[field])

            for pos_name, pos_info in position_info.items():
                if pos_info['separator'] == current_separator:
                    if i + 2 < len(fields):
                        east_val = fields[i + 1].strip()
                        north_val = fields[i + 2].strip()

                        try:
                            float(east_val)
                            float(north_val)
                            data[pos_name] = {
                                'east': east_val,
                                'north': north_val
                            }
                        except ValueError:
                            continue

    return data


def format_time_hhmmss(time_str):
    """시간을 HH:MM:SS.000 형식으로 변환"""
    try:
        parts = time_str.split(':')
        if len(parts) == 3:
            hours = parts[0].zfill(2)
            minutes = parts[1].zfill(2)
            seconds = float(parts[2])
            return f"{hours}:{minutes}:{seconds:06.3f}"
        return time_str
    except (ValueError, IndexError, AttributeError):
        return time_str


def parse_npd_file(npd_file_path, target_positions=None):
    """NPD 파일 파싱"""
    print(f"\nNPD 파일 파싱 중: {Path(npd_file_path).name}")

    with open(npd_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    if len(lines) < 2:
        raise ValueError("NPD 파일에 충분한 데이터가 없습니다.")

    header_line = lines[0].strip()
    position_info = parse_npd_header(header_line)

    print(f"  {len(position_info)}개 Position 섹션 발견")

    if target_positions:
        position_info = {k: v for k, v in position_info.items() if k in target_positions}

    rename_mapping = {
        'Head_Buoy': 'FRONT',
        'Tail_Buoy': 'TAIL'
    }

    data_rows = []

    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue

        fields = line.split(',')
        time_str = fields[0].strip() if len(fields) > 0 else None
        if not time_str:
            continue

        position_data = extract_position_data(fields, position_info)

        if position_data:
            formatted_time = format_time_hhmmss(time_str)
            row = {'Time': formatted_time}

            for pos_name, coords in position_data.items():
                display_name = rename_mapping.get(pos_name, pos_name)
                row[f'{display_name}_X'] = float(coords['east'])
                row[f'{display_name}_Y'] = float(coords['north'])
            data_rows.append(row)

    df = pd.DataFrame(data_rows)
    print(f"  파싱 완료: {len(df)}개 레코드")

    return df


def parse_track_file(track_file_path):
    """Track 파일 파싱"""
    print(f"\nTrack 파일 파싱 중: {Path(track_file_path).name}")
    df = pd.read_csv(track_file_path, sep='\t')
    print(f"  {len(df)}개 레코드 로드")
    return df


def time_to_seconds(time_str):
    """HH:MM:SS.fff를 초로 변환"""
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    except (ValueError, IndexError, AttributeError):
        return None


def track_time_to_seconds(day, hour, minute, second):
    """Track 시간을 초로 변환"""
    try:
        return int(hour) * 3600 + int(minute) * 60 + float(second)
    except (ValueError, TypeError):
        return None


def match_npd_with_track(npd_df, track_df):
    """NPD와 Track 매칭 (벡터화 searchsorted — O(n log m))"""
    print(f"\n시간 매칭 수행 중...")

    npd_df = npd_df.copy()
    track_df = track_df.copy()

    npd_df['time_seconds'] = npd_df['Time'].apply(time_to_seconds)
    track_df['time_seconds'] = track_df.apply(
        lambda row: track_time_to_seconds(row['DAY'], row['HOUR'],
                                         row['MINUTE'], row['SECOND']),
        axis=1
    )

    npd_df = npd_df[npd_df['time_seconds'].notna()].copy()
    track_df = track_df[track_df['time_seconds'].notna()].copy()

    # Sort track by time for searchsorted
    track_df = track_df.sort_values('time_seconds').reset_index(drop=True)
    track_times = track_df['time_seconds'].values

    track_min_time = track_times[0]
    track_max_time = track_times[-1]

    npd_in_range = npd_df[
        (npd_df['time_seconds'] >= track_min_time) &
        (npd_df['time_seconds'] <= track_max_time)
    ].copy()

    print(f"  시간 범위 내 NPD 레코드: {len(npd_in_range)}개")

    if len(npd_in_range) == 0:
        print("\n  경고: Track 시간 범위 내에 매칭되는 NPD 데이터가 없습니다.")
        return pd.DataFrame()

    # Vectorised nearest-neighbour via searchsorted
    npd_times = npd_in_range['time_seconds'].values
    idx_right = np.searchsorted(track_times, npd_times, side='left')
    idx_right = np.clip(idx_right, 0, len(track_times) - 1)
    idx_left = np.clip(idx_right - 1, 0, len(track_times) - 1)

    diff_left = np.abs(npd_times - track_times[idx_left])
    diff_right = np.abs(npd_times - track_times[idx_right])
    best_idx = np.where(diff_left <= diff_right, idx_left, idx_right)

    track_matched = track_df.iloc[best_idx].reset_index(drop=True)
    npd_reset = npd_in_range.reset_index(drop=True)

    matched_df = pd.DataFrame({
        'Time': npd_reset['Time'].values,
        'TRACENO': track_matched['TRACENO'].values,
        'FFID': track_matched['FFID'].values,
        'CHAN': track_matched['CHAN'].values,
        'SOU_X': track_matched['SOU_X'].values,
        'SOU_Y': track_matched['SOU_Y'].values,
    })

    for col in npd_reset.columns:
        if col not in ('time_seconds', 'Time'):
            matched_df[col] = npd_reset[col].values

    print(f"  매칭 완료: {len(matched_df)}개 레코드")
    return matched_df


def match_npd_with_track_fast(npd_df, track_df, tolerance_s=None):
    """NPD와 Track 빠른 매칭 (numpy searchsorted 기반)"""
    print(f"\n빠른 시간 매칭 수행 중...")

    npd_df = npd_df.copy()
    track_df = track_df.copy()

    npd_df['time_seconds'] = npd_df['Time'].apply(time_to_seconds)
    track_df['time_seconds'] = track_df.apply(
        lambda row: track_time_to_seconds(row['DAY'], row['HOUR'],
                                         row['MINUTE'], row['SECOND']),
        axis=1
    )

    npd_df = npd_df[npd_df['time_seconds'].notna()].copy()
    track_df = track_df[track_df['time_seconds'].notna()].copy()

    track_times = track_df['time_seconds'].values
    sort_idx = np.argsort(track_times)
    track_times_sorted = track_times[sort_idx]
    track_df_sorted = track_df.iloc[sort_idx].reset_index(drop=True)

    matched_rows = []
    tol = tolerance_s if tolerance_s is not None else float('inf')

    for _, npd_row in npd_df.iterrows():
        npd_time = npd_row['time_seconds']
        idx = np.searchsorted(track_times_sorted, npd_time)

        best_idx = None
        best_diff = float('inf')
        for candidate in [idx - 1, idx]:
            if 0 <= candidate < len(track_times_sorted):
                diff = abs(track_times_sorted[candidate] - npd_time)
                if diff < best_diff:
                    best_diff = diff
                    best_idx = candidate

        if best_idx is not None and best_diff <= tol:
            track_row = track_df_sorted.iloc[best_idx]
            matched_row = {
                'Time': npd_row['Time'],
                'TRACENO': track_row['TRACENO'],
                'FFID': track_row['FFID'],
                'CHAN': track_row['CHAN'],
                'SOU_X': track_row['SOU_X'],
                'SOU_Y': track_row['SOU_Y'],
            }
            for col in npd_row.index:
                if col not in ['time_seconds', 'Time']:
                    matched_row[col] = npd_row[col]
            matched_rows.append(matched_row)

    matched_df = pd.DataFrame(matched_rows)
    print(f"  매칭 완료: {len(matched_df)}개 레코드")
    return matched_df


# ============================================================================
# Feathering 분석 함수들
# ============================================================================

def calculate_feathering(df, planned_azimuth):
    """
    Feathering 각도 계산

    Args:
        df: FRONT_X, FRONT_Y, TAIL_X, TAIL_Y 열이 있는 DataFrame
        planned_azimuth: 계획된 방위각 (도)

    Returns:
        feathering angles (도)
    """
    dx = df['TAIL_X'].values - df['FRONT_X'].values
    dy = df['TAIL_Y'].values - df['FRONT_Y'].values

    actual_azimuth = np.degrees(np.arctan2(dx, dy))
    actual_azimuth = (actual_azimuth + 360) % 360

    feathering = actual_azimuth - planned_azimuth

    feathering = np.where(feathering > 180, feathering - 360, feathering)
    feathering = np.where(feathering < -180, feathering + 360, feathering)

    return feathering


def calculate_distance_along_line(df):
    """라인을 따라 누적 거리 계산 (km)"""
    dx = np.diff(df['FRONT_X'].values, prepend=df['FRONT_X'].iloc[0])
    dy = np.diff(df['FRONT_Y'].values, prepend=df['FRONT_Y'].iloc[0])

    distances = np.sqrt(dx**2 + dy**2)
    cumulative_dist = np.cumsum(distances) / 1000.0
    return cumulative_dist


def detect_feathering_changes(feathering, threshold=5.0, min_duration=10, feathering_limit=0):
    """
    페더링 급변 구간 감지 - 다층 탐지 알고리즘

    3가지 방법으로 회피 기동 감지:
    1. 짧은 window 변화 (빠른 급변)
    2. 긴 window 변화 (지속적 bias 제외)
    3. Feathering limit 초과
    """
    mean_feathering = np.mean(feathering)
    std_feathering = np.std(feathering)

    short_window = max(20, len(feathering) // 100)
    short_baseline = pd.Series(feathering).rolling(
        window=short_window, center=True, min_periods=1).mean().values
    short_deviation = feathering - short_baseline

    long_window = max(50, len(feathering) // 20)
    long_baseline = pd.Series(feathering).rolling(
        window=long_window, center=True, min_periods=1).mean().values
    long_deviation = feathering - long_baseline

    derivative = np.abs(np.diff(feathering, prepend=feathering[0]))

    adaptive_threshold = max(threshold, std_feathering * 1.5)

    short_significant = np.abs(short_deviation) > adaptive_threshold
    long_significant = np.abs(long_deviation) > (adaptive_threshold * 0.7)
    high_rate = derivative > (std_feathering * 0.3)

    if feathering_limit > 0:
        limit_exceeded = np.abs(feathering) > feathering_limit
    else:
        limit_exceeded = np.zeros_like(feathering, dtype=bool)

    significant = (short_significant & high_rate) | (long_significant & high_rate) | limit_exceeded

    smooth_window = 3
    smoothed = pd.Series(significant.astype(float)).rolling(
        window=smooth_window, center=True).mean().values
    significant = smoothed > 0.5

    changes = []
    in_change = False
    start_idx = 0

    for i in range(len(significant)):
        if significant[i] and not in_change:
            in_change = True
            start_idx = i
        elif not significant[i] and in_change:
            duration = i - start_idx
            if duration >= min_duration:
                segment = feathering[start_idx:i]
                mean_change = np.mean(segment) - mean_feathering
                max_value = np.max(np.abs(segment))

                if np.any(limit_exceeded[start_idx:i]):
                    detection_type = "Limit Exceeded"
                elif np.mean(np.abs(short_deviation[start_idx:i])) > adaptive_threshold:
                    detection_type = "Sudden Change"
                else:
                    detection_type = "Sustained Deviation"

                changes.append((start_idx, i - 1, mean_change, detection_type, max_value))
            in_change = False

    if in_change:
        duration = len(feathering) - start_idx
        if duration >= min_duration:
            segment = feathering[start_idx:]
            mean_change = np.mean(segment) - mean_feathering
            max_value = np.max(np.abs(segment))

            if np.any(limit_exceeded[start_idx:]):
                detection_type = "Limit Exceeded"
            elif np.mean(np.abs(short_deviation[start_idx:])) > adaptive_threshold:
                detection_type = "Sudden Change"
            else:
                detection_type = "Sustained Deviation"

            changes.append((start_idx, len(feathering) - 1, mean_change,
                            detection_type, max_value))

    return changes


# ============================================================================
# Plotting — professional dark-themed visualisations
# ============================================================================

def _format_coord(val, _):
    """축 좌표 포맷터: 과학적 표기법 제거"""
    if abs(val) >= 1e6:
        return f"{val / 1e6:.2f}M"
    if abs(val) >= 1e3:
        return f"{val / 1e3:.1f}k"
    return f"{val:.0f}"


def _add_watermark(fig):
    """우하단 워터마크"""
    fig.text(0.99, 0.01, f"NPD Feathering Analysis  |  {datetime.now():%Y-%m-%d %H:%M}",
             fontsize=7, color=_PLOT_STYLE["grid"], ha="right", va="bottom",
             fontstyle="italic")


def plot_track(df, line_name, feathering, feathering_limit, output_path):
    """Track plot (경로 지도) 생성"""

    fig, ax = plt.subplots(figsize=(14, 12))

    exceeded_mask = np.zeros(len(df), dtype=bool)
    if feathering_limit > 0:
        exceeded_mask = np.abs(feathering) > feathering_limit

    if 'SOU_X' in df.columns and 'SOU_Y' in df.columns:
        # Normal track
        normal_mask = ~exceeded_mask
        if np.any(normal_mask):
            ax.plot(df.loc[normal_mask, 'SOU_X'], df.loc[normal_mask, 'SOU_Y'],
                    color=_PLOT_STYLE["accent"], linewidth=2.0, label='Source (Normal)',
                    alpha=0.85, solid_capstyle="round")

        # Exceeded segments
        if np.any(exceeded_mask):
            ax.plot(df.loc[exceeded_mask, 'SOU_X'], df.loc[exceeded_mask, 'SOU_Y'],
                    color=_PLOT_STYLE["warn"], linewidth=2.8,
                    label=f'Exceeded \u00b1{feathering_limit}\u00b0', alpha=0.9,
                    solid_capstyle="round")

        # Start / End markers
        ax.plot(df['SOU_X'].iloc[0], df['SOU_Y'].iloc[0], 'o',
                color=_PLOT_STYLE["accent2"], markersize=13, label='Start',
                markeredgecolor=_PLOT_STYLE["text_bright"], markeredgewidth=2,
                zorder=5)
        ax.plot(df['SOU_X'].iloc[-1], df['SOU_Y'].iloc[-1], 's',
                color=_PLOT_STYLE["warn"], markersize=13, label='End',
                markeredgecolor=_PLOT_STYLE["text_bright"], markeredgewidth=2,
                zorder=5)

    # Head / Tail buoy traces
    ax.plot(df['FRONT_X'], df['FRONT_Y'], color=_PLOT_STYLE["cyan"],
            linewidth=0.7, label='Head Buoy', alpha=0.35)
    ax.plot(df['TAIL_X'], df['TAIL_Y'], color=_PLOT_STYLE["magenta"],
            linewidth=0.7, label='Tail Buoy', alpha=0.35)

    # FFID annotations
    if 'FFID' in df.columns:
        interval = max(1, len(df) // 10)
        for i in range(0, len(df), interval):
            ffid_val = df['FFID'].iloc[i]
            x_val = df['SOU_X'].iloc[i] if 'SOU_X' in df.columns else df['FRONT_X'].iloc[i]
            y_val = df['SOU_Y'].iloc[i] if 'SOU_Y' in df.columns else df['FRONT_Y'].iloc[i]

            color = _PLOT_STYLE["warn"] if exceeded_mask[i] else _PLOT_STYLE["text"]
            fontweight = 'bold' if exceeded_mask[i] else 'normal'

            ax.annotate(
                f'{int(ffid_val)}',
                xy=(x_val, y_val), xytext=(6, 6), textcoords='offset points',
                fontsize=8, fontweight=fontweight, color=color,
                bbox=dict(boxstyle='round,pad=0.3',
                          facecolor=_PLOT_STYLE["card"],
                          edgecolor=color, alpha=0.85),
            )

    ax.set_xlabel('East (m)', fontweight='bold')
    ax.set_ylabel('North (m)', fontweight='bold')

    title = f'Track Plot — {line_name}'
    if feathering_limit > 0:
        title += f'  (Limit: \u00b1{feathering_limit}\u00b0)'
    ax.set_title(title, fontweight='bold', pad=14)

    ax.xaxis.set_major_formatter(FuncFormatter(_format_coord))
    ax.yaxis.set_major_formatter(FuncFormatter(_format_coord))
    ax.xaxis.set_minor_locator(AutoMinorLocator(2))
    ax.yaxis.set_minor_locator(AutoMinorLocator(2))
    ax.grid(True, which="major", alpha=0.4)
    ax.grid(True, which="minor", alpha=0.15, linewidth=0.4)

    legend = ax.legend(loc='best', fontsize=10, framealpha=0.9)
    for text in legend.get_texts():
        text.set_color(_PLOT_STYLE["text"])

    ax.set_aspect('equal', adjustable='datalim')
    _add_watermark(fig)

    plt.savefig(output_path)
    plt.close()
    print(f"  Track plot 저장: {output_path}")


def plot_feathering(df, feathering, planned_azimuth, run_in_m, run_out_m,
                    feathering_limit, line_name, output_path):
    """Feathering 그래프 생성 — professional dark theme"""

    ffid = df['FFID'].values
    first_ffid = ffid[0]
    last_ffid = ffid[-1]

    distance_m = calculate_distance_along_line(df) * 1000.0
    total_distance = distance_m[-1]

    if run_in_m > 0:
        run_in_idx = np.searchsorted(distance_m, run_in_m)
        run_in_ffid = ffid[run_in_idx] if run_in_idx < len(ffid) else first_ffid
    else:
        run_in_ffid = first_ffid

    if run_out_m > 0:
        run_out_distance = total_distance - run_out_m
        run_out_idx = np.searchsorted(distance_m, run_out_distance)
        run_out_ffid = ffid[run_out_idx] if run_out_idx < len(ffid) else last_ffid
    else:
        run_out_ffid = last_ffid

    main_line_mask = (ffid >= run_in_ffid) & (ffid <= run_out_ffid)
    main_feathering = feathering[main_line_mask]

    mean_f = np.mean(main_feathering)
    std_f = np.std(main_feathering)
    min_f = np.min(main_feathering)
    max_f = np.max(main_feathering)

    # --- Figure ---
    fig, ax = plt.subplots(figsize=(20, 7))

    # Run-in / Run-out zones
    if run_in_m > 0:
        ax.axvspan(first_ffid, run_in_ffid, alpha=0.18,
                   color=_PLOT_STYLE["green_zone"], label='Run-in (SoL)')
    if run_out_m > 0:
        ax.axvspan(run_out_ffid, last_ffid, alpha=0.18,
                   color=_PLOT_STYLE["red_zone"], label='Run-out (EoL)')

    # Feathering line with gradient-like effect
    ax.fill_between(ffid, 0, feathering, alpha=0.12, color=_PLOT_STYLE["accent"])
    ax.plot(ffid, feathering, color=_PLOT_STYLE["accent"], linewidth=0.9,
            label='Feathering', alpha=0.95)

    # Zero line
    ax.axhline(y=0, color=_PLOT_STYLE["text"], linestyle='--', linewidth=0.6, alpha=0.35)

    # Mean line
    ax.axhline(y=mean_f, color=_PLOT_STYLE["accent2"], linestyle='-.',
               linewidth=1.0, alpha=0.6, label=f'Mean: {mean_f:.2f}\u00b0')

    # Limit lines
    if feathering_limit > 0:
        for sign in [1, -1]:
            ax.axhline(y=sign * feathering_limit, color=_PLOT_STYLE["warn"],
                       linestyle='--', linewidth=1.4, alpha=0.8,
                       label=f'Limit: \u00b1{feathering_limit}\u00b0' if sign == 1 else None)

    # Stats box
    stats_lines = [
        f"Main Line Statistics",
        f"Mean:  {mean_f:+.2f}\u00b0  (\u00b1{std_f:.2f}\u00b0)",
        f"Range: {min_f:+.2f}\u00b0 ~ {max_f:+.2f}\u00b0",
        f"Total: {len(feathering):,} pts",
    ]
    stats_text = "\n".join(stats_lines)

    props = dict(boxstyle='round,pad=0.6', facecolor=_PLOT_STYLE["card"],
                 edgecolor=_PLOT_STYLE["accent"], alpha=0.92, linewidth=1.2)
    ax.text(0.015, 0.97, stats_text, transform=ax.transAxes, fontsize=10,
            verticalalignment='top', fontfamily='monospace', color=_PLOT_STYLE["text"],
            bbox=props)

    ax.set_xlabel('FFID', fontweight='bold')
    ax.set_ylabel('Feathering Angle (\u00b0)', fontweight='bold')
    ax.set_title(
        f'Feathering Analysis — {line_name}  '
        f'(Planned Azimuth: {planned_azimuth}\u00b0)',
        fontweight='bold', pad=14,
    )

    ax.ticklabel_format(style='plain', axis='x')
    ax.xaxis.set_minor_locator(AutoMinorLocator(2))
    ax.yaxis.set_minor_locator(AutoMinorLocator(2))
    ax.grid(True, which="major", alpha=0.4)
    ax.grid(True, which="minor", alpha=0.15, linewidth=0.4)

    legend = ax.legend(loc='upper right', fontsize=10, framealpha=0.9)
    for text in legend.get_texts():
        text.set_color(_PLOT_STYLE["text"])

    _add_watermark(fig)

    plt.savefig(output_path)
    plt.close()

    print(f"  그래프 저장: {output_path}")

    return {
        'mean': mean_f,
        'std': std_f,
        'min': min_f,
        'max': max_f,
        'range': max_f - min_f,
    }


def generate_report(df, feathering, stats, planned_azimuth,
                    run_in_m, run_out_m, line_name, feathering_limit, output_path):
    """텍스트 리포트 생성"""

    if feathering_limit > 0:
        exceeded_mask = np.abs(feathering) > feathering_limit
        exceeded_count = int(np.sum(exceeded_mask))
        exceeded_percent = (exceeded_count / len(feathering)) * 100

        if exceeded_count > 0:
            exceeded_values = feathering[exceeded_mask]
            max_exceeded = float(np.max(np.abs(exceeded_values)))
            mean_exceeded = float(np.mean(exceeded_values))
        else:
            max_exceeded = 0.0
            mean_exceeded = 0.0
    else:
        exceeded_count = 0
        exceeded_percent = 0.0
        max_exceeded = 0.0
        mean_exceeded = 0.0

    sep = "=" * 72
    sep2 = "-" * 72
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"{sep}\n")
        f.write(f"  FEATHERING ANALYSIS REPORT\n")
        f.write(f"  Line: {line_name}\n")
        f.write(f"  Generated: {ts}\n")
        f.write(f"{sep}\n\n")

        f.write(f"{'Planned Azimuth:':<24} {planned_azimuth}\u00b0\n")
        f.write(f"{'Run-in Distance:':<24} {run_in_m} m\n")
        f.write(f"{'Run-out Distance:':<24} {run_out_m} m\n")
        f.write(f"{'Total Records:':<24} {len(df):,}\n\n")

        f.write(f"{sep2}\n")
        f.write(f"  MAIN LINE STATISTICS (Run-in/out Excluded)\n")
        f.write(f"{sep2}\n")
        f.write(f"{'Mean Feathering:':<24} {stats['mean']:+8.2f}\u00b0  "
                f"(\u00b1{stats['std']:.2f}\u00b0)\n")
        f.write(f"{'Minimum:':<24} {stats['min']:+8.2f}\u00b0\n")
        f.write(f"{'Maximum:':<24} {stats['max']:+8.2f}\u00b0\n")
        f.write(f"{'Range:':<24} {stats['range']:8.2f}\u00b0\n\n")

        if feathering_limit > 0:
            f.write(f"{sep2}\n")
            f.write(f"  FEATHERING LIMIT ANALYSIS "
                    f"(\u00b1{feathering_limit}\u00b0)\n")
            f.write(f"{sep2}\n")
            f.write(f"{'Exceeded Points:':<24} {exceeded_count:,} "
                    f"({exceeded_percent:.1f}%)\n")

            if exceeded_count > 0:
                f.write(f"{'Max Exceedance:':<24} {max_exceeded:.2f}\u00b0\n")
                f.write(f"{'Mean of Exceeded:':<24} {mean_exceeded:+.2f}\u00b0\n\n")
                f.write(f"  WARNING: Feathering exceeded the specified limit.\n")
                f.write(f"  Review the track plot for exact locations.\n")
            else:
                f.write(f"\n  PASS: All feathering values within limit.\n")

        f.write(f"\n{sep}\n")

    print(f"  리포트 저장: {output_path}")


# ============================================================================
# 메인 프로그램 (CLI interactive mode)
# ============================================================================

def get_input(prompt, input_type=str, default=None):
    """사용자 입력 받기"""
    while True:
        if default is not None:
            user_input = input(f"{prompt} (기본값: {default}): ").strip()
            if not user_input:
                return default
        else:
            user_input = input(f"{prompt}: ").strip()

        if not user_input and default is None:
            print("  값을 입력해주세요.")
            continue

        try:
            if input_type == float:
                return float(user_input)
            elif input_type == int:
                return int(user_input)
            else:
                return user_input
        except ValueError:
            print(f"  올바른 {input_type.__name__} 값을 입력해주세요.")


def get_file_path(prompt, check_exists=True):
    """파일 경로 입력"""
    while True:
        file_path = input(prompt).strip().strip('"').strip("'")

        if not file_path:
            print("  파일 경로를 입력해주세요.")
            continue

        if check_exists and not os.path.exists(file_path):
            print(f"  파일을 찾을 수 없습니다: {file_path}")
            continue

        return file_path


def interactive_mode():
    """인터랙티브 모드"""
    print("\n" + "=" * 72)
    print("  NPD Parser + Feathering Analysis")
    print("=" * 72)

    print("\n" + "-" * 72)
    npd_file = get_file_path("NPD 파일 경로: ")
    track_file = get_file_path("Track 파일 경로: ")

    line_name = Path(track_file).stem
    if '_track' in line_name.lower():
        line_name = line_name.split('_track')[0]

    print("\n" + "-" * 72)
    save_dir = get_file_path("결과 저장 폴더 (엔터=현재 폴더): ", check_exists=False)
    if not save_dir:
        save_dir = "."
    os.makedirs(save_dir, exist_ok=True)

    print("\n" + "-" * 72)
    print("Feathering 분석 파라미터 입력")
    print("-" * 72)

    planned_azimuth = get_input("계획된 라인 방위각 (도)", float)
    feathering_limit = get_input("Feathering 제한치 (±도, 0=표시안함)", float, default=0)
    run_in_m = get_input("Run-in 거리 (m)", float, default=0)
    run_out_m = get_input("Run-out 거리 (m)", float, default=0)

    print("\n" + "=" * 72)
    print("처리 시작...")
    print("=" * 72)

    npd_df = parse_npd_file(npd_file, target_positions=['Head_Buoy', 'Tail_Buoy'])
    track_df = parse_track_file(track_file)
    matched_df = match_npd_with_track(npd_df, track_df)

    if len(matched_df) == 0:
        print("\n  매칭된 데이터가 없습니다.")
        return None

    print("\n  Feathering 계산 중...")
    feathering = calculate_feathering(matched_df, planned_azimuth)
    matched_df['Feathering'] = feathering

    csv_path = os.path.join(save_dir, f"{line_name}_feathering.csv")
    matched_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"  CSV 저장: {csv_path}")

    print("\n  그래프 생성 중...")
    plot_path = os.path.join(save_dir, f"{line_name}_feathering.png")
    stats = plot_feathering(matched_df, feathering, planned_azimuth,
                            run_in_m, run_out_m, feathering_limit, line_name, plot_path)

    print("\n  Track plot 생성 중...")
    track_plot_path = os.path.join(save_dir, f"{line_name}_trackplot.png")
    plot_track(matched_df, line_name, feathering, feathering_limit, track_plot_path)

    print("\n  리포트 생성 중...")
    report_path = os.path.join(save_dir, f"{line_name}_report.txt")
    generate_report(matched_df, feathering, stats, planned_azimuth,
                    run_in_m, run_out_m, line_name, feathering_limit, report_path)

    print("\n" + "=" * 72)
    print("  모든 처리 완료!")
    print("=" * 72)
    print(f"\n생성된 파일:")
    print(f"  1. {csv_path}")
    print(f"  2. {plot_path}")
    print(f"  3. {track_plot_path}")
    print(f"  4. {report_path}")

    return matched_df


def main():
    try:
        get_ipython()
        is_jupyter = True
    except NameError:
        is_jupyter = False

    if len(sys.argv) >= 3 and sys.argv[1] not in ['-f', '--']:
        print("명령줄 모드는 아직 구현되지 않았습니다.")
        print("인터랙티브 모드를 사용하세요: python Parser_2.py")
        return None

    return interactive_mode()


if __name__ == "__main__":
    result = main()
