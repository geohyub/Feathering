import { useMemo } from "react";
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
import { Card } from "@/components/ui/card";
import { lttbDecimate } from "@/lib/decimation";
import type { AnalysisSummary, ChartDataPoint, FeatheringStats } from "@/types";

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
  // Decimate data for rendering performance
  const chartData = useMemo(() => {
    const mapped = data.map((d) => ({
      x: d.ffid,
      y: d.feathering,
      ffid: d.ffid,
      feathering: d.feathering,
    }));

    if (mapped.length <= MAX_VISIBLE_POINTS) return mapped;
    return lttbDecimate(mapped, MAX_VISIBLE_POINTS);
  }, [data]);

  // Run-in/Run-out FFID boundaries (백엔드에서 거리 기반으로 계산된 값 사용)
  const runInEnd = stats.run_in_ffid;
  const runOutStart = stats.run_out_ffid;
  const highlightedChanges = summary?.changes.slice(0, 3) ?? [];
  const highlightedPeaks = summary?.peaks.slice(0, 3) ?? [];

  const minFFID = chartData.length > 0 ? chartData[0].ffid : 0;
  const maxFFID = chartData.length > 0 ? chartData[chartData.length - 1].ffid : 0;

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

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 60, left: 10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="featheringFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c8aff" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#7c8aff" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.4}
          />

          <XAxis
            dataKey="ffid"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={(v: number) => `${v}°`}
            domain={["auto", "auto"]}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`${Number(value).toFixed(3)}°`, "Feathering"]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => `FFID: ${Number(label).toLocaleString()}`}
          />

          {/* Run-in zone */}
          {runInEnd && (
            <ReferenceArea
              x1={minFFID}
              x2={runInEnd}
              fill="#e8b94a"
              fillOpacity={0.08}
              label={{
                value: "Run-in",
                position: "insideTopLeft",
                fontSize: 10,
                fill: "#e8b94a",
              }}
            />
          )}

          {/* Run-out zone */}
          {runOutStart && (
            <ReferenceArea
              x1={runOutStart}
              x2={maxFFID}
              fill="#e8b94a"
              fillOpacity={0.08}
              label={{
                value: "Run-out",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#e8b94a",
              }}
            />
          )}

          {highlightedChanges.map((change, index) => (
            <ReferenceArea
              key={`${change.start_ffid}-${change.end_ffid}-${index}`}
              x1={change.start_ffid}
              x2={change.end_ffid}
              fill={change.detection_type === "Limit Exceeded" ? "#ff6b6b" : "#e8b94a"}
              fillOpacity={0.08}
              label={{
                value: change.detection_type === "Limit Exceeded" ? "Limit zone" : "Change zone",
                position: "insideTop",
                fontSize: 10,
                fill: change.detection_type === "Limit Exceeded" ? "#ff6b6b" : "#e8b94a",
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
            stroke="#66d9a0"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `Mean: ${stats.mean.toFixed(2)}°`,
              position: "right",
              fontSize: 10,
              fill: "#66d9a0",
            }}
          />

          {/* Feathering limit bands */}
          {featheringLimit > 0 && (
            <>
              <ReferenceLine
                y={featheringLimit}
                stroke="#ff6b6b"
                strokeDasharray="8 4"
                strokeWidth={1}
                label={{
                  value: `+${featheringLimit}°`,
                  position: "right",
                  fontSize: 9,
                  fill: "#ff6b6b",
                }}
              />
              <ReferenceLine
                y={-featheringLimit}
                stroke="#ff6b6b"
                strokeDasharray="8 4"
                strokeWidth={1}
                label={{
                  value: `-${featheringLimit}°`,
                  position: "right",
                  fontSize: 9,
                  fill: "#ff6b6b",
                }}
              />
            </>
          )}

          {highlightedPeaks.map((peak, index) => (
            <ReferenceLine
              key={`${peak.ffid}-${index}`}
              x={peak.ffid}
              stroke={peak.exceeded ? "#ff6b6b" : "#e8b94a"}
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: `Peak ${index + 1}`,
                position: "top",
                fontSize: 9,
                fill: peak.exceeded ? "#ff6b6b" : "#e8b94a",
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
            type="monotone"
            dataKey="feathering"
            stroke="#7c8aff"
            strokeWidth={1.2}
            dot={false}
            activeDot={{
              r: 3,
              fill: "#7c8aff",
              stroke: "var(--background)",
              strokeWidth: 1,
            }}
          />

          {/* Brush for range selection */}
          <Brush
            dataKey="ffid"
            height={24}
            stroke="var(--border)"
            fill="var(--muted)"
            travellerWidth={8}
          >
            <ComposedChart>
              <Line
                type="monotone"
                dataKey="feathering"
                stroke="#7c8aff"
                strokeWidth={0.5}
                dot={false}
              />
            </ComposedChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
