import { useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Compass,
  FileSearch,
  FolderOpen,
  Loader2,
  Ruler,
  Wand2,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useLocale } from "@/hooks/useLocale";
import { FileDropZone } from "@/components/FileDropZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface InputPanelProps {
  analysis: {
    browseFile: (field: "npdPath" | "trackPath", title: string) => Promise<void>;
    scanHeaders: (path: string) => Promise<void>;
    estimateAzimuth: () => Promise<void>;
    runAnalysis: () => Promise<void>;
    validateTrackFile: (path: string) => Promise<boolean>;
  };
}

const presets = [
  { id: "strict", label: "Strict QC", desc: "±3° / precise / 200 m trim", values: { featheringLimit: "3", runInM: "200", runOutM: "200", fastMatch: false, matchTolerance: "" } },
  { id: "survey", label: "Survey Default", desc: "±5° / fast 2.5 s / 150 m trim", values: { featheringLimit: "5", runInM: "150", runOutM: "150", fastMatch: true, matchTolerance: "2.5" } },
  { id: "explore", label: "Explore", desc: "No limit / fast 5 s / full line", values: { featheringLimit: "0", runInM: "0", runOutM: "0", fastMatch: true, matchTolerance: "5" } },
] as const;

function formatPathLabel(path: string, empty: string) {
  if (!path) return empty;
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

export function InputPanel({ analysis }: InputPanelProps) {
  const { t } = useLocale();
  const {
    npdPath, trackPath, lineName, plannedAzimuth, featheringLimit,
    runInM, runOutM, npdHeaders, headPosition, tailPosition,
    trackFormatStatus, trackFormatMessage, trackFormatDetail,
    fastMatch, matchTolerance, outputDir, azimuthEstimate,
    isRunning,
    setField, setHeadPosition, setTailPosition, setFastMatch, setMatchTolerance,
  } = useAppStore();

  const [estimating, setEstimating] = useState(false);

  const recommendedAzimuth =
    azimuthEstimate == null ? null
    : azimuthEstimate.method === "track_heading" && azimuthEstimate.azimuth_reverse != null
      ? azimuthEstimate.azimuth_reverse : azimuthEstimate.azimuth;

  const azimuthMatchesEstimate =
    recommendedAzimuth != null && plannedAzimuth !== "" &&
    Math.abs(Number(plannedAzimuth) - recommendedAzimuth) < 0.05;

  const filesReady = Boolean(npdPath && trackPath);
  const headersReady = npdHeaders.length === 0 || (Boolean(headPosition) && Boolean(tailPosition) && headPosition !== tailPosition);
  const azimuthReady = Boolean(plannedAzimuth);
  const trackFormatReady = !trackPath || trackFormatStatus !== "unsupported";
  const runReady = filesReady && headersReady && azimuthReady && trackFormatReady;

  const handleEstimate = async () => {
    setEstimating(true);
    try { await analysis.estimateAzimuth(); }
    finally { setTimeout(() => setEstimating(false), 1500); }
  };

  const handleBrowse = async (field: "npdPath" | "trackPath") => {
    await analysis.browseFile(field, field === "npdPath" ? "NPD" : "Track");
  };

  const handleFileDrop = (field: "npdPath" | "trackPath") => (path: string) => {
    setField(field, path);
    if (field === "npdPath") void analysis.scanHeaders(path);
    else void analysis.validateTrackFile(path);
  };

  const applyPreset = (presetId: (typeof presets)[number]["id"]) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    setField("featheringLimit", p.values.featheringLimit);
    setField("runInM", p.values.runInM);
    setField("runOutM", p.values.runOutM);
    setFastMatch(p.values.fastMatch);
    setMatchTolerance(p.values.matchTolerance);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Source Files ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSearch size={15} className="text-primary" />
            {t("input.files")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FileDropZone onFileDrop={handleFileDrop("npdPath")}>
            <div className="space-y-1.5 rounded-xl border border-border/70 bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t("input.npd")}</Label>
                {npdPath && <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">{t("input.connected")}</Badge>}
              </div>
              <div className="flex gap-2">
                <Input value={npdPath} onChange={(e) => setField("npdPath", e.target.value)}
                  onBlur={() => { if (npdPath) void analysis.scanHeaders(npdPath); }}
                  placeholder={t("input.npd.placeholder")} className="h-8 text-xs font-mono" />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => void handleBrowse("npdPath")}>
                  <FolderOpen size={13} className="mr-1" /> {t("input.select")}
                </Button>
              </div>
            </div>
          </FileDropZone>

          <FileDropZone onFileDrop={handleFileDrop("trackPath")}>
            <div className="space-y-1.5 rounded-xl border border-border/70 bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t("input.track")}</Label>
                {trackPath && trackFormatStatus === "supported" && (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">{t("input.formatOk")}</Badge>
                )}
                {trackPath && trackFormatStatus === "unsupported" && (
                  <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">{t("input.formatBad")}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={trackPath} onChange={(e) => setField("trackPath", e.target.value)}
                  onBlur={() => { if (trackPath) void analysis.validateTrackFile(trackPath); }}
                  placeholder={t("input.track.placeholder")} className="h-8 text-xs font-mono" />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => void handleBrowse("trackPath")}>
                  <FolderOpen size={13} className="mr-1" /> {t("input.select")}
                </Button>
              </div>
              {trackPath && trackFormatMessage && (
                <p className={`text-[11px] leading-relaxed px-1 ${trackFormatStatus === "unsupported" ? "text-warning" : "text-muted-foreground"}`}>
                  {trackFormatMessage}{trackFormatDetail ? ` — ${trackFormatDetail}` : ""}
                </p>
              )}
            </div>
          </FileDropZone>

          <div className="space-y-1.5 rounded-xl border border-border/70 bg-background/40 p-3">
            <Label className="text-xs text-muted-foreground">{t("input.lineName")}</Label>
            <Input value={lineName} onChange={(e) => setField("lineName", e.target.value)}
              placeholder={t("input.lineName.placeholder")} className="h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* ── Header Mapping ── */}
          {npdHeaders.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ArrowRightLeft size={15} className="text-primary" />
                    {t("header.title")}
                  </CardTitle>
                  <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary text-[10px]">
                    {npdHeaders.length}{t("header.detected")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("header.head")}</Label>
                  <Select value={headPosition} onValueChange={(v) => v && setHeadPosition(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{npdHeaders.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("header.tail")}</Label>
                  <Select value={tailPosition} onValueChange={(v) => v && setTailPosition(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{npdHeaders.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Analysis Parameters ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Compass size={15} className="text-primary" />
                {t("param.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("param.azimuth")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={plannedAzimuth}
                      onChange={(e) => setField("plannedAzimuth", e.target.value)}
                      placeholder="0 ~ 360" className="h-8 text-xs" />
                    <Button variant="outline" size="sm" className="h-8 shrink-0 px-2.5"
                      onClick={() => void handleEstimate()}
                      disabled={!trackPath || isRunning || estimating}
                      title={t("btn.estimate")}>
                      {estimating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("param.limit")}</Label>
                  <Input type="number" value={featheringLimit}
                    onChange={(e) => setField("featheringLimit", e.target.value)}
                    placeholder={t("param.limit.placeholder")} className="h-8 text-xs" />
                </div>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ruler size={11} /> {t("param.runIn")}
                  </Label>
                  <Input type="number" value={runInM} onChange={(e) => setField("runInM", e.target.value)}
                    placeholder="0" className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ruler size={11} /> {t("param.runOut")}
                  </Label>
                  <Input type="number" value={runOutM} onChange={(e) => setField("runOutM", e.target.value)}
                    placeholder="0" className="h-8 text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-5 lg:sticky lg:top-4 self-start">
          {/* Readiness */}
          <Card className="border-primary/20 bg-card/85">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("status.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { label: t("status.files"), ok: filesReady, text: filesReady ? t("status.files.ok") : t("status.files.need") },
                { label: t("status.header"), ok: headersReady, text: npdHeaders.length > 0 ? `${headPosition} → ${tailPosition}` : t("status.header.wait") },
                { label: t("status.azimuth"), ok: azimuthReady, text: azimuthReady ? `${Number(plannedAzimuth).toFixed(1)}°` : t("status.azimuth.notset") },
                { label: t("status.ready"), ok: runReady, text: runReady ? t("status.ready.ok") : t("status.ready.need") },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {s.ok ? <CheckCircle2 size={13} className="text-success" /> : <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />}
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="text-foreground truncate max-w-[180px]">{s.text}</span>
                </div>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                {runReady ? (
                  <Button size="sm" className="w-full" onClick={() => void analysis.runAnalysis()} disabled={isRunning}>
                    {t("btn.run")}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full"
                    onClick={() => void handleEstimate()} disabled={!trackPath || isRunning || estimating}>
                    {estimating
                      ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> {t("btn.estimating")}</>
                      : <><Wand2 size={13} className="mr-1.5" /> {t("btn.estimate")}</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Presets */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">{t("preset.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {presets.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/10">
                  <div>
                    <div className="text-xs font-medium">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Blueprint */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">{t("blueprint.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {([
                [t("blueprint.npd"), formatPathLabel(npdPath, t("blueprint.notSelected"))],
                [t("blueprint.track"), formatPathLabel(trackPath, t("blueprint.notSelected"))],
                [t("blueprint.headers"), npdHeaders.length > 0 ? `${headPosition} → ${tailPosition}` : t("blueprint.waiting")],
                [t("blueprint.matching"), fastMatch ? `Fast${matchTolerance ? ` ±${matchTolerance}s` : ""}` : "Precise"],
                [t("blueprint.window"), `Run-in ${runInM || 0} m / Run-out ${runOutM || 0} m`],
                [t("blueprint.limit"), Number(featheringLimit || 0) > 0 ? `±${featheringLimit}°` : t("blueprint.none")],
                [t("blueprint.output"), outputDir || t("blueprint.trackFolder")],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
                  <span className="text-xs text-foreground text-right truncate max-w-[200px]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Azimuth evidence */}
          {azimuthEstimate && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{t("az.title")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
                    {azimuthEstimate.method === "cable_vector" ? "Cable vector" : "Track reverse"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{azimuthEstimate.confidence}</Badge>
                  <Badge variant="outline" className="text-[10px]">Spread {azimuthEstimate.spread.toFixed(1)}°</Badge>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("az.recommended")}</span>
                    <span className="text-lg font-semibold">{recommendedAzimuth?.toFixed(1)}°</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/60 bg-background/30 p-2.5">
                    <div className="text-[10px] text-muted-foreground">{t("az.current")}</div>
                    <div className="mt-1 font-semibold">{plannedAzimuth ? `${Number(plannedAzimuth).toFixed(1)}°` : "—"}</div>
                    {!azimuthMatchesEstimate && plannedAzimuth && <div className="mt-1 text-[10px] text-warning">{t("az.mismatch")}</div>}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/30 p-2.5">
                    <div className="text-[10px] text-muted-foreground">{t("az.ship")}</div>
                    <div className="mt-1 font-semibold">{azimuthEstimate.ship_heading != null ? `${azimuthEstimate.ship_heading.toFixed(1)}°` : "—"}</div>
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
