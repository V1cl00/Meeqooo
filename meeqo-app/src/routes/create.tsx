import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, face, Field, Note, TextArea, TextInput } from "@/components/bits";
import { CategorySelect } from "@/components/categories";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { Shell, useMe } from "@/components/shell";
import { createActivity, listCategories } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!imageUrl) throw new Error("Ohne Foto wird nichts veröffentlicht.");
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
        },
      });
      await navigate({ to: "/activity/$id", params: { id: created.id } });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">Aktivität anlegen</h1>
      <p className="text-sm text-muted">Wer sie sieht, hängt an der Absicht. Teilnehmen geht nur über Anfrage, außer du bist Veranstalter mit Sofortbuchung.</p>
      <Field label="Titel"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
      <Field label="Beschreibung"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Kategorie">
        <CategorySelect value={category} onChange={setCategory} custom={cats.data ?? []} />
      </Field>
      <p className="text-sm text-muted">
        Fehlt deine Unterkategorie? <Link to="/categories" className={face}>Selbst anlegen</Link>
      </p>
      <div className="flex flex-wrap gap-2">
        {(["friends", "date", "both"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setIntent(item)} className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${intent === item ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>
            {item === "friends" ? "Nur Freundschaft" : item === "date" ? "Nur Dates" : "Alle"}
          </button>
        ))}
      </div>
      <VisibilityPicker value={visibility} onChange={setVisibility} communityIds={communityIds} onCommunityIds={setCommunityIds} />
      <Field label="Ort"><TextInput value={placeName} onChange={(event) => setPlaceName(event.target.value)} required /></Field>
      <Field label="Stadt"><TextInput value={city} onChange={(event) => setCity(event.target.value)} required /></Field>
      <button type="button" className={face} onClick={locate}>{coords ? "Standort übernommen" : "Diesen Ort vom Handy nehmen"}</button>
      <Field label="Beginn"><TextInput type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} required /></Field>
      <Field label="Plätze für Gäste"><TextInput type="number" min={1} max={40} value={spots} onChange={(event) => setSpots(Number(event.target.value))} /></Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={intent === "date" ? true : publicPlace} disabled={intent === "date"} onChange={(event) => setPublicPlace(event.target.checked)} />
        <span>{intent === "date" ? "Dates sind nur an öffentlichen Orten." : "Öffentlicher Ort."}</span>
      </label>
      {profile?.isOrganizer ? (
        <div className="flex gap-2">
          <button type="button" className={`inline-flex h-10 items-center rounded-full border-2 px-4 text-sm font-semibold ${bookingMode === "request" ? "border-accent bg-accent text-onaccent" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("request")}>Anfrage</button>
          <button type="button" className={`inline-flex h-10 items-center rounded-full border-2 px-4 text-sm font-semibold ${bookingMode === "instant" ? "border-accent bg-accent text-onaccent" : "border-line bg-card text-ink"}`} onClick={() => setBookingMode("instant")}>Sofortbuchung</button>
        </div>
      ) : <p className="text-sm text-muted">Buchung: Anfrage mit deiner Freigabe.</p>}
      <TraitPicker label="Eigenschaften des Treffens" hint="Wer vegan oder queer als Pflicht gesetzt hat, sieht das Treffen nur mit dem passenden Haken." selected={traits} onChange={setTraits} />
      <Field label="Foto, Pflicht">
        <input type="file" accept="image/*" required={!imageUrl} className="text-sm" onChange={(event) => onFile(event.target.files?.[0])} />
      </Field>
      {imageUrl ? <img src={imageUrl} alt="Vorschau" className="aspect-[3/2] w-full rounded-card object-cover" /> : null}
      {communityId ? <Note>Die Aktivität erscheint in deiner Community und im Feed.</Note> : null}
      {error ? <Note>{error}</Note> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Speichern…" : "Veröffentlichen"}</Button>
    </form>
  );
}
