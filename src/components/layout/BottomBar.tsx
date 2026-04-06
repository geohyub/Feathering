import { FolderOpen, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { useLocale } from "@/hooks/useLocale";

interface BottomBarProps {
  onRun: () => void;
  onOpenOutput: () => void;
}

export function BottomBar({ onRun, onOpenOutput }: BottomBarProps) {
  const { t } = useLocale();
  const isRunning = useAppStore((s) => s.isRunning);
  const outputDir = useAppStore((s) => s.outputDir);
  const resultFiles = useAppStore((s) => s.resultFiles);
  const canOpenOutput = Boolean(outputDir || resultFiles[0]?.path);

  return (
    <div className="flex items-center justify-end gap-2 border-t border-border/80 bg-background/80 px-5 py-2.5 backdrop-blur-sm">
      <Button variant="outline" size="sm" onClick={onOpenOutput} disabled={!canOpenOutput}>
        <FolderOpen size={14} className="mr-1.5" />
        {t("btn.openFolder")}
      </Button>
      <Button size="sm" onClick={onRun} disabled={isRunning} className="min-w-[120px]">
        {isRunning ? (
          <><Loader2 size={14} className="mr-1.5 animate-spin" /> {t("btn.running")}</>
        ) : (
          <><Play size={14} className="mr-1.5" /> {t("btn.run")}</>
        )}
      </Button>
    </div>
  );
}
