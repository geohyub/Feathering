import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { useBackend } from "./useBackend";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { BackendMessage, BackendProgress, BackendResult, OutputFile } from "@/types";

function getFileType(path: string): OutputFile["type"] {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "png") return "PNG";
  if (ext === "pdf") return "PDF";
  if (ext === "txt") return "TXT";
  return "LOG";
}

function getFileName(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export function useAnalysis() {
  const store = useAppStore();

  const handleMessage = useCallback(
    (msg: BackendMessage) => {
      // Progress events
      if (msg.event === "progress") {
        const data = msg.data as BackendProgress;
        store.addLog(data.message, "info");
        store.setStatus(data.message);
        if (data.percent != null) {
          store.setProgressPercent(data.percent);
        }
        return;
      }

      // Error responses
      if (msg.error) {
        store.addLog(`Error: ${msg.error}`, "error");
        store.setStatus("Error");
        store.setRunning(false);
        toast.error(msg.error);
        return;
      }

      // Scan headers response
      if (msg.result && msg.id && typeof msg.result === "object") {
        const result = msg.result as Record<string, unknown>;

        if ("headers" in result) {
          const headers = result.headers as string[];
          store.setNpdHeaders(headers);
          if (headers.length >= 2) {
            // Smart defaults
            const headMatch = headers.find((h) =>
              /head|front/i.test(h)
            );
            const tailMatch = headers.find((h) =>
              /tail|rear|end/i.test(h)
            );
            if (headMatch) store.setHeadPosition(headMatch);
            if (tailMatch) store.setTailPosition(tailMatch);
          }
          store.addLog(
            `NPD 헤더 감지: ${headers.join(", ")}`,
            "success"
          );
          return;
        }

        // Azimuth estimation result
        if ("azimuth" in result && "confidence" in result) {
          const az = result as {
            azimuth: number;
            azimuth_reverse?: number | null;
            confidence: string;
            spread: number;
            method: string;
            ship_heading?: number | null;
            ship_heading_reverse?: number | null;
          };
          // track_heading 방식이면 케이블은 반대 방향이므로 reverse 사용
          const bestAzimuth = az.method === "track_heading" && az.azimuth_reverse != null
            ? az.azimuth_reverse
            : az.azimuth;
          store.setField("plannedAzimuth", String(bestAzimuth));
          const methodLabel = az.method === "cable_vector"
            ? "케이블 벡터"
            : "선박 역방향 추정";
          store.addLog(
            `방위각 자동 추정: ${az.azimuth}° (${methodLabel}, 신뢰도: ${az.confidence})`,
            "success"
          );
          if (az.ship_heading != null) {
            store.addLog(
              `  선박 방향: ${az.ship_heading}° / 반대: ${az.ship_heading_reverse}°`,
              "info"
            );
          }
          toast.success(`방위각 추정: ${bestAzimuth}° (${methodLabel})`);
          return;
        }

        // Analysis result
        if ("stats" in result && "chart_data" in result) {
          const res = result as unknown as BackendResult;

          store.setStats(res.stats);

          // Convert columnar data to point array
          const points = res.chart_data.ffid.map((_, i) => ({
            ffid: res.chart_data.ffid[i],
            feathering: res.chart_data.feathering[i],
            sou_x: res.chart_data.sou_x[i] || 0,
            sou_y: res.chart_data.sou_y[i] || 0,
            front_x: res.chart_data.front_x[i] || 0,
            front_y: res.chart_data.front_y[i] || 0,
            tail_x: res.chart_data.tail_x[i] || 0,
            tail_y: res.chart_data.tail_y[i] || 0,
          }));
          store.setChartData({ points });

          // Add result files
          for (const path of res.output_files) {
            store.addResultFile({
              path,
              name: getFileName(path),
              type: getFileType(path),
            });
          }

          store.addLog("분석 완료!", "success");
          store.setStatus("완료");
          store.setRunning(false);
          store.setActivePanel("results");
          toast.success(
            `분석 완료 — Mean: ${res.stats.mean.toFixed(2)}°, Records: ${res.stats.total_records}`
          );

          // 출력 폴더 자동 열기
          if (store.openAfterRun && store.outputDir) {
            try {
              revealItemInDir(store.outputDir);
            } catch { /* ignore */ }
          }
          return;
        }

        // Unhandled result — log for debugging
        console.warn("Unhandled backend result:", result);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { send } = useBackend(handleMessage);

  const scanHeaders = useCallback(
    async (path: string) => {
      await send("scan_headers", { path });
    },
    [send]
  );

  const browseFile = useCallback(
    async (
      field: "npdPath" | "trackPath",
      title: string
    ) => {
      const result = await open({
        title,
        multiple: false,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (result) {
        const path = typeof result === "string" ? result : result;
        store.setField(field, path);

        // Auto-scan NPD headers
        if (field === "npdPath") {
          await scanHeaders(path);
        }
      }
    },
    [scanHeaders, store]
  );

  const browseOutputDir = useCallback(async () => {
    const result = await open({
      title: "출력 폴더 선택",
      directory: true,
    });
    if (result) {
      store.setOutputDir(typeof result === "string" ? result : result);
    }
  }, [store]);

  const runAnalysis = useCallback(async () => {
    // Validation
    if (!store.npdPath) {
      toast.error("NPD 파일을 선택하세요.");
      store.setActivePanel("input");
      return;
    }
    if (!store.trackPath) {
      toast.error("Track 파일을 선택하세요.");
      store.setActivePanel("input");
      return;
    }
    if (!store.plannedAzimuth) {
      toast.error("Planned Azimuth를 입력하세요.");
      store.setActivePanel("input");
      return;
    }

    // Start analysis
    store.setRunning(true);
    store.setStartTime(Date.now());
    store.setProgressPercent(0);
    store.setStatus("분석 시작...");
    store.clearLogs();
    store.clearResults();
    store.setActivePanel("log");
    store.addLog("분석을 시작합니다...", "info");

    const toleranceS =
      store.fastMatch && store.matchTolerance
        ? parseFloat(store.matchTolerance)
        : null;

    await send("run_analysis", {
      npd_path: store.npdPath,
      track_path: store.trackPath,
      output_dir: store.outputDir,
      line_name: store.lineName,
      planned_azimuth: parseFloat(store.plannedAzimuth),
      feathering_limit: parseFloat(store.featheringLimit || "0"),
      run_in_m: parseFloat(store.runInM || "0"),
      run_out_m: parseFloat(store.runOutM || "0"),
      fast_match: store.fastMatch,
      tolerance_s: toleranceS,
      head_position: store.headPosition,
      tail_position: store.tailPosition,
    });
  }, [send, store]);

  const estimateAzimuth = useCallback(async () => {
    if (!store.trackPath) {
      toast.error("Track 파일을 먼저 선택하세요.");
      return;
    }

    store.addLog("방위각 자동 추정 중...", "info");

    try {
      await send("estimate_azimuth", {
        track_path: store.trackPath,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      toast.error(`방위각 추정 실패: ${errMsg}`);
      store.addLog(`방위각 추정 에러: ${errMsg}`, "error");
    }
  }, [send, store]);

  const openOutputDir = useCallback(async () => {
    if (store.outputDir) {
      try {
        await revealItemInDir(store.outputDir);
      } catch {
        toast.error("출력 폴더를 열 수 없습니다.");
      }
    }
  }, [store.outputDir]);

  const openFile = useCallback(async (path: string) => {
    try {
      await revealItemInDir(path);
    } catch {
      toast.error("파일을 열 수 없습니다.");
    }
  }, []);

  return {
    scanHeaders,
    browseFile,
    browseOutputDir,
    runAnalysis,
    estimateAzimuth,
    openOutputDir,
    openFile,
  };
}
