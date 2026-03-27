import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { PanelId } from "@/types";
import {
  FileInput,
  Settings,
  ScrollText,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  id: PanelId;
  label: string;
  number: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "input", label: "입력", number: "01", icon: <FileInput size={16} /> },
  { id: "options", label: "옵션", number: "02", icon: <Settings size={16} /> },
  { id: "log", label: "로그", number: "03", icon: <ScrollText size={16} /> },
  { id: "results", label: "결과", number: "04", icon: <BarChart3 size={16} /> },
  { id: "help", label: "도움말", number: "?", icon: <HelpCircle size={16} /> },
];

export function Sidebar() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex flex-col gap-0.5 px-4 py-5">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Feathering Analysis
        </h1>
        <span className="text-[11px] text-muted-foreground">v3.0</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              activePanel === item.id
                ? "bg-sidebar-accent text-primary font-medium"
                : "text-sidebar-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded text-[10px] font-mono font-bold",
                activePanel === item.id
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.number}
            </span>
            <span className={cn(
              activePanel === item.id ? "text-foreground" : ""
            )}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Shortcuts hint */}
      <div className="border-t border-border px-4 py-3">
        <div className="space-y-1">
          {[
            ["Ctrl+R", "분석 실행"],
            ["Ctrl+O", "NPD 열기"],
            ["Ctrl+S", "설정 저장"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {key}
              </kbd>
              <span className="text-[10px] text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
