import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomBar } from "./BottomBar";
import { useAppStore } from "@/stores/appStore";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { InputPanel } from "@/components/panels/InputPanel";
import { OptionsPanel } from "@/components/panels/OptionsPanel";
import { LogPanel } from "@/components/panels/LogPanel";
import { ResultsPanel } from "@/components/panels/ResultsPanel";
import { HelpPanel } from "@/components/panels/HelpPanel";
import { WorkspacePanel } from "@/components/panels/WorkspacePanel";
import { useEffect } from "react";

type AnalysisController = ReturnType<typeof useAnalysis>;

function ActivePanel({ analysis }: { analysis: AnalysisController }) {
  const activePanel = useAppStore((s) => s.activePanel);

  switch (activePanel) {
    case "input":
      return <InputPanel analysis={analysis} />;
    case "options":
      return <OptionsPanel analysis={analysis} />;
    case "workspace":
      return <WorkspacePanel analysis={analysis} />;
    case "log":
      return <LogPanel />;
    case "results":
      return <ResultsPanel analysis={analysis} />;
    case "help":
      return <HelpPanel />;
  }
}

export function AppShell() {
  const analysis = useAnalysis();
  const { saveSettings } = useSettings();
  const isRunning = useAppStore((s) => s.isRunning);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        if (!isRunning) analysis.runAnalysis();
      }
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        analysis.browseFile("npdPath", "NPD 파일 선택");
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveSettings().then(() => toast.success("설정이 저장되었습니다."));
      }
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        useAppStore.getState().setActivePanel("workspace");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [analysis, isRunning, saveSettings]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(63,184,175,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(124,138,255,0.14),transparent_32%)]" />
        <TopBar />
        <main className="relative flex-1 overflow-auto px-5 py-5">
          <div className="mx-auto w-full max-w-[1500px]">
            <ActivePanel analysis={analysis} />
          </div>
        </main>
        <BottomBar onRun={analysis.runAnalysis} onOpenOutput={analysis.openOutputDir} />
      </div>
    </div>
  );
}
