import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Camera, ChevronRight, Users } from "lucide-react";
import { BadgeRow, Button, Field, Note, TextArea, TextInput } from "@/components/bits";
import { SeekingPicker } from "@/components/categories";
import { PostBoard } from "@/components/posts";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { Shell, useMe } from "@/components/shell";
import { friendOverview, listCategories, setAvatar, updateProfile } from "@/lib/meeqo/api";
import { AreaPicker } from "@/components/areas";
import { areaSummary, errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { compress } from "@/lib/meeqo/image";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/profile")({ component: Page });

function Page() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path !== "/profile") return <Outlet />;
  return (
    <Shell>
      <ProfilePage />
    </Shell>
  );
}

const LINKS = [
  ["/my-activities", "Meine Aktivitäten"],
  ["/friends", "Freunde"],
  ["/requests", "Anfragen"],
  ["/communities", "Communities"],
  ["/organizer", "Veranstalter"],
  ["/categories", "Kategorien"],
  ["/calendar", "Kalender"],
  ["/settings", "Einstellungen"],
  ["/support", "Hilfe"],
] as const;

function ProfilePage() {
  const { profile, reload } = useMe();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [areas, setAreas] = useState<string[]>(profile?.areas ?? []);
  const [seeking, setSeeking] = useState<string[]>(profile?.seeking ?? []);
  const [traits, setTraits] = useState<string[]>(profile?.traits ?? []);
  const [requireTraits, setRequireTraits] = useState<string[]>(profile?.requireTraits ?? []);
  const [city, setCity] = useState(profile?.city ?? "");
  const [year, setYear] = useState(profile?.birthYear ? String(profile.birthYear) : "");
  const [see, setSee] = useState<string>(profile?.defaultVisibility ?? "all");
  const [audienceIds, setAudienceIds] = useState<string[]>(profile?.audienceIds ?? []);
  const [trusted, setTrusted] = useState(profile?.trustedLabel ?? "");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const cats = useLoad(() => listCategories(), []);
  const friends = useLoad(() => friendOverview(), []);
  if (!profile) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await updateProfile({ data: { displayName: name, bio, areas, seeking, traits, requireTraits, city, trustedLabel: trusted, birthYear: year ? Number(year) : 0, defaultVisibility: see, audienceIds } });
      await reload();
      setInfo("Gespeichert.");
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <label className="relative shrink-0 cursor-pointer">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-2xl object-cover" /> : <span className="grid h-24 w-24 place-items-center rounded-2xl bg-sand-deep font-display text-4xl">{profile.displayName.slice(0, 1)}</span>}
            <span className="absolute -bottom-1.5 -right-1.5 grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-accent text-onfill shadow" aria-hidden="true">
              <Camera className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept="image/*"
              aria-label={t("Profilfoto wählen")}
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const dataUrl = await compress(file, 640);
                await setAvatar({ data: { imageUrl: dataUrl } });
                await reload();
              }}
            />
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-3xl leading-tight">{profile.displayName}</h1>
            {profile.city ? <p className="mt-1 text-sm text-muted">{profile.city}</p> : null}
            {profile.areas.length ? <p className="text-sm text-muted">{areaSummary(profile.areas)}</p> : null}
          </div>
        </div>
        <p className="text-xs text-muted">{t("Foto antippen zum Wechseln")}</p>
        <Link to="/friends" className="flex items-center gap-3 rounded-control border border-line bg-sand px-3 py-2.5">
          <span className="flex -space-x-2">
            {(friends.data?.friends ?? []).slice(0, 4).map((person) => (
              <span key={person.userId} className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-sand-deep text-xs font-semibold text-ink">{person.displayName.slice(0, 1)}</span>
            ))}
            {(friends.data?.friends.length ?? 0) === 0 ? <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-sand-deep text-ink"><Users className="h-4 w-4" aria-hidden="true" /></span> : null}
          </span>
          <span className="flex-1 text-sm font-semibold text-ink">{(friends.data?.friends.length ?? 0) === 1 ? t("1 Freund") : t("{0} Freunde", friends.data?.friends.length ?? 0)}</span>
          <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
        </Link>
      </div>
      <BadgeRow badges={profile.badges} />
      <PostBoard userId={profile.userId} canPost />
      <form onSubmit={save} className="space-y-4">
        <div className="card space-y-3 p-4">
          <Field label={t("Name")}><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label={t("Kurz zu dir")}><TextArea value={bio} onChange={(event) => setBio(event.target.value)} /></Field>
        </div>
        <div className="card space-y-2 p-4">
          <p className="text-sm font-semibold">{t("Wofür du hier bist")}</p>
          <p className="text-sm text-muted">{t("Mehrere gehen. Der Feed richtet sich danach.")}</p>
          <AreaPicker selected={areas} onChange={setAreas} />
        </div>
        <div className="card space-y-2 p-4">
          <p className="text-sm font-semibold">{t("Ich suche aktiv neue Leute für")}</p>
          <SeekingPicker selected={seeking} onChange={setSeeking} custom={cats.data ?? []} />
        </div>
        <TraitPicker label={t("Das trifft auf mich zu")} hint={t("Andere können danach filtern. Queer und vegan sind Eigenschaften, keine Kategorien.")} selected={traits} onChange={setTraits} personal />
        <TraitPicker label={t("Mindestens vorhanden")} hint={t("Feed, Suche, Communities und Anzeigen ohne diese Eigenschaft siehst du nicht.")} selected={requireTraits} onChange={setRequireTraits} personal />
        <div className="card space-y-3 p-4">
          <VisibilityPicker value={see} onChange={setSee} communityIds={audienceIds} onCommunityIds={setAudienceIds} />
          <p className="text-sm text-muted">{t("Das ist die Vorgabe für neue Beiträge, Treffen und Anzeigen. Jedes einzelne kannst du noch anders stellen.")}</p>
        </div>
        <div className="card space-y-3 p-4">
          <Field label={t("Stadt")}><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
          <Field label={t("Geburtsjahr")}>
            <TextInput inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="1994" />
          </Field>
          <p className="text-sm text-muted">{t("Nur für „Mein Alter“. Das Jahr selbst ist nicht öffentlich.")}</p>
          <Field label={t("Vertrauensperson, nur ein Name")}>
            <TextInput value={trusted} onChange={(event) => setTrusted(event.target.value)} placeholder={t("Zum Beispiel Sam")} />
          </Field>
        </div>
        {error ? <Note>{error}</Note> : null}
        {info ? <p className="text-sm text-friend">{info}</p> : null}
        <Button type="submit" className="w-full">{t("Absicht speichern")}</Button>
      </form>
      <div className="card space-y-2 p-4">
        <h2 className="font-display text-2xl">{t("Vertrauen")}</h2>
        <p className="text-sm text-muted">{t("Bewertungen kommen erst nach einem echten Check-in. „Profil bestätigt“ setzt MeeQo selbst nach einer Prüfung, du kannst es nicht anklicken.")}</p>
        {profile.identityConfirmed ? <p className="text-sm font-semibold">{t("Profil bestätigt")}</p> : null}
      </div>
      <div className="grid gap-2">
        {LINKS.map(([to, label]) => (
          <Link key={to} to={to} className="card flex h-14 items-center px-4 font-medium">{t(label)}</Link>
        ))}
      </div>
    </div>
  );
}
