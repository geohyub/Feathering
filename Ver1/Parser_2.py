#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPD Parser + Feathering Analysis - 통합 프로그램
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import sys
from pathlib import Path
import re
import os
from datetime import datetime, timedelta


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
        # HH:MM:SS.ffffff 형식
        parts = time_str.split(':')
        if len(parts) == 3:
            hours = parts[0].zfill(2)
            minutes = parts[1].zfill(2)
            seconds = float(parts[2])
            return f"{hours}:{minutes}:{seconds:06.3f}"
        return time_str
    except:
        return time_str


def parse_npd_file(npd_file_path, target_positions=None):
    """NPD 파일 파싱"""
    print(f"\n📂 NPD 파일 파싱 중: {Path(npd_file_path).name}")
    
    with open(npd_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    if len(lines) < 2:
        raise ValueError("NPD 파일에 충분한 데이터가 없습니다.")
    
    header_line = lines[0].strip()
    position_info = parse_npd_header(header_line)
    
    print(f"✓ {len(position_info)}개 Position 섹션 발견")
    
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
            # 시간 형식 변환
            formatted_time = format_time_hhmmss(time_str)
            row = {'Time': formatted_time}
            
            for pos_name, coords in position_data.items():
                display_name = rename_mapping.get(pos_name, pos_name)
                row[f'{display_name}_X'] = float(coords['east'])
                row[f'{display_name}_Y'] = float(coords['north'])
            data_rows.append(row)
    
    df = pd.DataFrame(data_rows)
    print(f"✓ 파싱 완료: {len(df)}개 레코드")
    
    return df


def parse_track_file(track_file_path):
    """Track 파일 파싱"""
    print(f"\n📂 Track 파일 파싱 중: {Path(track_file_path).name}")
    df = pd.read_csv(track_file_path, sep='\t')
    print(f"✓ {len(df)}개 레코드 로드")
    return df


def time_to_seconds(time_str):
    """HH:MM:SS.fff를 초로 변환"""
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    except:
        return None


def track_time_to_seconds(day, hour, minute, second):
    """Track 시간을 초로 변환"""
    try:
        return int(hour) * 3600 + int(minute) * 60 + float(second)
    except:
        return None


def match_npd_with_track(npd_df, track_df):
    """NPD와 Track 매칭"""
    print(f"\n⏱️  시간 매칭 수행 중...")
    
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
    
    track_min_time = track_df['time_seconds'].min()
    track_max_time = track_df['time_seconds'].max()
    
    npd_in_range = npd_df[
        (npd_df['time_seconds'] >= track_min_time) & 
        (npd_df['time_seconds'] <= track_max_time)
    ].copy()
    
    print(f"  시간 범위 내 NPD 레코드: {len(npd_in_range)}개")
    
    if len(npd_in_range) == 0:
        print("\n⚠️  경고: Track 시간 범위 내에 매칭되는 NPD 데이터가 없습니다.")
        return pd.DataFrame()
    
    matched_rows = []
    
    for idx, npd_row in npd_in_range.iterrows():
        npd_time = npd_row['time_seconds']
        track_df['time_diff'] = abs(track_df['time_seconds'] - npd_time)
        
        closest_idx = track_df['time_diff'].idxmin()
        track_row = track_df.loc[closest_idx]
        
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
    print(f"✓ 매칭 완료: {len(matched_df)}개 레코드")
    
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
    # Head -> Tail 방향 벡터
    dx = df['TAIL_X'].values - df['FRONT_X'].values
    dy = df['TAIL_Y'].values - df['FRONT_Y'].values
    
    # 실제 azimuth 계산 (북쪽 기준, 시계방향)
    actual_azimuth = np.degrees(np.arctan2(dx, dy))
    actual_azimuth = (actual_azimuth + 360) % 360
    
    # Feathering = 실제 - 계획
    feathering = actual_azimuth - planned_azimuth
    
    # -180 ~ 180 범위로 정규화
    feathering = np.where(feathering > 180, feathering - 360, feathering)
    feathering = np.where(feathering < -180, feathering + 360, feathering)
    
    return feathering


def calculate_distance_along_line(df):
    """라인을 따라 누적 거리 계산 (km)"""
    dx = np.diff(df['FRONT_X'].values, prepend=df['FRONT_X'].iloc[0])
    dy = np.diff(df['FRONT_Y'].values, prepend=df['FRONT_Y'].iloc[0])
    
    distances = np.sqrt(dx**2 + dy**2)
    cumulative_dist = np.cumsum(distances) / 1000.0  # m -> km
    
    return cumulative_dist


def detect_feathering_changes(feathering, threshold=5.0, min_duration=10, feathering_limit=0):
    """
    페더링 급변 구간 감지 - 다층 탐지 알고리즘
    
    3가지 방법으로 회피 기동 감지:
    1. 짧은 window 변화 (빠른 급변)
    2. 긴 window 변화 (지속적 bias 제외)
    3. Feathering limit 초과
    
    Args:
        feathering: 페더링 각도 배열
        threshold: 변화 임계값 (도)
        min_duration: 최소 지속 포인트 수
        feathering_limit: 제한치 (0이면 무시)
    
    Returns:
        list of (start_idx, end_idx, mean_change, detection_type)
    """
    # 전체 평균과 표준편차
    mean_feathering = np.mean(feathering)
    std_feathering = np.std(feathering)
    
    # 방법 1: 짧은 baseline (빠른 변화 감지)
    short_window = max(20, len(feathering) // 100)  # ~1%
    short_baseline = pd.Series(feathering).rolling(window=short_window, center=True, min_periods=1).mean().values
    short_deviation = feathering - short_baseline
    
    # 방법 2: 긴 baseline (지속적 추세)
    long_window = max(50, len(feathering) // 20)  # ~5%
    long_baseline = pd.Series(feathering).rolling(window=long_window, center=True, min_periods=1).mean().values
    long_deviation = feathering - long_baseline
    
    # 방법 3: 절대 변화율
    derivative = np.abs(np.diff(feathering, prepend=feathering[0]))
    
    # 적응형 임계값
    adaptive_threshold = max(threshold, std_feathering * 1.5)  # 2.0 → 1.5 (더 민감하게)
    
    # 감지 조건
    # 1. 짧은 deviation이 큼 (급변)
    short_significant = np.abs(short_deviation) > adaptive_threshold
    
    # 2. 긴 deviation도 큼 (지속적 bias 아님)
    long_significant = np.abs(long_deviation) > (adaptive_threshold * 0.7)
    
    # 3. 변화율이 빠름
    high_rate = derivative > (std_feathering * 0.3)  # 0.5 → 0.3 (더 민감하게)
    
    # 4. Limit 초과
    if feathering_limit > 0:
        limit_exceeded = np.abs(feathering) > feathering_limit
    else:
        limit_exceeded = np.zeros_like(feathering, dtype=bool)
    
    # 최종 조합: (짧은 변화 AND 빠른 변화율) OR (긴 변화 AND 빠른 변화율) OR (Limit 초과)
    significant = (short_significant & high_rate) | (long_significant & high_rate) | limit_exceeded
    
    # 노이즈 필터링
    smooth_window = 3
    smoothed = pd.Series(significant.astype(float)).rolling(window=smooth_window, center=True).mean().values
    significant = smoothed > 0.5
    
    # 연속된 구간 찾기
    changes = []
    in_change = False
    start_idx = 0
    
    for i in range(len(significant)):
        if significant[i] and not in_change:
            # 변화 시작
            in_change = True
            start_idx = i
        elif not significant[i] and in_change:
            # 변화 종료
            duration = i - start_idx
            if duration >= min_duration:
                # 변화량 계산
                segment = feathering[start_idx:i]
                mean_change = np.mean(segment) - mean_feathering
                max_value = np.max(np.abs(segment))
                
                # 감지 타입 결정
                if np.any(limit_exceeded[start_idx:i]):
                    detection_type = "Limit Exceeded"
                elif np.mean(np.abs(short_deviation[start_idx:i])) > adaptive_threshold:
                    detection_type = "Sudden Change"
                else:
                    detection_type = "Sustained Deviation"
                
                changes.append((start_idx, i-1, mean_change, detection_type, max_value))
            
            in_change = False
    
    # 마지막 구간 처리
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
            
            changes.append((start_idx, len(feathering)-1, mean_change, detection_type, max_value))
    
    return changes


def plot_track(df, line_name, feathering, feathering_limit, output_path):
    """Track plot (경로 지도) 생성 - Source 위치 기반, FFID 및 이탈 구간 표시"""
    
    fig, ax = plt.subplots(figsize=(14, 12))
    
    # Feathering limit 초과 구간 찾기
    exceeded_mask = np.zeros(len(df), dtype=bool)
    if feathering_limit > 0:
        exceeded_mask = np.abs(feathering) > feathering_limit
    
    # Source 경로 (메인)
    if 'SOU_X' in df.columns and 'SOU_Y' in df.columns:
        # 정상 구간 (파란색)
        normal_mask = ~exceeded_mask
        if np.any(normal_mask):
            ax.plot(df.loc[normal_mask, 'SOU_X'], df.loc[normal_mask, 'SOU_Y'], 
                   'b-', linewidth=2.0, label='Source (Normal)', alpha=0.8)
        
        # 이탈 구간 (빨간색)
        if np.any(exceeded_mask):
            ax.plot(df.loc[exceeded_mask, 'SOU_X'], df.loc[exceeded_mask, 'SOU_Y'], 
                   'r-', linewidth=2.5, label=f'Exceeded ±{feathering_limit}°', alpha=0.9)
        
        # 시작점과 끝점 표시
        ax.plot(df['SOU_X'].iloc[0], df['SOU_Y'].iloc[0], 'go', markersize=12, 
               label='Start', markeredgecolor='black', markeredgewidth=2)
        ax.plot(df['SOU_X'].iloc[-1], df['SOU_Y'].iloc[-1], 'ro', markersize=12, 
               label='End', markeredgecolor='black', markeredgewidth=2)
    
    # FRONT와 TAIL 경로 (참고용, 얇게)
    ax.plot(df['FRONT_X'], df['FRONT_Y'], 'c-', linewidth=0.8, label='Head Buoy', alpha=0.4)
    ax.plot(df['TAIL_X'], df['TAIL_Y'], 'm-', linewidth=0.8, label='Tail Buoy', alpha=0.4)
    
    # FFID 주석 표시 (일정 간격)
    if 'FFID' in df.columns:
        # 전체 데이터의 10% 간격으로 FFID 표시 (약 10개)
        interval = max(1, len(df) // 10)
        
        for i in range(0, len(df), interval):
            ffid_val = df['FFID'].iloc[i]
            x_val = df['SOU_X'].iloc[i] if 'SOU_X' in df.columns else df['FRONT_X'].iloc[i]
            y_val = df['SOU_Y'].iloc[i] if 'SOU_Y' in df.columns else df['FRONT_Y'].iloc[i]
            
            # 이탈 구간이면 빨간색, 아니면 검은색
            color = 'red' if exceeded_mask[i] else 'black'
            fontweight = 'bold' if exceeded_mask[i] else 'normal'
            
            ax.annotate(f'{int(ffid_val)}', 
                       xy=(x_val, y_val),
                       xytext=(5, 5), textcoords='offset points',
                       fontsize=9, fontweight=fontweight, color=color,
                       bbox=dict(boxstyle='round,pad=0.3', facecolor='white', 
                                edgecolor=color, alpha=0.7))
    
    # 레이블 및 제목
    ax.set_xlabel('East (m)', fontsize=14, fontweight='bold')
    ax.set_ylabel('North (m)', fontsize=14, fontweight='bold')
    
    title = f'Track Plot - {line_name}'
    if feathering_limit > 0:
        title += f' (Limit: ±{feathering_limit}°)'
    ax.set_title(title, fontsize=16, fontweight='bold')
    
    # 축 포맷 (과학적 표기법 제거)
    ax.ticklabel_format(style='plain', axis='both')
    ax.tick_params(axis='both', which='major', labelsize=12)
    
    ax.grid(True, alpha=0.3)
    ax.legend(loc='best', fontsize=11)
    ax.axis('equal')
    
    # 저장
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"✓ Track plot 저장: {output_path}")


def plot_feathering(df, feathering, planned_azimuth, run_in_m, run_out_m, 
                   feathering_limit, line_name, output_path):
    """Feathering 그래프 생성"""
    
    # FFID 추출
    ffid = df['FFID'].values
    first_ffid = ffid[0]
    last_ffid = ffid[-1]
    
    # 거리로 Run-in/out FFID 계산
    distance_m = calculate_distance_along_line(df) * 1000.0  # km -> m
    total_distance = distance_m[-1]
    
    # Run-in/out FFID 찾기
    if run_in_m > 0:
        run_in_idx = np.searchsorted(distance_m, run_in_m)
        run_in_ffid = ffid[run_in_idx] if run_in_idx < len(ffid) else first_ffid
    else:
        run_in_ffid = first_ffid
    
    if run_out_m > 0:
        # 끝에서부터 run_out_m 거리만큼
        run_out_distance = total_distance - run_out_m
        run_out_idx = np.searchsorted(distance_m, run_out_distance)
        run_out_ffid = ffid[run_out_idx] if run_out_idx < len(ffid) else last_ffid
    else:
        run_out_ffid = last_ffid
    
    # 통계 계산 (Run-in/out 제외)
    main_line_mask = (ffid >= run_in_ffid) & (ffid <= run_out_ffid)
    main_feathering = feathering[main_line_mask]
    
    mean_feathering = np.mean(main_feathering)
    std_feathering = np.std(main_feathering)
    min_feathering = np.min(main_feathering)
    max_feathering = np.max(main_feathering)
    
    # 그래프 생성
    fig, ax = plt.subplots(figsize=(18, 7))
    
    # Run-in 구간 (초록색)
    if run_in_m > 0:
        ax.axvspan(first_ffid, run_in_ffid, alpha=0.2, color='green', label='Run-in (SoL)')
    
    # Run-out 구간 (빨간색)
    if run_out_m > 0:
        ax.axvspan(run_out_ffid, last_ffid, alpha=0.2, color='red', label='Run-out (EoL)')
    
    # Feathering 데이터
    ax.plot(ffid, feathering, 'k-', linewidth=0.5, label='Feathering')
    
    # 0도 기준선
    ax.axhline(y=0, color='gray', linestyle='--', linewidth=0.5, alpha=0.5)
    
    # Feathering 제한선
    if feathering_limit > 0:
        ax.axhline(y=feathering_limit, color='red', linestyle='--', linewidth=1.5, 
                  alpha=0.7, label=f'Limit: ±{feathering_limit}°')
        ax.axhline(y=-feathering_limit, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
    
    # 통계 박스
    stats_text = f"Main Line Stats:\nMean: {mean_feathering:.2f}° (±{std_feathering:.2f}°)\n"
    stats_text += f"Range: {min_feathering:.2f}° ~ {max_feathering:.2f}°"
    
    ax.text(0.02, 0.98, stats_text, transform=ax.transAxes,
           fontsize=12, verticalalignment='top',
           bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    # 레이블 및 제목
    ax.set_xlabel('FFID', fontsize=14, fontweight='bold')
    ax.set_ylabel('Feathering angle (deg)', fontsize=14, fontweight='bold')
    ax.set_title(f'Feathering Analysis - {line_name} (Planned Azimuth: {planned_azimuth}°)', 
                fontsize=16, fontweight='bold')
    
    # X축 포맷 (과학적 표기법 제거)
    ax.ticklabel_format(style='plain', axis='x')
    ax.tick_params(axis='both', which='major', labelsize=12)
    
    ax.grid(True, alpha=0.3)
    ax.legend(loc='upper right', fontsize=11)
    
    # 저장
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"✓ 그래프 저장: {output_path}")
    
    return {
        'mean': mean_feathering,
        'std': std_feathering,
        'min': min_feathering,
        'max': max_feathering,
        'range': max_feathering - min_feathering
    }


def generate_report(df, feathering, stats, planned_azimuth, 
                   run_in_m, run_out_m, line_name, feathering_limit, output_path):
    """텍스트 리포트 생성 - Feathering 통계 중심"""
    
    # Limit 초과 분석
    if feathering_limit > 0:
        exceeded_mask = np.abs(feathering) > feathering_limit
        exceeded_count = np.sum(exceeded_mask)
        exceeded_percent = (exceeded_count / len(feathering)) * 100
        
        # 초과 구간의 통계
        if exceeded_count > 0:
            exceeded_values = feathering[exceeded_mask]
            max_exceeded = np.max(np.abs(exceeded_values))
            mean_exceeded = np.mean(exceeded_values)
        else:
            max_exceeded = 0
            mean_exceeded = 0
    else:
        exceeded_count = 0
        exceeded_percent = 0
        max_exceeded = 0
        mean_exceeded = 0
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write(f"  FEATHERING ANALYSIS REPORT - {line_name}\n")
        f.write("="*70 + "\n\n")
        
        f.write(f"Planned Azimuth: {planned_azimuth}°\n")
        f.write(f"Run-in Distance: {run_in_m} m\n")
        f.write(f"Run-out Distance: {run_out_m} m\n")
        f.write(f"Total Records: {len(df)}\n\n")
        
        f.write("-"*70 + "\n")
        f.write("MAIN LINE STATISTICS (Run-in/out Excluded)\n")
        f.write("-"*70 + "\n")
        f.write(f"Mean Feathering:    {stats['mean']:8.2f}° (±{stats['std']:.2f}°)\n")
        f.write(f"Minimum:            {stats['min']:8.2f}°\n")
        f.write(f"Maximum:            {stats['max']:8.2f}°\n")
        f.write(f"Range:              {stats['range']:8.2f}°\n\n")
        
        if feathering_limit > 0:
            f.write("-"*70 + "\n")
            f.write(f"FEATHERING LIMIT ANALYSIS (±{feathering_limit}°)\n")
            f.write("-"*70 + "\n")
            f.write(f"Exceeded Points:    {exceeded_count} ({exceeded_percent:.1f}%)\n")
            
            if exceeded_count > 0:
                f.write(f"Max Exceedance:     {max_exceeded:.2f}°\n")
                f.write(f"Mean of Exceeded:   {mean_exceeded:.2f}°\n")
                f.write("\n")
                f.write("⚠️  Feathering exceeded the specified limit.\n")
                f.write("   Review the track plot for exact locations.\n")
            else:
                f.write("\n")
                f.write("✓ All feathering values are within the specified limit.\n")
        
        f.write("\n" + "="*70 + "\n")
    
    print(f"✓ 리포트 저장: {output_path}")


# ============================================================================
# 메인 프로그램
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
            print("❌ 값을 입력해주세요.")
            continue
        
        try:
            if input_type == float:
                return float(user_input)
            elif input_type == int:
                return int(user_input)
            else:
                return user_input
        except ValueError:
            print(f"❌ 올바른 {input_type.__name__} 값을 입력해주세요.")


def get_file_path(prompt, check_exists=True):
    """파일 경로 입력"""
    while True:
        file_path = input(prompt).strip().strip('"').strip("'")
        
        if not file_path:
            print("❌ 파일 경로를 입력해주세요.")
            continue
        
        if check_exists and not os.path.exists(file_path):
            print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
            continue
        
        return file_path


def interactive_mode():
    """인터랙티브 모드"""
    print("\n" + "="*70)
    print("  NPD Parser + Feathering Analysis")
    print("="*70)
    
    # NPD 파일
    print("\n" + "-"*70)
    npd_file = get_file_path("NPD 파일 경로: ")
    
    # Track 파일
    track_file = get_file_path("Track 파일 경로: ")
    
    # 라인명 추출 (track 파일 이름에서)
    line_name = Path(track_file).stem
    if '_track' in line_name.lower():
        line_name = line_name.split('_track')[0]
    
    # 저장 위치
    print("\n" + "-"*70)
    save_dir = get_file_path("결과 저장 폴더 (엔터=현재 폴더): ", check_exists=False)
    if not save_dir:
        save_dir = "."
    
    # 폴더 생성
    os.makedirs(save_dir, exist_ok=True)
    
    # Feathering 파라미터
    print("\n" + "-"*70)
    print("Feathering 분석 파라미터 입력")
    print("-"*70)
    
    planned_azimuth = get_input("계획된 라인 방위각 (도)", float)
    feathering_limit = get_input("Feathering 제한치 (±도, 0=표시안함)", float, default=0)
    run_in_m = get_input("Run-in 거리 (m)", float, default=0)
    run_out_m = get_input("Run-out 거리 (m)", float, default=0)
    
    # 처리 시작
    print("\n" + "="*70)
    print("처리 시작...")
    print("="*70)
    
    # NPD 파싱
    npd_df = parse_npd_file(npd_file, target_positions=['Head_Buoy', 'Tail_Buoy'])
    
    # Track 매칭
    track_df = parse_track_file(track_file)
    matched_df = match_npd_with_track(npd_df, track_df)
    
    if len(matched_df) == 0:
        print("\n❌ 매칭된 데이터가 없습니다.")
        return None
    
    # Feathering 계산
    print("\n📊 Feathering 계산 중...")
    feathering = calculate_feathering(matched_df, planned_azimuth)
    matched_df['Feathering'] = feathering
    
    # CSV 저장
    csv_path = os.path.join(save_dir, f"{line_name}_feathering.csv")
    matched_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"✓ CSV 저장: {csv_path}")
    
    # 그래프 생성
    print("\n📈 그래프 생성 중...")
    plot_path = os.path.join(save_dir, f"{line_name}_feathering.png")
    stats = plot_feathering(matched_df, feathering, planned_azimuth, 
                           run_in_m, run_out_m, feathering_limit, line_name, plot_path)
    
    # Track plot 생성
    print("\n🗺️  Track plot 생성 중...")
    track_plot_path = os.path.join(save_dir, f"{line_name}_trackplot.png")
    plot_track(matched_df, line_name, feathering, feathering_limit, track_plot_path)
    
    # 리포트 생성
    print("\n📄 리포트 생성 중...")
    report_path = os.path.join(save_dir, f"{line_name}_report.txt")
    generate_report(matched_df, feathering, stats, planned_azimuth,
                   run_in_m, run_out_m, line_name, feathering_limit, report_path)
    
    print("\n" + "="*70)
    print("✅ 모든 처리 완료!")
    print("="*70)
    print(f"\n생성된 파일:")
    print(f"  1. {csv_path}")
    print(f"  2. {plot_path}")
    print(f"  3. {track_plot_path}")
    print(f"  4. {report_path}")
    
    return matched_df


def main():
    # Jupyter 체크
    try:
        get_ipython()
        is_jupyter = True
    except NameError:
        is_jupyter = False
    
    # 명령줄 인자 체크
    if len(sys.argv) >= 3 and sys.argv[1] not in ['-f', '--']:
        print("명령줄 모드는 아직 구현되지 않았습니다.")
        print("인터랙티브 모드를 사용하세요: python feathering_analyzer.py")
        return None
    
    return interactive_mode()


if __name__ == "__main__":
    result = main()