import { useEffect, useRef, useState } from "react";
import { Heart, ImagePlus, Pause, Play } from "lucide-react";
import { Button, Note } from "@/components/bits";
import { sendMessage } from "@/lib/meeqo/api";
import { meetAlbum, sendThanks, thanksPeople } from "@/lib/meeqo/design";
import { compress } from "@/lib/meeqo/image";
import { errText } from "@/lib/meeqo/labels";
import { notice } from "@/lib/meeqo/feel";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

/** Shared album: the photos from the group chat, plus an upload right here. Plays itself as a short slideshow. */
export function Album({ id }: { id: string }) {
  const { data, reload } = useLoad(() => meetAlbum({ data: { id } }), [id]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const photos = data ?? [];

  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % photos.length), 3000);
    return () => window.clearInterval(timer);
  }, [playing, photos.length]);

  async function add(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFail("");
    try {
      const dataUrl = await compress(file, 1280);
      await sendMessage({ data: { id, body: "", attachment: { name: "foto.jpg", type: "image/jpeg", data: dataUrl } } });
      reload();
      notice(t("Foto ist im Album und im Gruppenchat."));
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const current = photos[index % Math.max(1, photos.length)];
  return (
    <section className="card space-y-3 overflow-hidden p-0">
      {current ? (
        <div className="relative aspect-[4/3] bg-sand-deep">
          <img key={current.id} src={current.src} alt="" className="h-full w-full animate-[cardin_.5s_ease-out] object-cover" />
          {photos.length > 1 ? (
            <>
              <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden="true">
                {photos.map((photo, i) => <span key={photo.id} className={`h-1 flex-1 rounded-full ${i === index % photos.length ? "bg-white" : "bg-white/40"}`} />)}
              </div>
              <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? t("Anhalten") : t("Abspielen")} className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2 px-4 pb-4 pt-1">
        <p className="font-display text-2xl">{t("Euer Album")}</p>
        <p className="text-sm text-muted">{photos.length ? (photos.length === 1 ? t("1 Foto. Nur für alle, die dabei waren.") : t("{0} Fotos. Nur für alle, die dabei waren.", photos.length)) : t("Noch keine Fotos. Nur alle, die dabei waren, sehen sie.")}</p>
        <Button type="button" tone="ghost" disabled={busy} className="w-full gap-2" onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {busy ? t("Lädt hoch…") : t("Foto hinzufügen")}
        </Button>
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={t("Foto fürs Album")} onChange={(event) => void add(event.target.files?.[0])} />
        {fail ? <Note>{fail}</Note> : null}
      </div>
    </section>
  );
}

/** Private thanks: the other person gets one quiet message, nobody else sees it. */
export function Thanks({ id }: { id: string }) {
  const { data, reload } = useLoad(() => thanksPeople({ data: { id } }), [id]);
  const [fail, setFail] = useState("");
  if (!data?.length) return null;
  async function thank(to: string) {
    setFail("");
    try {
      await sendThanks({ data: { id, to } });
      notice(t("Danke ist angekommen."));
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }
  return (
    <section className="card space-y-2 p-4">
      <p className="font-display text-2xl">{t("Danke sagen")}</p>
      <p className="text-sm text-muted">{t("Privat. Nur die Person sieht es, einmal pro Treffen.")}</p>
      <div className="space-y-2">
        {data.map((person) => (
          <div key={person.userId} className="flex items-center gap-3">
            {person.avatar ? <img src={person.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-sand-deep font-semibold">{person.name.slice(0, 1)}</span>}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.name}</span>
            <button type="button" disabled={person.thanked} onClick={() => void thank(person.userId)} className={`inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-sm font-semibold ${person.thanked ? "bg-green/30 text-ink" : "border border-line bg-card text-ink"}`}>
              <Heart className="h-4 w-4" aria-hidden="true" />
              {person.thanked ? t("Gesagt") : t("Danke")}
            </button>
          </div>
        ))}
      </div>
      {fail ? <Note>{fail}</Note> : null}
    </section>
  );
}
