import { useSyncExternalStore } from "react";
import { t, getLocale, toggleLocale, subscribe, type Locale, type TransKey } from "@/lib/i18n";

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return { locale, t: (key: TransKey) => t(key), toggleLocale };
}

export type { Locale, TransKey };
