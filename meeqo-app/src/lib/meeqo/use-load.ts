import { useEffect, useState } from "react";
import { errText } from "@/lib/meeqo/labels";

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
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

  return { data, error, loading, reload: () => setTick((value) => value + 1) };
}
