import { create } from "zustand";
import type {
  PanelId,
  LogLevel,
  LogEntry,
  OutputFile,
  FeatheringStats,
  ChartData,
  Settings,
} from "@/types";

let logCounter = 0;

function getTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString("ko-KR", { hour12: false });
}

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
  addResultFile: (file: OutputFile) => void;
  setChartData: (data: ChartData | null) => void;
  setStats: (stats: FeatheringStats | null) => void;
  clearResults: () => void;

  // Settings
  loadSettings: (s: Settings) => void;
  exportSettings: () => Settings;
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
  setField: (key, value) => set({ [key]: value }),

  // NPD headers
  npdHeaders: [],
  headPosition: "Head_Buoy",
  tailPosition: "Tail_Buoy",
  setNpdHeaders: (headers) => set({ npdHeaders: headers }),
  setHeadPosition: (pos) => set({ headPosition: pos }),
  setTailPosition: (pos) => set({ tailPosition: pos }),

  // Options
  fastMatch: false,
  matchTolerance: "",
  outputDir: "",
  openAfterRun: true,
  setFastMatch: (v) => set({ fastMatch: v }),
  setMatchTolerance: (v) => set({ matchTolerance: v }),
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
  addResultFile: (file) =>
    set((state) => ({ resultFiles: [...state.resultFiles, file] })),
  setChartData: (data) => set({ chartData: data }),
  setStats: (stats) => set({ stats: stats }),
  clearResults: () =>
    set({ resultFiles: [], chartData: null, stats: null }),

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
