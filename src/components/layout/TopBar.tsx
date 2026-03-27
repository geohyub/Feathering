import { useAppStore } from "@/stores/appStore";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";

export function TopBar() {
  const status = useAppStore((s) => s.status);
  const isRunning = useAppStore((s) => s.isRunning);
  const startTime = useAppStore((s) => s.startTime);
  const progressPercent = useAppStore((s) => s.progressPercent);
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

  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Activity
            size={14}
            className={isRunning ? "animate-pulse text-primary" : "text-muted-foreground"}
          />
          <span className="text-sm text-muted-foreground">{status}</span>
          {isRunning && (
            <Badge variant="outline" className="border-primary/30 text-primary text-[11px] px-1.5 py-0">
              Running
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock size={12} />
          <span className="font-mono text-xs">{elapsed}</span>
        </div>
      </div>
      {isRunning && (
        <Progress
          value={progressPercent}
          className="h-0.5 rounded-none"
        />
      )}
    </div>
  );
}
