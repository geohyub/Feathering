import { useCallback, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Brush,
  ResponsiveContainer,
} from "recharts";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { lttbDecimate } from "@/lib/decimation";
import type { AnalysisSummary, ChartDataPoint, FeatheringStats } from "@/types";

interface InspectedPoint {
  ffid: number;
  traceNo: number;
  feathering: number;
  zone: "run_in" | "main" | "run_out";
  exceeded: boolean;
}

function classifyZone(
  ffid: number,
  runInEnd: number | null,
  runOutStart: number | null
): "run_in" | "main" | "run_out" {
  if (runInEnd != null && ffid <= runInEnd) return "run_in";
  if (runOutStart != null && ffid >= runOutStart) return "run_out";
  return "main";
}

const zoneLabels: Record<string, string> = {
  run_in: "Run-in",
  main: "Main line",
  run_out: "Run-out",
};

const zoneColors: Record<string, string> = {
  run_in: "border-warning/35 bg-warning/10 text-warning",
  main: "border-primary/35 bg-primary/10 text-primary",
  run_out: "border-warning/35 bg-warning/10 text-warning",
};

interface FeatheringChartProps {
  data: ChartDataPoint[];
  stats: FeatheringStats;
  featheringLimit: number;
  runInM: number;
  runOutM: number;
  summary?: AnalysisSummary | null;
}

const MAX_VISIBLE_POINTS = 2000;

export function FeatheringChart({
  data,
  stats,
  featheringLimit,
  runInM,
  runOutM,
  summary,
}: FeatheringChartProps) {
  const [inspected, setInspected] = useState<InspectedPoint | null>(null);
  // Decimate data for rendering performance
  const chartData = useMemo(() => {
    const mapped = data.map((d) => ({
      x: d.trace_no,
      traceNo: d.trace_no,
      y: d.feathering,
      ffid: d.ffid,
      feathering: d.feathering,
    }));

    if (mapped.length <= MAX_VISIBLE_POINTS) return mapped;
    return lttbDecimate(mapped, MAX_VISIBLE_POINTS);
  }, [data]);

  const traceNoByFfid = useMemo(
    () => new Map(data.map((point) => [point.ffid, point.trace_no])),
    [data]
  );

  // Run-in/Run-out FFID boundaries (백엔드에서 거리 기반으로 계산된 값 사용)
  const runInEnd = stats.run_in_ffid;
  const runOutStart = stats.run_out_ffid;
  const highlightedChanges = summary?.changes.slice(0, 3) ?? [];
  const highlightedPeaks = summary?.peaks.slice(0, 3) ?? [];

  const minTraceNo = chartData.length > 0 ? chartData[0].x : 0;
  const maxTraceNo = chartData.length > 0 ? chartData[chartData.length - 1].x : 0;
  const lineColor = "#0f766e";
  const fillColor = "#14b8a6";

  const handleChartClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (!event?.activePayload?.[0]?.payload) return;
      const payload = event.activePayload[0].payload as {
        ffid: number;
        traceNo: number;
        feathering: number;
      };
      const zone = classifyZone(payload.ffid, runInEnd, runOutStart);
      const exceeded =
        featheringLimit > 0 && Math.abs(payload.feathering) > featheringLimit;
      setInspected({
        ffid: payload.ffid,
        traceNo: payload.traceNo,
        feathering: payload.feathering,
        zone,
        exceeded,
      });
    },
    [runInEnd, runOutStart, featheringLimit]
  );

  // Enhanced custom tooltip
  const renderTooltip = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ active, payload, label }: any) => {
      if (!active || !payload?.[0]) return null;
      const item = payload[0].payload as {
        ffid: number;
        traceNo: number;
        feathering: number;
      };
      const zone = classifyZone(item.ffid, runInEnd, runOutStart);
      const exceeded =
        featheringLimit > 0 && Math.abs(item.feathering) > featheringLimit;
      return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              Trace {Number(label).toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">
              FFID {item.ffid.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">
              {item.feathering.toFixed(3)}°
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${zoneColors[zone]}`}
            >
              {zoneLabels[zone]}
            </span>
            {exceeded && (
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                EXCEEDED
              </span>
            )}
          </div>
        </div>
      );
    },
    [runInEnd, runOutStart, featheringLimit]
  );

  return (
    <div className="relative">
      {/* Stats overlay */}
      <Card className="absolute right-16 top-2 z-10 bg-card/90 backdrop-blur-sm px-3 py-2 border-border/50">
        <div className="space-y-0.5 text-[11px] font-mono">
          <div className="text-muted-foreground">
            Mean: <span className="text-chart-2">{stats.mean.toFixed(2)}°</span>
            {" ± "}
            <span className="text-muted-foreground">{stats.std.toFixed(2)}°</span>
          </div>
          <div className="text-muted-foreground">
            Range: <span className="text-foreground">{stats.min.toFixed(2)}°</span>
            {" ~ "}
            <span className="text-foreground">{stats.max.toFixed(2)}°</span>
          </div>
          {summary && (
            <div className="text-muted-foreground">
              Main line:{" "}
              <span className="text-foreground">
                {summary.window.included_records.toLocaleString()}
              </span>
              {" / "}
              <span className="text-foreground">
                {summary.window.total_records.toLocaleString()}
              </span>
            </div>
          )}
          <div className="text-muted-foreground">
            Total: <span className="text-foreground">{stats.total_records.toLocaleString()}</span> pts
          </div>
        </div>
      </Card>

      {/* Inspected point detail card */}
      {inspected && (
        <Card className="absolute left-16 top-2 z-10 bg-card/95 backdrop-blur-sm px-4 py-3 border-border/50 max-w-[260px]">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={zoneColors[inspected.zone]}>
                  {zoneLabels[inspected.zone]}
                </Badge>
                {inspected.exceeded && (
                  <Badge variant="outline" className="border-destructive/35 bg-destructive/10 text-destructive">
                    EXCEEDED
                  </Badge>
                )}
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="text-muted-foreground">
                  FFID: <span className="text-foreground font-semibold">{inspected.ffid.toLocaleString()}</span>
                </div>
                <div className="text-muted-foreground">
                  Trace: <span className="text-foreground font-semibold">{inspected.traceNo.toLocaleString()}</span>
                </div>
                <div className="text-muted-foreground">
                  Feathering: <span className="text-chart-2 font-semibold">{inspected.feathering.toFixed(3)}°</span>
                </div>
                {featheringLimit > 0 && (
                  <div className="text-muted-foreground">
                    Deviation: <span className="text-foreground">
                      {(Math.abs(inspected.feathering) - featheringLimit).toFixed(3)}°
                      {inspected.exceeded ? " over" : " under"} limit
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setInspected(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </Card>
      )}

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 60, left: 10, bottom: 5 }}
          onClick={handleChartClick}
        >
          <defs>
            <linearGradient id="featheringFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.12} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.4}
          />

          <XAxis
            dataKey="x"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={(v: number) => v.toLocaleString()}
            label={{
              value: "Trace No",
              position: "insideBottom",
              offset: -2,
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={(v: number) => `${v}°`}
            domain={["auto", "auto"]}
          />

          <Tooltip content={renderTooltip} />

          {/* Run-in zone */}
          {runInEnd && (
            <ReferenceArea
              x1={minTraceNo}
              x2={traceNoByFfid.get(runInEnd) ?? runInEnd}
              fill="#f59e0b"
              fillOpacity={0.06}
              label={{
                value: "Run-in",
                position: "insideTopLeft",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
          )}

          {/* Run-out zone */}
          {runOutStart && (
            <ReferenceArea
              x1={traceNoByFfid.get(runOutStart) ?? runOutStart}
              x2={maxTraceNo}
              fill="#f59e0b"
              fillOpacity={0.06}
              label={{
                value: "Run-out",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
          )}

          {highlightedChanges.map((change, index) => (
            <ReferenceArea
              key={`${change.start_ffid}-${change.end_ffid}-${index}`}
              x1={traceNoByFfid.get(change.start_ffid) ?? change.start_ffid}
              x2={traceNoByFfid.get(change.end_ffid) ?? change.end_ffid}
              fill={change.detection_type === "Limit Exceeded" ? "#ef4444" : "#f59e0b"}
              fillOpacity={0.08}
              label={{
                value: change.detection_type === "Limit Exceeded" ? "Limit zone" : "Change zone",
                position: "insideTop",
                fontSize: 10,
                fill: change.detection_type === "Limit Exceeded" ? "#ef4444" : "#f59e0b",
              }}
            />
          ))}

          {/* Zero line */}
          <ReferenceLine
            y={0}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />

          {/* Mean line */}
          <ReferenceLine
            y={stats.mean}
            stroke="#f59e0b"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `Mean: ${stats.mean.toFixed(2)}°`,
              position: "right",
              fontSize: 10,
              fill: "#f59e0b",
            }}
          />

          {/* Feathering limit bands */}
          {featheringLimit > 0 && (
            <>
              <ReferenceLine
                y={featheringLimit}
                stroke="#fb7185"
                strokeDasharray="8 4"
                strokeWidth={1}
                label={{
                  value: `+${featheringLimit}°`,
                  position: "right",
                  fontSize: 9,
                  fill: "#fb7185",
                }}
              />
              <ReferenceLine
                y={-featheringLimit}
                stroke="#fb7185"
                strokeDasharray="8 4"
                strokeWidth={1}
                label={{
                  value: `-${featheringLimit}°`,
                  position: "right",
                  fontSize: 9,
                  fill: "#fb7185",
                }}
              />
            </>
          )}

          {highlightedPeaks.map((peak, index) => (
            <ReferenceLine
              key={`${peak.ffid}-${index}`}
              x={traceNoByFfid.get(peak.ffid) ?? peak.ffid}
              stroke={peak.exceeded ? "#ef4444" : "#f59e0b"}
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: `Peak ${index + 1}`,
                position: "top",
                fontSize: 9,
                fill: peak.exceeded ? "#ef4444" : "#f59e0b",
              }}
            />
          ))}

          {/* Area fill */}
          <Area
            type="monotone"
            dataKey="feathering"
            fill="url(#featheringFill)"
            stroke="none"
          />

          {/* Main feathering line */}
          <Line
            type="linear"
            dataKey="feathering"
            stroke={lineColor}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
            activeDot={{
              r: 3,
              fill: lineColor,
              stroke: "var(--background)",
              strokeWidth: 1,
            }}
          />

          {/* Brush for range selection */}
          <Brush
            dataKey="x"
            height={24}
            stroke="var(--border)"
            fill="var(--muted)"
            travellerWidth={8}
          >
            <ComposedChart>
              <Line
                type="linear"
                dataKey="feathering"
                stroke={lineColor}
                strokeWidth={0.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
