# Feathering Analysis

> 해양 탄성파 케이블 페더링 각도 계산/분석 데스크탑 애플리케이션

## 기술 스택

- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Desktop**: Tauri 2 (Rust)
- **Backend**: Python sidecar (Parser_2.py)
- **차트**: Recharts
- **상태관리**: Zustand

## 사전 요구사항

- Node.js 18+
- Rust (Tauri 2)
- Python 3.8+ (matplotlib, pandas, numpy)

## 실행

```bash
# 개발 모드
npm run tauri dev

# 또는
run.bat
```

## 빌드

```bash
npm run tauri build
```

## 프로젝트 구조

```
Feathering/
├── src/                  # React 프론트엔드
│   ├── components/       # UI 컴포넌트
│   ├── stores/           # Zustand 상태관리
│   └── App.tsx
├── src-tauri/            # Tauri (Rust) 백엔드
│   ├── python/           # Python sidecar
│   │   ├── backend.py    # Tauri-Python 브릿지
│   │   └── Parser_2.py   # 페더링 분석 엔진
│   └── src/              # Rust 소스
├── Sample/               # 테스트용 샘플 데이터
├── _legacy/              # 이전 버전 (Ver1~Ver4 Tkinter)
└── package.json
```

## 레거시 버전

`_legacy/` 폴더에 이전 Tkinter 기반 버전들이 보관되어 있습니다:
- **Ver1**: 초기 Tkinter 버전
- **Ver2**: 다크 테마 + EXE 빌드
- **Ver3**: 사이드바 네비게이션 UI
- **Ver4_tkinter**: 동적 NPD 헤더 감지 (v2.4)

## 라이선스

GeoView 내부 사용 전용
