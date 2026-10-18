import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityCard, face, Button, Field, Note, TextInput } from "@/components/bits";
import { CategorySelect } from "@/components/categories";
import { Shell, useMe } from "@/components/shell";
import { getFeed, hideActivity, listCategories, suggestActivities, unhideActivity } from "@/lib/meeqo/api";
import { PlaceSuggest } from "@/components/place-bar";
import { errText, RADIUS_OPTIONS } from "@/lib/meeqo/labels";
import type { ActivityCard as Card } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/search")({ component: Page });

function Page() {
  return (
    <Shell>
      <Search />
    </Shell>
  );
}

function Search() {
  const { profile } = useMe();
  const [q, setQ] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("");
  const [radius, setRadius] = useState(profile?.radiusKm ?? 25);
  const [submitted, setSubmitted] = useState({ q: "", place: "", category: "", radius: profile?.radiusKm ?? 25 });
  const [ideas, setIdeas] = useState<{ source: string; reason: string; items: Card[] } | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [gone, setGone] = useState<{ id: string; title: string } | null>(null);
  const cats = useLoad(() => listCategories(), []);
  const { data, loading, error, reload } = useLoad(
    () => getFeed({ data: { q: submitted.q, city: submitted.place, category: submitted.category, radiusKm: submitted.radius } }),
    [submitted.q, submitted.place, submitted.category, submitted.radius],
  );

  async function suggest() {
    setAiPending(true);
    setAiError("");
    try {
      setIdeas(await suggestActivities({ data: { note: q, city: place } }));
    } catch (err) {
      setAiError(errText(err));
    } finally {
      setAiPending(false);
    }
  }

  async function hide(item: Card) {
    setAiError("");
    try {
      await hideActivity({ data: { id: item.id } });
      setGone({ id: item.id, title: item.title });
      setIdeas((current) => (current ? { ...current, items: current.items.filter((entry) => entry.id !== item.id) } : current));
      reload();
    } catch (err) {
      setAiError(errText(err));
    }
  }

  async function undoHide() {
    if (!gone) return;
    try {
      await unhideActivity({ data: { id: gone.id } });
      setGone(null);
      reload();
    } catch (err) {
      setAiError(errText(err));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Suche")}</h1>
      <p className="text-sm text-muted">{t("Bei dir oder in einer anderen Stadt. Es zählen nur Aktivitäten, die deine Absicht sehen darf.")}</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted({ q, place, category, radius });
        }}
      >
        <Field label={t("Wonach?")}>
          <TextInput value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("Klettern, Brunnen, Spaziergang")} />
        </Field>
        <Field label={t("Stadt")}>
          <PlaceSuggest
            value={place}
            onChange={setPlace}
            placeholder={profile?.city ? t("Bei dir in {0}, oder PLZ und Ort", profile.city) : t("Postleitzahl, Stadt oder Dorf")}
          />
        </Field>
        <button type="button" onClick={() => setPlace("")} className={`inline-flex h-10 items-center rounded-control border-2 px-3 text-sm font-semibold ${place === "" ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}>{t("Bei mir")}</button>
        <CategorySelect allowAll value={category} onChange={setCategory} custom={cats.data ?? []} />
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_OPTIONS.map((item) => (
            <button key={item} type="button" onClick={() => setRadius(item)} className={`inline-flex h-10 items-center rounded-control border-2 px-3 text-sm font-semibold ${radius === item ? "border-accent bg-accent text-onfill" : "border-ink/25 bg-card text-ink"}`}>{t("{0} km", item)}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="submit">{t("Suchen")}</Button>
          <Button type="button" tone="ghost" disabled={aiPending} onClick={suggest}>{aiPending ? t("Denkt nach…") : t("Vorschläge")}</Button>
        </div>
      </form>
      {error ? <Note>{error}</Note> : null}
      {aiError ? <Note>{aiError}</Note> : null}
      {gone ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">{t("„{0}“ bleibt ausgeblendet.", gone.title)}</p>
          <button type="button" className={face} onClick={undoHide}>{t("Rückgängig")}</button>
        </div>
      ) : null}
      {ideas ? (
        <div className="space-y-3">
          <p className="text-sm">{ideas.reason}</p>
          <p className="text-xs text-muted">{ideas.source === "ai" ? t("Vorschlag") : t("Aus deinem Profil, ohne KI")}</p>
          <div className="grid gap-4 md:grid-cols-2">{ideas.items.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hide(item)} />)}</div>
        </div>
      ) : null}
      {data?.around ? <p className="text-sm text-muted">{t("Umkreis um {0}, nicht nur um deinen Standort.", data.around)}</p> : null}
      {loading ? <p className="text-sm text-muted">{t("Suche…")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">{data?.items.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hide(item)} />)}</div>
    </div>
  );
}
