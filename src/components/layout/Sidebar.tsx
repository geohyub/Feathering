import {
  BarChart3,
  FileInput,
  FolderOpen,
  HelpCircle,
  ScrollText,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { PanelId } from "@/types";

interface NavItem {
  id: PanelId;
  step: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: "input",
    step: "01",
    label: "Input setup",
    hint: "Files, headers, planned azimuth",
    icon: <FileInput size={16} />,
  },
  {
    id: "options",
    step: "02",
    label: "Analysis options",
    hint: "Matching and output policy",
    icon: <Settings size={16} />,
  },
  {
    id: "workspace",
    step: "03",
    label: "Batch / compare",
    hint: "Folder scan and scenario review",
    icon: <FolderOpen size={16} />,
  },
  {
    id: "log",
    step: "04",
    label: "Run log",
    hint: "Progress and backend messages",
    icon: <ScrollText size={16} />,
  },
  {
    id: "results",
    step: "05",
    label: "Results story",
    hint: "Verdict, charts, output package",
    icon: <BarChart3 size={16} />,
  },
  {
    id: "help",
    step: "06",
    label: "Help",
    hint: "Examples and workflow notes",
    icon: <HelpCircle size={16} />,
  },
];

export function Sidebar() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  return (
    <aside className="flex h-full w-[250px] shrink-0 flex-col border-r border-border/80 bg-sidebar/95 backdrop-blur-sm">
      <div className="px-5 py-6">
        <div className="text-[11px] uppercase tracking-[0.28em] text-primary/80">
          Processing
        </div>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          Feathering Analysis
        </h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Marine streamer feathering workflow with live analysis story, batch review,
          and scenario comparison.
        </p>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
        {navItems.map((item) => {
          const isActive = activePanel === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition-all",
                isActive
                  ? "border-primary/30 bg-sidebar-accent text-foreground shadow-[0_18px_40px_-28px_rgba(63,184,175,0.55)]"
                  : "border-transparent bg-transparent text-sidebar-foreground hover:border-border/70 hover:bg-sidebar-accent/70 hover:text-foreground"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 bg-background/40 text-muted-foreground"
                  )}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
                      {item.step}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {item.hint}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/80 px-5 py-4">
        <div className="space-y-2 rounded-2xl border border-border/70 bg-background/30 p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Shortcuts
          </div>
          {[
            ["Ctrl+R", "Run analysis"],
            ["Ctrl+O", "Open NPD"],
            ["Ctrl+B", "Open workspace"],
            ["Ctrl+S", "Save settings"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-xs">
              <kbd className="rounded-md border border-border/70 bg-card px-2 py-1 font-mono text-[10px] text-foreground">
                {key}
              </kbd>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
