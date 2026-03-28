import { create } from "zustand";
import type {
  PanelId,
  LogLevel,
  LogEntry,
  OutputFile,
  FeatheringStats,
  ChartData,
  Settings,
  AnalysisSummary,
  AzimuthEstimate,
  AnalysisSnapshot,
  BatchJobOutcome,
  BatchWorkspaceJob,
  BatchWorkspaceScan,
} from "@/types";

let logCounter = 0;
const HISTORY_LIMIT = 8;

function getTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString("ko-KR", { hour12: false });
}

const RESULT_INVALIDATION_FIELDS = new Set([
  "npdPath",
  "trackPath",
  "lineName",
  "plannedAzimuth",
  "featheringLimit",
  "runInM",
  "runOutM",
]);

interface AppState {
  // Navigation
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;

  // Input fields
  npdPath: string;
  trackPath: string;
  lineName: string;
  plannedAzimuth: string;
  featheringLimit: string;
  runInM: string;
  runOutM: string;
  setField: (key: string, value: string) => void;

  // NPD headers
  npdHeaders: string[];
  headPosition: string;
  tailPosition: string;
  setNpdHeaders: (headers: string[]) => void;
  setHeadPosition: (pos: string) => void;
  setTailPosition: (pos: string) => void;

  // Options
  fastMatch: boolean;
  matchTolerance: string;
  outputDir: string;
  openAfterRun: boolean;
  setFastMatch: (v: boolean) => void;
  setMatchTolerance: (v: string) => void;
  setOutputDir: (v: string) => void;
  setOpenAfterRun: (v: boolean) => void;

  // Runtime
  isRunning: boolean;
  status: string;
  progressPercent: number;
  startTime: number | null;
  setRunning: (v: boolean) => void;
  setStatus: (v: string) => void;
  setProgressPercent: (v: number) => void;
  setStartTime: (v: number | null) => void;

  // Logs
  logs: LogEntry[];
  addLog: (message: string, level: LogLevel) => void;
  clearLogs: () => void;

  // Results
  resultFiles: OutputFile[];
  chartData: ChartData | null;
  stats: FeatheringStats | null;
  summary: AnalysisSummary | null;
  azimuthEstimate: AzimuthEstimate | null;
  resultsStale: boolean;
  analysisHistory: AnalysisSnapshot[];
  addResultFile: (file: OutputFile) => void;
  setChartData: (data: ChartData | null) => void;
  setStats: (stats: FeatheringStats | null) => void;
  setSummary: (summary: AnalysisSummary | null) => void;
  setAzimuthEstimate: (estimate: AzimuthEstimate | null) => void;
  setResultsStale: (stale: boolean) => void;
  addAnalysisSnapshot: (snapshot: AnalysisSnapshot) => void;
  clearAnalysisHistory: () => void;
  clearResults: () => void;

  // Workspace
  workspaceFolder: string;
  workspaceTrackFiles: string[];
  workspaceJobs: BatchWorkspaceJob[];
  batchResults: BatchJobOutcome[];
  batchOutputDir: string;
  isBatchRunning: boolean;
  setWorkspaceFolder: (value: string) => void;
  setWorkspaceScan: (scan: BatchWorkspaceScan) => void;
  updateWorkspaceJob: (id: string, patch: Partial<BatchWorkspaceJob>) => void;
  clearWorkspaceScan: () => void;
  setBatchResults: (results: BatchJobOutcome[], outputDir?: string) => void;
  clearBatchResults: () => void;
  setBatchRunning: (running: boolean) => void;

  // Settings
  loadSettings: (s: Settings) => void;
  exportSettings: () => Settings;
}

function hasResultData(state: Pick<AppState, "resultFiles" | "chartData" | "stats" | "summary">): boolean {
  return (
    state.resultFiles.length > 0 ||
    state.chartData !== null ||
    state.stats !== null ||
    state.summary !== null
  );
}

function shouldInvalidateResults(
  state: Pick<AppState, "resultFiles" | "chartData" | "stats" | "summary" | "isRunning">,
  changed: boolean
): boolean {
  return changed && !state.isRunning && hasResultData(state);
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activePanel: "input",
  setActivePanel: (panel) => set({ activePanel: panel }),

  // Input fields
  npdPath: "",
  trackPath: "",
  lineName: "",
  plannedAzimuth: "",
  featheringLimit: "0",
  runInM: "0",
  runOutM: "0",
  setField: (key, value) =>
    set((state) => {
      const currentValue = state[key as keyof AppState];
      const changed = String(currentValue ?? "") !== value;
      const next: Partial<AppState> & Record<string, string> = { [key]: value };

      if (key === "npdPath" && changed) {
        next.npdHeaders = [];
        next.headPosition = "Head_Buoy";
        next.tailPosition = "Tail_Buoy";
      }

      if (key === "trackPath" && changed) {
        next.azimuthEstimate = null;
      }

      if (RESULT_INVALIDATION_FIELDS.has(key) && shouldInvalidateResults(state, changed)) {
        next.resultsStale = true;
        next.status = "입력이 변경되었습니다 — 다시 실행하세요";
      }

      return next;
    }),

  // NPD headers
  npdHeaders: [],
  headPosition: "Head_Buoy",
  tailPosition: "Tail_Buoy",
  setNpdHeaders: (headers) => set({ npdHeaders: headers }),
  setHeadPosition: (pos) =>
    set((state) => {
      const changed = state.headPosition !== pos;
      return {
        headPosition: pos,
        ...(shouldInvalidateResults(state, changed)
          ? {
              resultsStale: true,
              status: "입력이 변경되었습니다 — 다시 실행하세요",
            }
          : {}),
      };
    }),
  setTailPosition: (pos) =>
    set((state) => {
      const changed = state.tailPosition !== pos;
      return {
        tailPosition: pos,
        ...(shouldInvalidateResults(state, changed)
          ? {
              resultsStale: true,
              status: "입력이 변경되었습니다 — 다시 실행하세요",
            }
          : {}),
      };
    }),

  // Options
  fastMatch: false,
  matchTolerance: "",
  outputDir: "",
  openAfterRun: true,
  setFastMatch: (v) =>
    set((state) => {
      const changed = state.fastMatch !== v;
      return {
        fastMatch: v,
        ...(shouldInvalidateResults(state, changed)
          ? {
              resultsStale: true,
              status: "입력이 변경되었습니다 — 다시 실행하세요",
            }
          : {}),
      };
    }),
  setMatchTolerance: (v) =>
    set((state) => {
      const changed = state.matchTolerance !== v;
      return {
        matchTolerance: v,
        ...(shouldInvalidateResults(state, changed)
          ? {
              resultsStale: true,
              status: "입력이 변경되었습니다 — 다시 실행하세요",
            }
          : {}),
      };
    }),
  setOutputDir: (v) => set({ outputDir: v }),
  setOpenAfterRun: (v) => set({ openAfterRun: v }),

  // Runtime
  isRunning: false,
  status: "Ready",
  progressPercent: 0,
  startTime: null,
  setRunning: (v) => set({ isRunning: v }),
  setStatus: (v) => set({ status: v }),
  setProgressPercent: (v) => set({ progressPercent: v }),
  setStartTime: (v) => set({ startTime: v }),

  // Logs
  logs: [],
  addLog: (message, level) =>
    set((state) => ({
      logs: [
        ...state.logs,
        { id: ++logCounter, timestamp: getTimestamp(), message, level },
      ],
    })),
  clearLogs: () => set({ logs: [] }),

  // Results
  resultFiles: [],
  chartData: null,
  stats: null,
  summary: null,
  azimuthEstimate: null,
  resultsStale: false,
  analysisHistory: [],
  addResultFile: (file) =>
    set((state) => {
      if (state.resultFiles.some((existing) => existing.path === file.path)) {
        return state;
      }
      return { resultFiles: [...state.resultFiles, file] };
    }),
  setChartData: (data) => set({ chartData: data }),
  setStats: (stats) => set({ stats: stats }),
  setSummary: (summary) => set({ summary }),
  setAzimuthEstimate: (estimate) => set({ azimuthEstimate: estimate }),
  setResultsStale: (stale) => set({ resultsStale: stale }),
  addAnalysisSnapshot: (snapshot) =>
    set((state) => ({
      analysisHistory: [snapshot, ...state.analysisHistory].slice(0, HISTORY_LIMIT),
    })),
  clearAnalysisHistory: () => set({ analysisHistory: [] }),
  clearResults: () =>
    set({
      resultFiles: [],
      chartData: null,
      stats: null,
      summary: null,
      resultsStale: false,
    }),

  // Workspace
  workspaceFolder: "",
  workspaceTrackFiles: [],
  workspaceJobs: [],
  batchResults: [],
  batchOutputDir: "",
  isBatchRunning: false,
  setWorkspaceFolder: (value) => set({ workspaceFolder: value }),
  setWorkspaceScan: (scan) =>
    set({
      workspaceJobs: scan.jobs,
      workspaceTrackFiles: scan.trackFiles,
      batchResults: [],
      batchOutputDir: "",
    }),
  updateWorkspaceJob: (id, patch) =>
    set((state) => ({
      workspaceJobs: state.workspaceJobs.map((job) =>
        job.id === id ? { ...job, ...patch } : job
      ),
    })),
  clearWorkspaceScan: () =>
    set({
      workspaceTrackFiles: [],
      workspaceJobs: [],
      batchResults: [],
      batchOutputDir: "",
    }),
  setBatchResults: (results, outputDir = "") =>
    set({
      batchResults: results,
      batchOutputDir: outputDir,
    }),
  clearBatchResults: () => set({ batchResults: [], batchOutputDir: "" }),
  setBatchRunning: (running) => set({ isBatchRunning: running }),

  // Settings
  loadSettings: (s) =>
    set({
      npdPath: s.npd_path || "",
      trackPath: s.track_path || "",
      outputDir: s.output_dir || "",
      lineName: s.line_name || "",
      plannedAzimuth: s.planned_azimuth || "",
      featheringLimit: s.feathering_limit || "0",
      runInM: s.run_in_m || "0",
      runOutM: s.run_out_m || "0",
      fastMatch: s.fast_match || false,
      matchTolerance: s.match_tolerance || "",
      openAfterRun: s.open_after_run !== false,
      headPosition: s.head_position || "Head_Buoy",
      tailPosition: s.tail_position || "Tail_Buoy",
    }),
  exportSettings: () => {
    const s = get();
    return {
      npd_path: s.npdPath,
      track_path: s.trackPath,
      output_dir: s.outputDir,
      line_name: s.lineName,
      planned_azimuth: s.plannedAzimuth,
      feathering_limit: s.featheringLimit,
      run_in_m: s.runInM,
      run_out_m: s.runOutM,
      fast_match: s.fastMatch,
      match_tolerance: s.matchTolerance,
      open_after_run: s.openAfterRun,
      head_position: s.headPosition,
      tail_position: s.tailPosition,
    };
  },
}));
