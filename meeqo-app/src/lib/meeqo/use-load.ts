import { useEffect, useRef, useState } from "react";
import { errText } from "@/lib/meeqo/labels";

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const quiet = useRef(false);

  useEffect(() => {
    let live = true;
    if (!quiet.current) setLoading(true);
    quiet.current = false;
    loader()
      .then((value) => {
        if (!live) return;
        setData(value);
        setError("");
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setError(errText(error));
        setLoading(false);
      });
    return () => {
      live = false;
    };
    // loader identity changes every render; callers pass the real inputs via deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return {
    data,
    error,
    loading,
    reload: () => setTick((value) => value + 1),
    /** Reload without the loading state, so open screens do not flash. */
    refresh: () => {
      quiet.current = true;
      setTick((value) => value + 1);
    },
  };
}

/** Calls `tick` every few seconds while the page is visible, and once when it becomes visible again. */
export function usePolling(tick: () => void, seconds = 4) {
  useEffect(() => {
    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") tick();
    };
    const timer = window.setInterval(run, seconds * 1000);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
    // tick is a fresh closure every render; the interval only needs to exist once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);
}
