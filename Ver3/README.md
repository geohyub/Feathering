# Feathering Analysis v2.3

해양 탄성파 탐사(Seismic Survey) 데이터의 **페더링(Feathering) 각도**를 분석하는 데스크탑 GUI 도구입니다.

NPD 파일과 Track 파일을 입력하면 시간 기반 매칭 후 페더링 각도를 계산하고, 그래프/트랙맵/리포트를 자동 생성합니다.

---

## 실행 방법

### 1. EXE 실행 (권장 - 설치 불필요)

`dist/NPD_Feathering_Analysis.exe`를 더블클릭하면 바로 실행됩니다.
Python 설치 없이 Windows에서 단독 실행 가능합니다.

### 2. run.bat (Python 설치 필요)

`run.bat`을 더블클릭하면 Python 버전 확인, 패키지 자동 설치, GUI 실행까지 진행됩니다.

### 3. 직접 실행

```bash
# 패키지 설치
pip install -r requirements.txt

# GUI 실행
python GUI.py

# CLI 모드 (터미널 인터랙티브)
python Parser_2.py
```

---

## EXE 빌드 방법

Windows에서 직접 빌드하려면:

```
build_exe.bat
```

더블클릭하면 PyInstaller가 자동 설치되고 `dist/NPD_Feathering_Analysis.exe`가 생성됩니다.

수동 빌드:

```bash
pip install pyinstaller
pyinstaller NPD_Feathering.spec --noconfirm
```

---

## 요구 사항

**EXE 실행:** 없음 (Windows 단독 실행)

**Python 실행:**

- Python 3.10 이상
- pandas >= 1.5
- numpy >= 1.23
- matplotlib >= 3.6

**권장 폰트:** [Pretendard](https://github.com/orioncactus/pretendard) (설치하면 UI 가독성 향상. 없으면 맑은 고딕 등으로 자동 폴백)

---

## 파일 구성

```
├── GUI.py                      # 데스크탑 GUI (다크 테마)
├── Parser_2.py                 # 파싱/분석/시각화 엔진
├── run.bat                     # Windows 원클릭 실행기
├── build_exe.bat               # EXE 빌드 스크립트
├── NPD_Feathering.spec         # PyInstaller 빌드 설정
├── requirements.txt            # Python 패키지 의존성
└── README.md
```

---

## 기능

### 입력

| 항목 | 설명 |
|---|---|
| NPD 파일 | Head_Buoy / Tail_Buoy 좌표가 포함된 NPD 포지션 파일 |
| Track 파일 | 탭 구분 Track 파일 (FFID, SOU_X, SOU_Y, 시간 정보 포함) |
| 계획 방위각 | 라인의 계획된 방위각 (도, 북쪽 기준 시계방향) |
| Feathering 제한 | 허용 페더링 각도 (±도, 0이면 제한선 미표시) |
| Run-in / Run-out | 분석에서 제외할 시작/종료 구간 거리 (m) |

### 출력

| 파일 | 내용 |
|---|---|
| `{라인명}_feathering.csv` | 매칭 데이터 + 페더링 값 |
| `{라인명}_feathering.png` | 페더링 각도 그래프 (FFID 기준) |
| `{라인명}_trackplot.png` | 경로 지도 (Source/Buoy 위치, 이탈 구간 표시) |
| `{라인명}_report.txt` | 통계 리포트 (Mean, Std, Min/Max, Limit 초과 분석) |
| `{라인명}_gui_log_*.txt` | GUI 실행 로그 |

### 매칭 옵션

- **일반 매칭:** numpy searchsorted 기반 벡터화 매칭 (O(n log m), 30만 레코드도 수초 내 처리)
- **빠른 매칭:** 허용 시간차(초) 설정 가능, 범위 밖 레코드 자동 제외

---

### 도움말 탭

GUI 내 도움말 탭에서 다음 정보를 확인할 수 있습니다:

- NPD 파일 형식 예시 (Head_Buoy / Tail_Buoy 좌표 구조)
- Track 파일 형식 예시 (탭 구분, FFID/좌표/시간 컬럼)
- 분석 처리 흐름 다이어그램

---

## GUI 단축키

| 단축키 | 동작 |
|---|---|
| `Ctrl+R` | 분석 실행 |
| `Ctrl+O` | NPD 파일 열기 |
| `Ctrl+S` | 설정 저장 |

---

## 처리 흐름

```
NPD 파일 (Head_Buoy, Tail_Buoy 좌표)
Track 파일 (FFID, Source 좌표, 시간)
        │
        ▼
   시간 기반 매칭 (searchsorted)
        │
        ▼
   Feathering 각도 계산
   (Head→Tail 벡터 vs 계획 방위각)
        │
        ▼
   CSV + 그래프 + 트랙맵 + 리포트 출력
```

---

## 변경 이력

### v2.3
- 제목을 "Feathering Analysis"로 변경
- 사이드바 내비게이션 + 플랫 카드 디자인 전면 재설계
- 따뜻한 네이비 + 틸 악센트 컬러 팔레트 (#0d1117 / #3fb8af)
- 도움말 탭 추가 (NPD / Track 파일 형식 예시 및 분석 흐름 설명)
- run.bat CMD 인코딩 호환성 수정 (UTF-8 박스 문자 → ASCII)

### v2.2
- 사이드바 내비게이션 UI 도입 (탭 방식 → 5개 패널)
- 플랫 카드 + 악센트 좌측 바 디자인
- 토스트 알림, 커스텀 펄스 프로그레스 바
- 번호 기반 내비게이션 아이콘 (유니코드 호환성 개선)

### v2.1
- 다크 테마 전문 GUI 재설계
- Windows High-DPI 지원
- 시간 매칭 벡터화 최적화 (O(n*m) → O(n log m))
- 출판 수준 다크 테마 matplotlib 그래프
- 파일 존재 검증, 중복 실행 방지, elapsed timer 누수 수정
- EXE 빌드 지원 (PyInstaller)
- 한글 최적화 폰트 폴백 체인 (Pretendard → Noto Sans KR → 맑은 고딕)
