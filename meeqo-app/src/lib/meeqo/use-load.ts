import { useEffect, useRef, useState } from "react";
import { waitChat } from "@/lib/meeqo/api";
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

/**
 * Live updates for an open chat. The request waits on the server and returns at once when something
 * changed, then the screen refreshes. Paused while the tab is hidden, retried quietly after errors.
 */
export function useLiveChat(id: string, kind: "activity" | "ad", refresh: () => void) {
  useEffect(() => {
    let stop = false;
    let version = "";
    const visible = () => document.visibilityState === "visible";
    const whenVisible = () =>
      new Promise<void>((resolve) => {
        const onChange = () => {
          if (visible()) {
            document.removeEventListener("visibilitychange", onChange);
            resolve();
          }
        };
        document.addEventListener("visibilitychange", onChange);
      });
    (async () => {
      while (!stop) {
        if (!visible()) {
          await whenVisible();
          version = "";
          continue;
        }
        try {
          const result = await waitChat({ data: { id, kind, version } });
          if (stop) break;
          if (version !== "" && result.changed) refresh();
          version = result.version;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    })();
    return () => {
      stop = true;
    };
    // refresh is a fresh closure each render; the loop only restarts for another chat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);
}
