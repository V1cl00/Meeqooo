import { useEffect, useSyncExternalStore } from "react";

/** The five bottom-tab roots show the logo; every other page gets a back arrow. */
export const TAB_ROOTS = ["/", "/calendar", "/create", "/chat", "/profile"];

export function isTabRoot(path: string) {
  const clean = path.replace(/\/+$/, "") || "/";
  return TAB_ROOTS.includes(clean);
}

/** Where back goes when the page was opened directly (shared link, push, reload) and there is no in-app history. */
export function parentOf(path: string): string {
  const clean = path.replace(/\/+$/, "") || "/";
  const rules: Array<[RegExp, string]> = [
    [/^\/activity\//, "/"],
    [/^\/bearbeiten\//, "/my-activities"],
    [/^\/rating\//, "/calendar"],
    [/^\/chat\/./, "/chat"],
    [/^\/communities\/./, "/communities"],
    [/^\/communities$/, "/profile"],
    [/^\/profile\/./, "/"],
    [/^\/(settings|friends|my-activities|support|passwort)$/, "/profile"],
    [/^\/(requests|notifications|search)$/, "/"],
    [/^\/categories$/, "/create"],
    [/^\/organizer\/./, "/organizer"],
    [/^\/organizer$/, "/profile"],
    [/^\/admin/, "/profile"],
    [/^\/kalender\//, "/calendar"],
  ];
  for (const [pattern, target] of rules) if (pattern.test(clean)) return target;
  return "/";
}

/** True when the router has an earlier entry of this app in the tab's history. */
export function hasInAppHistory() {
  if (typeof window === "undefined") return false;
  const index = (window.history.state as { __TSR_index?: number } | null)?.__TSR_index;
  return typeof index === "number" && index > 0;
}

// A page can take over back for its own sub-steps (e.g. /create step 2 → step 1).
let override: (() => void) | null = null;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}

export function useBackOverride(handler: (() => void) | null) {
  useEffect(() => {
    override = handler;
    emit();
    return () => {
      if (override === handler) {
        override = null;
        emit();
      }
    };
  }, [handler]);
}

export function useHasBackOverride() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => override !== null,
    () => false,
  );
}

/** One back logic for the header arrow and the Android hardware button. Returns false when there is nowhere to go. */
export function goBack(navigate: (path: string) => void, path = typeof window === "undefined" ? "/" : window.location.pathname) {
  if (override) {
    override();
    return true;
  }
  if (hasInAppHistory()) {
    window.history.back();
    return true;
  }
  if (isTabRoot(path)) return false;
  navigate(parentOf(path));
  return true;
}
