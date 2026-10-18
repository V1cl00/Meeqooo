import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { adminSelfies, reviewSelfie } from "@/lib/meeqo/round3";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/admin/pruefung")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

function Page() {
  return (
    <Shell>
      <Queue />
    </Shell>
  );
}

function Queue() {
  const { data, error, loading, reload } = useLoad(() => adminSelfies(), []);
  const [fail, setFail] = useState("");

  async function decide(userId: string, ok: boolean) {
    setFail("");
    try {
      await reviewSelfie({ data: { userId, ok } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  if (error) return <Note>{error}</Note>;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">Selfie-Prüfung</h1>
        <p className="mt-2 text-sm text-muted">Vergleiche Selfie und Profilfoto mit eigenen Augen. Keine automatische Gesichtserkennung. Nach deiner Entscheidung wird das Selfie gelöscht; „Passt“ setzt „Verifiziert“.</p>
        <p className="mt-2 text-sm"><Link to="/admin/zahlen" className="underline">Zahlen</Link> · <Link to="/admin/meldungen" className="underline">Meldungen</Link> · <Link to="/admin/orte" className="underline">Orte</Link></p>
      </div>
      {fail ? <Note>{fail}</Note> : null}
      {loading && !data ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {data && !data.length ? <Empty title="Nichts offen" body="Keine Selfies zu prüfen." art="plant" /> : null}
      {(data ?? []).map((item) => (
        <div key={item.userId} className="card space-y-3 p-4">
          <p className="font-semibold">{item.name} <span className="text-sm font-normal text-muted">· {formatWhen(item.createdAt)}</span></p>
          <div className="grid grid-cols-2 gap-2">
            <figure className="space-y-1"><img src={item.avatarUrl} alt="Profilfoto" className="aspect-square w-full rounded-control object-cover" /><figcaption className="text-xs text-muted">Profilfoto</figcaption></figure>
            <figure className="space-y-1"><img src={item.selfie} alt="Selfie" className="aspect-square w-full rounded-control object-cover" /><figcaption className="text-xs text-muted">Selfie</figcaption></figure>
          </div>
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={() => void decide(item.userId, true)}>Passt</Button>
            <Button type="button" tone="ghost" className="flex-1" onClick={() => void decide(item.userId, false)}>Passt nicht</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
