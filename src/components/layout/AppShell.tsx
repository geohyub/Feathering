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
import { useEffect } from "react";

function ActivePanel() {
  const activePanel = useAppStore((s) => s.activePanel);
  const analysis = useAnalysis();

  switch (activePanel) {
    case "input":
      return <InputPanel analysis={analysis} />;
    case "options":
      return <OptionsPanel analysis={analysis} />;
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [analysis, isRunning, saveSettings]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-4">
          <ActivePanel />
        </main>
        <BottomBar onRun={analysis.runAnalysis} onOpenOutput={analysis.openOutputDir} />
      </div>
    </div>
  );
}
