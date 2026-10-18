import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera } from "lucide-react";
import { Button } from "@/components/bits";
import { mySelfie, submitSelfie, type SelfieStatus } from "@/lib/meeqo/round3";
import { compress } from "@/lib/meeqo/image";
import { errText } from "@/lib/meeqo/labels";
import { notice } from "@/lib/meeqo/feel";
import { t } from "@/lib/meeqo/i18n";

/** Selfie check: a person at MeeQo compares it with the profile photo. No face matching, and the selfie is deleted after the decision. */
export function SelfieCard({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, setState] = useState<SelfieStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void mySelfie().then(setState).catch(() => setState(null));
  }, []);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFail("");
    try {
      await submitSelfie({ data: { image: await compress(file, 640) } });
      setState((prev) => ({ verified: prev?.verified ?? false, status: "pending" }));
      notice(t("Selfie geschickt. Wir melden uns."));
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (!state) return null;
  if (state.verified) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-control bg-green/25 px-3 py-2 text-sm font-semibold text-ink">
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        {t("Verifiziert")}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-control border border-line bg-sand p-3">
      <p className="text-sm font-semibold text-ink">{t("Selfie-Prüfung")}</p>
      <p className="text-sm text-muted">{t("Ein Mensch bei MeeQo vergleicht dein Selfie mit deinem Profilfoto. Keine Gesichtserkennung. Das Selfie wird danach gelöscht.")}</p>
      {state.status === "pending" ? (
        <p className="text-sm font-semibold text-ink">{t("Wird geprüft. Meist innerhalb eines Tages.")}</p>
      ) : (
        <>
          {state.status === "declined" ? <p className="text-sm text-accent-deep">{t("Das letzte Selfie passte nicht. Nimm ein klares Foto von vorn.")}</p> : null}
          <Button type="button" tone="ghost" disabled={busy || !hasPhoto} className="w-full gap-2" onClick={() => input.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {busy ? t("Lädt hoch…") : t("Selfie aufnehmen")}
          </Button>
          {!hasPhoto ? <p className="text-xs text-muted">{t("Zuerst ein Profilfoto hochladen.")}</p> : null}
          <input ref={input} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-label={t("Selfie aufnehmen")} onChange={(event) => void send(event.target.files?.[0])} />
        </>
      )}
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}
