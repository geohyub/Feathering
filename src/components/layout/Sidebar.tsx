import {
  BarChart3,
  FileInput,
  FolderOpen,
  Globe,
  HelpCircle,
  ScrollText,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useLocale } from "@/hooks/useLocale";
import type { PanelId } from "@/types";
import type { TransKey } from "@/lib/i18n";

interface NavItem {
  id: PanelId;
  step: string;
  labelKey: TransKey;
  hintKey: TransKey;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "input", step: "01", labelKey: "nav.input", hintKey: "nav.input.desc", icon: <FileInput size={16} /> },
  { id: "options", step: "02", labelKey: "nav.options", hintKey: "nav.options.desc", icon: <Settings size={16} /> },
  { id: "workspace", step: "03", labelKey: "nav.batch", hintKey: "nav.batch.desc", icon: <FolderOpen size={16} /> },
  { id: "log", step: "04", labelKey: "nav.log", hintKey: "nav.log.desc", icon: <ScrollText size={16} /> },
  { id: "results", step: "05", labelKey: "nav.results", hintKey: "nav.results.desc", icon: <BarChart3 size={16} /> },
  { id: "help", step: "06", labelKey: "nav.help", hintKey: "nav.help.desc", icon: <HelpCircle size={16} /> },
];

export function Sidebar() {
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  const { t, locale, toggleLocale } = useLocale();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border/80 bg-sidebar/95 backdrop-blur-sm">
      <div className="px-4 py-5">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Feathering Analysis
        </h1>
        <p className="mt-1 text-[11px] text-muted-foreground">v3.0</p>
      </div>

      <Separator />

      <nav className="flex flex-1 flex-col gap-1 px-2.5 py-3">
        {navItems.map((item) => {
          const isActive = activePanel === item.id;
          return (
            <button key={item.id} onClick={() => setActivePanel(item.id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                isActive
                  ? "border-primary/30 bg-sidebar-accent text-foreground"
                  : "border-transparent text-sidebar-foreground hover:border-border/70 hover:bg-sidebar-accent/70 hover:text-foreground"
              )}>
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs",
                  isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-background/40 text-muted-foreground"
                )}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium">{t(item.labelKey)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{t(item.hintKey)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/80 px-3 py-3 space-y-2">
        <div className="space-y-1.5 text-[11px]">
          {([["Ctrl+R", "shortcut.run"], ["Ctrl+O", "shortcut.openNpd"], ["Ctrl+S", "shortcut.save"]] as const).map(([key, tKey]) => (
            <div key={key} className="flex items-center justify-between">
              <kbd className="rounded border border-border/70 bg-card px-1.5 py-0.5 font-mono text-[10px]">{key}</kbd>
              <span className="text-muted-foreground">{t(tKey)}</span>
            </div>
          ))}
        </div>

        <button onClick={toggleLocale}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/30 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground">
          <Globe size={12} />
          {locale === "ko" ? "English" : "한국어"}
        </button>
      </div>
    </aside>
  );
}
