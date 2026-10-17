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
import { t } from "@/lib/meeqo/i18n";

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
  const onlyFriends = !profile?.flags.dating && !profile?.flags.business && !profile?.flags.classifieds;
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
      const chosen = onlyFriends ? ["friends"] : areas;
      if (!chosen.length) {
        setError(t("Wähl mindestens eins."));
        setPending(false);
        return;
      }
      await saveOnboarding({ data: { areas: chosen, seeking, city, lat: coords?.lat, lng: coords?.lng } });
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
      setError(t("Dein Browser gibt keinen Standort her. Schreib die Stadt von Hand."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        try {
          const result = await setLocation({ data: next });
          if (result.city) setCity(result.city);
          setLocNote(result.city ? `Standort: ${result.city}` : t("Standort übernommen. Stadt kannst du noch eintragen."));
        } catch (err) {
          setLocNote(t("Standort übernommen."));
          setError(errText(err));
        }
      },
      () => setError(t("Standort nicht freigegeben. Schreib die Stadt von Hand.")),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-3 p-5">
        <Wordmark />
        <h1 className="font-display text-[2rem] leading-none">{onlyFriends ? t("Wo bist du?") : t("Wofür bist du hier?")}</h1>
        <p className="text-sm text-muted">{onlyFriends ? t("Triff Leute bei dem, was du eh gern machst. Sag uns nur, wo.") : t("Mehrere gehen. Das siehst du im Feed, und du kannst es später ändern.")}</p>
      </section>
      {onlyFriends ? null : <AreaPicker selected={areas} onChange={setAreas} />}
      <Field label={t("Stadt")}>
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
          placeholder={t("Postleitzahl, Stadt oder Dorf")}
        />
      </Field>
      <button type="button" className="inline-flex h-12 w-full items-center justify-center rounded-full border border-line bg-card text-sm font-semibold text-ink shadow-sm" onClick={locate}>{coords ? t("Standort übernommen") : t("Standort nutzen")}</button>
      {locNote ? <p className="text-sm text-muted">{locNote}</p> : null}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t("Was suchst du? (optional, geht auch später)")}</summary>
        <div className="mt-3">
          <SeekingPicker selected={seeking} onChange={setSeeking} custom={cats.data ?? []} />
        </div>
      </details>
      {error ? <Note>{error}</Note> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? t("Speichern…") : t("Weiter zum Feed")}</Button>
    </form>
  );
}
