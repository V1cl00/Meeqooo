import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlaceBar } from "@/components/place-bar";
import { ActivityCard, Button, Empty, face, Note } from "@/components/bits";
import { ClassifiedBoard } from "@/components/classifieds";
import { Shell, useMe } from "@/components/shell";
import { WhenBar } from "@/components/when-bar";
import { hideActivity, makeWish, setRadius, setRequireTraits, unhideActivity, wishInfo } from "@/lib/meeqo/api";
import { TRAITS, berlinDay, errText, lensSubs } from "@/lib/meeqo/labels";
import type { ActivityCard as Card } from "@/lib/meeqo/types";
import { useLoad } from "@/lib/meeqo/use-load";
import { takeFeed } from "@/lib/meeqo/warm";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <Feed />
    </Shell>
  );
}

const LENS_WISH: Record<string, string> = { essen: "Essen", business: "Business", date: "Dating", friends: "Freunde" };

function WishPrompt({ category, day }: { category: string; day: string }) {
  const info = useLoad(() => wishInfo({ data: { category } }), [category]);
  const [fail, setFail] = useState("");

  async function wish() {
    setFail("");
    try {
      await makeWish({ data: { category, day } });
      info.reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  const count = info.data?.count ?? 0;
  const need = info.data?.atLeast ?? 3;
  return (
    <div className="mt-4 w-full basis-full space-y-2 border-t border-line pt-4 text-center">
      <p className="text-sm">Niemand bietet {category} an. Willst du?</p>
      {info.data?.mine ? (
        <p className="text-sm font-semibold text-friend">Du bist vorgemerkt. {count >= need ? `${count} Leute wollen das.` : `Ab ${need} Leuten sagen wir dir Bescheid.`}</p>
      ) : (
        <button type="button" className={face} onClick={wish}>Ich hätte Lust{count ? ` · ${count} schon` : ""}</button>
      )}
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}

function Feed() {
  const { profile, reload } = useMe();
  const [filter, setFilter] = useState("all");
  const [sub, setSub] = useState("");
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [locError, setLocError] = useState("");
  const [gone, setGone] = useState<{ id: string; title: string } | null>(null);
  const [days, setDays] = useState<string[]>(() => [berlinDay()]);
  const { data, error, loading, reload: reloadFeed } = useLoad(
    () => takeFeed(filter, sub, days),
    [filter, sub, days.join(","), profile?.radiusKm, profile?.lat, profile?.city, profile?.areas.join(","), profile?.openTo, profile?.requireTraits.join(",")],
  );

  async function hide(item: Card) {
    setLocError("");
    try {
      await hideActivity({ data: { id: item.id } });
      setGone({ id: item.id, title: item.title });
      reloadFeed();
    } catch (err) {
      setLocError(errText(err));
    }
  }

  async function undoHide() {
    if (!gone) return;
    try {
      await unhideActivity({ data: { id: gone.id } });
      setGone(null);
      reloadFeed();
    } catch (err) {
      setLocError(errText(err));
    }
  }

  const lenses = [
    ["all", "Alles"],
    ["date", "Dating"],
    ["friends", "Freunde"],
    ["essen", "Essen"],
    ["business", "Business"],
    ["classifieds", "Kleinanzeigen"],
    ["events", "Veranstaltungen"],
  ] as const;
  const subs = lensSubs(filter);

  const hosts = (data?.items ?? []).filter((item, index, list) => list.findIndex((other) => other.hostId === item.hostId) === index).slice(0, 12);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{profile?.city || "In der Nähe"}</p>
        <h1 className="font-display text-4xl leading-none">Treffen in der Nähe</h1>
      </div>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {lenses.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(id);
              setSub("");
            }}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${filter === id ? "border border-ink bg-card text-ink" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {subs.length ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" onClick={() => setSub("")} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${sub === "" ? "bg-ink text-onaccent" : "bg-card text-ink"}`}>Alle</button>
          {subs.map((item) => (
            <button key={item} type="button" onClick={() => setSub(item)} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${sub === item ? "bg-ink text-onaccent" : "bg-card text-ink"}`}>{item}</button>
          ))}
        </div>
      ) : null}
      {filter === "business" ? <Note>Business: Kontakte und Kooperationen. Kein Date, keine Absicht außer Arbeit.</Note> : null}
      {filter === "classifieds" ? <Note>Kleinanzeigen: Dinge und Angebote statt Verabredungen. Hier gibt es keine Zeit und keinen Treffpunkt.</Note> : null}
      {filter === "classifieds" ? null : <WhenBar days={days} onChange={setDays} />}
      {!profile?.avatarUrl ? (
        <Link to="/profile" className="card block p-4">
          <p className="font-semibold">Ohne Foto bist du ein Buchstabe.</p>
          <p className="mt-1 text-sm text-muted">Lad eins hoch, sonst kannst du nicht anfragen.</p>
        </Link>
      ) : null}
      {loading ? (
        <div className="space-y-4">
          <div className="card h-64 animate-pulse bg-sand-deep" />
          <div className="card h-64 animate-pulse bg-sand-deep" />
        </div>
      ) : null}
      {error ? <Note>{error}</Note> : null}
      {filter === "classifieds" ? <ClassifiedBoard city={profile?.city ?? ""} sub={sub} /> : (
      <div className="grid gap-4 md:grid-cols-2">
        {data?.items.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hide(item)} />)}
      </div>
      )}
      {filter !== "classifieds" && data && data.items.length === 0 ? (
        <Empty
          title={data.nextDay ? "An diesem Tag ist nichts" : "Hier ist gerade nichts"}
          body={data.nextDay ? `Am ${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(new Date(`${data.nextDay}T12:00:00`))} ${data.nextCount === 1 ? "ist ein Treffen" : `sind ${data.nextCount} Treffen`} in der Nähe.` : "Leg selbst etwas an, oder schau einen anderen Tag."}
          action={
            <span className="inline-flex flex-wrap justify-center gap-2">
              {data.nextDay ? <button type="button" className={face} onClick={() => setDays([data.nextDay!])}>Diesen Tag zeigen</button> : null}
              <Link to="/create" search={{ community: "" }} className={face}>Selbst anlegen</Link>
              {!data.nextDay ? <WishPrompt category={sub || LENS_WISH[filter] || "Treffen"} day={days[0] ?? ""} /> : null}
            </span>
          }
        />
      ) : null}
      {hosts.length ? (
        <div>
          <h2 className="text-base font-semibold">Wer einlädt</h2>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4">
            {hosts.map((item) => (
              <Link key={item.hostId} to="/activity/$id" params={{ id: item.id }} className="w-16 shrink-0 text-center">
                {item.hostAvatar ? (
                  <img src={item.hostAvatar} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-card font-display text-xl">{item.hostName.slice(0, 1)}</span>
                )}
                <span className="mt-1 block truncate text-xs font-semibold">{item.hostName.split(" ")[0]}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <PlaceBar onChange={reloadFeed} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/search" className={face}>Suche</Link>
        <button type="button" className={face} onClick={() => setTraitsOpen((value) => !value)}>Mindestens</button>
      </div>
      {traitsOpen ? (
        <div className="card space-y-2 p-3">
          <p className="text-sm text-muted">Ohne diese Eigenschaft bleibt es unsichtbar. Gilt für Feed, Suche, Communities und Anzeigen.</p>
          <div className="flex flex-wrap gap-2">
            {TRAITS.map((trait) => {
              const on = profile?.requireTraits.includes(trait) ?? false;
              return (
                <button
                  key={trait}
                  type="button"
                  className={`inline-flex h-10 items-center rounded-full border-2 px-3 text-sm font-semibold ${on ? "border-accent bg-accent text-onaccent" : "border-line bg-card text-ink"}`}
                  onClick={async () => {
                    const next = on ? (profile?.requireTraits ?? []).filter((item) => item !== trait) : [...(profile?.requireTraits ?? []), trait];
                    await setRequireTraits({ data: { traits: next } });
                    await reload();
                    reloadFeed();
                  }}
                >
                  {trait}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {locError ? <Note>{locError}</Note> : null}
      {gone ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">„{gone.title}“ bleibt ausgeblendet.</p>
          <button type="button" className={face} onClick={undoHide}>Rückgängig</button>
        </div>
      ) : null}
      {!profile?.lat ? <Note>Ohne Standort zeige ich dir alles, was zu deiner Absicht passt. Mit Standort gilt der Radius.</Note> : null}
      {data && data.missed > 0 ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">{data.missed} {data.missed === 1 ? "Aktivität liegt" : "Aktivitäten liegen"} etwas weiter weg.</p>
          <Button
            type="button"
            tone="ghost"
            className="h-10"
            onClick={async () => {
              await setRadius({ data: { radiusKm: Math.min(100, (profile?.radiusKm ?? 25) * 2 >= 60 ? 100 : 60) } });
              await reload();
              reloadFeed();
            }}
          >
            Weiter fassen
          </Button>
        </div>
      ) : null}
      {data?.againTitle ? (
        <Note>Letzte Woche: {data.againTitle}. Diese Woche ist wieder etwas frei, oder du legst selbst eines an.</Note>
      ) : null}
    </div>
  );
}
