export type Locale = "ko" | "en";

const dict = {
  // ── App Shell / Layout ──
  "app.title": { ko: "Feathering Analysis", en: "Feathering Analysis" },
  "app.ready": { ko: "대기", en: "Ready" },
  "app.running": { ko: "분석 중", en: "Running" },
  "app.done": { ko: "완료", en: "Done" },

  // Sidebar
  "nav.input": { ko: "입력 설정", en: "Input Setup" },
  "nav.input.desc": { ko: "파일, 헤더, 방위각", en: "Files, headers, azimuth" },
  "nav.options": { ko: "분석 옵션", en: "Analysis Options" },
  "nav.options.desc": { ko: "매칭, 출력 정책", en: "Matching & output policy" },
  "nav.batch": { ko: "배치 / 비교", en: "Batch / Compare" },
  "nav.batch.desc": { ko: "폴더 스캔, 시나리오 비교", en: "Folder scan & scenarios" },
  "nav.log": { ko: "실행 로그", en: "Run Log" },
  "nav.log.desc": { ko: "진행 상황, 메시지", en: "Progress & messages" },
  "nav.results": { ko: "결과", en: "Results" },
  "nav.results.desc": { ko: "통계, 차트, 출력물", en: "Stats, charts, output" },
  "nav.help": { ko: "도움말", en: "Help" },
  "nav.help.desc": { ko: "사용법, 파일 형식", en: "Usage & file formats" },

  // Bottom bar
  "btn.run": { ko: "분석 실행", en: "Run Analysis" },
  "btn.running": { ko: "분석 중...", en: "Analyzing..." },
  "btn.openFolder": { ko: "출력 폴더 열기", en: "Open Output" },

  // ── Input Panel ──
  "input.files": { ko: "파일 선택", en: "Source Files" },
  "input.npd": { ko: "NPD File", en: "NPD File" },
  "input.track": { ko: "Track File", en: "Track File" },
  "input.npd.placeholder": { ko: "NPD 파일을 드래그하거나 선택하세요", en: "Drag or select NPD file" },
  "input.track.placeholder": { ko: "Tab-separated survey track 파일", en: "Tab-separated survey track file" },
  "input.lineName": { ko: "Line Name", en: "Line Name" },
  "input.lineName.placeholder": { ko: "자동 감지 (Track 파일명 기반)", en: "Auto-detect from track filename" },
  "input.connected": { ko: "연결됨", en: "Connected" },
  "input.formatOk": { ko: "형식 확인됨", en: "Format OK" },
  "input.formatBad": { ko: "형식 미지원", en: "Unsupported" },
  "input.select": { ko: "선택", en: "Browse" },

  // Header mapping
  "header.title": { ko: "Position 헤더", en: "Position Headers" },
  "header.detected": { ko: "개 감지", en: " detected" },
  "header.head": { ko: "Head Position", en: "Head Position" },
  "header.tail": { ko: "Tail Position", en: "Tail Position" },

  // Analysis parameters
  "param.title": { ko: "분석 파라미터", en: "Analysis Parameters" },
  "param.azimuth": { ko: "Planned Azimuth (°)", en: "Planned Azimuth (°)" },
  "param.limit": { ko: "Feathering Limit (°)", en: "Feathering Limit (°)" },
  "param.limit.placeholder": { ko: "0 = 제한 없음", en: "0 = no limit" },
  "param.runIn": { ko: "Run-in (m)", en: "Run-in (m)" },
  "param.runOut": { ko: "Run-out (m)", en: "Run-out (m)" },

  // Workflow status
  "status.title": { ko: "실행 준비", en: "Readiness" },
  "status.files": { ko: "파일", en: "Files" },
  "status.files.ok": { ko: "NPD + Track 연결됨", en: "NPD + Track connected" },
  "status.files.need": { ko: "파일을 선택하세요", en: "Select files" },
  "status.header": { ko: "헤더", en: "Headers" },
  "status.header.wait": { ko: "NPD 스캔 대기", en: "Waiting for NPD scan" },
  "status.azimuth": { ko: "방위각", en: "Azimuth" },
  "status.azimuth.notset": { ko: "미설정", en: "Not set" },
  "status.ready": { ko: "준비", en: "Ready" },
  "status.ready.ok": { ko: "분석 가능", en: "Ready to run" },
  "status.ready.need": { ko: "위 항목을 완료하세요", en: "Complete above items" },
  "btn.estimate": { ko: "방위각 추정", en: "Estimate Azimuth" },
  "btn.estimating": { ko: "추정 중", en: "Estimating" },

  // Presets
  "preset.title": { ko: "Quick Presets", en: "Quick Presets" },

  // Blueprint
  "blueprint.title": { ko: "설정 요약", en: "Summary" },
  "blueprint.npd": { ko: "NPD", en: "NPD" },
  "blueprint.track": { ko: "Track", en: "Track" },
  "blueprint.headers": { ko: "헤더", en: "Headers" },
  "blueprint.matching": { ko: "매칭", en: "Matching" },
  "blueprint.window": { ko: "Window", en: "Window" },
  "blueprint.limit": { ko: "Limit", en: "Limit" },
  "blueprint.output": { ko: "출력", en: "Output" },
  "blueprint.notSelected": { ko: "미선택", en: "Not selected" },
  "blueprint.waiting": { ko: "대기", en: "Waiting" },
  "blueprint.none": { ko: "없음", en: "None" },
  "blueprint.trackFolder": { ko: "Track 폴더", en: "Track folder" },

  // Azimuth estimate
  "az.title": { ko: "방위각 추정 결과", en: "Azimuth Estimate" },
  "az.recommended": { ko: "추천 방위각", en: "Recommended" },
  "az.current": { ko: "현재 입력", en: "Current input" },
  "az.ship": { ko: "선박 방향", en: "Ship heading" },
  "az.mismatch": { ko: "추정값과 다름", en: "Differs from estimate" },

  // ── Options Panel ──
  "opt.title": { ko: "분석 옵션", en: "Analysis Options" },
  "opt.fastMatch": { ko: "고속 매칭", en: "Fast Matching" },
  "opt.fastMatch.desc": { ko: "허용 오차 내 근사 매칭 사용", en: "Use approximate matching within tolerance" },
  "opt.tolerance": { ko: "허용 오차 (초)", en: "Tolerance (sec)" },
  "opt.outputDir": { ko: "출력 폴더", en: "Output Folder" },
  "opt.outputDir.placeholder": { ko: "미지정 시 Track 파일과 같은 폴더", en: "Default: same as track file" },
  "opt.autoOpen": { ko: "분석 완료 후 폴더 자동 열기", en: "Open folder after analysis" },

  // ── Results Panel ──
  "res.noResult": { ko: "결과 없음", en: "No Results" },
  "res.noResult.title": { ko: "분석을 실행하면 결과가 표시됩니다.", en: "Run analysis to see results." },
  "res.noResult.desc": { ko: "통계, 차트, 생성된 파일을 확인할 수 있습니다.", en: "View statistics, charts, and generated files." },
  "res.stale": { ko: "입력이 변경되어 결과가 오래되었습니다.", en: "Results are outdated due to input changes." },
  "res.rerun": { ko: "다시 실행", en: "Re-run" },
  "res.output": { ko: "출력물", en: "Output Package" },
  "res.output.desc": { ko: "생성된 파일 확인 및 열기", en: "View and open generated files" },
  "res.files": { ko: "생성된 파일", en: "Generated Files" },
  "res.files.waiting": { ko: "분석 완료 후 파일 목록이 표시됩니다.", en: "Files will appear after analysis." },
  "res.chart.feathering": { ko: "Feathering Plot", en: "Feathering Plot" },
  "res.chart.track": { ko: "Track Plot", en: "Track Plot" },
  "res.chart.histogram": { ko: "Histogram", en: "Histogram" },

  // ── Log Panel ──
  "log.title": { ko: "실행 로그", en: "Run Log" },
  "log.clear": { ko: "지우기", en: "Clear" },
  "log.empty": { ko: "로그가 없습니다. 분석을 실행하세요.", en: "No logs yet. Run an analysis." },

  // ── Help Panel ──
  "help.title": { ko: "도움말", en: "Help" },

  // ── Misc ──
  "drop.hint": { ko: "파일을 여기에 놓으세요", en: "Drop file here" },
  "shortcut.run": { ko: "분석 실행", en: "Run analysis" },
  "shortcut.openNpd": { ko: "NPD 열기", en: "Open NPD" },
  "shortcut.save": { ko: "설정 저장", en: "Save settings" },
} as const;

export type TransKey = keyof typeof dict;

let currentLocale: Locale = "ko";
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  for (const fn of listeners) fn();
}

export function toggleLocale(): Locale {
  const next = currentLocale === "ko" ? "en" : "ko";
  setLocale(next);
  return next;
}

export function t(key: TransKey): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[currentLocale] || entry.en;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
