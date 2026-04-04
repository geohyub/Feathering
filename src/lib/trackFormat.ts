import { readTextFile } from "@tauri-apps/plugin-fs";

export type TrackFormatStatus = "idle" | "checking" | "supported" | "unsupported";

export interface TrackFormatAssessment {
  status: TrackFormatStatus;
  message: string;
  detail: string;
}

const REQUIRED_TRACK_COLUMNS = [
  "TRACENO",
  "FFID",
  "CHAN",
  "SOU_X",
  "SOU_Y",
  "DAY",
  "HOUR",
  "MINUTE",
  "SECOND",
] as const;

function normalize(value: string) {
  return value.trim().replace(/\uFEFF/g, "");
}

function hasRequiredColumns(line: string) {
  const normalized = line.toUpperCase();
  return REQUIRED_TRACK_COLUMNS.every((column) => normalized.includes(column));
}

export async function inspectTrackFile(path: string): Promise<TrackFormatAssessment> {
  if (!path) {
    return {
      status: "idle",
      message: "Track 파일을 선택해 주세요.",
      detail: "Feathering은 track 입력이 있어야 실제 분석을 시작할 수 있습니다.",
    };
  }

  try {
    const content = await readTextFile(path);
    const sample = content.slice(0, 8192);
    const lines = sample
      .split(/\r?\n/)
      .map(normalize)
      .filter(Boolean)
      .slice(0, 8);

    if (lines.length === 0) {
      return {
        status: "unsupported",
        message: "Track 파일이 비어 있습니다.",
        detail:
          "Feathering은 NPD와 시간 매칭할 수 있는 survey track이 필요합니다. 파일에 헤더와 데이터 행이 모두 있는지 확인해 주세요.",
      };
    }

    const headerLine = lines[0];
    const looksLikeRawNmea =
      /^\$?GP(?:GGA|GLL|RMC|VTG|GSA|GSV)\b/i.test(headerLine) ||
      lines.some((line) => /^\$?GP(?:GGA|GLL|RMC|VTG|GSA|GSV)\b/i.test(line)) ||
      sample.includes("GPGGA");

    const commaSeparated = headerLine.includes(",") && !headerLine.includes("\t");
    const tabSeparated = headerLine.includes("\t");
    const hasRequired = hasRequiredColumns(headerLine);

    if (looksLikeRawNmea) {
      return {
        status: "unsupported",
        message: "원시 GPGGA/NMEA nav 로그는 직접 사용할 수 없습니다.",
        detail:
          "Feathering은 탭으로 구분된 survey track 파일을 기대합니다. raw GPGGA는 먼저 survey track으로 변환한 뒤 다시 넣어 주세요.",
      };
    }

    if (hasRequired && tabSeparated) {
      return {
        status: "supported",
        message: "탭으로 구분된 survey track 형식이 확인됐습니다.",
        detail: `필수 컬럼(${REQUIRED_TRACK_COLUMNS.join(", ")})이 보입니다. NPD와 시간 매칭할 수 있습니다.`,
      };
    }

    if (hasRequired && commaSeparated) {
      return {
        status: "unsupported",
        message: "컬럼은 맞지만 구분자가 맞지 않습니다.",
        detail:
          "현재 파일은 쉼표로 구분된 형식처럼 보입니다. Feathering은 탭으로 구분된 track 파일을 사용합니다. 내보내기 설정을 다시 확인해 주세요.",
      };
    }

    if (tabSeparated) {
      return {
        status: "unsupported",
        message: "Track 헤더를 찾지 못했습니다.",
        detail:
          `Feathering은 ${REQUIRED_TRACK_COLUMNS.join(", ")} 컬럼이 있는 탭 구분 survey track을 기대합니다. 현재 파일의 첫 줄에서 필요한 컬럼을 확인할 수 없습니다.`,
      };
    }

    return {
      status: "unsupported",
      message: "지원되는 Track 형식이 아닙니다.",
      detail:
        "Feathering은 탭으로 구분된 survey track 파일을 사용합니다. raw GPGGA/NMEA nav 로그나 일반 메모 로그는 먼저 변환이 필요합니다.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "unsupported",
      message: "Track 파일을 읽을 수 없습니다.",
      detail: `파일을 열 수 없어서 형식을 확인하지 못했습니다. ${message}`,
    };
  }
}

export const TRACK_FORMAT_HINT =
  "지원되는 입력: 탭으로 구분된 survey track 파일. raw GPGGA / NMEA nav 로그는 먼저 변환해 주세요.";
