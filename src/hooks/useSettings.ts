import { useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";
import type { Settings } from "@/types";

const SETTINGS_FILE = ".npd_feathering_gui.json";

export function useSettings() {
  const loadSettings = useAppStore((s) => s.loadSettings);
  const exportSettings = useAppStore((s) => s.exportSettings);

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const home = await homeDir();
        const path = await join(home, SETTINGS_FILE);
        const content = await readTextFile(path);
        const settings: Settings = JSON.parse(content);
        loadSettings(settings);
      } catch {
        // No settings file yet — first launch
      }
    })();
  }, [loadSettings]);

  // Save settings
  const saveSettings = useCallback(async () => {
    try {
      const settings = exportSettings();
      const home = await homeDir();
      const path = await join(home, SETTINGS_FILE);
      await writeTextFile(path, JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }, [exportSettings]);

  return { saveSettings };
}
