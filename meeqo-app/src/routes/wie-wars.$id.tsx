import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Note, Skeleton } from "@/components/bits";
import { Shell } from "@/components/shell";
import { Album, Thanks } from "@/components/recap";
import { getAfterMeet, saveAfterMeet } from "@/lib/meeqo/round3";
import { errText } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/wie-wars/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <AfterMeet id={id} />
    </Shell>
  );
}

function YesNo({ question, value, onChange, yes, no }: { question: string; value: boolean | null; onChange: (next: boolean) => void; yes: string; no: string }) {
  const chip = (on: boolean) => `inline-flex h-12 flex-1 items-center justify-center rounded-control border-2 px-3 text-sm font-semibold ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
  return (
    <fieldset className="card space-y-2 p-4">
      <legend className="sr-only">{question}</legend>
      <p className="text-base font-semibold text-ink" aria-hidden="true">{question}</p>
      <div className="flex gap-2">
        <button type="button" aria-pressed={value === true} className={chip(value === true)} onClick={() => onChange(true)}>{yes}</button>
        <button type="button" aria-pressed={value === false} className={chip(value === false)} onClick={() => onChange(false)}>{no}</button>
      </div>
    </fieldset>
  );
}

function AfterMeet({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad(() => getAfterMeet({ data: { id } }), [id]);
  const [wasThere, setWasThere] = useState<boolean | null>(null);
  const [wasNice, setWasNice] = useState<boolean | null>(null);
  const [hostThere, setHostThere] = useState<boolean | null>(null);
  const [again, setAgain] = useState<boolean | null>(null);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!data?.mine) return;
    setWasThere(data.mine.wasThere);
    setWasNice(data.mine.wasNice);
    setHostThere(data.mine.hostThere);
    setAgain(data.mine.againGroup);
    setKeep(data.mine.keepGroup);
  }, [data?.mine]);

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;
  if (!data.started) return <Note>{t("Das geht erst, wenn das Treffen angefangen hat.")}</Note>;

  async function save() {
    if (wasThere === null) return setFail(t("Sag zuerst, ob du da warst."));
    setBusy(true);
    setFail("");
    try {
      await saveAfterMeet({ data: { id, wasThere, wasNice: wasThere ? wasNice : null, againGroup: wasThere ? again : null, keepGroup: wasThere && keep, hostThere: data?.isHost ? null : hostThere } });
      buzz(20);
      setSaved(true);
      setEditing(false);
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if ((saved || data.mine) && !editing) {
    const went = saved ? wasThere : data.mine?.wasThere;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Dein Abend")}</p>
          <h1 className="font-display text-4xl leading-none">{data.title}</h1>
          <p className="mt-2 text-sm text-muted">{t("Deine Antworten sieht niemand einzeln. Es gibt keine Sterne.")}</p>
        </div>
        {went ? <Album id={id} /> : null}
        {went ? <Thanks id={id} /> : null}
        {went ? (
          <Link to="/create" search={{ community: "", from: id }} className="inline-flex h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill">{t("Nochmal treffen")}</Link>
        ) : null}
        {data.groupId ? (
          <Link to="/communities/$id" params={{ id: data.groupId }} className="card block p-4 font-semibold">{t("Eure private Gruppe öffnen")}</Link>
        ) : keep && wasThere ? (
          <Note>{t("Die Gruppe entsteht, sobald noch jemand „Gruppe behalten“ wählt.")}</Note>
        ) : null}
        {data.checkedIn ? <Link to="/rating/$id" params={{ id }} className="card block p-4 text-sm font-semibold">{t("Einzelne Person wiedersehen? Das bleibt unsichtbar, bis es gegenseitig ist.")}</Link> : null}
        <div className="flex flex-wrap gap-2">
          <Link to="/activity/$id" params={{ id }} className="inline-flex h-12 items-center rounded-control border border-line bg-card px-5 text-sm font-semibold">{t("Zurück zum Treffen")}</Link>
          <button type="button" onClick={() => { setSaved(false); setEditing(true); }} className="inline-flex h-12 items-center rounded-control px-3 text-sm font-semibold text-muted underline">{t("Antworten ändern")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-display text-4xl leading-none">{t("Wie war's?")}</h1>
        <p className="mt-2 text-sm text-muted">{data.title}</p>
      </div>
      <YesNo question={t("Warst du da?")} value={wasThere} onChange={setWasThere} yes={t("Ja, war da")} no={t("Hat nicht geklappt")} />
      {wasThere ? (
        <>
          <YesNo question={t("War's nett?")} value={wasNice} onChange={setWasNice} yes={t("Ja, war nett")} no={t("Ging so")} />
          {data.isHost ? null : <YesNo question={t("War die einladende Person da?")} value={hostThere} onChange={setHostThere} yes={t("Ja")} no={t("Nein")} />}
          <YesNo question={t("Nochmal mit denselben Leuten?")} value={again} onChange={setAgain} yes={t("Gern")} no={t("Eher nicht")} />
          <label className="card flex items-start gap-3 p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-accent)]" checked={keep} onChange={(event) => setKeep(event.target.checked)} />
            <span>
              <span className="block text-base font-semibold text-ink">{t("Gruppe behalten")}</span>
              <span className="block text-sm text-muted">{t("Eine private Gruppe, nur mit allen, die das auch wählen. Ab zwei Personen. Bisher: {0}.", data.keepCount)}</span>
            </span>
          </label>
        </>
      ) : null}
      {fail ? <Note>{fail}</Note> : null}
      <Button type="button" className="w-full" disabled={busy || wasThere === null} onClick={() => void save()}>{busy ? t("Speichern…") : t("Abschicken")}</Button>
    </div>
  );
}
