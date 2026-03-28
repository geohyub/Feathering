import { FolderOpen, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";

interface BottomBarProps {
  onRun: () => void;
  onOpenOutput: () => void;
}

export function BottomBar({ onRun, onOpenOutput }: BottomBarProps) {
  const isRunning = useAppStore((s) => s.isRunning);
  const outputDir = useAppStore((s) => s.outputDir);
  const resultsStale = useAppStore((s) => s.resultsStale);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/80 px-5 py-3 backdrop-blur-sm">
      <div className="text-sm text-muted-foreground">
        {resultsStale && !isRunning
          ? "입력이 변경되어 결과가 오래되었습니다. rerun으로 차트와 report를 다시 맞추세요."
          : "결과 package는 지정 폴더에 안전하게 남고, 기존 사용자 데이터는 삭제하지 않습니다."}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
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
          className="min-w-[136px] bg-primary text-primary-foreground hover:bg-primary/90"
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
    </div>
  );
}
