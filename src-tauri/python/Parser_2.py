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
    "figure.dpi": 100,
    "savefig.dpi": 150,
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


def scan_npd_headers(npd_file_path):
    """NPD 파일의 헤더를 스캔하여 사용 가능한 Position 이름 목록을 반환.

    Returns:
        list[str]: Position 이름 목록 (예: ['Head_Buoy', 'Tail_Buoy', 'GPS_Antenna', ...])
    """
    with open(npd_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        header_line = f.readline().strip()

    if not header_line:
        return []

    position_info = parse_npd_header(header_line)
    return sorted(position_info.keys())


def parse_npd_file(npd_file_path, target_positions=None, progress_cb=None):
    """NPD 파일 파싱 (스트리밍 + 벡터화 최적화)

    Args:
        npd_file_path: NPD 파일 경로
        target_positions: 추출할 Position 이름 목록
        progress_cb: 진행률 콜백 fn(percent: int, message: str)
    """
    print(f"\nNPD 파일 파싱 중: {Path(npd_file_path).name}")

    file_size = os.path.getsize(npd_file_path)

    # 헤더만 먼저 읽기
    with open(npd_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        header_line = f.readline().strip()

    if not header_line:
        raise ValueError("NPD 파일에 충분한 데이터가 없습니다.")

    position_info = parse_npd_header(header_line)
    print(f"  {len(position_info)}개 Position 섹션 발견")

    if target_positions:
        position_info = {k: v for k, v in position_info.items() if k in target_positions}

    # Dynamic rename mapping
    rename_mapping = {}
    pos_names = list(position_info.keys())
    if 'Head_Buoy' in pos_names and 'Tail_Buoy' in pos_names:
        rename_mapping = {'Head_Buoy': 'FRONT', 'Tail_Buoy': 'TAIL'}
    elif len(pos_names) >= 2:
        rename_mapping = {pos_names[0]: 'FRONT', pos_names[1]: 'TAIL'}
    elif len(pos_names) == 1:
        rename_mapping = {pos_names[0]: pos_names[0]}

    # 컬럼 인덱스 사전 계산 — extract_position_data 호출을 완전히 제거
    # separator 기반으로 각 position의 데이터 필드 offset을 미리 결정
    pos_field_map = _precompute_position_offsets(header_line, position_info)

    # 스트리밍 파싱 — 메모리에 전체 파일을 올리지 않음
    times = []
    coord_arrays = {f'{rename_mapping.get(pn, pn)}_{ax}': []
                    for pn in position_info for ax in ('X', 'Y')}

    bytes_read = 0
    line_count = 0
    last_pct = -1

    with open(npd_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        f.readline()  # 헤더 스킵
        for line in f:
            bytes_read += len(line.encode('utf-8', errors='ignore'))
            line = line.strip()
            if not line:
                continue

            fields = line.split(',')
            time_str = fields[0].strip() if fields else None
            if not time_str:
                continue

            # 빠른 좌표 추출 — 사전 계산된 인덱스 사용
            valid = True
            row_coords = {}
            for pos_name, (east_idx, north_idx) in pos_field_map.items():
                if east_idx < len(fields) and north_idx < len(fields):
                    try:
                        e = float(fields[east_idx].strip())
                        n = float(fields[north_idx].strip())
                        display = rename_mapping.get(pos_name, pos_name)
                        row_coords[f'{display}_X'] = e
                        row_coords[f'{display}_Y'] = n
                    except (ValueError, IndexError):
                        valid = False
                        break
                else:
                    valid = False
                    break

            if valid and row_coords:
                times.append(format_time_hhmmss(time_str))
                for key in coord_arrays:
                    coord_arrays[key].append(row_coords.get(key, np.nan))
                line_count += 1

            # 진행률 보고 (파일 크기 기반, 1% 단위)
            if progress_cb and file_size > 0:
                pct = min(int(bytes_read / file_size * 100), 99)
                if pct > last_pct:
                    last_pct = pct
                    progress_cb(pct, f"NPD 파싱 중... {line_count:,}개 레코드")

    # numpy 배열로 직접 DataFrame 생성 (dict-of-lists → DataFrame은 빠름)
    data = {'Time': times}
    for key, arr in coord_arrays.items():
        data[key] = np.array(arr, dtype=np.float64)

    df = pd.DataFrame(data)
    print(f"  파싱 완료: {len(df)}개 레코드")

    return df


def _precompute_position_offsets(header_line, position_info):
    """헤더에서 각 Position의 East/North 필드 인덱스를 사전 계산.

    extract_position_data()의 반복적 separator 스캔을 제거하여
    파싱 속도를 크게 향상시킴.
    """
    columns = [col.strip() for col in header_line.split(',')]

    # 각 separator의 데이터 라인에서의 위치를 미리 계산
    separator_positions = {}
    separator_counts = {}
    for i, col in enumerate(columns):
        if col in ['D', 'O', 'X']:
            if col not in separator_counts:
                separator_counts[col] = 0
            separator_counts[col] += 1
            separator_positions[(col, separator_counts[col])] = i

    # position_info의 separator를 실제 데이터 필드 인덱스로 변환
    result = {}
    for pos_name, info in position_info.items():
        sep = info['separator']
        if sep in separator_positions:
            sep_idx = separator_positions[sep]
            # separator 다음 필드가 east, 그 다음이 north
            result[pos_name] = (sep_idx + 1, sep_idx + 2)

    return result


def parse_track_file(track_file_path):
    """Track 파일 파싱"""
    print(f"\nTrack 파일 파싱 중: {Path(track_file_path).name}")
    df = pd.read_csv(track_file_path, sep='\t')
    print(f"  {len(df)}개 레코드 로드")
    return df


def time_to_seconds(time_str):
    """HH:MM:SS.fff를 초로 변환 (단일 값)"""
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    except (ValueError, IndexError, AttributeError):
        return None


def time_to_seconds_vectorized(time_series):
    """시간 문자열 Series를 초로 벡터화 변환 (apply 대체)"""
    split = time_series.str.split(':', expand=True)
    if split.shape[1] < 3:
        return time_series.apply(time_to_seconds)
    hours = pd.to_numeric(split[0], errors='coerce')
    minutes = pd.to_numeric(split[1], errors='coerce')
    seconds = pd.to_numeric(split[2], errors='coerce')
    return hours * 3600 + minutes * 60 + seconds


def track_time_to_seconds(day, hour, minute, second):
    """Track 시간을 초로 변환 (단일 값)"""
    try:
        return int(hour) * 3600 + int(minute) * 60 + float(second)
    except (ValueError, TypeError):
        return None


def track_time_to_seconds_vectorized(track_df):
    """Track DataFrame의 시간을 초로 벡터화 변환 (apply 대체)"""
    hours = pd.to_numeric(track_df['HOUR'], errors='coerce')
    minutes = pd.to_numeric(track_df['MINUTE'], errors='coerce')
    seconds = pd.to_numeric(track_df['SECOND'], errors='coerce')
    return hours * 3600 + minutes * 60 + seconds


def match_npd_with_track(npd_df, track_df):
    """NPD와 Track 매칭 (벡터화 searchsorted — O(n log m))"""
    print(f"\n시간 매칭 수행 중...")

    npd_df = npd_df.copy()
    track_df = track_df.copy()

    npd_df['time_seconds'] = time_to_seconds_vectorized(npd_df['Time'])
    track_df['time_seconds'] = track_time_to_seconds_vectorized(track_df)

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
    """NPD와 Track 빠른 매칭 (완전 벡터화 — iterrows 제거)"""
    print(f"\n빠른 시간 매칭 수행 중...")

    npd_df = npd_df.copy()
    track_df = track_df.copy()

    npd_df['time_seconds'] = time_to_seconds_vectorized(npd_df['Time'])
    track_df['time_seconds'] = track_time_to_seconds_vectorized(track_df)

    npd_df = npd_df[npd_df['time_seconds'].notna()].copy()
    track_df = track_df[track_df['time_seconds'].notna()].copy()

    # Sort track by time
    track_df = track_df.sort_values('time_seconds').reset_index(drop=True)
    track_times = track_df['time_seconds'].values

    # Vectorised nearest-neighbour via searchsorted
    npd_times = npd_df['time_seconds'].values
    idx_right = np.searchsorted(track_times, npd_times, side='left')
    idx_right = np.clip(idx_right, 0, len(track_times) - 1)
    idx_left = np.clip(idx_right - 1, 0, len(track_times) - 1)

    diff_left = np.abs(npd_times - track_times[idx_left])
    diff_right = np.abs(npd_times - track_times[idx_right])
    best_idx = np.where(diff_left <= diff_right, idx_left, idx_right)
    best_diff = np.minimum(diff_left, diff_right)

    # tolerance 필터링
    tol = tolerance_s if tolerance_s is not None else float('inf')
    valid_mask = best_diff <= tol

    npd_valid = npd_df[valid_mask].reset_index(drop=True)
    track_matched = track_df.iloc[best_idx[valid_mask]].reset_index(drop=True)

    matched_df = pd.DataFrame({
        'Time': npd_valid['Time'].values,
        'TRACENO': track_matched['TRACENO'].values,
        'FFID': track_matched['FFID'].values,
        'CHAN': track_matched['CHAN'].values,
        'SOU_X': track_matched['SOU_X'].values,
        'SOU_Y': track_matched['SOU_Y'].values,
    })

    for col in npd_valid.columns:
        if col not in ('time_seconds', 'Time'):
            matched_df[col] = npd_valid[col].values

    print(f"  매칭 완료: {len(matched_df)}개 레코드")
    return matched_df


# ============================================================================
# Feathering 분석 함수들
# ============================================================================

def estimate_planned_azimuth(df, trim_pct=20):
    """Track/매칭 데이터에서 라인 계획 방위각(케이블 방향)을 자동 추정.

    전략:
      1. FRONT_X/Y + TAIL_X/Y가 모두 있으면 (매칭 데이터)
         → Front→Tail 벡터의 중앙값 방위각 직접 계산 (가장 정확)
      2. 좌표가 하나뿐이면 (Track only)
         → 진행 방향 계산 후 반대 방향(+180°)도 후보로 제시
      3. 양 끝 trim_pct% 를 잘라내서 run-in/out 곡선 구간 제거
      4. 3가지 방법의 circular mean → 최종 추정치

    Args:
        df: SOU_X/Y, FRONT_X/Y, TAIL_X/Y 등 좌표 컬럼이 있는 DataFrame
        trim_pct: 양쪽 끝에서 제거할 비율 (기본 20%)

    Returns:
        dict: {
            'azimuth': float,       # 추정 방위각 (0~360)
            'confidence': str,      # 'high' | 'medium' | 'low'
            'spread': float,        # 3개 추정치의 분산 (도)
            'method': str,          # 'cable_vector' | 'track_heading'
            'method_detail': dict,  # 각 방법별 값
        }
    """
    has_cable = ('FRONT_X' in df.columns and 'FRONT_Y' in df.columns and
                 'TAIL_X' in df.columns and 'TAIL_Y' in df.columns)

    if has_cable:
        return _estimate_from_cable_vector(df, trim_pct)

    # Track 좌표만 있는 경우
    if 'SOU_X' in df.columns and 'SOU_Y' in df.columns:
        x = df['SOU_X'].values.astype(float)
        y = df['SOU_Y'].values.astype(float)
        coord_source = 'SOU'
    elif 'FRONT_X' in df.columns and 'FRONT_Y' in df.columns:
        x = df['FRONT_X'].values.astype(float)
        y = df['FRONT_Y'].values.astype(float)
        coord_source = 'FRONT'
    else:
        raise ValueError("방위각 추정에 필요한 좌표 컬럼이 없습니다 (SOU_X/Y 또는 FRONT_X/Y)")

    n = len(x)
    if n < 10:
        raise ValueError(f"데이터 포인트 부족: {n}개 (최소 10개 필요)")

    # NaN 제거
    valid = ~(np.isnan(x) | np.isnan(y))
    x, y = x[valid], y[valid]
    n = len(x)

    # 양 끝 trim
    trim = max(1, int(n * trim_pct / 100))
    xm, ym = x[trim:-trim], y[trim:-trim]

    if len(xm) < 5:
        # trim이 너무 많으면 전체 사용
        xm, ym = x, y

    estimates = []

    # ── 방법 A: 시작~끝 벡터 ──
    # 노이즈 감소를 위해 처음/마지막 5% 평균 사용
    chunk = max(1, len(xm) // 20)
    x_start, y_start = np.mean(xm[:chunk]), np.mean(ym[:chunk])
    x_end, y_end = np.mean(xm[-chunk:]), np.mean(ym[-chunk:])
    dx, dy = x_end - x_start, y_end - y_start
    az_gross = (np.degrees(np.arctan2(dx, dy)) + 360) % 360
    estimates.append(az_gross)

    # ── 방법 B: 구간 방위각 중앙값 ──
    step = max(1, len(xm) // 100)  # ~100개 구간
    seg_dx = xm[step:] - xm[:-step]
    seg_dy = ym[step:] - ym[:-step]
    seg_az = (np.degrees(np.arctan2(seg_dx, seg_dy)) + 360) % 360
    # circular median: 가장 빈도 높은 방향 근처의 중앙값
    az_median = _circular_median(seg_az)
    estimates.append(az_median)

    # ── 방법 C: PCA 주성분 ──
    coords = np.column_stack([xm - np.mean(xm), ym - np.mean(ym)])
    cov = np.cov(coords.T)
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    # 가장 큰 고유벡터가 주축 방향
    principal = eigenvectors[:, np.argmax(eigenvalues)]
    az_pca = (np.degrees(np.arctan2(principal[0], principal[1])) + 360) % 360
    # PCA는 방향 모호 (±180°) → gross direction에 가까운 쪽 선택
    if abs(_angle_diff(az_pca, az_gross)) > 90:
        az_pca = (az_pca + 180) % 360
    estimates.append(az_pca)

    # ── Circular mean of 3 estimates ──
    final_az = _circular_mean(np.array(estimates))

    # ── 신뢰도 판단 ──
    spread = max(abs(_angle_diff(e, final_az)) for e in estimates)
    if spread < 2.0:
        confidence = 'high'
    elif spread < 5.0:
        confidence = 'medium'
    else:
        confidence = 'low'

    # 반올림
    final_rounded = round(final_az, 1)
    # Track heading은 선박 진행 방향 — 케이블은 반대쪽이므로 reverse도 제시
    reverse_az = round((final_az + 180) % 360, 1)

    result = {
        'azimuth': final_rounded,
        'azimuth_reverse': reverse_az,
        'confidence': confidence,
        'spread': round(spread, 2),
        'method': 'track_heading',
        'coord_source': coord_source,
        'data_points': n,
        'trimmed_points': len(xm),
        'method_detail': {
            'gross': round(az_gross, 2),
            'median': round(az_median, 2),
            'pca': round(az_pca, 2),
        },
        'note': '선박 진행 방향 기준. 케이블 방향은 azimuth_reverse 참고. '
                'NPD 데이터(FRONT/TAIL)가 있으면 더 정확한 추정 가능.',
    }

    print(f"  방위각 자동 추정 (Track heading): {final_rounded}° (반대: {reverse_az}°)")
    print(f"    신뢰도: {confidence} | 분산: {spread:.1f}°")
    print(f"    Gross: {az_gross:.1f}° | Median: {az_median:.1f}° | PCA: {az_pca:.1f}°")

    return result


def _estimate_from_cable_vector(df, trim_pct=20):
    """FRONT→TAIL 벡터에서 직접 케이블 방위각을 추정 (가장 정확한 방법).

    매칭된 데이터에 FRONT_X/Y, TAIL_X/Y가 모두 있을 때 사용.
    """
    fx = df['FRONT_X'].values.astype(float)
    fy = df['FRONT_Y'].values.astype(float)
    tx = df['TAIL_X'].values.astype(float)
    ty = df['TAIL_Y'].values.astype(float)

    # NaN 제거
    valid = ~(np.isnan(fx) | np.isnan(fy) | np.isnan(tx) | np.isnan(ty))
    fx, fy, tx, ty = fx[valid], fy[valid], tx[valid], ty[valid]
    n = len(fx)

    if n < 5:
        raise ValueError(f"유효 데이터 부족: {n}개")

    # 양 끝 trim (run-in/out 제거)
    trim = max(1, int(n * trim_pct / 100))
    sl = slice(trim, -trim) if trim < n // 2 else slice(None)

    # Front→Tail 벡터의 방위각
    dx = tx[sl] - fx[sl]
    dy = ty[sl] - fy[sl]
    cable_az = (np.degrees(np.arctan2(dx, dy)) + 360) % 360

    # 3가지 집계
    az_mean = _circular_mean(cable_az)
    az_median = _circular_median(cable_az)
    # Robust: 중앙 50% IQR만 사용
    deviations = np.array([_angle_diff(a, az_mean) for a in cable_az])
    q25, q75 = np.percentile(deviations, [25, 75])
    iqr_mask = (deviations >= q25) & (deviations <= q75)
    az_iqr = _circular_mean(cable_az[iqr_mask]) if np.sum(iqr_mask) > 5 else az_mean

    estimates = [az_mean, az_median, az_iqr]
    final_az = _circular_mean(np.array(estimates))
    spread = max(abs(_angle_diff(e, final_az)) for e in estimates)

    if spread < 1.0:
        confidence = 'high'
    elif spread < 3.0:
        confidence = 'medium'
    else:
        confidence = 'low'

    final_rounded = round(final_az, 1)

    result = {
        'azimuth': final_rounded,
        'confidence': confidence,
        'spread': round(spread, 2),
        'method': 'cable_vector',
        'coord_source': 'FRONT→TAIL',
        'data_points': n,
        'trimmed_points': int(np.sum(np.ones_like(dx))),
        'method_detail': {
            'mean': round(az_mean, 2),
            'median': round(az_median, 2),
            'iqr_mean': round(az_iqr, 2),
        },
    }

    # 선박 진행 방향도 추가 계산 (SOU 좌표가 있으면)
    ship_heading = None
    if 'SOU_X' in df.columns and 'SOU_Y' in df.columns:
        sx = df['SOU_X'].values.astype(float)
        sy = df['SOU_Y'].values.astype(float)
        sv = ~(np.isnan(sx) | np.isnan(sy))
        sx, sy = sx[sv], sy[sv]
        if len(sx) > 10:
            st = max(1, int(len(sx) * trim_pct / 100))
            sxm, sym = sx[st:-st], sy[st:-st]
            chunk_s = max(1, len(sxm) // 20)
            sdx = np.mean(sxm[-chunk_s:]) - np.mean(sxm[:chunk_s])
            sdy = np.mean(sym[-chunk_s:]) - np.mean(sym[:chunk_s])
            ship_heading = round((np.degrees(np.arctan2(sdx, sdy)) + 360) % 360, 1)

    result['ship_heading'] = ship_heading
    if ship_heading is not None:
        result['ship_heading_reverse'] = round((ship_heading + 180) % 360, 1)

    print(f"  방위각 자동 추정 (케이블 벡터): {final_rounded}° (신뢰도: {confidence})")
    if ship_heading is not None:
        print(f"    선박 진행 방향: {ship_heading}° (반대: {(ship_heading + 180) % 360:.1f}°)")
    print(f"    Mean: {az_mean:.1f}° | Median: {az_median:.1f}° | IQR-Mean: {az_iqr:.1f}°")

    return result


def _angle_diff(a, b):
    """두 각도 사이의 signed 차이 (-180 ~ +180)"""
    d = (a - b + 180) % 360 - 180
    return d


def _circular_mean(angles_deg):
    """각도의 circular mean (도 단위)"""
    rad = np.radians(angles_deg)
    mean_sin = np.mean(np.sin(rad))
    mean_cos = np.mean(np.cos(rad))
    return (np.degrees(np.arctan2(mean_sin, mean_cos)) + 360) % 360


def _circular_median(angles_deg):
    """각도의 circular median (도 단위)"""
    # circular median: 모든 각도와의 circular distance 합이 최소인 값
    # 근사: reference를 circular mean으로 잡고, unwrap 후 일반 median
    ref = _circular_mean(angles_deg)
    unwrapped = np.array([_angle_diff(a, ref) for a in angles_deg])
    return (ref + np.median(unwrapped)) % 360


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
    """축 좌표 포맷터: 순수 숫자 (과학적 표기 X)"""
    return f"{val:,.0f}"


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

    legend = ax.legend(loc='lower left', fontsize=9, framealpha=0.9,
                        ncol=2, borderaxespad=1.0)
    for text in legend.get_texts():
        text.set_color(_PLOT_STYLE["text"])

    ax.set_aspect('equal', adjustable='datalim')
    _add_watermark(fig)

    plt.savefig(output_path, bbox_inches='tight', pad_inches=0.4)
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

    legend = ax.legend(loc='lower right', fontsize=9, framealpha=0.9,
                        ncol=2, borderaxespad=1.0)
    for text in legend.get_texts():
        text.set_color(_PLOT_STYLE["text"])

    _add_watermark(fig)

    plt.savefig(output_path, bbox_inches='tight', pad_inches=0.4)
    plt.close()

    print(f"  그래프 저장: {output_path}")

    return {
        'mean': mean_f,
        'std': std_f,
        'min': min_f,
        'max': max_f,
        'range': max_f - min_f,
    }


def plot_histogram(feathering, feathering_limit, line_name, output_path):
    """Feathering 각도 히스토그램 생성"""

    fig, ax = plt.subplots(figsize=(14, 7))

    bin_width = max(0.5, (np.max(feathering) - np.min(feathering)) / 50)
    bins = np.arange(np.floor(np.min(feathering)), np.ceil(np.max(feathering)) + bin_width, bin_width)

    n, bin_edges, patches = ax.hist(feathering, bins=bins, edgecolor=_PLOT_STYLE["card"],
                                     linewidth=0.3, alpha=0.85, color=_PLOT_STYLE["accent"])

    # 초과 구간 색칠
    if feathering_limit > 0:
        for patch, left_edge in zip(patches, bin_edges[:-1]):
            if abs(left_edge) > feathering_limit or abs(left_edge + bin_width) > feathering_limit:
                patch.set_facecolor(_PLOT_STYLE["warn"])
                patch.set_alpha(0.9)

    # 통계 라인
    ax.axvline(x=np.mean(feathering), color=_PLOT_STYLE["accent2"], linestyle='--',
               linewidth=1.5, label=f'Mean: {np.mean(feathering):.2f}°')
    ax.axvline(x=np.median(feathering), color=_PLOT_STYLE["cyan"], linestyle='-.',
               linewidth=1.2, label=f'Median: {np.median(feathering):.2f}°')

    if feathering_limit > 0:
        ax.axvline(x=feathering_limit, color=_PLOT_STYLE["warn"], linestyle='--',
                   linewidth=1.2, label=f'Limit: ±{feathering_limit}°')
        ax.axvline(x=-feathering_limit, color=_PLOT_STYLE["warn"], linestyle='--', linewidth=1.2)

    # 정규분포 피팅 오버레이
    from scipy import stats as sp_stats
    mu, sigma = np.mean(feathering), np.std(feathering)
    x_norm = np.linspace(np.min(feathering), np.max(feathering), 200)
    y_norm = sp_stats.norm.pdf(x_norm, mu, sigma) * len(feathering) * bin_width
    ax.plot(x_norm, y_norm, color=_PLOT_STYLE["magenta"], linewidth=1.5,
            alpha=0.7, label=f'Normal fit (σ={sigma:.2f}°)')

    ax.set_xlabel('Feathering Angle (°)', fontweight='bold')
    ax.set_ylabel('Count', fontweight='bold')
    ax.set_title(f'Feathering Distribution — {line_name}', fontweight='bold', pad=14)

    ax.xaxis.set_minor_locator(AutoMinorLocator(2))
    ax.yaxis.set_minor_locator(AutoMinorLocator(2))
    ax.grid(True, which="major", alpha=0.4)
    ax.grid(True, which="minor", alpha=0.15, linewidth=0.4)
    ax.ticklabel_format(style='plain', axis='both')

    legend = ax.legend(loc='upper left', fontsize=9, framealpha=0.9)
    for text in legend.get_texts():
        text.set_color(_PLOT_STYLE["text"])

    # 통계 박스
    stats_text = (
        f"N = {len(feathering):,}\n"
        f"Mean = {mu:+.2f}°\n"
        f"Std = {sigma:.2f}°\n"
        f"Min = {np.min(feathering):+.2f}°\n"
        f"Max = {np.max(feathering):+.2f}°"
    )
    props = dict(boxstyle='round,pad=0.5', facecolor=_PLOT_STYLE["card"],
                 edgecolor=_PLOT_STYLE["accent"], alpha=0.9, linewidth=1.0)
    ax.text(0.98, 0.95, stats_text, transform=ax.transAxes, fontsize=9,
            verticalalignment='top', horizontalalignment='right',
            fontfamily='monospace', color=_PLOT_STYLE["text"], bbox=props)

    _add_watermark(fig)

    plt.savefig(output_path, bbox_inches='tight', pad_inches=0.4)
    plt.close()
    print(f"  히스토그램 저장: {output_path}")


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
