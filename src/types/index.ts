export type PanelId = "input" | "options" | "workspace" | "log" | "results" | "help";

export type LogLevel = "info" | "success" | "error" | "warning";
export type ChartTabId = "feathering" | "track" | "histogram";
export type VerdictLevel = "PASS" | "WARN" | "FAIL" | "INFO";

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface OutputFile {
  path: string;
  name: string;
  type: "CSV" | "PNG" | "TXT" | "LOG" | "PDF";
}

export interface FeatheringStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
  total_records: number;
  exceeded_count: number;
  exceeded_percent: number;
  run_in_ffid: number | null;
  run_out_ffid: number | null;
}

export interface NumericSummary {
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
}

export interface ChartDataPoint {
  ffid: number;
  feathering: number;
  sou_x: number;
  sou_y: number;
  front_x: number;
  front_y: number;
  tail_x: number;
  tail_y: number;
}

export interface ChartData {
  points: ChartDataPoint[];
}

export interface Settings {
  npd_path: string;
  track_path: string;
  output_dir: string;
  line_name: string;
  planned_azimuth: string;
  feathering_limit: string;
  run_in_m: string;
  run_out_m: string;
  fast_match: boolean;
  match_tolerance: string;
  open_after_run: boolean;
  head_position: string;
  tail_position: string;
}

export interface AzimuthEstimate {
  azimuth: number;
  azimuth_reverse?: number | null;
  confidence: string;
  spread: number;
  method: "cable_vector" | "track_heading";
  coord_source?: string;
  data_points?: number;
  trimmed_points?: number;
  method_detail?: Record<string, number>;
  note?: string;
  ship_heading?: number | null;
  ship_heading_reverse?: number | null;
}

export interface MatchingSummary {
  mode: "precise" | "fast";
  tolerance_s: number | null;
  npd_records: number;
  track_records: number;
  matched_records: number;
  matched_percent: number;
  head_position: string;
  tail_position: string;
  line_name: string;
}

export interface AnalysisWindowSummary {
  total_records: number;
  included_records: number;
  excluded_records: number;
  first_ffid: number | null;
  last_ffid: number | null;
  run_in_end_ffid: number | null;
  run_out_start_ffid: number | null;
  total_distance_m: number;
  included_distance_m: number;
}

export interface LimitSummary {
  value: number;
  overall_exceeded_count: number;
  overall_exceeded_percent: number;
  main_exceeded_count: number;
  main_exceeded_percent: number;
  max_abs: number;
}

export interface PeakExcursion {
  ffid: number;
  feathering: number;
  abs_feathering: number;
  zone: "run_in" | "main" | "run_out";
  exceeded: boolean;
}

export interface ChangeEventSummary {
  start_ffid: number;
  end_ffid: number;
  detection_type: string;
  peak_abs: number;
  mean_shift: number;
  record_count: number;
}

export interface AnalysisSummary {
  verdict: VerdictLevel;
  headline: string;
  detail: string;
  recommended_chart: ChartTabId;
  recommended_reason: string;
  matching: MatchingSummary;
  window: AnalysisWindowSummary;
  main_stats: NumericSummary;
  overall_stats: NumericSummary;
  limit: LimitSummary | null;
  peaks: PeakExcursion[];
  changes: ChangeEventSummary[];
}

export interface RunSettingsSnapshot {
  npdPath: string;
  trackPath: string;
  outputDir: string;
  lineName: string;
  plannedAzimuth: string;
  featheringLimit: string;
  runInM: string;
  runOutM: string;
  fastMatch: boolean;
  matchTolerance: string;
  headPosition: string;
  tailPosition: string;
}

export interface AnalysisSnapshot {
  id: string;
  label: string;
  createdAt: string;
  createdAtMs: number;
  stats: FeatheringStats;
  summary: AnalysisSummary;
  chartData: ChartData;
  resultFiles: OutputFile[];
  settings: RunSettingsSnapshot;
}

export interface BatchWorkspaceJob {
  id: string;
  lineName: string;
  npdPath: string;
  trackPath: string;
  confidence: number;
  matchReason: string;
  selected: boolean;
}

export interface BatchWorkspaceScan {
  npdFiles: string[];
  trackFiles: string[];
  jobs: BatchWorkspaceJob[];
}

export interface BatchJobOutcome {
  id: string;
  lineName: string;
  status: "success" | "error";
  stats: FeatheringStats | null;
  summary: AnalysisSummary | null;
  outputDir: string;
  outputFiles: OutputFile[];
  error?: string;
}

export interface BackendProgress {
  step: string;
  message: string;
  percent?: number;
}

export interface BackendResult {
  stats: FeatheringStats;
  summary: AnalysisSummary;
  chart_data: {
    ffid: number[];
    feathering: number[];
    sou_x: number[];
    sou_y: number[];
    front_x: number[];
    front_y: number[];
    tail_x: number[];
    tail_y: number[];
  };
  output_files: string[];
}

export interface BackendMessage {
  id: number | null;
  result?: unknown;
  error?: string;
  event?: string;
  data?: unknown;
}
