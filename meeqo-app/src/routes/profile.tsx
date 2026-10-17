import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { BadgeRow, Button, Field, Note, TextArea, TextInput } from "@/components/bits";
import { SeekingPicker } from "@/components/categories";
import { PostBoard } from "@/components/posts";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { Shell, useMe } from "@/components/shell";
import { listCategories, setAvatar, updateProfile } from "@/lib/meeqo/api";
import { AreaPicker } from "@/components/areas";
import { areaSummary, errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
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
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <label className="relative shrink-0">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-sand-deep font-display text-3xl">{profile.displayName.slice(0, 1)}</span>}
            <input
              type="file"
              accept="image/*"
              aria-label={t("Profilfoto wählen")}
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const image = new Image();
                const url = URL.createObjectURL(file);
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  image.onload = () => {
                    const scale = Math.min(1, 640 / Math.max(image.width, image.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(image.width * scale);
                    canvas.height = Math.round(image.height * scale);
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                      reject(new Error(t("Bild konnte nicht gelesen werden.")));
                      return;
                    }
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    resolve(canvas.toDataURL("image/jpeg", 0.72));
                  };
                  image.onerror = () => reject(new Error(t("Bild konnte nicht gelesen werden.")));
                  image.src = url;
                });
                await setAvatar({ data: { imageUrl: dataUrl } });
                await reload();
              }}
            />
          </label>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl leading-none">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-muted">{profile.city || t("Ohne Stadt")} · {areaSummary(profile.areas)}</p>
            <p className="mt-2 text-xs font-semibold text-accent-deep">{t("Foto antippen zum Wechseln")}</p>
          </div>
          <UserButton />
        </div>
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
        <TraitPicker label={t("Das trifft auf mich zu")} hint={t("Andere können danach filtern. Queer und vegan sind Eigenschaften, keine Kategorien.")} selected={traits} onChange={setTraits} />
        <TraitPicker label={t("Mindestens vorhanden")} hint={t("Feed, Suche, Communities und Anzeigen ohne diese Eigenschaft siehst du nicht.")} selected={requireTraits} onChange={setRequireTraits} />
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
