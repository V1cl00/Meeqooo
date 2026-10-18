import { useEffect, useState } from "react";
import { hostReliability } from "@/lib/meeqo/round3";
import { t } from "@/lib/meeqo/i18n";

/** Discreet, from guests who were there. Reliability only after 3 meetups with answers; no stars, no ranking. */
export function HostTrust({ hostId }: { hostId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof hostReliability>> | null>(null);
  useEffect(() => {
    let live = true;
    hostReliability({ data: { hostId } }).then((next) => live && setData(next)).catch(() => {});
    return () => { live = false; };
  }, [hostId]);
  if (!data || (!data.reliability && !data.nice)) return null;
  const parts: string[] = [];
  if (data.reliability) parts.push(t("laut Gästen bei {0} von {1} Treffen da", data.reliability.meetups - data.reliability.missed, data.reliability.meetups));
  if (data.nice) parts.push(data.nice === 1 ? t("1× „war nett“") : t("{0}× „war nett“", data.nice));
  return <p className="mt-3 text-xs text-muted">{parts.join(" · ")}</p>;
}
