import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { handleReport, listReports } from "@/lib/meeqo/api";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/admin/meldungen")({ component: Page });

const KIND: Record<string, string> = { person: "Person", activity: "Treffen", ad: "Anzeige", message: "Nachricht" };
const DONE: Record<string, string> = { dismiss: "abgewiesen", remove: "Inhalt entfernt", suspend: "Konto gesperrt" };

function Page() {
  return (
    <Shell>
      <Reports />
    </Shell>
  );
}

function Reports() {
  const { data, error, loading, reload } = useLoad(() => listReports(), []);
  const [fail, setFail] = useState("");
  const [only, setOnly] = useState<"open" | "all">("open");
  const rows = (data ?? []).filter((item) => only === "all" || item.status === "open");

  async function act(id: string, action: "dismiss" | "remove" | "suspend" | "restore") {
    setFail("");
    try {
      await handleReport({ data: { id, action } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (error) return <Note>{error}</Note>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">Meldungen</h1>
        <p className="mt-2 text-sm text-muted">Wer meldet, bekommt nach der Bearbeitung eine Mitteilung. Entfernen und Sperren lassen sich nicht automatisch zurücknehmen, außer Entsperren.</p>
      </div>
      <div className="flex gap-2">
        {(["open", "all"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setOnly(item)} className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ${only === item ? "bg-ink text-onaccent" : "border border-line bg-card text-ink"}`}>
            {item === "open" ? "Offen" : "Alle"}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {fail ? <Note>{fail}</Note> : null}
      {rows.map((item) => (
        <article key={item.id} className="card space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-onaccent">{KIND[item.kind] ?? item.kind}</span>
            <span className="rounded-full bg-sand-deep px-2.5 py-1 text-xs font-semibold">{item.reason}</span>
            {item.sameTarget > 1 ? <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-onfill">{item.sameTarget} Meldungen</span> : null}
            {item.ownerSuspended ? <span className="rounded-full border border-ink px-2.5 py-1 text-xs font-semibold">gesperrt</span> : null}
          </div>
          <p className="font-semibold">
            {item.kind === "activity" ? (
              <Link to="/activity/$id" params={{ id: item.targetId }} className="underline">{item.targetLabel}</Link>
            ) : item.kind === "person" ? (
              <Link to="/profile/$id" params={{ id: item.targetId }} className="underline">{item.targetLabel}</Link>
            ) : (
              item.targetLabel
            )}
          </p>
          {item.ownerName && item.kind !== "person" ? <p className="text-sm text-muted">Von {item.ownerName}</p> : null}
          {item.note ? <p className="whitespace-pre-wrap rounded-2xl bg-sand-deep px-3 py-2 text-sm">{item.note}</p> : null}
          <p className="text-xs text-muted">Gemeldet von {item.reporterName} · {formatWhen(item.createdAt)}</p>
          {item.status === "open" ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" tone="ghost" className="h-11" onClick={() => act(item.id, "dismiss")}>Abweisen</Button>
              {item.kind === "activity" || item.kind === "ad" ? <Button type="button" className="h-11" onClick={() => act(item.id, "remove")}>Inhalt entfernen</Button> : null}
              {item.ownerId && !item.ownerSuspended ? <Button type="button" tone="ink" className="h-11" onClick={() => act(item.id, "suspend")}>Konto sperren</Button> : null}
              {item.ownerId && item.ownerSuspended ? <Button type="button" tone="ghost" className="h-11" onClick={() => act(item.id, "restore")}>Entsperren</Button> : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <p className="text-sm font-semibold text-friend">Erledigt: {DONE[item.action] ?? item.action}</p>
              {item.ownerId && item.ownerSuspended ? <Button type="button" tone="ghost" className="h-11" onClick={() => act(item.id, "restore")}>Entsperren</Button> : null}
            </div>
          )}
        </article>
      ))}
      {!loading && rows.length === 0 ? <Empty title="Nichts offen" body="Neue Meldungen erscheinen hier. Wer meldet, bleibt für die gemeldete Person unsichtbar." /> : null}
    </div>
  );
}
