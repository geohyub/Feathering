import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ExternalLink,
  FileDown,
  FileText,
  Image,
  Printer,
  Route,
  ShieldAlert,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/appStore";
import { generateFeatheringPDF } from "@/lib/reportGenerator";
import type { ChartTabId, VerdictLevel } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatheringChart } from "@/components/charts/FeatheringChart";
import { HistogramChart } from "@/components/charts/HistogramChart";
import { TrackPlot } from "@/components/charts/TrackPlot";
import { Button } from "@/components/ui/button";

interface ResultsPanelProps {
  analysis: {
    openFile: (path: string) => Promise<void>;
    openOutputDir: () => Promise<void>;
    runAnalysis?: () => Promise<void>;
  };
}

const typeIcons: Record<string, React.ReactNode> = {
  CSV: <Table2 size={12} />,
  PNG: <Image size={12} />,
  TXT: <FileText size={12} />,
  PDF: <FileDown size={12} />,
  LOG: <FileText size={12} />,
};

const typeColors: Record<string, string> = {
  CSV: "border-chart-2/30 bg-chart-2/15 text-chart-2",
  PNG: "border-chart-1/30 bg-chart-1/15 text-chart-1",
  TXT: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  PDF: "border-destructive/30 bg-destructive/15 text-destructive",
  LOG: "border-border bg-muted text-foreground",
};

const verdictStyles: Record<VerdictLevel, string> = {
  PASS: "border-success/35 bg-success/10 text-success",
  WARN: "border-warning/35 bg-warning/10 text-warning",
  FAIL: "border-destructive/35 bg-destructive/10 text-destructive",
  INFO: "border-primary/35 bg-primary/10 text-primary",
};

const chartDescriptions: Record<ChartTabId, string> = {
  feathering:
    "FFID 기준 변동, run-in/out 제외 구간, limit 기준, 변화 구간을 한 번에 읽습니다.",
  track:
    "Exceeded point가 공간적으로 어디에 몰리는지 확인해 실제 line geometry와 함께 해석합니다.",
  histogram:
    "분포가 중심에 모이는지, 한쪽으로 bias되는지, 긴 꼬리가 있는지를 빠르게 파악합니다.",
};

function formatAngle(value: number) {
  return `${value.toFixed(2)}°`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMeters(value: number) {
  return `${value.toLocaleString()} m`;
}

export function ResultsPanel({ analysis }: ResultsPanelProps) {
  const resultFiles = useAppStore((s) => s.resultFiles);
  const stats = useAppStore((s) => s.stats);
  const summary = useAppStore((s) => s.summary);
  const chartData = useAppStore((s) => s.chartData);
  const resultsStale = useAppStore((s) => s.resultsStale);
  const analysisHistoryCount = useAppStore((s) => s.analysisHistory.length);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const featheringLimit = parseFloat(useAppStore((s) => s.featheringLimit) || "0");
  const runInM = parseFloat(useAppStore((s) => s.runInM) || "0");
  const runOutM = parseFloat(useAppStore((s) => s.runOutM) || "0");
  const plannedAzimuth = useAppStore((s) => s.plannedAzimuth);
  const headPosition = useAppStore((s) => s.headPosition);
  const tailPosition = useAppStore((s) => s.tailPosition);
  const npdPath = useAppStore((s) => s.npdPath);
  const trackPath = useAppStore((s) => s.trackPath);
  const lineName = useAppStore((s) => s.lineName);
  const [activeChart, setActiveChart] = useState<ChartTabId>("feathering");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportPDF = useCallback(() => {
    if (!stats || !summary) return;
    setIsGeneratingPDF(true);
    try {
      const doc = generateFeatheringPDF({
        stats,
        summary,
        lineName: lineName || summary.matching.line_name || "Unknown",
        featheringLimit,
        plannedAzimuth,
        headPosition,
        tailPosition,
        npdPath,
        trackPath,
      });
      const fileName = `Feathering_Report_${(lineName || "analysis").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      doc.save(fileName);
      toast.success(`PDF 저장 완료: ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`PDF 생성 실패: ${message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [stats, summary, lineName, featheringLimit, plannedAzimuth, headPosition, tailPosition, npdPath, trackPath]);

  useEffect(() => {
    if (summary?.recommended_chart) {
      setActiveChart(summary.recommended_chart);
    }
  }, [summary?.recommended_chart]);

  const fileTypeCounts = useMemo(() => {
    return resultFiles.reduce<Record<string, number>>((accumulator, file) => {
      accumulator[file.type] = (accumulator[file.type] || 0) + 1;
      return accumulator;
    }, {});
  }, [resultFiles]);

  if (!stats && !summary && resultFiles.length === 0) {
    return (
      <Card className="border-dashed border-border/70 bg-background/35">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
          <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
            No results
          </Badge>
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Run analysis to view results
          </h2>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {resultsStale && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert size={16} className="mt-1 text-warning" />
              <div>
                <div className="font-medium text-warning">이 결과는 오래된 상태입니다.</div>
                <p className="mt-1 text-sm leading-6 text-warning/90">
                  입력이나 옵션이 변경되어 현재 차트와 report가 최신 판단 기준을 반영하지 않습니다.
                  같은 스토리로 다시 읽으려면 rerun이 필요합니다.
                </p>
              </div>
            </div>
            {analysis.runAnalysis && (
              <Button onClick={() => void analysis.runAnalysis?.()}>다시 실행</Button>
            )}
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <Card className="overflow-hidden border-primary/25 bg-[linear-gradient(135deg,rgba(63,184,175,0.12),rgba(63,184,175,0.02)_42%,rgba(124,138,255,0.1))]">
            <CardContent className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={verdictStyles[summary.verdict]}>
                    {summary.verdict}
                  </Badge>
                  <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                    Start with {summary.recommended_chart}
                  </Badge>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {summary.headline}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {summary.detail}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Main-line mean",
                      value: formatAngle(summary.main_stats.mean),
                      detail: `Range ${formatAngle(summary.main_stats.range)}`,
                    },
                    {
                      label: "Main-line exceeded",
                      value:
                        summary.limit != null
                          ? `${summary.limit.main_exceeded_count.toLocaleString()}`
                          : "Limit off",
                      detail:
                        summary.limit != null
                          ? formatPercent(summary.limit.main_exceeded_percent)
                          : "Review mode",
                    },
                    {
                      label: "Included records",
                      value: summary.window.included_records.toLocaleString(),
                      detail: `${summary.window.total_records.toLocaleString()} total`,
                    },
                    {
                      label: "Coverage window",
                      value: formatMeters(summary.window.included_distance_m),
                      detail: `Run-in/out ${formatMeters(runInM)} · ${formatMeters(runOutM)}`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3"
                    >
                      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{item.value}</div>
                      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {item.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Judgment basis
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">Recommended chart</div>
                    <p>{summary.recommended_reason}</p>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Matching</div>
                    <p>
                      {summary.matching.mode === "fast" ? "Fast tolerance match" : "Precise nearest match"}
                      {summary.matching.tolerance_s != null
                        ? ` · ±${summary.matching.tolerance_s}s`
                        : ""}
                      {" · "}
                      {formatPercent(summary.matching.matched_percent)} of NPD records matched
                    </p>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Window</div>
                    <p>
                      FFID {summary.window.first_ffid?.toLocaleString() ?? "N/A"} →{" "}
                      {summary.window.last_ffid?.toLocaleString() ?? "N/A"} / main window{" "}
                      {summary.window.run_in_end_ffid?.toLocaleString() ?? "start"} →{" "}
                      {summary.window.run_out_start_ffid?.toLocaleString() ?? "end"}
                    </p>
                  </div>
                  {summary.limit && (
                    <div>
                      <div className="font-medium text-foreground">Limit</div>
                      <p>
                        ±{summary.limit.value.toLocaleString()}° / max absolute{" "}
                        {formatAngle(summary.limit.max_abs)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/85">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Route size={15} className="text-primary" />
                Output package
              </CardTitle>
              <CardDescription className="text-xs">
                생성된 deliverable을 종류별로 확인하고 바로 열 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(fileTypeCounts).map(([type, count]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className={typeColors[type] || "border-border bg-muted text-foreground"}
                  >
                    {typeIcons[type]}
                    <span className="ml-1">
                      {type} · {count}
                    </span>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Chart, CSV, Report, PDF가 같은 출력 폴더에 저장됩니다.
              </p>
              <Button variant="outline" className="w-full" onClick={() => void analysis.openOutputDir()}>
                출력 폴더 열기
              </Button>
              <Button
                variant="default"
                className="w-full"
                onClick={handleExportPDF}
                disabled={isGeneratingPDF || !stats || !summary}
              >
                <Printer size={14} className="mr-2" />
                {isGeneratingPDF ? "PDF 생성 중..." : "PDF 리포트 내보내기"}
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setActivePanel("workspace")}>
                Compare scenarios
                {analysisHistoryCount > 0 ? ` (${analysisHistoryCount})` : ""}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Largest excursions</CardTitle>
              <CardDescription className="text-xs">
                최대 편차를 보인 FFID를 zone과 함께 정리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.peaks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No peak excursion detected.</p>
              ) : (
                summary.peaks.map((peak, index) => (
                  <div key={`${peak.ffid}-${index}`} className="rounded-2xl border border-border/70 bg-background/35 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          FFID {peak.ffid.toLocaleString()}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {peak.zone}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {formatAngle(peak.feathering)}
                        </div>
                        {peak.exceeded && (
                          <div className="mt-1 text-[11px] text-warning">Exceeded</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Change zones</CardTitle>
              <CardDescription className="text-xs">
                급변 또는 지속 편차 구간을 FFID 범위로 정리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summary.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No change zone flagged.</p>
              ) : (
                summary.changes.map((change, index) => (
                  <div key={`${change.start_ffid}-${change.end_ffid}-${index}`} className="rounded-2xl border border-border/70 bg-background/35 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {change.start_ffid.toLocaleString()} → {change.end_ffid.toLocaleString()}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {change.detection_type}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-foreground">{formatAngle(change.peak_abs)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {change.record_count.toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Window & matching</CardTitle>
              <CardDescription className="text-xs">
                어떤 데이터가 실제 verdict에 포함되었는지 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Included coverage
                </div>
                <p className="mt-2">
                  {summary.window.included_records.toLocaleString()} /{" "}
                  {summary.window.total_records.toLocaleString()} records are treated as the main-line
                  evidence window.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Source mapping
                </div>
                <p className="mt-2">
                  {summary.matching.head_position} → {summary.matching.tail_position} 기준으로
                  streamer vector를 계산했습니다.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Match coverage
                </div>
                <p className="mt-2">
                  {summary.matching.npd_records.toLocaleString()} NPD /{" "}
                  {summary.matching.track_records.toLocaleString()} Track records 중{" "}
                  {summary.matching.matched_records.toLocaleString()}개가 실제 feathering 계산에
                  사용되었습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {chartData && stats && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 size={15} className="text-primary" />
              Visual evidence
            </CardTitle>
            <CardDescription className="text-xs">
              {chartDescriptions[activeChart]}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs value={activeChart} onValueChange={(value) => setActiveChart(value as ChartTabId)}>
              <TabsList variant="line" className="w-full justify-start border-b border-border/80 px-1 pb-2">
                <TabsTrigger value="feathering" className="text-xs">
                  Feathering Plot
                </TabsTrigger>
                <TabsTrigger value="track" className="text-xs">
                  Track Plot
                </TabsTrigger>
                <TabsTrigger value="histogram" className="text-xs">
                  Histogram
                </TabsTrigger>
              </TabsList>
              <TabsContent value="feathering" className="pt-4">
                <FeatheringChart
                  data={chartData.points}
                  stats={stats}
                  featheringLimit={featheringLimit}
                  runInM={runInM}
                  runOutM={runOutM}
                  summary={summary}
                />
              </TabsContent>
              <TabsContent value="track" className="pt-4">
                <TrackPlot data={chartData.points} featheringLimit={featheringLimit} />
              </TabsContent>
              <TabsContent value="histogram" className="pt-4">
                <HistogramChart data={chartData.points} featheringLimit={featheringLimit} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium">Generated files</CardTitle>
              <CardDescription className="text-xs">
                결과 file을 직접 열어 chart, CSV, report를 확인합니다.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-border/70 bg-background/35 text-foreground">
              {resultFiles.length} files
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {resultFiles.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              분석 완료 후 파일 목록이 표시됩니다.
            </p>
          ) : (
            <ScrollArea className="max-h-[260px]">
              <div className="space-y-2">
                {resultFiles.map((file, index) => (
                  <button
                    key={`${file.path}-${index}`}
                    onClick={() => void analysis.openFile(file.path)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/35 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/10"
                  >
                    <Badge
                      variant="outline"
                      className={typeColors[file.type] || "border-border bg-muted text-foreground"}
                    >
                      {typeIcons[file.type]}
                      <span className="ml-1">{file.type}</span>
                    </Badge>
                    <span className="flex-1 truncate font-mono text-xs text-foreground">
                      {file.name}
                    </span>
                    <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
