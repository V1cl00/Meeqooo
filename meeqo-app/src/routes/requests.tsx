import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { listRequests, respondRequest } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/requests")({ component: Page });

function Page() {
  return (
    <Shell>
      <Requests />
    </Shell>
  );
}

function reliability(item: { past: number; came: number; withMe: number }) {
  if (item.past === 0) return "Noch kein Treffen über MeeQo.";
  return `Kam zu ${item.came} von ${item.past} Treffen${item.withMe ? ` · ${item.withMe}× bei dir` : ""}.`;
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
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl leading-none">Anfragen</h1>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("in")} className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${tab === "in" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>Eingehend</button>
        <button type="button" onClick={() => setTab("out")} className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${tab === "out" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>Ausgehend</button>
      </div>
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {error ? <Note>{error}</Note> : null}
      {fail ? <Note>{fail}</Note> : null}
      <div className="space-y-2">
        {rows.map((item) => (
          <div key={item.id} className="card space-y-2 p-4">
            <Link to="/activity/$id" params={{ id: item.activityId }} className="font-semibold">{item.activityTitle}</Link>
            {tab === "in" ? <p className="text-sm text-muted">{reliability(item)}</p> : null}
            {item.mood ? <span className="inline-flex rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">Erwartet: {item.mood}</span> : null}
            <p className="text-sm text-muted">{tab === "in" ? item.personName : `Bei ${item.personName}`} · {({ pending: "offen", accepted: "zugesagt", declined: "abgelehnt", waitlist: "Warteliste", removed: "entfernt", withdrawn: "abgesagt" } as Record<string, string>)[item.status] ?? item.status}</p>
            {tab === "in" && item.status === "pending" ? (
              <div className="flex gap-2">
                <Button type="button" className="h-11" onClick={() => answer(item.id, true)}>Annehmen</Button>
                <Button type="button" tone="ghost" className="h-11" onClick={() => answer(item.id, false)}>Ablehnen</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!loading && rows.length === 0 ? <Empty art="people" title={tab === "in" ? "Keine eingehenden Anfragen" : "Du hast noch niemanden angefragt"} body="Im Feed sind Aktivitäten, bei denen der Ersteller entscheidet." /> : null}
    </div>
  );
}
