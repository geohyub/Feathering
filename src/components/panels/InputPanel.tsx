import { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Compass,
  FileSearch,
  FolderOpen,
  Loader2,
  Route,
  Ruler,
  Wand2,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { FileDropZone } from "@/components/FileDropZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface InputPanelProps {
  analysis: {
    browseFile: (field: "npdPath" | "trackPath", title: string) => Promise<void>;
    scanHeaders: (path: string) => Promise<void>;
    estimateAzimuth: () => Promise<void>;
    runAnalysis: () => Promise<void>;
  };
}

const presets = [
  {
    id: "strict",
    label: "Strict QC",
    description: "±3° / precise match / 200 m trim",
    values: {
      featheringLimit: "3",
      runInM: "200",
      runOutM: "200",
      fastMatch: false,
      matchTolerance: "",
    },
  },
  {
    id: "survey",
    label: "Survey Default",
    description: "±5° / fast 2.5 s / 150 m trim",
    values: {
      featheringLimit: "5",
      runInM: "150",
      runOutM: "150",
      fastMatch: true,
      matchTolerance: "2.5",
    },
  },
  {
    id: "explore",
    label: "Explore",
    description: "No limit / fast 5 s / full line",
    values: {
      featheringLimit: "0",
      runInM: "0",
      runOutM: "0",
      fastMatch: true,
      matchTolerance: "5",
    },
  },
] as const;

function formatMeters(value: string) {
  return `${Number(value || 0).toLocaleString()} m`;
}

function formatPathLabel(path: string, empty: string) {
  if (!path) {
    return empty;
  }

  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export function InputPanel({ analysis }: InputPanelProps) {
  const {
    npdPath,
    trackPath,
    lineName,
    plannedAzimuth,
    featheringLimit,
    runInM,
    runOutM,
    npdHeaders,
    headPosition,
    tailPosition,
    fastMatch,
    matchTolerance,
    outputDir,
    azimuthEstimate,
    resultsStale,
    isRunning,
    setField,
    setHeadPosition,
    setTailPosition,
    setFastMatch,
    setMatchTolerance,
    setActivePanel,
  } = useAppStore();

  const [estimating, setEstimating] = useState(false);

  const recommendedAzimuth =
    azimuthEstimate == null
      ? null
      : azimuthEstimate.method === "track_heading" && azimuthEstimate.azimuth_reverse != null
        ? azimuthEstimate.azimuth_reverse
        : azimuthEstimate.azimuth;

  const azimuthMatchesEstimate =
    recommendedAzimuth != null &&
    plannedAzimuth !== "" &&
    Math.abs(Number(plannedAzimuth) - recommendedAzimuth) < 0.05;

  const filesReady = Boolean(npdPath && trackPath);
  const headersReady =
    npdHeaders.length === 0 ||
    (Boolean(headPosition) && Boolean(tailPosition) && headPosition !== tailPosition);
  const azimuthReady = Boolean(plannedAzimuth);
  const runReady = filesReady && headersReady && azimuthReady;

  const nextAction = !filesReady
    ? "NPD와 Track 파일을 모두 연결하면 헤더 스캔과 방향 설정으로 넘어갑니다."
    : !headersReady
      ? "Head / Tail 헤더가 서로 다르게 선택되어야 실제 streamer 방향이 계산됩니다."
      : !azimuthReady
        ? "Planned Azimuth를 직접 입력하거나 Track 기반 자동 추정을 먼저 실행하세요."
        : resultsStale
          ? "입력이 바뀌어 현재 결과가 오래된 상태입니다. 다시 실행해서 차트와 출력물을 갱신하세요."
          : "입력 준비가 완료되었습니다. 옵션을 검토한 뒤 바로 실행할 수 있습니다.";

  const workflowSteps = [
    {
      label: "Data loaded",
      ready: filesReady,
      detail: filesReady ? "NPD + Track connected" : "Load both source files",
    },
    {
      label: "Header mapping",
      ready: headersReady,
      detail: npdHeaders.length > 0 ? `${headPosition} → ${tailPosition}` : "Wait for NPD scan",
    },
    {
      label: "Direction basis",
      ready: azimuthReady,
      detail:
        azimuthEstimate != null
          ? `${azimuthEstimate.method === "cable_vector" ? "Cable vector" : "Track reverse"} / ${azimuthEstimate.confidence}`
          : "Manual or estimated azimuth",
    },
    {
      label: "Run ready",
      ready: runReady,
      detail: resultsStale ? "Previous result is stale" : "Ready for analysis",
    },
  ];

  const handleEstimate = async () => {
    setEstimating(true);
    try {
      await analysis.estimateAzimuth();
    } finally {
      setTimeout(() => setEstimating(false), 1500);
    }
  };

  const handleBrowse = async (field: "npdPath" | "trackPath") => {
    const title = field === "npdPath" ? "NPD 파일 선택" : "Track 파일 선택";
    await analysis.browseFile(field, title);
  };

  const handleFileDrop = (field: "npdPath" | "trackPath") => (path: string) => {
    setField(field, path);
    if (field === "npdPath") {
      void analysis.scanHeaders(path);
    }
  };

  const applyPreset = (presetId: (typeof presets)[number]["id"]) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setField("featheringLimit", preset.values.featheringLimit);
    setField("runInM", preset.values.runInM);
    setField("runOutM", preset.values.runOutM);
    setFastMatch(preset.values.fastMatch);
    setMatchTolerance(preset.values.matchTolerance);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card className="overflow-hidden border-primary/25 bg-[linear-gradient(135deg,rgba(63,184,175,0.14),rgba(63,184,175,0.02)_46%,rgba(124,138,255,0.08))]">
        <CardContent className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Workflow briefing
              </Badge>
              {resultsStale && (
                <Badge variant="outline" className="border-warning/35 bg-warning/10 text-warning">
                  Rerun required
                </Badge>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Feathering 판단에 필요한 근거를 먼저 정렬합니다.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                현재 화면은 입력을 모으는 곳이 아니라, 어떤 헤더를 streamer front / tail로
                보고 어떤 방위각과 window로 결과를 해석할지 정하는 단계입니다. 아래
                블루프린트가 곧 차트와 report의 읽는 법이 됩니다.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-border/70 bg-background/45 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {step.label}
                    </span>
                    {step.ready ? (
                      <CheckCircle2 size={14} className="text-success" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/45" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.7)]">
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Recommended next step
            </div>
            <p className="mt-3 text-base font-medium leading-7 text-foreground">{nextAction}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setActivePanel("options")}>
                옵션 검토
              </Button>
              {runReady ? (
                <Button onClick={() => void analysis.runAnalysis()} disabled={isRunning}>
                  분석 실행
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => void handleEstimate()}
                  disabled={!trackPath || isRunning || estimating}
                >
                  {estimating ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                      추정 중
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} className="mr-1.5" />
                      방위각 추정
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-5">
          <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileSearch size={15} className="text-primary" />
                Source files
              </CardTitle>
              <CardDescription className="text-xs">
                NPD와 Track은 동일한 survey line을 설명해야 하며, 이후 모든 판단은 이 두
                파일의 시간 매칭에 기반합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropZone onFileDrop={handleFileDrop("npdPath")}>
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="npd" className="text-xs text-muted-foreground">
                      NPD file
                    </Label>
                    {npdPath && (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                        Connected
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="npd"
                      value={npdPath}
                      onChange={(event) => setField("npdPath", event.target.value)}
                      onBlur={() => {
                        if (npdPath) {
                          void analysis.scanHeaders(npdPath);
                        }
                      }}
                      placeholder="NPD 파일을 드래그하거나 선택하세요"
                      className="h-9 text-xs font-mono"
                    />
                    <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => void handleBrowse("npdPath")}>
                      <FolderOpen size={13} className="mr-1" />
                      선택
                    </Button>
                  </div>
                </div>
              </FileDropZone>

              <FileDropZone onFileDrop={handleFileDrop("trackPath")}>
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="track" className="text-xs text-muted-foreground">
                      Track file
                    </Label>
                    {trackPath && (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                        Connected
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="track"
                      value={trackPath}
                      onChange={(event) => setField("trackPath", event.target.value)}
                      placeholder="Track 파일을 드래그하거나 선택하세요"
                      className="h-9 text-xs font-mono"
                    />
                    <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => void handleBrowse("trackPath")}>
                      <FolderOpen size={13} className="mr-1" />
                      선택
                    </Button>
                  </div>
                </div>
              </FileDropZone>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                <Label htmlFor="lineName" className="text-xs text-muted-foreground">
                  Output line name
                </Label>
                <Input
                  id="lineName"
                  value={lineName}
                  onChange={(event) => setField("lineName", event.target.value)}
                  placeholder="비워두면 Track 파일명 기반으로 자동 설정됩니다"
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {npdHeaders.length > 0 && (
            <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <ArrowRightLeft size={15} className="text-primary" />
                      Header mapping
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Feathering은 Tail - Head 벡터를 기준으로 계산되므로, 이 선택이 곧
                      실제 판단 좌표계입니다.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                    {npdHeaders.length} headers
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label className="text-xs text-muted-foreground">Head position</Label>
                  <Select value={headPosition} onValueChange={(value) => value && setHeadPosition(value)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {npdHeaders.map((header) => (
                        <SelectItem key={header} value={header} className="text-xs">
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label className="text-xs text-muted-foreground">Tail position</Label>
                  <Select value={tailPosition} onValueChange={(value) => value && setTailPosition(value)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {npdHeaders.map((header) => (
                        <SelectItem key={header} value={header} className="text-xs">
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="transition-shadow hover:shadow-lg hover:shadow-primary/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Compass size={15} className="text-primary" />
                Analysis parameters
              </CardTitle>
              <CardDescription className="text-xs">
                이 값들은 결과를 예쁘게 꾸미는 옵션이 아니라, 어느 구간을 main line으로 보고
                어떤 편차를 문제로 볼지 결정하는 판단 기준입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label htmlFor="azimuth" className="text-xs text-muted-foreground">
                    Planned Azimuth (°)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="azimuth"
                      type="number"
                      value={plannedAzimuth}
                      onChange={(event) => setField("plannedAzimuth", event.target.value)}
                      placeholder="0 ~ 360"
                      className="h-9 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 px-3"
                      onClick={() => void handleEstimate()}
                      disabled={!trackPath || isRunning || estimating}
                      title="Track 데이터에서 방위각을 자동 추정"
                    >
                      {estimating ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Wand2 size={13} />
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    케이블 벡터와 비교할 기준 방향입니다. 수동 입력도 가능하지만, Track 기반
                    자동 추정치를 먼저 참고하면 해석이 더 빨라집니다.
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label htmlFor="limit" className="text-xs text-muted-foreground">
                    Feathering limit (°)
                  </Label>
                  <Input
                    id="limit"
                    type="number"
                    value={featheringLimit}
                    onChange={(event) => setField("featheringLimit", event.target.value)}
                    placeholder="0 = pass/fail without limit"
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    0이면 분포 해석용 리뷰 모드가 되고, 0보다 크면 ±limit 기준으로
                    exceedance와 verdict가 계산됩니다.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label htmlFor="runIn" className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ruler size={11} />
                    Run-in (m)
                  </Label>
                  <Input
                    id="runIn"
                    type="number"
                    value={runInM}
                    onChange={(event) => setField("runInM", event.target.value)}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    시작부 곡선 구간을 제외하고 main line 통계를 만들 때 사용됩니다.
                  </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/40 p-3">
                  <Label htmlFor="runOut" className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ruler size={11} />
                    Run-out (m)
                  </Label>
                  <Input
                    id="runOut"
                    type="number"
                    value={runOutM}
                    onChange={(event) => setField("runOutM", event.target.value)}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    종료부 진입 / 이탈 구간을 제외하고 main line verdict를 계산할 때 사용됩니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-5 self-start">
          <Card className="border-primary/20 bg-card/85">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Route size={15} className="text-primary" />
                Analysis blueprint
              </CardTitle>
              <CardDescription className="text-xs">
                지금 설정한 값이 결과를 어떻게 읽게 만드는지 요약합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resultsStale && (
                <div className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm leading-6 text-warning">
                  입력이 바뀌어 현재 결과가 오래되었습니다. 숫자, 차트, report를 다시 맞추려면
                  rerun이 필요합니다.
                </div>
              )}

              <div className="space-y-3">
                {[
                  ["NPD source", formatPathLabel(npdPath, "Not selected")],
                  ["Track source", formatPathLabel(trackPath, "Not selected")],
                  ["Header pair", npdHeaders.length > 0 ? `${headPosition} → ${tailPosition}` : "Waiting for scan"],
                  [
                    "Direction basis",
                    azimuthEstimate != null
                      ? `${azimuthEstimate.method === "cable_vector" ? "Cable vector" : "Track reverse"} · ${azimuthEstimate.confidence}`
                      : plannedAzimuth
                        ? "Manual azimuth"
                        : "Not decided",
                  ],
                  [
                    "Matching mode",
                    fastMatch
                      ? `Fast match${matchTolerance ? ` · ±${matchTolerance}s` : ""}`
                      : "Precise nearest match",
                  ],
                  [
                    "Main-line window",
                    `Run-in ${formatMeters(runInM)} / Run-out ${formatMeters(runOutM)}`,
                  ],
                  [
                    "Limit rule",
                    Number(featheringLimit || 0) > 0
                      ? `Flag over ±${Number(featheringLimit).toLocaleString()}°`
                      : "Distribution review only",
                  ],
                  ["Output folder", outputDir || "Track folder fallback"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </span>
                    <span className="max-w-[58%] text-right text-sm leading-5 text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/35 p-3 text-[12px] leading-6 text-muted-foreground">
                출력 폴더는 기존 데이터를 삭제하지 않습니다. rerun 시 새로운 결과를 같은 폴더에
                덮어쓰거나 추가 생성하므로, 비교가 필요하면 line name이나 output folder를 구분하세요.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium">Quick presets</CardTitle>
              <CardDescription className="text-xs">
                팀에서 자주 쓰는 판단 프레임을 바로 적용합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="w-full rounded-2xl border border-border/70 bg-background/35 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{preset.label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {preset.description}
                      </div>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {azimuthEstimate && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium">Azimuth evidence</CardTitle>
                <CardDescription className="text-xs">
                  자동 추정 결과가 현재 입력값과 어떻게 연결되는지 보여줍니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    {azimuthEstimate.method === "cable_vector" ? "Cable vector" : "Track reverse"}
                  </Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/40 text-foreground">
                    Confidence {azimuthEstimate.confidence}
                  </Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/40 text-foreground">
                    Spread {azimuthEstimate.spread.toFixed(1)}°
                  </Badge>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Recommended azimuth</span>
                    <span className="text-lg font-semibold text-foreground">
                      {recommendedAzimuth?.toFixed(1)}°
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    {azimuthEstimate.note ||
                      "Track 기반 추정은 선박 진행 방향과 케이블 방향을 함께 고려합니다."}
                  </p>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Current input
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {plannedAzimuth ? `${Number(plannedAzimuth).toFixed(1)}°` : "Not set"}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      {azimuthMatchesEstimate
                        ? "현재 입력은 자동 추정 추천값과 일치합니다."
                        : "현재 입력값이 자동 추정 추천값과 다릅니다. 의도적 조정인지 확인하세요."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/35 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Ship heading
                    </div>
                    <div className="mt-2 text-lg font-semibold text-foreground">
                      {azimuthEstimate.ship_heading != null
                        ? `${azimuthEstimate.ship_heading.toFixed(1)}°`
                        : "N/A"}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      {azimuthEstimate.ship_heading_reverse != null
                        ? `Reverse ${azimuthEstimate.ship_heading_reverse.toFixed(1)}°`
                        : "Track-only estimate without vessel heading detail."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
