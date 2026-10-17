import { useState } from "react";
import { Button, Note } from "@/components/bits";
import { blockUser, reportItem } from "@/lib/meeqo/api";
import { errText, REPORT_REASONS } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

/** Melden und Blockieren an einer Stelle. `personId` schaltet Blockieren frei. */
export function SafetyMenu({
  kind,
  targetId,
  personId,
  personName,
  onBlocked,
}: {
  kind: "person" | "activity" | "ad" | "message";
  targetId: string;
  personId?: string;
  personName?: string;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [info, setInfo] = useState("");
  const [fail, setFail] = useState("");

  async function send() {
    setFail("");
    try {
      await reportItem({ data: { kind, targetId, reason, note } });
      setInfo(t("Danke. Wir sehen uns das an."));
      setOpen(false);
    } catch (err) {
      setFail(errText(err));
    }
  }

  async function block() {
    if (!personId) return;
    setFail("");
    try {
      await blockUser({ data: { userId: personId } });
      setInfo(t("{0} ist blockiert.", personName || t("Die Person")));
      setOpen(false);
      onBlocked?.();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink">{t("Melden{0}", personId ? t(" oder blockieren") : "")}
      </button>
      {open ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm font-semibold">{t("Was stimmt nicht?")}</p>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((item) => (
              <button key={item} type="button" onClick={() => setReason(item)} className={`inline-flex h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${reason === item ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{t(item)}</button>
            ))}
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={400} placeholder={t("Optional: was ist passiert?")} className="min-h-20 w-full rounded-2xl border border-line bg-sand px-4 py-3 text-base outline-none focus:border-accent" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" onClick={send}>{t("Melden")}</Button>
            {personId ? <Button type="button" tone="ink" className="h-11" onClick={block}>{personName ? t("{0} blockieren", personName) : t("Blockieren")}</Button> : null}
          </div>
        </div>
      ) : null}
      {fail ? <Note>{fail}</Note> : null}
      {info ? <p className="text-sm text-friend">{info}</p> : null}
    </div>
  );
}
