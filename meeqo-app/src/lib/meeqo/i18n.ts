import { useSyncExternalStore } from "react";
import { EN } from "@/lib/meeqo/en";

export type Lang = "de" | "en";

const STORAGE = "meeqo-lang";
let current: Lang = "de";
const listeners = new Set<() => void>();

/** Texts that were asked for in English but have no translation yet. Read in tests via window.__i18nMissing. */
const missing = new Set<string>();

/**
 * The German text is the key. German is always what the server renders and what the first client render shows,
 * so there is no hydration mismatch; an English reader is switched over right after the page has loaded.
 */
export function t(key: string, ...args: (string | number | null | undefined)[]) {
  let text = key;
  if (current === "en") {
    const hit = EN[key];
    if (hit === undefined) {
      if (typeof window !== "undefined" && /[A-Za-zÄÖÜäöüß]{2,}/.test(key)) {
        missing.add(key);
        (window as unknown as { __i18nMissing?: string[] }).__i18nMissing = [...missing];
      }
    } else text = hit;
  }
  return args.length ? text.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index)] ?? "")) : text;
}

export function getLang(): Lang {
  return current;
}

/** "de-DE" or "en-GB" for Intl. */
export function locale() {
  return current === "en" ? "en-GB" : "de-DE";
}

export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE, next);
  } catch {
    /* the choice just does not persist */
  }
  if (typeof document !== "undefined") document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}

/** Called once after the first client render: the saved choice, else the browser language. */
export function initLang() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE);
  } catch {
    stored = null;
  }
  const detected: Lang = stored === "de" || stored === "en" ? stored : navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
  setLang(detected);
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => "de",
  );
}
