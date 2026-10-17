import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityCard, Empty } from "@/components/bits";
import { Shell } from "@/components/shell";
import { WhenBar } from "@/components/when-bar";
import { getFeed } from "@/lib/meeqo/api";
import { berlinDay } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/calendar")({ component: Page });

function Page() {
  return (
    <Shell>
      <Calendar />
    </Shell>
  );
}

function Calendar() {
  const [days, setDays] = useState<string[]>(() => [berlinDay()]);
  const { data, loading } = useLoad(() => getFeed({ data: { days } }), [days.join(",")]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">{t("Wann?")}</h1>
        <p className="mt-2 text-sm text-muted">{t("Heute ist ausgewählt. Tippe weitere Tage an, oder öffne den Kalender für die nächsten zwei Monate.")}</p>
      </div>
      <WhenBar days={days} onChange={setDays} />
      {loading ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.items.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>
      {!loading && data && data.items.length === 0 ? (
        <Empty art="calendar" title={t("An diesen Tagen ist nichts")} body={t("Wähl einen anderen Tag oder schau eine Woche weiter im Kalender.")} action={<Link to="/" className="inline-flex h-11 items-center rounded-full border-2 border-accent bg-card px-4 text-sm font-semibold text-accent-deep">{t("Zum Entdecken")}</Link>} />
      ) : null}
    </div>
  );
}
