import { useAppStore } from "@/stores/appStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ScrollText, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

const levelColors: Record<string, string> = {
  info: "text-chart-1",
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
};

export function LogPanel() {
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ScrollText size={15} className="text-primary" />
          실행 로그
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={clearLogs}
          disabled={logs.length === 0}
        >
          <Trash2 size={12} className="mr-1" />
          지우기
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[calc(100vh-260px)] px-4 pb-4">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              분석을 실행하면 로그가 여기에 표시됩니다
            </p>
          ) : (
            <div className="space-y-0.5 font-mono text-xs">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-2 leading-relaxed">
                  <span className="shrink-0 text-muted-foreground/60">
                    [{log.timestamp}]
                  </span>
                  <span className={cn(levelColors[log.level] || "text-foreground")}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
