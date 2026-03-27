import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Play, FolderOpen, Loader2 } from "lucide-react";

interface BottomBarProps {
  onRun: () => void;
  onOpenOutput: () => void;
}

export function BottomBar({ onRun, onOpenOutput }: BottomBarProps) {
  const isRunning = useAppStore((s) => s.isRunning);
  const outputDir = useAppStore((s) => s.outputDir);

  return (
    <div className="flex h-14 items-center justify-between border-t border-border px-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={onOpenOutput}
        disabled={!outputDir}
      >
        <FolderOpen size={14} className="mr-1.5" />
        출력 폴더 열기
      </Button>

      <Button
        size="sm"
        onClick={onRun}
        disabled={isRunning}
        className="min-w-[120px] bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isRunning ? (
          <>
            <Loader2 size={14} className="mr-1.5 animate-spin" />
            분석 중...
          </>
        ) : (
          <>
            <Play size={14} className="mr-1.5" />
            분석 실행
          </>
        )}
      </Button>
    </div>
  );
}
