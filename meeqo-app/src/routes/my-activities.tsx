import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { cancelActivity, getFeed } from "@/lib/meeqo/api";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/my-activities")({ component: Page });

function Page() {
  return (
    <Shell>
      <Mine />
    </Shell>
  );
}

function Mine() {
  const [tab, setTab] = useState<"host" | "join">("host");
  const { data, loading, error, reload } = useLoad(() => getFeed({ data: { mineOnly: true, includePast: true, radiusKm: 500 } }), []);
  const [fail, setFail] = useState("");
  const rows = (data?.items ?? []).filter((item) => (tab === "host" ? item.isHost : !item.isHost));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Meine Aktivitäten")}</h1>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("host")} className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${tab === "host" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Ich lade ein")}</button>
        <button type="button" onClick={() => setTab("join")} className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${tab === "join" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Ich komme")}</button>
      </div>
      {loading ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      {error ? <Note>{error}</Note> : null}
      {fail ? <Note>{fail}</Note> : null}
      {rows.map((item) => (
        <div key={item.id} className="card space-y-2 p-4">
          <Link to="/activity/$id" params={{ id: item.id }} className="font-semibold">{item.title}</Link>
          <p className="text-sm text-muted">{formatWhen(item.startsAt)} · {item.myStatus === "pending" ? t("Anfrage offen") : item.myStatus === "accepted" ? t("Zugesagt") : t("Deine Aktivität")}</p>
          {item.isHost && !item.cancelled ? (
            <Button
              type="button"
              tone="ghost"
              className="h-11"
              onClick={async () => {
                try {
                  await cancelActivity({ data: { id: item.id } });
                  reload();
                } catch (err) {
                  setFail(errText(err));
                }
              }}
            >{t("Absagen")}</Button>
          ) : null}
        </div>
      ))}
      {!loading && rows.length === 0 ? <Empty art="plant" title={t("Noch leer")} body={t("Leg eine Aktivität an oder frag im Feed an.")} /> : null}
    </div>
  );
}
