import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, FolderOpen, Play, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { AnalysisSnapshot } from "@/types";

const NONE_TRACK = "__none__";

function getFileName(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function formatAngle(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(1)} deg`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

function buildComparisonData(primary: AnalysisSnapshot, secondary: AnalysisSnapshot) {
  const map = new Map<number, { ffid: number; primary: number | null; secondary: number | null }>();

  for (const point of primary.chartData.points) {
    map.set(point.ffid, {
      ffid: point.ffid,
      primary: point.feathering,
      secondary: null,
    });
  }

  for (const point of secondary.chartData.points) {
    const existing = map.get(point.ffid);
    if (existing) {
      existing.secondary = point.feathering;
    } else {
      map.set(point.ffid, {
        ffid: point.ffid,
        primary: null,
        secondary: point.feathering,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => a.ffid - b.ffid)
    .filter(
      (_, index, arr) =>
        arr.length <= 720 ||
        index % Math.ceil(arr.length / 720) === 0 ||
        index === arr.length - 1
    );
}

function collectSettingDiffs(primary: AnalysisSnapshot, secondary: AnalysisSnapshot) {
  const labels: Record<keyof AnalysisSnapshot["settings"], string> = {
    npdPath: "NPD",
    trackPath: "Track",
    outputDir: "Output",
    lineName: "Line",
    plannedAzimuth: "Azimuth",
    featheringLimit: "Limit",
    runInM: "Run-in",
    runOutM: "Run-out",
    fastMatch: "Match mode",
    matchTolerance: "Tolerance",
    headPosition: "Head",
    tailPosition: "Tail",
  };

  return (Object.keys(primary.settings) as Array<keyof AnalysisSnapshot["settings"]>)
    .filter((key) => primary.settings[key] !== secondary.settings[key])
    .map(
      (key) =>
        `${labels[key]}: ${String(primary.settings[key] || "empty")} -> ${String(
          secondary.settings[key] || "empty"
        )}`
    );
}

interface WorkspacePanelProps {
  analysis: {
    browseWorkspaceFolder: () => Promise<void>;
    scanWorkspaceFolder: (folder?: string) => Promise<void>;
    runBatchAnalysis: () => Promise<void>;
    openFile: (path: string) => Promise<void>;
  };
}

export function WorkspacePanel({ analysis }: WorkspacePanelProps) {
  const workspaceFolder = useAppStore((state) => state.workspaceFolder);
  const workspaceTrackFiles = useAppStore((state) => state.workspaceTrackFiles);
  const workspaceJobs = useAppStore((state) => state.workspaceJobs);
  const batchResults = useAppStore((state) => state.batchResults);
  const batchOutputDir = useAppStore((state) => state.batchOutputDir);
  const isBatchRunning = useAppStore((state) => state.isBatchRunning);
  const outputDir = useAppStore((state) => state.outputDir);
  const plannedAzimuth = useAppStore((state) => state.plannedAzimuth);
  const analysisHistory = useAppStore((state) => state.analysisHistory);
  const setWorkspaceFolder = useAppStore((state) => state.setWorkspaceFolder);
  const updateWorkspaceJob = useAppStore((state) => state.updateWorkspaceJob);
  const setActivePanel = useAppStore((state) => state.setActivePanel);

  const selectedJobCount = useMemo(
    () => workspaceJobs.filter((job) => job.selected && job.trackPath).length,
    [workspaceJobs]
  );
  const failedBatchCount = useMemo(
    () => batchResults.filter((job) => job.status === "error").length,
    [batchResults]
  );
  const successfulBatchCount = batchResults.length - failedBatchCount;

  const [tab, setTab] = useState<"batch" | "compare">("batch");
  const [primaryId, setPrimaryId] = useState("");
  const [secondaryId, setSecondaryId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!analysisHistory.length) return;
    setPrimaryId((current) => current || analysisHistory[0]?.id || "");
    setSecondaryId((current) => current || analysisHistory[1]?.id || analysisHistory[0]?.id || "");
  }, [analysisHistory]);

  const deferredHistory = useDeferredValue(analysisHistory);
  const primary = useDeferredValue(
    deferredHistory.find((item) => item.id === primaryId) || null
  );
  const secondary = useDeferredValue(
    deferredHistory.find((item) => item.id === secondaryId) || null
  );

  const comparisonData = useMemo(() => {
    if (!primary || !secondary || primary.id === secondary.id) return [];
    return buildComparisonData(primary, secondary);
  }, [primary, secondary]);

  const settingDiffs = useMemo(() => {
    if (!primary || !secondary || primary.id === secondary.id) return [];
    return collectSettingDiffs(primary, secondary);
  }, [primary, secondary]);

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(63,184,175,0.12),rgba(63,184,175,0.03)_42%,rgba(124,138,255,0.1))]">
        <CardContent className="grid gap-4 px-5 py-5 md:grid-cols-4">
          {[
            ["Detected jobs", String(workspaceJobs.length)],
            ["Selected jobs", String(selectedJobCount)],
            ["Scenario history", String(analysisHistory.length)],
            ["Batch results", String(batchResults.length)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(value) => startTransition(() => setTab(value as "batch" | "compare"))}
      >
        <TabsList variant="line" className="w-full justify-start border-b border-border/80 px-1 pb-2">
          <TabsTrigger value="batch" className="text-xs">
            Batch Queue
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">
            Scenario Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <FolderOpen size={15} className="text-primary" />
                  Folder Scan
                </CardTitle>
                <CardDescription className="text-xs">
                  Review suggested NPD and track pairs before running a shared policy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={workspaceFolder}
                    onChange={(event) => setWorkspaceFolder(event.target.value)}
                    placeholder="Choose or paste a folder to scan"
                    className="h-10 font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => void analysis.browseWorkspaceFolder()}
                    >
                      Browse
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => void analysis.scanWorkspaceFolder()}
                    >
                      <RefreshCw size={14} className="mr-2" />
                      Scan
                    </Button>
                  </div>
                </div>

                {workspaceJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-8 text-center text-sm text-muted-foreground">
                    No batch jobs yet. Scan a folder to populate the queue.
                  </div>
                ) : (
                  <ScrollArea className="h-[560px] pr-4">
                    <div className="space-y-3">
                      {workspaceJobs.map((job) => (
                        <div
                          key={job.id}
                          className={cn(
                            "rounded-3xl border p-4",
                            job.trackPath
                              ? "border-border/70 bg-background/35"
                              : "border-warning/35 bg-warning/5"
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={job.selected}
                                onCheckedChange={(checked) =>
                                  updateWorkspaceJob(job.id, { selected: Boolean(checked) })
                                }
                                className="mt-1"
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-medium text-foreground">
                                    {job.lineName || getFileName(job.npdPath)}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={
                                      job.confidence >= 70
                                        ? "border-primary/25 bg-primary/10 text-primary"
                                        : job.confidence >= 50
                                          ? "border-warning/25 bg-warning/10 text-warning"
                                          : "border-destructive/25 bg-destructive/10 text-destructive"
                                    }
                                  >
                                    Pair {job.confidence}%
                                  </Badge>
                                </div>
                                <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                  {job.matchReason}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setActivePanel("input")}
                            >
                              Open single run
                            </Button>
                          </div>

                          <div className="mt-4 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                            <Input
                              value={job.lineName}
                              onChange={(event) =>
                                updateWorkspaceJob(job.id, { lineName: event.target.value })
                              }
                              className="h-9 text-xs"
                            />
                            <div className="rounded-2xl border border-border/70 bg-card/60 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                              {job.npdPath}
                            </div>
                            <Select
                              value={job.trackPath || NONE_TRACK}
                              onValueChange={(value) =>
                                updateWorkspaceJob(job.id, {
                                  trackPath: (value ?? NONE_TRACK) === NONE_TRACK ? "" : value ?? "",
                                  selected: (value ?? NONE_TRACK) !== NONE_TRACK,
                                })
                              }
                            >
                              <SelectTrigger className="h-9 text-left text-xs">
                                <SelectValue placeholder="Track file" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_TRACK}>Not assigned</SelectItem>
                                {workspaceTrackFiles.map((trackPath) => (
                                  <SelectItem key={trackPath} value={trackPath}>
                                    {getFileName(trackPath)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium">Batch Action</CardTitle>
                  <CardDescription className="text-xs">
                    Every selected job uses the current input and option settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm leading-6 text-muted-foreground">
                    Output root: <span className="text-foreground">{outputDir || "not set"}</span>
                    <br />
                    Planned azimuth:{" "}
                    <span className="text-foreground">{plannedAzimuth || "not set"}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => void analysis.runBatchAnalysis()}
                    disabled={isBatchRunning || selectedJobCount === 0}
                  >
                    <Play size={14} className="mr-2" />
                    {isBatchRunning ? "Batch running..." : `Run batch (${selectedJobCount})`}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium">Batch Results</CardTitle>
                  <CardDescription className="text-xs">
                    Open the batch root or inspect each output folder directly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                      {successfulBatchCount} success
                    </Badge>
                    <Badge variant="outline" className="border-warning/25 bg-warning/10 text-warning">
                      {failedBatchCount} failed
                    </Badge>
                    {batchOutputDir ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void analysis.openFile(batchOutputDir)}
                      >
                        Open batch folder
                      </Button>
                    ) : null}
                  </div>

                  <ScrollArea className="h-[420px] pr-4">
                    <div className="space-y-3">
                      {batchResults.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
                          No batch results yet.
                        </div>
                      ) : (
                        batchResults.map((job) => (
                          <div
                            key={job.id}
                            className={cn(
                              "rounded-2xl border p-4",
                              job.status === "success"
                                ? "border-border/70 bg-background/35"
                                : "border-warning/35 bg-warning/5"
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {job.lineName}
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {job.status === "success" && job.summary
                                    ? `${job.summary.verdict} | Mean ${formatAngle(
                                        job.summary.main_stats.mean
                                      )} | ${
                                        job.summary.limit
                                          ? `Exceeded ${formatPercent(
                                              job.summary.limit.main_exceeded_percent
                                            )}`
                                          : "Limit off"
                                      }`
                                    : job.error || "Batch job failed."}
                                </div>
                              </div>
                              {job.outputDir ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => void analysis.openFile(job.outputDir)}
                                >
                                  Open output
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compare" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRightLeft size={15} className="text-primary" />
                  Scenario Compare
                </CardTitle>
                <CardDescription className="text-xs">
                  Overlay two saved runs and read the setting deltas as one story.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisHistory.length < 2 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-8 text-center text-sm text-muted-foreground">
                    Run at least two scenarios to unlock comparison.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select
                        value={primaryId}
                        onValueChange={(value) =>
                          startTransition(() => setPrimaryId(value ?? ""))
                        }
                      >
                        <SelectTrigger className="h-10 text-left text-xs">
                          <SelectValue placeholder="Primary scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {analysisHistory.map((snapshot) => (
                            <SelectItem key={snapshot.id} value={snapshot.id}>
                              {snapshot.label} | {snapshot.createdAt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={secondaryId}
                        onValueChange={(value) =>
                          startTransition(() => setSecondaryId(value ?? ""))
                        }
                      >
                        <SelectTrigger className="h-10 text-left text-xs">
                          <SelectValue placeholder="Secondary scenario" />
                        </SelectTrigger>
                        <SelectContent>
                          {analysisHistory.map((snapshot) => (
                            <SelectItem key={snapshot.id} value={snapshot.id}>
                              {snapshot.label} | {snapshot.createdAt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {primary && secondary && primary.id !== secondary.id ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[primary, secondary].map((snapshot, index) => (
                            <div
                              key={snapshot.id}
                              className="rounded-3xl border border-border/70 bg-background/35 p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    index === 0
                                      ? "border-primary/25 bg-primary/10 text-primary"
                                      : "border-[rgba(124,138,255,0.25)] bg-[rgba(124,138,255,0.12)] text-[rgb(124,138,255)]"
                                  )}
                                >
                                  {index === 0 ? "Primary" : "Secondary"}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="border-border/70 bg-card/70 text-foreground"
                                >
                                  {snapshot.summary.verdict}
                                </Badge>
                              </div>
                              <div className="mt-3 text-sm font-medium text-foreground">
                                {snapshot.label}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {snapshot.createdAt}
                              </div>
                              <div className="mt-4 text-sm text-muted-foreground">
                                {snapshot.summary.headline}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="h-[360px] rounded-3xl border border-border/70 bg-card/85 p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={comparisonData}
                              margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(148,163,184,0.18)"
                              />
                              <XAxis dataKey="ffid" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} unit=" deg" />
                              <Tooltip
                                formatter={(value) =>
                                  typeof value === "number"
                                    ? `${value.toFixed(2)} deg`
                                    : value ?? "N/A"
                                }
                                labelFormatter={(label) => `FFID ${label}`}
                              />
                              <Legend />
                              <ReferenceLine y={0} stroke="rgba(148,163,184,0.5)" />
                              <Line
                                type="monotone"
                                dataKey="primary"
                                name={primary.label}
                                stroke="rgb(63,184,175)"
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                              />
                              <Line
                                type="monotone"
                                dataKey="secondary"
                                name={secondary.label}
                                stroke="rgb(124,138,255)"
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-4 text-sm text-warning">
                        Select two different scenarios to enable comparison.
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium">Setting Deltas</CardTitle>
                  <CardDescription className="text-xs">
                    Read which configuration changes most likely drove the result shift.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isPending ? (
                    <div className="rounded-2xl border border-border/70 bg-background/35 px-3 py-3 text-xs text-muted-foreground">
                      Refreshing comparison view...
                    </div>
                  ) : null}

                  {settingDiffs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      No scenario delta is ready yet.
                    </div>
                  ) : (
                    settingDiffs.map((line) => (
                      <div
                        key={line}
                        className="rounded-2xl border border-border/70 bg-background/35 px-3 py-3 text-sm text-foreground"
                      >
                        {line}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium">Operator Notes</CardTitle>
                  <CardDescription className="text-xs">
                    Use batch for throughput and compare for interpretation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                    Use batch when one policy needs to be applied safely across many lines.
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                    Use compare when you need to explain why a preset, threshold, or window
                    changed the interpretation.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActivePanel("results")}
                  >
                    Back to current result
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
