export type PanelId = "input" | "options" | "log" | "results" | "help";

export type LogLevel = "info" | "success" | "error" | "warning";

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

export interface BackendProgress {
  step: string;
  message: string;
  percent?: number;
}

export interface BackendResult {
  stats: FeatheringStats;
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
