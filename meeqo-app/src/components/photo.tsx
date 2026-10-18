import { forwardRef, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/bits";
import { useMe } from "@/components/shell";
import { setAvatar } from "@/lib/meeqo/api";
import { compress } from "@/lib/meeqo/image";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

/** Server message when a request is blocked because the profile photo is missing (requestJoin, expressInterest). */
export const PHOTO_MISSING = "Ohne Foto kannst du nicht anfragen. Lad eins im Profil hoch.";

/** True when an error from the server means: profile photo missing. */
export function isPhotoMissing(err: unknown) {
  const text = errText(err);
  return text === PHOTO_MISSING || text === t(PHOTO_MISSING);
}

/** Uploads a profile photo where you are: opens the file picker, uses the same upload as the profile (640 px JPEG), then calls onDone. */
export function AvatarUpload({ onDone, label = "Foto hochladen", tone = "accent", className = "" }: { onDone?: () => void; label?: string; tone?: "accent" | "ink" | "ghost"; className?: string }) {
  const { reload } = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFail("");
    try {
      await setAvatar({ data: { imageUrl: await compress(file, 640) } });
      await reload();
      onDone?.();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <Button type="button" tone={tone} disabled={busy} className="w-full gap-2" onClick={() => input.current?.click()}>
        <Camera className="h-5 w-5" aria-hidden="true" />
        {busy ? t("Lädt hoch…") : t(label)}
      </Button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t("Profilfoto wählen")} onChange={(event) => void upload(event.target.files?.[0])} />
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}

/** Shown where a request is blocked because the profile photo is missing. Upload right here, then go on. */
export function PhotoMissing({ onDone, text = "Ohne Foto kannst du nicht anfragen. Lad hier eins hoch, dann geht es weiter." }: { onDone?: () => void; text?: string }) {
  return (
    <div className="card space-y-3 border-2 border-accent p-4" role="alert">
      <p className="text-sm font-semibold text-ink">{t(text)}</p>
      <AvatarUpload onDone={onDone} />
    </div>
  );
}

/** Large, obvious photo picker: dashed card with camera icon, preview with "Ändern" once chosen. `invalid` highlights it. */
export const PhotoPicker = forwardRef<HTMLDivElement, { value: string; onFile: (file: File | undefined) => void; invalid?: boolean; label?: string; hint?: string }>(function PhotoPicker({ value, onFile, invalid = false, label = "Foto hinzufügen", hint = "Tippen zum Auswählen" }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {value ? (
        <div className="relative">
          <img src={value} alt={t("Vorschau")} className="aspect-[3/2] w-full rounded-card object-cover" />
          <Button type="button" tone="ghost" className="absolute bottom-3 right-3 h-10 gap-2" onClick={choose}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t("Ändern")}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={choose}
          className={`flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed transition ${invalid ? "border-accent bg-accent/10 ring-4 ring-accent/30" : "border-accent/60 bg-sand hover:bg-sand-deep"}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-onfill">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold text-ink">{t(label)}</span>
          <span className="text-sm text-muted">{t(hint)}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t(label)} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
  );
});
