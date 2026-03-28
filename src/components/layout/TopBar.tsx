import { useEffect, useState } from "react";
import { Activity, Clock, Route, ShieldAlert, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/stores/appStore";

function formatWindow(runInM: string, runOutM: string) {
  return `${Number(runInM || 0).toLocaleString()} m / ${Number(runOutM || 0).toLocaleString()} m`;
}

export function TopBar() {
  const status = useAppStore((s) => s.status);
  const isRunning = useAppStore((s) => s.isRunning);
  const startTime = useAppStore((s) => s.startTime);
  const progressPercent = useAppStore((s) => s.progressPercent);
  const featheringLimit = useAppStore((s) => s.featheringLimit);
  const fastMatch = useAppStore((s) => s.fastMatch);
  const matchTolerance = useAppStore((s) => s.matchTolerance);
  const runInM = useAppStore((s) => s.runInM);
  const runOutM = useAppStore((s) => s.runOutM);
  const resultsStale = useAppStore((s) => s.resultsStale);
  const scenarioCount = useAppStore((s) => s.analysisHistory.length);
  const batchJobCount = useAppStore((s) => s.workspaceJobs.length);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (!isRunning || !startTime) {
      setElapsed("00:00");
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const mm = String(Math.floor(diff / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      setElapsed(`${mm}:${ss}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const matchingLabel = fastMatch
    ? `Fast match${matchTolerance ? ` · ±${matchTolerance}s` : ""}`
    : "Precise nearest match";
  const limitLabel =
    Number(featheringLimit || 0) > 0
      ? `Limit ±${Number(featheringLimit).toLocaleString()}°`
      : "Limit off";

  return (
    <div className="border-b border-border/80 bg-background/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Live Workflow
            </Badge>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Activity
                size={15}
                className={isRunning ? "animate-pulse text-primary" : "text-muted-foreground"}
              />
              <span className="font-medium">{status}</span>
            </div>
            {isRunning && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                Running
              </Badge>
            )}
            {resultsStale && !isRunning && (
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                Rerun required
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-border/70 bg-card/70 text-foreground">
              <ShieldAlert size={12} />
              <span className="ml-1">{limitLabel}</span>
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-card/70 text-foreground">
              <Zap size={12} />
              <span className="ml-1">{matchingLabel}</span>
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-card/70 text-foreground">
              <Route size={12} />
              <span className="ml-1">Run-in/out {formatWindow(runInM, runOutM)}</span>
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-card/70 text-foreground">
              <span className="ml-1">Scenarios {scenarioCount}</span>
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-card/70 text-foreground">
              <span className="ml-1">Batch jobs {batchJobCount}</span>
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm">
          {isRunning && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Progress
              </div>
              <div className="font-semibold tabular-nums text-foreground">
                {progressPercent.toFixed(0)}%
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-muted-foreground">
            <Clock size={13} />
            <span className="font-mono text-xs">{elapsed}</span>
          </div>
        </div>
      </div>

      {(isRunning || resultsStale) && (
        <Progress
          value={isRunning ? progressPercent : 100}
          className={resultsStale && !isRunning ? "[&_[data-slot=progress-indicator]]:bg-warning" : ""}
        />
      )}
    </div>
  );
}
