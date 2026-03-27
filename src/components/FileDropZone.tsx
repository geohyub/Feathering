import { useState, useCallback, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFileDrop: (path: string) => void;
  children: ReactNode;
  accept?: string;
  className?: string;
}

export function FileDropZone({
  onFileDrop,
  children,
  className,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // In Tauri webview, dropped files expose their path
        const file = files[0];
        // dataTransfer.files[0].path works in Tauri
        const path = (file as unknown as { path?: string }).path || file.name;
        if (path) {
          onFileDrop(path);
        }
      }
    },
    [onFileDrop]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative transition-all duration-200", className)}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5">
            <Upload size={20} className="text-primary animate-bounce" />
            <span className="text-xs font-medium text-primary">
              파일을 여기에 놓으세요
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
