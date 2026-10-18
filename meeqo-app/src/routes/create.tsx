import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useBackOverride } from "@/lib/meeqo/back";
import { Button, face, Field, Note, TextArea, TextInput } from "@/components/bits";
import { CategorySelect } from "@/components/categories";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { Shell, useMe } from "@/components/shell";
import { createActivity, listCategories, suggestVenues } from "@/lib/meeqo/api";
import { errText, splitCategory, templateFor } from "@/lib/meeqo/labels";
import { compress } from "@/lib/meeqo/image";
import { PhotoPicker } from "@/components/photo";
import { clearDraft, markReturn, readDraft, takePicked, writeDraft } from "@/lib/meeqo/draft";
import { parseMeetup } from "@/lib/meeqo/parse";
import type { VenueHit } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>) => ({
    community: typeof search.community === "string" ? search.community : "",
  }),
  component: Page,
});

function Page() {
  const { community } = Route.useSearch();
  return (
    <Shell>
      <Create communityId={community} />
    </Shell>
  );
}

function Create({ communityId }: { communityId: string }) {
  const { profile } = useMe();
  const navigate = useNavigate();
  const cats = useLoad(() => listCategories(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Sport");
  const [intent, setIntent] = useState<"date" | "friends" | "both">("friends");
  const [placeName, setPlaceName] = useState("");
  const [city, setCity] = useState(profile?.city ?? "");
  const [when, setWhen] = useState("");
  const [spots, setSpots] = useState(4);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [photoMissing, setPhotoMissing] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);
  const [bookingMode, setBookingMode] = useState<"request" | "instant">(profile?.bookingMode ?? "request");
  const [publicPlace, setPublicPlace] = useState(true);
  const [traits, setTraits] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>(profile?.defaultVisibility ?? "all");
  const [communityIds, setCommunityIds] = useState<string[]>(profile?.audienceIds ?? []);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(1);
  const stepBack = useCallback(() => { setError(""); setStep((value) => Math.max(1, value - 1)); window.scrollTo({ top: 0 }); }, []);
  useBackOverride(step > 1 ? stepBack : null);
  const [durationMin, setDurationMin] = useState(120);
  const [sentence, setSentence] = useState("");
  const [sentenceNote, setSentenceNote] = useState("");
  const [venues, setVenues] = useState<VenueHit[]>([]);
  const venuePoint = coords ?? (profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null);
  const template = templateFor(category);
  const [templateUsed, setTemplateUsed] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restore the draft after a round trip (e.g. to /categories), and select a subcategory created there.
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setTitle(draft.title);
      setDescription(draft.description);
      setCategory(draft.category);
      setIntent(draft.intent);
      setPlaceName(draft.placeName);
      setCity(draft.city);
      setWhen(draft.when);
      setSpots(draft.spots);
      setCoords(draft.coords);
      setImageUrl(draft.imageUrl);
      setBookingMode(draft.bookingMode);
      setPublicPlace(draft.publicPlace);
      setTraits(draft.traits);
      setVisibility(draft.visibility);
      setCommunityIds(draft.communityIds);
      setDurationMin(draft.durationMin);
      setStep(draft.step);
      setSentence(draft.sentence);
      setRestored(true);
    }
    const picked = takePicked();
    if (picked) setCategory(picked);
    setDraftReady(true);
  }, []);

  const dirty = Boolean(title.trim() || description.trim() || imageUrl || placeName.trim() || when || sentence.trim());
  useEffect(() => {
    if (!draftReady) return;
    if (!dirty) {
      clearDraft();
      return;
    }
    writeDraft({ title, description, category, intent, placeName, city, when, spots, coords, imageUrl, bookingMode, publicPlace, traits, visibility, communityIds, durationMin, step, sentence, communityId });
  }, [draftReady, dirty, title, description, category, intent, placeName, city, when, spots, coords, imageUrl, bookingMode, publicPlace, traits, visibility, communityIds, durationMin, step, sentence, communityId]);

  function startOver() {
    clearDraft();
    setTitle("");
    setDescription("");
    setPlaceName("");
    setWhen("");
    setImageUrl("");
    setSentence("");
    setTraits([]);
    setStep(1);
    setRestored(false);
  }

  useEffect(() => {
    if (step !== 2 || !venuePoint) return;
    let live = true;
    suggestVenues({ data: venuePoint })
      .then((list) => live && setVenues(list))
      .catch(() => {});
    return () => {
      live = false;
    };
    // the point only changes when the person picks another place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, venuePoint?.lat, venuePoint?.lng]);

  function fillFromSentence() {
    const found = parseMeetup(sentence);
    const filled: string[] = [];
    if (found.title) {
      setTitle(found.title);
      filled.push("Titel");
    }
    if (found.category) {
      setCategory(found.category);
      filled.push("Kategorie");
    }
    if (found.when) {
      setWhen(found.when);
      filled.push("Zeit");
    }
    if (found.placeName) {
      setPlaceName(found.placeName);
      filled.push("Ort");
    }
    if (found.spots) {
      setSpots(Math.min(40, Math.max(1, found.spots)));
      filled.push("Plätze");
    }
    if (found.durationMin) {
      setDurationMin(Math.min(480, Math.max(30, found.durationMin)));
      filled.push("Dauer");
    }
    setSentenceNote(filled.length ? t("Ausgefüllt: {0}. Prüf alles kurz, ein Foto fehlt noch.", filled.map((name) => t(name)).join(", ")) : t("Daraus konnte ich nichts herauslesen. Schreib zum Beispiel Tag, Uhrzeit und was ihr macht."));
  }

  function applyTemplate() {
    if (!template) return;
    setSpots(template.spots);
    setDurationMin(template.durationMin);
    setTemplateUsed(true);
    if (!description.trim()) setDescription(template.description);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setImageUrl(await compress(file));
      setPhotoMissing(false);
      setError("");
    } catch (err) {
      setError(errText(err));
    }
  }

  /** Photo is required: scroll to the picker and highlight it. */
  function flagPhoto() {
    setPhotoMissing(true);
    window.setTimeout(() => {
      photoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      photoRef.current?.focus({ preventScroll: true });
    }, 50);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }

  function problem(at: number) {
    if (at === 1) {
      if (title.trim().length < 3) return "Gib dem Treffen einen Titel.";
      if (!imageUrl) return t("Ohne Foto wird nichts veröffentlicht.");
    }
    if (at === 2) {
      if (!placeName.trim() || !city.trim()) return t("Ort und Stadt fehlen.");
      if (!when) return "Wann geht es los?";
    }
    return "";
  }

  function next() {
    const message = problem(step);
    setError(message);
    if (step === 1 && title.trim().length >= 3 && !imageUrl) flagPhoto();
    if (!message) setStep((value) => Math.min(3, value + 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 3) {
      next();
      return;
    }
    const message = problem(1) || problem(2);
    if (message) {
      setError(message);
      setStep(problem(1) ? 1 : 2);
      if (problem(1) && title.trim().length >= 3 && !imageUrl) flagPhoto();
      return;
    }
    setPending(true);
    setError("");
    try {
      const created = await createActivity({
        data: {
          title,
          description,
          category,
          intent: profile?.flags.dating ? intent : "friends",
          placeName,
          city,
          lat: coords?.lat,
          lng: coords?.lng,
          startsAt: new Date(when).toISOString(),
          spots,
          imageUrl,
          bookingMode,
          communityId,
          publicPlace: intent === "date" ? true : publicPlace,
          traits,
          visibility,
          communityIds: visibility === "community" ? communityIds : [],
          durationMin,
        },
      });
      clearDraft();
      await navigate({ to: "/activity/$id", params: { id: created.id } });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  const titles = ["Was", t("Wann und wo"), "Wer darf mit"] as const;

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4" noValidate>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-none">{t("Aktivität anlegen")}</h1>
        <div className="flex gap-1.5" aria-hidden>
          {titles.map((_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index < step ? "bg-accent" : "bg-sand-deep"}`} />
          ))}
        </div>
        <p className="text-sm text-muted">{t("Schritt {0} von 3: {1}", step, titles[step - 1])}</p>
        {restored ? (
          <p className="flex items-center justify-between gap-2 text-sm text-muted">
            <span>{t("Dein Entwurf ist noch da.")}</span>
            <button type="button" className="font-semibold text-ink underline" onClick={startOver}>{t("Neu beginnen")}</button>
          </p>
        ) : null}
      </div>
      {step === 1 ? (
        <div className="space-y-4">
          <div className="card space-y-2 p-4">
            <Field label={t("Beschreib es in einem Satz")}>
              <TextInput
                value={sentence}
                onChange={(event) => setSentence(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    fillFromSentence();
                  }
                }}
                placeholder={t("Samstag 10 Uhr Bouldern am Ostkreuz, sechs Leute")}
              />
            </Field>
            <Button type="button" tone="ghost" className="w-full" disabled={sentence.trim().length < 3} onClick={fillFromSentence}>{t("Ausfüllen")}</Button>
            {sentenceNote ? <p className="text-sm text-muted">{sentenceNote}</p> : null}
          </div>
          <Field label={t("Titel")}><TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("Zum Beispiel: Laufen, acht Kilometer")} /></Field>
          <Field label={t("Beschreibung")}><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label={t("Kategorie")}>
            <CategorySelect
              value={category}
              onChange={setCategory}
              custom={cats.data ?? []}
              subFooter={<p className="flex flex-wrap items-center gap-x-2 gap-y-1">{t("Fehlt deine Unterkategorie?")}<Link to="/categories" className={face.replace("h-11", "h-9")} onClick={() => markReturn(splitCategory(category).parent)}>{t("Selbst anlegen")}</Link></p>}
            />
          </Field>
          {template ? (
            <div className="space-y-1">
              <Button type="button" tone="ghost" className="w-full border-accent" onClick={applyTemplate}>{t("Vorlage einsetzen: {0} Leute · {1} Min.", template.spots, template.durationMin)}</Button>
              {templateUsed ? <p className="text-sm text-muted">{t("Vorlage eingesetzt. Du kannst alles unten noch ändern.")}</p> : null}
            </div>
          ) : null}
          <SizeControls spots={spots} onSpots={setSpots} durationMin={durationMin} onDuration={setDurationMin} />
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-ink">{t("Foto, Pflicht")}</span>
            <PhotoPicker ref={photoRef} value={imageUrl} onFile={onFile} invalid={photoMissing} />
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-4">
          <Field label={t("Ort")}><TextInput value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder={t("Treffpunkt, zum Beispiel Schlossgarten")} /></Field>
          {venues.length ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t("Öffentliche Orte in der Nähe")}</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {venues.map((venue) => (
                  <button key={venue.name} type="button" onClick={() => setPlaceName(venue.name)} className={`inline-flex min-h-11 shrink-0 flex-col items-start justify-center rounded-2xl border-2 px-3 py-1 text-left ${placeName === venue.name ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>
                    <span className="text-sm font-semibold">{venue.name}</span>
                    <span className="text-xs opacity-80">{venue.kind} · {venue.meters < 1000 ? `${venue.meters} m` : t("{0} km", (venue.meters / 1000).toFixed(1))}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Field label={t("Stadt")}><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
          <button type="button" className={face} onClick={locate}>{coords ? t("Standort übernommen") : t("Diesen Ort vom Handy nehmen")}</button>
          <Field label={t("Beginn")}><TextInput type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={intent === "date" ? true : publicPlace} disabled={intent === "date"} onChange={(event) => setPublicPlace(event.target.checked)} />
            <span>{intent === "date" ? t("Dates sind nur an öffentlichen Orten.") : t("Öffentlicher Ort.")}</span>
          </label>
          {profile?.isOrganizer ? (
            <div className="flex gap-2">
              <button type="button" className={`inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${bookingMode === "request" ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("request")}>{t("Anfrage")}</button>
              <button type="button" className={`inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${bookingMode === "instant" ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("instant")}>{t("Sofortbuchung")}</button>
            </div>
          ) : <p className="text-sm text-muted">{t("Buchung: Anfrage mit deiner Freigabe.")}</p>}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("Wer sie sieht, hängt an der Absicht. Teilnehmen geht nur über Anfrage, außer du bist Veranstalter mit Sofortbuchung.")}</p>
          {profile?.flags.dating ? <div className="flex flex-wrap gap-1.5">
            {(["friends", "date", "both"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setIntent(item)} className={`inline-flex h-10 items-center rounded-control border px-3.5 text-sm font-semibold ${intent === item ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>
                {item === "friends" ? t("Nur Freundschaft") : item === "date" ? t("Nur Dates") : t("Alle")}
              </button>
            ))}
          </div> : null}
          <VisibilityPicker value={visibility} onChange={setVisibility} communityIds={communityIds} onCommunityIds={setCommunityIds} />
          <TraitPicker label={t("Eigenschaften des Treffens")} hint={t("Wer vegan oder queer als Pflicht gesetzt hat, sieht das Treffen nur mit dem passenden Haken.")} selected={traits} onChange={setTraits} />
          {communityId ? <Note>{t("Die Aktivität erscheint in deiner Community und im Feed.")}</Note> : null}
        </div>
      ) : null}
      {error ? <Note>{error}</Note> : null}
      <div className="flex gap-2">
        {step > 1 ? <Button key="back" type="button" tone="ghost" className="flex-1" onClick={() => { setError(""); setStep((value) => value - 1); }}>{t("Zurück")}</Button> : null}
        {step < 3 ? (
          <Button key="next" type="button" className="flex-1" onClick={next}>{t("Weiter")}</Button>
        ) : (
          <Button key="publish" type="submit" disabled={pending} className="flex-1">{pending ? t("Speichern…") : t("Veröffentlichen")}</Button>
        )}
      </div>
    </form>
  );
}

const DURATIONS = [30, 60, 90, 120, 180] as const;
const LONGER = [240, 300, 360, 420, 480] as const;

function durationLabel(minutes: number) {
  return minutes < 60 ? t("{0} Minuten", minutes) : minutes % 60 === 0 ? t("{0} Std.", minutes / 60) : t("{0} Std. {1} Min.", Math.floor(minutes / 60), minutes % 60);
}

/** Guests (stepper, 1 to 40 like the server) and duration (chips, longer via select). Always editable; a template only prefills. */
function SizeControls({ spots, onSpots, durationMin, onDuration }: { spots: number; onSpots: (next: number) => void; durationMin: number; onDuration: (next: number) => void }) {
  const step = "grid h-12 w-12 place-items-center rounded-full border border-line bg-card text-2xl font-semibold text-ink disabled:opacity-40";
  const chip = (on: boolean) => `inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
  return (
    <div className="card space-y-4 p-4">
      <div className="space-y-1.5">
        <span className="text-[13px] font-semibold text-ink">{t("Plätze für Gäste")}</span>
        <div className="flex items-center gap-3">
          <button type="button" className={step} aria-label={t("Ein Platz weniger")} disabled={spots <= 1} onClick={() => onSpots(Math.max(1, spots - 1))}>−</button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            aria-label={t("Plätze für Gäste")}
            value={spots}
            onChange={(event) => onSpots(Math.min(40, Math.max(1, Math.round(Number(event.target.value)) || 1)))}
            className="h-12 w-20 rounded-2xl border border-line bg-sand text-center text-lg font-semibold outline-none focus:border-accent"
          />
          <button type="button" className={step} aria-label={t("Ein Platz mehr")} disabled={spots >= 40} onClick={() => onSpots(Math.min(40, spots + 1))}>+</button>
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-[13px] font-semibold text-ink">{t("Dauer")}</span>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((minutes) => (
            <button key={minutes} type="button" aria-pressed={durationMin === minutes} className={chip(durationMin === minutes)} onClick={() => onDuration(minutes)}>{durationLabel(minutes)}</button>
          ))}
          <select
            aria-label={t("Länger")}
            value={(LONGER as readonly number[]).includes(durationMin) ? durationMin : ""}
            onChange={(event) => event.target.value && onDuration(Number(event.target.value))}
            className={`${chip((LONGER as readonly number[]).includes(durationMin))} pr-2 outline-none`}
          >
            <option value="">{t("Länger…")}</option>
            {LONGER.map((minutes) => <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
