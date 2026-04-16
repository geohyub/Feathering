import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { lttbDecimate } from "@/lib/decimation";
import type { ChartDataPoint } from "@/types";

interface TrackPlotProps {
  data: ChartDataPoint[];
  featheringLimit: number;
}

const MAX_POINTS = 500;

function computeGridLines(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range <= 0) return [];
  const rawStep = range / (count + 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 5, 10];
  const step =
    magnitude *
    (niceSteps.find((s) => s * magnitude >= rawStep) || niceSteps[niceSteps.length - 1]);
  const start = Math.ceil(min / step) * step;
  const lines: number[] = [];
  for (let v = start; v <= max; v += step) {
    lines.push(Math.round(v * 1e6) / 1e6);
  }
  return lines;
}

export function TrackPlot({ data, featheringLimit }: TrackPlotProps) {
  const { sourceNormal, sourceExceeded, headBuoy, tailBuoy } = useMemo(() => {
    // Separate normal vs exceeded
    const normal: { x: number; y: number; ffid: number }[] = [];
    const exceeded: { x: number; y: number; ffid: number }[] = [];
    const head: { x: number; y: number }[] = [];
    const tail: { x: number; y: number }[] = [];

    for (const d of data) {
      const pt = { x: d.sou_x, y: d.sou_y, ffid: d.ffid };
      if (featheringLimit > 0 && Math.abs(d.feathering) > featheringLimit) {
        exceeded.push(pt);
      } else {
        normal.push(pt);
      }
      if (d.front_x && d.front_y) head.push({ x: d.front_x, y: d.front_y });
      if (d.tail_x && d.tail_y) tail.push({ x: d.tail_x, y: d.tail_y });
    }

    // Decimate for rendering
    const decNormal =
      normal.length > MAX_POINTS
        ? lttbDecimate(normal, MAX_POINTS)
        : normal;
    const decHead =
      head.length > MAX_POINTS
        ? lttbDecimate(
            head.map((h) => ({ ...h, ffid: 0 })),
            MAX_POINTS
          )
        : head;
    const decTail =
      tail.length > MAX_POINTS
        ? lttbDecimate(
            tail.map((t) => ({ ...t, ffid: 0 })),
            MAX_POINTS
          )
        : tail;

    return {
      sourceNormal: decNormal,
      sourceExceeded: exceeded.length > MAX_POINTS
        ? lttbDecimate(exceeded, MAX_POINTS)
        : exceeded,
      headBuoy: decHead,
      tailBuoy: decTail,
    };
  }, [data, featheringLimit]);

  const formatCoord = (v: number) => {
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Compute coordinate grid lines for spatial context
  const { xGridLines, yGridLines } = useMemo(() => {
    if (data.length === 0) return { xGridLines: [], yGridLines: [] };
    const allX = data.flatMap((d) => [d.sou_x, d.front_x, d.tail_x].filter(Boolean));
    const allY = data.flatMap((d) => [d.sou_y, d.front_y, d.tail_y].filter(Boolean));
    const xMin = Math.min(...allX);
    const xMax = Math.max(...allX);
    const yMin = Math.min(...allY);
    const yMax = Math.max(...allY);
    return {
      xGridLines: computeGridLines(xMin, xMax, 4),
      yGridLines: computeGridLines(yMin, yMax, 4),
    };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          strokeOpacity={0.3}
        />
        <XAxis
          dataKey="x"
          type="number"
          name="East"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickFormatter={formatCoord}
          label={{
            value: "East (m)",
            position: "bottom",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
          domain={["auto", "auto"]}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="North"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickFormatter={formatCoord}
          label={{
            value: "North (m)",
            angle: -90,
            position: "left",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
          domain={["auto", "auto"]}
        />
        <ZAxis range={[6, 6]} />

        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${Number(value).toFixed(2)} m`,
            name,
          ]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(_: any, payload: any) => {
            const item = payload?.[0]?.payload;
            if (!item) return "";
            return item.ffid ? `FFID ${item.ffid}` : "";
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          iconSize={8}
          verticalAlign="bottom"
        />

        {/* Coordinate grid lines */}
        {xGridLines.map((v) => (
          <ReferenceLine
            key={`x-${v}`}
            x={v}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.15}
            strokeDasharray="6 4"
            label={{
              value: `E ${formatCoord(v)}`,
              position: "insideTopRight",
              fontSize: 8,
              fill: "var(--muted-foreground)",
              opacity: 0.5,
            }}
          />
        ))}
        {yGridLines.map((v) => (
          <ReferenceLine
            key={`y-${v}`}
            y={v}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.15}
            strokeDasharray="6 4"
            label={{
              value: `N ${formatCoord(v)}`,
              position: "insideTopLeft",
              fontSize: 8,
              fill: "var(--muted-foreground)",
              opacity: 0.5,
            }}
          />
        ))}

        {/* Head Buoy trace */}
        {headBuoy.length > 0 && (
          <Scatter
            name="Head Buoy"
            data={headBuoy}
            fill="#3fb8af"
            fillOpacity={0.3}
            shape="circle"
            legendType="circle"
            isAnimationActive={false}
          />
        )}

        {/* Tail Buoy trace */}
        {tailBuoy.length > 0 && (
          <Scatter
            name="Tail Buoy"
            data={tailBuoy}
            fill="#a78bfa"
            fillOpacity={0.3}
            shape="circle"
            legendType="circle"
            isAnimationActive={false}
          />
        )}

        {/* Source — normal */}
        <Scatter
          name="Source (Normal)"
          data={sourceNormal}
          fill="#7c8aff"
          fillOpacity={0.7}
          shape="circle"
          legendType="circle"
          isAnimationActive={false}
        />

        {/* Source — exceeded */}
        {sourceExceeded.length > 0 && (
          <Scatter
            name="Source (Exceeded)"
            data={sourceExceeded}
            fill="#ff6b6b"
            fillOpacity={0.9}
            shape="diamond"
            legendType="diamond"
            isAnimationActive={false}
          />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
