import { useEffect, useState } from "react";
import { hideActivity, hideRule, unhideActivity, unhideRule } from "@/lib/meeqo/api";
import { buzz } from "@/lib/meeqo/feel";
import { errText, splitCategory } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

export type HideTarget = { id: string; title: string; hostId: string; hostName: string; category: string };
type Done = { kind: "activity" | "user" | "category"; value: string; label: string };

const row = "flex w-full items-center justify-between gap-3 rounded-control border border-line bg-card px-4 py-3 text-left text-sm font-semibold active:bg-sand-deep disabled:opacity-50";

/** "Ausblenden" with a scope, then a toast to undo it. */
export function useHide(onChanged: () => void) {
  const [target, setTarget] = useState<HideTarget | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 7000);
    return () => window.clearTimeout(timer);
  }, [done]);

  async function choose(kind: Done["kind"]) {
    if (!target) return;
    setBusy(true);
    setFail("");
    try {
      const parent = splitCategory(target.category).parent;
      if (kind === "activity") await hideActivity({ data: { id: target.id } });
      if (kind === "user") await hideRule({ data: { kind: "user", value: target.hostId } });
      if (kind === "category") await hideRule({ data: { kind: "category", value: parent } });
      buzz(15);
      setDone({ kind, value: kind === "activity" ? target.id : kind === "user" ? target.hostId : parent, label: kind === "activity" ? target.title : kind === "user" ? target.hostName : t(parent) });
      setTarget(null);
      onChanged();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!done) return;
    const was = done;
    setDone(null);
    try {
      if (was.kind === "activity") await unhideActivity({ data: { id: was.value } });
      else await unhideRule({ data: { kind: was.kind, value: was.value } });
      onChanged();
    } catch (err) {
      setFail(errText(err));
    }
  }

  const parent = target ? splitCategory(target.category).parent : "";
  const ui = (
    <>
      {target ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" onClick={() => setTarget(null)} role="dialog" aria-modal="true" aria-label={t("Ausblenden")}>
          <div className="card w-full max-w-lg space-y-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-display text-2xl">{t("Was willst du nicht mehr sehen?")}</h2>
            <p className="text-sm text-muted">{t("Niemand erfährt davon. Du kannst es in den Einstellungen wieder zeigen.")}</p>
            <button type="button" className={row} disabled={busy} onClick={() => void choose("activity")}>
              <span>{t("Nur dieses Treffen")}<span className="block text-xs font-normal text-muted">{target.title}</span></span><span aria-hidden="true">›</span>
            </button>
            <button type="button" className={row} disabled={busy} onClick={() => void choose("user")}>
              <span>{t("Alles von {0}", target.hostName.split(" ")[0] || target.hostName)}</span><span aria-hidden="true">›</span>
            </button>
            <button type="button" className={row} disabled={busy} onClick={() => void choose("category")}>
              <span>{t("Alle Treffen der Art {0}", t(parent))}</span><span aria-hidden="true">›</span>
            </button>
            {fail ? <p className="text-sm font-semibold text-accent-deep">{fail}</p> : null}
            <button type="button" className="h-11 w-full text-sm font-semibold text-muted" onClick={() => setTarget(null)}>{t("Abbrechen")}</button>
          </div>
        </div>
      ) : null}
      {done ? (
        <div className="fixed inset-x-0 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:bottom-6" role="status">
          <div className="flex w-full max-w-lg items-center justify-between gap-3 rounded-control bg-ink px-4 py-3 text-sm text-onaccent shadow-lg">
            <span className="min-w-0 truncate">{done.kind === "activity" ? t("„{0}“ ist ausgeblendet.", done.label) : done.kind === "user" ? t("Alles von {0} ist ausgeblendet.", done.label) : t("{0} ist ausgeblendet.", done.label)}</span>
            <button type="button" className="shrink-0 font-semibold underline" onClick={() => void undo()}>{t("Rückgängig")}</button>
          </div>
        </div>
      ) : null}
    </>
  );
  return { ask: (item: HideTarget) => { setFail(""); setTarget(item); }, ui };
}
