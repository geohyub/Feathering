import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ChartDataPoint } from "@/types";

interface HistogramChartProps {
  data: ChartDataPoint[];
  featheringLimit: number;
}

interface BinData {
  bin: string;
  center: number;
  count: number;
  exceeded: boolean;
}

export function HistogramChart({ data, featheringLimit }: HistogramChartProps) {
  const bins = useMemo(() => {
    if (data.length === 0) return [];

    const angles = data.map((d) => d.feathering);
    const min = Math.floor(Math.min(...angles));
    const max = Math.ceil(Math.max(...angles));
    const binWidth = Math.max(1, Math.round((max - min) / 40)); // ~40 bins
    const result: BinData[] = [];

    for (let start = min; start < max; start += binWidth) {
      const end = start + binWidth;
      const count = angles.filter((a) => a >= start && a < end).length;
      const center = start + binWidth / 2;
      result.push({
        bin: `${start}° ~ ${end}°`,
        center,
        count,
        exceeded:
          featheringLimit > 0 &&
          (Math.abs(start) > featheringLimit || Math.abs(end) > featheringLimit),
      });
    }

    return result;
  }, [data, featheringLimit]);

  const mean = useMemo(() => {
    if (data.length === 0) {
      return 0;
    }

    return data.reduce((sum, point) => sum + point.feathering, 0) / data.length;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={bins}
        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          strokeOpacity={0.3}
        />
        <XAxis
          dataKey="center"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickFormatter={(v: number) => `${v.toFixed(0)}°`}
          label={{
            value: "Feathering Angle (°)",
            position: "bottom",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={10}
          label={{
            value: "Count",
            angle: -90,
            position: "left",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "var(--foreground)",
          }}
          labelStyle={{ color: "var(--muted-foreground)" }}
          itemStyle={{ color: "var(--foreground)" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [Number(value).toLocaleString(), "Count"]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(_: any, payload: any) =>
            payload?.[0]?.payload?.bin || ""
          }
        />
        <ReferenceLine
          x={mean}
          stroke="#66d9a0"
          strokeDasharray="6 3"
          label={{
            value: `Mean ${mean.toFixed(1)}°`,
            position: "insideTopRight",
            fontSize: 10,
            fill: "#66d9a0",
          }}
        />
        {featheringLimit > 0 && (
          <>
            <ReferenceLine
              x={featheringLimit}
              stroke="#ff6b6b"
              strokeDasharray="8 4"
              label={{
                value: `+${featheringLimit}°`,
                position: "insideTopRight",
                fontSize: 9,
                fill: "#ff6b6b",
              }}
            />
            <ReferenceLine
              x={-featheringLimit}
              stroke="#ff6b6b"
              strokeDasharray="8 4"
              label={{
                value: `-${featheringLimit}°`,
                position: "insideTopLeft",
                fontSize: 9,
                fill: "#ff6b6b",
              }}
            />
          </>
        )}
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {bins.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.exceeded ? "#ff6b6b" : "#7c8aff"}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
