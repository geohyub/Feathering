import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useAppStore } from "@/stores/appStore";
import { useBackend } from "./useBackend";
import type {
  AnalysisSnapshot,
  AzimuthEstimate,
  BatchJobOutcome,
  BackendMessage,
  BackendProgress,
  BackendResult,
  BatchWorkspaceScan,
  ChartData,
  OutputFile,
  RunSettingsSnapshot,
} from "@/types";

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

function getRecommendedAzimuth(estimate: AzimuthEstimate): number {
  if (estimate.method === "track_heading" && estimate.azimuth_reverse != null) {
    return estimate.azimuth_reverse;
  }

  return estimate.azimuth;
}

function toOutputFile(path: string): OutputFile {
  return {
    path,
    name: getFileName(path),
    type: getFileType(path),
  };
}

function toChartData(result: BackendResult): ChartData {
  return {
    points: result.chart_data.ffid.map((_, index) => ({
      ffid: result.chart_data.ffid[index],
      feathering: result.chart_data.feathering[index],
      sou_x: result.chart_data.sou_x[index] || 0,
      sou_y: result.chart_data.sou_y[index] || 0,
      front_x: result.chart_data.front_x[index] || 0,
      front_y: result.chart_data.front_y[index] || 0,
      tail_x: result.chart_data.tail_x[index] || 0,
      tail_y: result.chart_data.tail_y[index] || 0,
    })),
  };
}

function buildSettingsSnapshot(state: ReturnType<typeof useAppStore.getState>): RunSettingsSnapshot {
  return {
    npdPath: state.npdPath,
    trackPath: state.trackPath,
    outputDir: state.outputDir,
    lineName: state.lineName,
    plannedAzimuth: state.plannedAzimuth,
    featheringLimit: state.featheringLimit,
    runInM: state.runInM,
    runOutM: state.runOutM,
    fastMatch: state.fastMatch,
    matchTolerance: state.matchTolerance,
    headPosition: state.headPosition,
    tailPosition: state.tailPosition,
  };
}

function buildAnalysisSnapshot(
  state: ReturnType<typeof useAppStore.getState>,
  result: BackendResult,
  chartData: ChartData
): AnalysisSnapshot {
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs).toLocaleString("ko-KR", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const label = result.summary.matching.line_name || state.lineName || getFileName(state.trackPath);

  return {
    id: `${createdAtMs}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt,
    createdAtMs,
    stats: result.stats,
    summary: result.summary,
    chartData,
    resultFiles: result.output_files.map(toOutputFile),
    settings: buildSettingsSnapshot(state),
  };
}

export function useAnalysis() {
  const store = useAppStore();

  const handleMessage = useCallback(
    (msg: BackendMessage) => {
      const state = useAppStore.getState();

      if (msg.event === "progress") {
        const data = msg.data as BackendProgress;
        state.addLog(data.message, "info");
        state.setStatus(data.message);
        if (data.percent != null) {
          state.setProgressPercent(data.percent);
        }
        return;
      }

      if (msg.error) {
        state.addLog(`Error: ${msg.error}`, "error");
        state.setStatus("Error");
        state.setRunning(false);
        toast.error(msg.error);
        return;
      }

      if (!msg.result || !msg.id || typeof msg.result !== "object") {
        return;
      }

      const result = msg.result as Record<string, unknown>;

      if ("headers" in result) {
        const headers = result.headers as string[];
        state.setNpdHeaders(headers);
        if (headers.length >= 2) {
          const headMatch = headers.find((header) => /head|front/i.test(header));
          const tailMatch = headers.find((header) => /tail|rear|end/i.test(header));
          if (headMatch) state.setHeadPosition(headMatch);
          if (tailMatch) state.setTailPosition(tailMatch);
        }

        if (headers.length > 0) {
          state.addLog(`NPD 헤더 감지: ${headers.join(", ")}`, "success");
        } else {
          state.addLog("NPD 헤더를 찾지 못했습니다. 파일 형식을 확인하세요.", "warning");
        }
        return;
      }

      if ("azimuth" in result && "confidence" in result) {
        const estimate = result as unknown as AzimuthEstimate;
        const bestAzimuth = getRecommendedAzimuth(estimate);
        const methodLabel =
          estimate.method === "cable_vector" ? "케이블 벡터" : "선박 진행 역방향";

        state.setAzimuthEstimate(estimate);
        state.setField("plannedAzimuth", String(bestAzimuth));
        state.addLog(
          `방위각 자동 추정: ${estimate.azimuth}° (${methodLabel}, 신뢰도: ${estimate.confidence})`,
          "success"
        );
        if (estimate.ship_heading != null) {
          state.addLog(
            `  선박 방향: ${estimate.ship_heading}° / 반대: ${estimate.ship_heading_reverse}°`,
            "info"
          );
        }
        toast.success(`방위각 추정: ${bestAzimuth}° (${methodLabel})`);
        return;
      }

      if ("npd_files" in result && "track_files" in result && "jobs" in result) {
        const scan = result as {
          npd_files: string[];
          track_files: string[];
          jobs: Array<{
            id: string;
            line_name: string;
            npd_path: string;
            track_path: string;
            confidence: number;
            match_reason: string;
            selected: boolean;
          }>;
        };
        const workspaceScan: BatchWorkspaceScan = {
          npdFiles: scan.npd_files,
          trackFiles: scan.track_files,
          jobs: scan.jobs.map((job) => ({
            id: job.id,
            lineName: job.line_name,
            npdPath: job.npd_path,
            trackPath: job.track_path,
            confidence: job.confidence,
            matchReason: job.match_reason,
            selected: job.selected,
          })),
        };

        state.setWorkspaceScan(workspaceScan);
        state.setStatus(`폴더 스캔 완료 (${workspaceScan.jobs.length} jobs)`);
        state.addLog(
          `폴더 스캔 완료: NPD ${workspaceScan.npdFiles.length}개 / Track ${workspaceScan.trackFiles.length}개 / Job ${workspaceScan.jobs.length}개`,
          "success"
        );
        state.setActivePanel("workspace");
        toast.success(`배치 후보 ${workspaceScan.jobs.length}개를 구성했습니다.`);
        return;
      }

      if ("total" in result && "results" in result) {
        const batchResult = result as {
          total: number;
          passed: number;
          failed: number;
          batch_output_dir?: string;
          results: Array<{
            line_name: string;
            status: "success" | "error";
            stats?: BackendResult["stats"];
            summary?: BackendResult["summary"];
            output_files?: string[];
            output_dir?: string;
            error?: string;
          }>;
        };

        const outcomes: BatchJobOutcome[] = batchResult.results.map((job, index) => ({
          id: `batch-${index + 1}`,
          lineName: job.line_name,
          status: job.status,
          stats: job.stats ?? null,
          summary: job.summary ?? null,
          outputDir: job.output_dir ?? "",
          outputFiles: (job.output_files ?? []).map(toOutputFile),
          error: job.error,
        }));

        state.setBatchResults(outcomes, batchResult.batch_output_dir || "");
        state.setBatchRunning(false);
        state.setRunning(false);
        state.setProgressPercent(100);
        state.setStatus(`배치 완료 (${batchResult.passed}/${batchResult.total} success)`);
        state.addLog(
          `배치 완료: ${batchResult.passed} success / ${batchResult.failed} failed`,
          batchResult.failed > 0 ? "warning" : "success"
        );
        state.setActivePanel("workspace");
        toast.success(`배치 완료: ${batchResult.passed}/${batchResult.total}`);

        if (state.openAfterRun && batchResult.batch_output_dir) {
          openPath(batchResult.batch_output_dir).catch(() => undefined);
        }
        return;
      }

      if ("stats" in result && "chart_data" in result && "summary" in result) {
        const res = result as unknown as BackendResult;
        const chartData = toChartData(res);
        const resultFiles = res.output_files.map(toOutputFile);
        const snapshot = buildAnalysisSnapshot(state, res, chartData);

        state.setStats(res.stats);
        state.setSummary(res.summary);
        state.setResultsStale(false);
        state.setChartData(chartData);
        state.addAnalysisSnapshot(snapshot);

        for (const file of resultFiles) {
          state.addResultFile(file);
        }

        state.addLog("분석 완료!", "success");
        state.setStatus("완료");
        state.setRunning(false);
        state.setActivePanel("results");
        toast.success(
          `분석 완료 — Mean: ${res.stats.mean.toFixed(2)}°, Records: ${res.stats.total_records.toLocaleString()}`
        );

        if (state.openAfterRun && state.outputDir) {
          openPath(state.outputDir).catch(() => undefined);
        }
        return;
      }

      console.warn("Unhandled backend result:", result);
    },
    []
  );

  const { send } = useBackend(handleMessage);

  const scanHeaders = useCallback(
    async (path: string) => {
      try {
        await send("scan_headers", { path });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.addLog(`헤더 스캔 실패: ${message}`, "error");
        toast.error(`헤더 스캔 실패: ${message}`);
      }
    },
    [send, store]
  );

  const browseFile = useCallback(
    async (field: "npdPath" | "trackPath", title: string) => {
      const result = await open({
        title,
        multiple: false,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });

      if (!result || typeof result !== "string") {
        return;
      }

      store.setField(field, result);

      if (field === "npdPath") {
        await scanHeaders(result);
      }
    },
    [scanHeaders, store]
  );

  const browseOutputDir = useCallback(async () => {
    const result = await open({
      title: "출력 폴더 선택",
      directory: true,
    });

    if (result && typeof result === "string") {
      store.setOutputDir(result);
    }
  }, [store]);

  const scanWorkspaceFolder = useCallback(
    async (folder?: string) => {
      const targetFolder = folder || useAppStore.getState().workspaceFolder;
      if (!targetFolder) {
        toast.error("먼저 스캔할 폴더를 선택하세요.");
        return;
      }

      try {
        await send("scan_folder", { folder: targetFolder });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        store.addLog(`폴더 스캔 실패: ${message}`, "error");
        toast.error(`폴더 스캔 실패: ${message}`);
      }
    },
    [send, store]
  );

  const browseWorkspaceFolder = useCallback(async () => {
    const result = await open({
      title: "배치 스캔 폴더 선택",
      directory: true,
    });

    if (result && typeof result === "string") {
      store.setWorkspaceFolder(result);
      await scanWorkspaceFolder(result);
    }
  }, [scanWorkspaceFolder, store]);

  const runAnalysis = useCallback(async () => {
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

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.setRunning(false);
      store.setStatus("Error");
      store.addLog(`분석 시작 실패: ${message}`, "error");
      toast.error(`분석 시작 실패: ${message}`);
    }
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`방위각 추정 실패: ${message}`);
      store.addLog(`방위각 추정 에러: ${message}`, "error");
    }
  }, [send, store]);

  const runBatchAnalysis = useCallback(async () => {
    const state = useAppStore.getState();
    const selectedJobs = state.workspaceJobs.filter((job) => job.selected);

    if (!state.outputDir) {
      toast.error("배치 실행 전 출력 폴더를 지정하세요.");
      state.setActivePanel("options");
      return;
    }

    if (!state.plannedAzimuth) {
      toast.error("배치 실행에도 Planned Azimuth가 필요합니다.");
      state.setActivePanel("input");
      return;
    }

    if (selectedJobs.length === 0) {
      toast.error("실행할 batch job을 먼저 선택하세요.");
      state.setActivePanel("workspace");
      return;
    }

    const incompleteJob = selectedJobs.find((job) => !job.trackPath);
    if (incompleteJob) {
      toast.error(`Track이 비어 있는 job이 있습니다: ${incompleteJob.lineName}`);
      state.setActivePanel("workspace");
      return;
    }

    state.setRunning(true);
    state.setBatchRunning(true);
    state.setStartTime(Date.now());
    state.setProgressPercent(0);
    state.setStatus("배치 분석 시작...");
    state.clearLogs();
    state.clearBatchResults();
    state.setActivePanel("workspace");
    state.addLog(`배치 분석 시작: ${selectedJobs.length} jobs`, "info");

    const toleranceS =
      state.fastMatch && state.matchTolerance
        ? parseFloat(state.matchTolerance)
        : null;

    try {
      await send("batch_analysis", {
        output_dir: state.outputDir,
        jobs: selectedJobs.map((job) => ({
          npd_path: job.npdPath,
          track_path: job.trackPath,
          line_name: job.lineName,
          planned_azimuth: parseFloat(state.plannedAzimuth),
          feathering_limit: parseFloat(state.featheringLimit || "0"),
          run_in_m: parseFloat(state.runInM || "0"),
          run_out_m: parseFloat(state.runOutM || "0"),
          fast_match: state.fastMatch,
          tolerance_s: toleranceS,
          head_position: state.headPosition,
          tail_position: state.tailPosition,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.setRunning(false);
      state.setBatchRunning(false);
      state.setStatus("Error");
      state.addLog(`배치 시작 실패: ${message}`, "error");
      toast.error(`배치 시작 실패: ${message}`);
    }
  }, [send]);

  const openOutputDir = useCallback(async () => {
    if (!store.outputDir) {
      return;
    }

    try {
      await openPath(store.outputDir);
    } catch {
      toast.error("출력 폴더를 열 수 없습니다.");
    }
  }, [store.outputDir]);

  const openFile = useCallback(async (path: string) => {
    try {
      await openPath(path);
    } catch {
      toast.error("파일을 열 수 없습니다.");
    }
  }, []);

  return {
    scanHeaders,
    browseFile,
    browseOutputDir,
    browseWorkspaceFolder,
    scanWorkspaceFolder,
    runAnalysis,
    estimateAzimuth,
    runBatchAnalysis,
    openOutputDir,
    openFile,
  };
}
