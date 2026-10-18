import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listRequests, respondRequest } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";
import { buzz } from "@/lib/meeqo/feel";
import { chime } from "@/lib/meeqo/sound";

export const Route = createFileRoute("/requests")({ component: Page });

function Page() {
  return (
    <Shell>
      <Requests />
    </Shell>
  );
}

function reliability(item: { past: number; came: number; withMe: number }) {
  if (item.past === 0) return t("Noch kein Treffen über MeeQo.");
  return t("Kam zu {0} von {1} Treffen{2}.", item.came, item.past, item.withMe ? t(" · {0}× bei dir", item.withMe) : "");
}

function Requests() {
  const [tab, setTab] = useState<"in" | "out">("in");
  const { data, loading, error, reload } = useLoad(() => listRequests(), []);
  const [fail, setFail] = useState("");
  const rows = (data ?? []).filter((item) => item.direction === tab);

  async function answer(id: string, accept: boolean) {
    setFail("");
    try {
      await respondRequest({ data: { id, accept } });
      if (accept) { buzz(20); chime(); }
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Anfragen")}</h1>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("in")} className={`inline-flex h-10 items-center rounded-control border px-3.5 text-sm font-semibold ${tab === "in" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Eingehend")}</button>
        <button type="button" onClick={() => setTab("out")} className={`inline-flex h-10 items-center rounded-control border px-3.5 text-sm font-semibold ${tab === "out" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Ausgehend")}</button>
      </div>
      {loading ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      {error ? <Note>{error}</Note> : null}
      {fail ? <Note>{fail}</Note> : null}
      <div className="space-y-2">
        {rows.map((item) => (
          <div key={item.id} className="card space-y-2 p-4">
            <Link to="/activity/$id" params={{ id: item.activityId }} className="font-semibold">{item.activityTitle}</Link>
            {tab === "in" ? <p className="text-sm text-muted">{reliability(item)}</p> : null}
            {item.mood ? <span className="inline-flex rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{t("Erwartet: {0}", item.mood)}</span> : null}
            <p className="flex items-center gap-2 text-sm text-muted">
              {item.personAvatar ? <img src={item.personAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand-deep text-xs font-semibold text-ink">{item.personName.slice(0, 1)}</span>}
              <span>{tab === "in" ? item.personName : t("Bei {0}", item.personName)} · {({ pending: "offen", accepted: "zugesagt", declined: "abgelehnt", waitlist: "Warteliste", removed: "entfernt", withdrawn: "abgesagt" } as Record<string, string>)[item.status] ?? item.status}</span>
            </p>
            {tab === "in" && item.status === "pending" ? (
              <div className="flex gap-2">
                <Button type="button" className="h-11" onClick={() => answer(item.id, true)}>{t("Annehmen")}</Button>
                <Button type="button" tone="ghost" className="h-11" onClick={() => answer(item.id, false)}>{t("Ablehnen")}</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!loading && rows.length === 0 ? <Empty art="people" title={tab === "in" ? t("Keine eingehenden Anfragen") : t("Du hast noch niemanden angefragt")} body={t("Im Feed sind Aktivitäten, bei denen der Ersteller entscheidet.")} /> : null}
    </div>
  );
}
