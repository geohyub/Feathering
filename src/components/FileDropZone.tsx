import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface FileDropZoneProps {
  onFileDrop: (path: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Tauri v2 네이티브 드래그앤드롭 래퍼.
 * Windows에서 HTML5 drag-drop은 기본 비활성화이므로
 * getCurrentWebview().onDragDropEvent()를 사용합니다.
 */
export function FileDropZone({
  onFileDrop,
  children,
  className,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const webview = getCurrentWebview();
      const unlisten = await webview.onDragDropEvent((event) => {
        if (cancelled) return;

        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragging(true);
        } else if (event.payload.type === "drop") {
          setIsDragging(false);
          const paths = event.payload.paths;
          if (paths.length > 0) {
            onFileDrop(paths[0]);
          }
        } else if (event.payload.type === "leave") {
          setIsDragging(false);
        }
      });

      return unlisten;
    };

    const promise = setup();

    return () => {
      cancelled = true;
      promise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [onFileDrop]);

  return (
    <div className={cn("relative transition-all duration-200", className)}>
      {children}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5">
            <Upload size={20} className="text-primary animate-bounce" />
            <span className="text-xs font-medium text-primary">
              {t("drop.hint")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
