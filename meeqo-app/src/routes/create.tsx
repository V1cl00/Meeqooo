import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, face, Field, Note, TextArea, TextInput } from "@/components/bits";
import { CategorySelect } from "@/components/categories";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { Shell, useMe } from "@/components/shell";
import { createActivity, listCategories, suggestVenues } from "@/lib/meeqo/api";
import { errText, templateFor } from "@/lib/meeqo/labels";
import { parseMeetup } from "@/lib/meeqo/parse";
import type { VenueHit } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";

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

function compress(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 960 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Bild konnte nicht gelesen werden."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    image.src = url;
  });
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
  const [bookingMode, setBookingMode] = useState<"request" | "instant">(profile?.bookingMode ?? "request");
  const [publicPlace, setPublicPlace] = useState(true);
  const [traits, setTraits] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>(profile?.defaultVisibility ?? "all");
  const [communityIds, setCommunityIds] = useState<string[]>(profile?.audienceIds ?? []);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(1);
  const [durationMin, setDurationMin] = useState(120);
  const [sentence, setSentence] = useState("");
  const [sentenceNote, setSentenceNote] = useState("");
  const [venues, setVenues] = useState<VenueHit[]>([]);
  const venuePoint = coords ?? (profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null);
  const template = templateFor(category);

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
    setSentenceNote(filled.length ? `Ausgefüllt: ${filled.join(", ")}. Prüf alles kurz, ein Foto fehlt noch.` : "Daraus konnte ich nichts herauslesen. Schreib zum Beispiel Tag, Uhrzeit und was ihr macht.");
  }

  function applyTemplate() {
    if (!template) return;
    setSpots(template.spots);
    setDurationMin(template.durationMin);
    if (!description.trim()) setDescription(template.description);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setImageUrl(await compress(file));
    } catch (err) {
      setError(errText(err));
    }
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }

  function problem(at: number) {
    if (at === 1) {
      if (title.trim().length < 3) return "Gib dem Treffen einen Titel.";
      if (!imageUrl) return "Ohne Foto wird nichts veröffentlicht.";
    }
    if (at === 2) {
      if (!placeName.trim() || !city.trim()) return "Ort und Stadt fehlen.";
      if (!when) return "Wann geht es los?";
    }
    return "";
  }

  function next() {
    const message = problem(step);
    setError(message);
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
          intent,
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
      await navigate({ to: "/activity/$id", params: { id: created.id } });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  const titles = ["Was", "Wann und wo", "Wer darf mit"] as const;

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4" noValidate>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-none">Aktivität anlegen</h1>
        <div className="flex gap-1.5" aria-hidden>
          {titles.map((_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index < step ? "bg-accent" : "bg-sand-deep"}`} />
          ))}
        </div>
        <p className="text-sm text-muted">Schritt {step} von 3: {titles[step - 1]}</p>
      </div>
      {step === 1 ? (
        <div className="space-y-4">
          <div className="card space-y-2 p-4">
            <Field label="Beschreib es in einem Satz">
              <TextInput
                value={sentence}
                onChange={(event) => setSentence(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    fillFromSentence();
                  }
                }}
                placeholder="Samstag 10 Uhr Bouldern am Ostkreuz, sechs Leute"
              />
            </Field>
            <Button type="button" tone="ghost" className="w-full" disabled={sentence.trim().length < 3} onClick={fillFromSentence}>Ausfüllen</Button>
            {sentenceNote ? <p className="text-sm text-muted">{sentenceNote}</p> : null}
          </div>
          <Field label="Titel"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Zum Beispiel: Laufen, acht Kilometer" /></Field>
          <Field label="Beschreibung"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Kategorie">
            <CategorySelect value={category} onChange={setCategory} custom={cats.data ?? []} />
          </Field>
          {template ? (
            <button type="button" onClick={applyTemplate} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
              Vorlage einsetzen: {template.spots} Leute · {template.durationMin} Min.
            </button>
          ) : null}
          <p className="text-sm text-muted">
            Fehlt deine Unterkategorie? <Link to="/categories" className={face}>Selbst anlegen</Link>
          </p>
          <Field label="Foto, Pflicht">
            <input type="file" accept="image/*" className="text-sm" onChange={(event) => onFile(event.target.files?.[0])} />
          </Field>
          {imageUrl ? <img src={imageUrl} alt="Vorschau" className="aspect-[3/2] w-full rounded-card object-cover" /> : null}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-4">
          <Field label="Ort"><TextInput value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Treffpunkt, zum Beispiel Schlossgarten" /></Field>
          {venues.length ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Öffentliche Orte in der Nähe</p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {venues.map((venue) => (
                  <button key={venue.name} type="button" onClick={() => setPlaceName(venue.name)} className={`inline-flex min-h-11 shrink-0 flex-col items-start justify-center rounded-2xl border-2 px-3 py-1 text-left ${placeName === venue.name ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>
                    <span className="text-sm font-semibold">{venue.name}</span>
                    <span className="text-xs opacity-80">{venue.kind} · {venue.meters < 1000 ? `${venue.meters} m` : `${(venue.meters / 1000).toFixed(1)} km`}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Field label="Stadt"><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
          <button type="button" className={face} onClick={locate}>{coords ? "Standort übernommen" : "Diesen Ort vom Handy nehmen"}</button>
          <Field label="Beginn"><TextInput type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></Field>
          <Field label="Dauer">
            <select value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none focus:border-accent">
              {[30, 60, 90, 120, 180, 240, 360].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} Minuten` : minutes % 60 === 0 ? `${minutes / 60} Std.` : `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`}</option>)}
            </select>
          </Field>
          <Field label="Plätze für Gäste"><TextInput type="number" min={1} max={40} value={spots} onChange={(event) => setSpots(Number(event.target.value))} /></Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={intent === "date" ? true : publicPlace} disabled={intent === "date"} onChange={(event) => setPublicPlace(event.target.checked)} />
            <span>{intent === "date" ? "Dates sind nur an öffentlichen Orten." : "Öffentlicher Ort."}</span>
          </label>
          {profile?.isOrganizer ? (
            <div className="flex gap-2">
              <button type="button" className={`inline-flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${bookingMode === "request" ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("request")}>Anfrage</button>
              <button type="button" className={`inline-flex h-11 items-center rounded-full border-2 px-4 text-sm font-semibold ${bookingMode === "instant" ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("instant")}>Sofortbuchung</button>
            </div>
          ) : <p className="text-sm text-muted">Buchung: Anfrage mit deiner Freigabe.</p>}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Wer sie sieht, hängt an der Absicht. Teilnehmen geht nur über Anfrage, außer du bist Veranstalter mit Sofortbuchung.</p>
          <div className="flex flex-wrap gap-2">
            {(["friends", "date", "both"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setIntent(item)} className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${intent === item ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>
                {item === "friends" ? "Nur Freundschaft" : item === "date" ? "Nur Dates" : "Alle"}
              </button>
            ))}
          </div>
          <VisibilityPicker value={visibility} onChange={setVisibility} communityIds={communityIds} onCommunityIds={setCommunityIds} />
          <TraitPicker label="Eigenschaften des Treffens" hint="Wer vegan oder queer als Pflicht gesetzt hat, sieht das Treffen nur mit dem passenden Haken." selected={traits} onChange={setTraits} />
          {communityId ? <Note>Die Aktivität erscheint in deiner Community und im Feed.</Note> : null}
        </div>
      ) : null}
      {error ? <Note>{error}</Note> : null}
      <div className="flex gap-2">
        {step > 1 ? <Button key="back" type="button" tone="ghost" className="flex-1" onClick={() => { setError(""); setStep((value) => value - 1); }}>Zurück</Button> : null}
        {step < 3 ? (
          <Button key="next" type="button" className="flex-1" onClick={next}>Weiter</Button>
        ) : (
          <Button key="publish" type="submit" disabled={pending} className="flex-1">{pending ? "Speichern…" : "Veröffentlichen"}</Button>
        )}
      </div>
    </form>
  );
}
