import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AreaPicker } from "@/components/areas";
import { Button, Field, Note, Wordmark } from "@/components/bits";
import { PlaceSuggest } from "@/components/place-bar";
import { SeekingPicker } from "@/components/categories";
import { Shell, useMe } from "@/components/shell";
import { listCategories, saveOnboarding, setLocation } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/onboarding")({ component: Page });

function Page() {
  return (
    <Shell bare requireOnboarding={false}>
      <Onboarding />
    </Shell>
  );
}

function Onboarding() {
  const { profile, reload } = useMe();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<string[]>(profile?.areas ?? []);
  const [seeking, setSeeking] = useState<string[]>(profile?.seeking ?? []);
  const [city, setCity] = useState(profile?.city ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cats = useLoad(() => listCategories(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!areas.length) {
        setError("Wähl mindestens eins.");
        setPending(false);
        return;
      }
      await saveOnboarding({ data: { areas, seeking, city, lat: coords?.lat, lng: coords?.lng } });
      await reload();
      await navigate({ to: "/" });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  function locate() {
    setError("");
    setLocNote("");
    if (!navigator.geolocation) {
      setError("Dein Browser gibt keinen Standort her. Schreib die Stadt von Hand.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        try {
          const result = await setLocation({ data: next });
          if (result.city) setCity(result.city);
          setLocNote(result.city ? `Standort: ${result.city}` : "Standort übernommen. Stadt kannst du noch eintragen.");
        } catch (err) {
          setLocNote("Standort übernommen.");
          setError(errText(err));
        }
      },
      () => setError("Standort nicht freigegeben. Schreib die Stadt von Hand."),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-3 p-5">
        <Wordmark />
        <h1 className="font-display text-[2rem] leading-none">Wofür bist du hier?</h1>
        <p className="text-sm text-muted">Mehrere gehen. Das siehst du im Feed, und du kannst es später ändern.</p>
      </section>
      <AreaPicker selected={areas} onChange={setAreas} />
      <div>
        <p className="text-sm font-medium text-muted">Ich suche aktiv neue Leute für</p>
        <div className="mt-2">
          <SeekingPicker selected={seeking} onChange={setSeeking} custom={cats.data ?? []} />
        </div>
      </div>
      <Field label="Stadt">
        <PlaceSuggest
          value={city}
          onChange={(next) => {
            setCity(next);
            setCoords(null);
          }}
          onPick={(hit) => {
            setCity(hit.city);
            setCoords({ lat: hit.lat, lng: hit.lng });
          }}
          placeholder="Postleitzahl, Stadt oder Dorf"
        />
      </Field>
      <button type="button" className="inline-flex h-12 w-full items-center justify-center rounded-full border border-line bg-card text-sm font-semibold text-ink shadow-sm" onClick={locate}>{coords ? "Standort übernommen" : "Standort nutzen"}</button>
      {locNote ? <p className="text-sm text-muted">{locNote}</p> : null}
      {error ? <Note>{error}</Note> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Speichern…" : "Weiter zum Feed"}</Button>
    </form>
  );
}
