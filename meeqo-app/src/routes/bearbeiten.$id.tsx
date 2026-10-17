import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, Note, Skeleton, TextArea, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { getActivity, updateActivity } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { compress } from "@/lib/meeqo/image";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/bearbeiten/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Edit id={id} />
    </Shell>
  );
}

function localValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Edit({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, error, loading } = useLoad(() => getActivity({ data: { id } }), [id]);
  const item = data?.activity;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [city, setCity] = useState("");
  const [when, setWhen] = useState("");
  const [spots, setSpots] = useState(4);
  const [durationMin, setDurationMin] = useState(120);
  const [imageUrl, setImageUrl] = useState("");
  const [fail, setFail] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setDescription(item.description);
    setPlaceName(item.placeName);
    setCity(item.city);
    setWhen(localValue(item.startsAt));
    setSpots(item.spots);
    setDurationMin(item.durationMin);
  }, [item?.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFail("");
    try {
      await updateActivity({ data: { id, title, description, placeName, city, startsAt: new Date(when).toISOString(), spots, durationMin, imageUrl } });
      notice("Gespeichert. Wer dabei ist, bekommt Bescheid.");
      await navigate({ to: "/activity/$id", params: { id } });
    } catch (err) {
      setFail(errText(err));
      setPending(false);
    }
  }

  if (loading) return <Skeleton lines={5} />;
  if (error || !item) return <Note>{error || "Nicht gefunden."}</Note>;
  if (!item.isHost) return <Note>Nur der Ersteller kann das Treffen ändern.</Note>;

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4">
      <div>
        <Link to="/activity/$id" params={{ id }} className="text-sm font-semibold underline">Zurück</Link>
        <h1 className="mt-2 font-display text-4xl leading-none">Treffen ändern</h1>
        <p className="mt-2 text-sm text-muted">Wer schon dabei ist, bekommt eine Mitteilung, wenn sich Zeit, Ort oder Plätze ändern.</p>
      </div>
      <Field label="Titel"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Beschreibung"><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Ort"><TextInput value={placeName} onChange={(event) => setPlaceName(event.target.value)} /></Field>
      <Field label="Stadt"><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
      <Field label="Beginn"><TextInput type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></Field>
      <Field label="Dauer">
        <select value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} className="h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none focus:border-accent">
          {[30, 60, 90, 120, 180, 240, 360, 480].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} Minuten` : minutes % 60 === 0 ? `${minutes / 60} Std.` : `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`}</option>)}
        </select>
      </Field>
      <Field label="Plätze für Gäste"><TextInput type="number" min={1} max={40} value={spots} onChange={(event) => setSpots(Number(event.target.value))} /></Field>
      <Field label="Neues Foto, optional">
        <input
          type="file"
          accept="image/*"
          className="text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              setImageUrl(await compress(file));
            } catch (err) {
              setFail(errText(err));
            }
          }}
        />
      </Field>
      <img src={imageUrl || item.imageUrl} alt="Vorschau" className="aspect-[3/2] w-full rounded-card object-cover" />
      {fail ? <Note>{fail}</Note> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Speichern…" : "Speichern"}</Button>
    </form>
  );
}
