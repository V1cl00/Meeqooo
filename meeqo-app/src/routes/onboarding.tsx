import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AreaPicker } from "@/components/areas";
import { Button, Field, Note, TextArea, TextInput, Wordmark } from "@/components/bits";
import { PlaceSuggest } from "@/components/place-bar";
import { AvatarUpload } from "@/components/photo";
import { ChipToggle, KA_DISTRICTS, LANGUAGES, QUICK_INTERESTS } from "@/components/quick-interests";
import { Shell, useMe } from "@/components/shell";
import { saveOnboarding, setLocation } from "@/lib/meeqo/api";
import { saveProfileMore } from "@/lib/meeqo/round3";
import { errText } from "@/lib/meeqo/labels";
import { buzz } from "@/lib/meeqo/feel";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/onboarding")({ component: Page });

function Page() {
  return (
    <Shell bare requireOnboarding={false}>
      <Onboarding />
    </Shell>
  );
}

const NEEDED = 3;

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${done ? "bg-green text-ink" : "bg-sand-deep text-ink"}`}>{done ? <Check className="h-4 w-4" aria-hidden="true" /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Onboarding() {
  const { profile, reload } = useMe();
  const [more, setMore] = useState(false);
  if (more) return <ProfileMore />;
  return <Quick onDone={async () => { await reload(); setMore(true); }} profileSeeking={profile?.seeking ?? []} />;
}

function Quick({ onDone, profileSeeking }: { onDone: () => Promise<void>; profileSeeking: string[] }) {
  const { profile } = useMe();
  const onlyFriends = !profile?.flags.dating && !profile?.flags.business && !profile?.flags.classifieds;
  const [areas, setAreas] = useState<string[]>(profile?.areas ?? []);
  const [picked, setPicked] = useState<string[]>(profileSeeking);
  const [city, setCity] = useState(profile?.city ?? "");
  const [district, setDistrict] = useState(profile?.district ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locNote, setLocNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const karlsruhe = /karlsruhe/i.test(city);

  function toggle(label: string) {
    setPicked((list) => (list.includes(label) ? list.filter((item) => item !== label) : [...list, label].slice(0, 12)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const chosen = onlyFriends ? ["friends"] : areas;
    if (!chosen.length) return setError(t("Wähl mindestens eins."));
    if (picked.length < NEEDED) return setError(t("Wähl noch {0} Interessen.", NEEDED - picked.length));
    if (!city.trim()) return setError(t("Sag uns noch, wo du bist."));
    setPending(true);
    try {
      await saveOnboarding({ data: { areas: chosen, seeking: picked, city, district, lat: coords?.lat, lng: coords?.lng } });
      buzz();
      await onDone();
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  function locate() {
    setError("");
    setLocNote("");
    if (!navigator.geolocation) return setError(t("Dein Browser gibt keinen Standort her. Schreib die Stadt von Hand."));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(next);
        try {
          const result = await setLocation({ data: next });
          if (result.city) setCity(result.city);
          setLocNote(result.city ? t("Standort: {0}", result.city) : t("Standort übernommen. Stadt kannst du noch eintragen."));
        } catch (err) {
          setLocNote(t("Standort übernommen."));
          setError(errText(err));
        }
      },
      () => setError(t("Standort nicht freigegeben. Schreib die Stadt von Hand.")),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="space-y-2 px-1">
        <Wordmark />
        <h1 className="font-display text-[2rem] leading-none">{t("In einer Minute startklar")}</h1>
        <p className="text-sm text-muted">{t("Foto, drei Interessen, dein Viertel. Alles andere später.")}</p>
      </section>
      {onlyFriends ? null : (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold">{t("Wofür bist du hier?")}</p>
          <AreaPicker selected={areas} onChange={setAreas} />
        </section>
      )}
      <Step n={1} title={t("Dein Foto")} done={Boolean(profile?.avatarUrl)}>
        <div className="flex items-center gap-3">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-control object-cover" /> : null}
          <AvatarUpload label={profile?.avatarUrl ? "Anderes Foto" : "Foto hochladen"} tone={profile?.avatarUrl ? "ghost" : "accent"} className="flex-1" />
        </div>
        <p className="text-xs text-muted">{t("Zum Anfragen brauchst du ein Foto. Du kannst es auch später hochladen.")}</p>
      </Step>
      <Step n={2} title={t("Drei Interessen")} done={picked.length >= NEEDED}>
        <div className="flex flex-wrap gap-1.5" data-interests>
          {QUICK_INTERESTS.map((label) => <ChipToggle key={label} data="interest" label={label} active={picked.includes(label)} onClick={() => toggle(label)} />)}
        </div>
        <p className="text-xs text-muted" aria-live="polite">{picked.length >= NEEDED ? t("Passt. Mehr geht später im Profil.") : t("{0} von {1} gewählt", picked.length, NEEDED)}</p>
      </Step>
      <Step n={3} title={t("Wo bist du?")} done={Boolean(city.trim())}>
        <Field label={t("Stadt")}>
          <PlaceSuggest
            value={city}
            onChange={(next) => { setCity(next); setCoords(null); }}
            onPick={(hit) => { setCity(hit.city); setCoords({ lat: hit.lat, lng: hit.lng }); }}
            placeholder={t("Postleitzahl, Stadt oder Dorf")}
          />
        </Field>
        <button type="button" className="inline-flex h-11 w-full items-center justify-center rounded-control border border-line bg-card text-sm font-semibold text-ink" onClick={locate}>{coords ? t("Standort übernommen") : t("Standort nutzen")}</button>
        {locNote ? <p className="text-sm text-muted">{locNote}</p> : null}
        <Field label={t("Stadtteil (optional)")}>
          <TextInput value={district} onChange={(event) => setDistrict(event.target.value)} list={karlsruhe ? "ka-districts" : undefined} placeholder={karlsruhe ? t("Zum Beispiel Südstadt") : t("Zum Beispiel Altstadt")} maxLength={40} />
        </Field>
        {karlsruhe ? <datalist id="ka-districts">{KA_DISTRICTS.map((name) => <option key={name} value={name} />)}</datalist> : null}
        <p className="text-xs text-muted">{t("Andere sehen nur Stadt und Stadtteil, nie deinen Standort.")}</p>
      </Step>
      {error ? <Note>{error}</Note> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? t("Speichern…") : t("Fertig")}</Button>
    </form>
  );
}

/** Optional second step. Skippable, and the same fields are in the profile. */
function ProfileMore() {
  const { profile, reload } = useMe();
  const navigate = useNavigate();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [seeking, setSeeking] = useState<string[]>(profile?.seeking ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function finish(skip: boolean) {
    setPending(true);
    setError("");
    try {
      await saveProfileMore({ data: skip ? { skip: true } : { bio, seeking, languages } });
      await reload();
      await navigate({ to: "/" });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  const toggle = (list: string[], set: (next: string[]) => void, label: string) => set(list.includes(label) ? list.filter((item) => item !== label) : [...list, label]);

  return (
    <div className="space-y-4">
      <section className="space-y-2 px-1">
        <p className="text-sm font-semibold text-friend">{t("Fertig. Du bist drin.")}</p>
        <h1 className="font-display text-[2rem] leading-none">{t("Profil vervollständigen?")}</h1>
        <p className="text-sm text-muted">{t("Freiwillig. Geht auch später im Profil.")}</p>
      </section>
      <section className="card space-y-3 p-4">
        <Field label={t("Kurz zu dir")}><TextArea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} placeholder={t("Zum Beispiel: Neu in der Südstadt, sonntags gern draußen.")} /></Field>
      </section>
      <section className="card space-y-2 p-4">
        <p className="text-sm font-semibold">{t("Mehr Interessen")}</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INTERESTS.map((label) => <ChipToggle key={label} label={label} active={seeking.includes(label)} onClick={() => toggle(seeking, setSeeking, label)} />)}
        </div>
      </section>
      <section className="card space-y-2 p-4">
        <p className="text-sm font-semibold">{t("Sprachen")}</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((label) => <ChipToggle key={label} label={label} active={languages.includes(label)} onClick={() => toggle(languages, setLanguages, label)} />)}
        </div>
      </section>
      {error ? <Note>{error}</Note> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" tone="ghost" disabled={pending} onClick={() => void finish(true)}>{t("Überspringen")}</Button>
        <Button type="button" disabled={pending} onClick={() => void finish(false)}>{t("Speichern")}</Button>
      </div>
    </div>
  );
}
