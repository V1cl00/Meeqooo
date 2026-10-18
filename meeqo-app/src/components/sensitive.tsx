import { useState, type ReactNode } from "react";
import { Button } from "@/components/bits";
import { useMe } from "@/components/shell";
import { giveSensitiveConsent } from "@/lib/meeqo/api";
import { hasSensitive } from "@/lib/meeqo/labels";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

/**
 * Traits that can reveal sexual orientation are only stored with explicit consent.
 * `guard(next, proceed)` runs `proceed` straight away when nothing sensitive is chosen or consent exists,
 * otherwise it shows `panel` and runs `proceed` after the person agrees.
 */
export function useSensitiveGate() {
  const { profile, reload } = useMe();
  const [waiting, setWaiting] = useState<(() => void) | null>(null);
  const [fail, setFail] = useState("");

  function guard(next: readonly string[], proceed: () => void) {
    if (!hasSensitive(next) || profile?.sensitiveConsent) proceed();
    else setWaiting(() => proceed);
  }

  async function agree() {
    setFail("");
    try {
      await giveSensitiveConsent();
      await reload();
      waiting?.();
      setWaiting(null);
    } catch (err) {
      setFail(errText(err));
    }
  }

  const panel: ReactNode = waiting ? (
    <div role="alertdialog" aria-labelledby="sensitive-title" className="card space-y-3 border-2 !border-accent p-4">
      <h2 id="sensitive-title" className="font-display text-xl">{t("Besonders geschützte Angabe")}</h2>
      <p className="text-sm">{t("„Queer“ und „Queerfreundlich“ können etwas über deine sexuelle Orientierung verraten. Das sind besonders geschützte Daten (Art. 9 DSGVO). Wir speichern sie nur, wenn du ausdrücklich einwilligst.")}</p>
      <p className="text-sm">{t("Unter „Das trifft auf mich zu“ sehen andere die Angabe auf deinem Profil. „Mindestens vorhanden“ bleibt privat und filtert nur für dich. Wir geben die Angabe an niemanden weiter.")}</p>
      <p className="text-sm text-muted">{t("Du kannst die Einwilligung jederzeit unter Einstellungen widerrufen. Dann löschen wir diese Angaben.")}</p>
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={agree}>{t("Ich willige ein")}</Button>
        <Button type="button" tone="ghost" className="flex-1" onClick={() => setWaiting(null)}>{t("Nicht jetzt")}</Button>
      </div>
    </div>
  ) : null;

  return { guard, panel };
}
