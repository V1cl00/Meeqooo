import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { NextUpCard } from "@/components/next-up";
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
import { locale, t } from "@/lib/meeqo/i18n";

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
    <div className="space-y-3">
      {info.data?.mine ? (
        <p className="text-sm font-semibold text-friend">{t("Du bist vorgemerkt. {0}", count >= need ? t("{0} Leute wollen {1}.", count, category) : t("Sobald {0} Leute {1} wollen, sagen wir dir Bescheid.", need, category))}
        </p>
      ) : (
        <Button type="button" className="w-full" onClick={wish}>{t("Ich hätte Lust auf {0}{1}", category, count ? t(" · {0} schon", count) : "")}
        </Button>
      )}
      <Link to="/create" search={{ community: "" }} className={`${face} w-full`}>{t("Selbst anlegen")}</Link>
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
  const [soon, setSoon] = useState(false);
  const [sort, setSort] = useState<"time" | "fit">(() => {
    try {
      return window.localStorage.getItem("meeqo-sort") === "fit" ? "fit" : "time";
    } catch {
      return "time";
    }
  });
  function chooseSort(next: "time" | "fit") {
    setSort(next);
    try {
      window.localStorage.setItem("meeqo-sort", next);
    } catch {
      /* the choice just does not persist */
    }
  }
  const viewKey = `${filter}|${sub}|${days.join(",")}|${soon}|${sort}`;
  const [more, setMore] = useState({ key: "", limit: 30 });
  const limit = more.key === viewKey ? more.limit : 30;
  const { data, error, loading, reload: reloadFeed } = useLoad(
    () => takeFeed(filter, sub, days, limit, soon, sort),
    [filter, sub, days.join(","), limit, soon, sort, profile?.radiusKm, profile?.lat, profile?.city, profile?.areas.join(","), profile?.openTo, profile?.requireTraits.join(",")],
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
      <NextUpCard />
      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-none">{t("Treffen in der Nähe")}</h1>
        <PlaceBar onChange={reloadFeed} />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {lenses.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(id);
              setSub("");
            }}
            className={`inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${filter === id ? "bg-ink text-onaccent" : "border border-line bg-card text-ink"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {subs.length ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" onClick={() => setSub("")} className={`inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${sub === "" ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}>{t("Alle")}</button>
          {subs.map((item) => (
            <button key={item} type="button" onClick={() => setSub(item)} className={`inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${sub === item ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}>{item}</button>
          ))}
        </div>
      ) : null}
      {filter === "business" ? <p className="text-sm text-muted">{t("Business: Kontakte und Kooperationen. Kein Date.")}</p> : null}
      {filter === "classifieds" ? <p className="text-sm text-muted">{t("Kleinanzeigen: Dinge und Angebote statt Verabredungen.")}</p> : null}
      {filter === "classifieds" ? null : (
        <div className="space-y-3">
          <button
            type="button"
            aria-pressed={soon}
            onClick={() => setSoon((value) => !value)}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${soon ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}
          >{t("Gleich in der Nähe")}</button>
          {soon ? <p className="text-sm text-muted">{t("Was in den nächsten vier Stunden anfängt, das Nächstgelegene zuerst.")}</p> : <WhenBar days={days} onChange={setDays} />}
          {soon ? null : (
            <div className="flex items-center gap-2" role="group" aria-label={t("Sortierung")}>
              {([["time", "Nach Zeit"], ["fit", "Passend für dich"]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={sort === id} onClick={() => chooseSort(id)} className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ${sort === id ? "bg-ink text-onaccent" : "border border-line bg-card text-ink"}`}>{t(label)}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {!profile?.avatarUrl ? (
        <Link to="/profile" className="flex items-center justify-between gap-3 rounded-2xl bg-sand-deep px-4 py-3 text-sm">
          <span>{t("Mit Foto kannst du anfragen und Treffen anlegen.")}</span>
          <span className="shrink-0 font-semibold underline">{t("Foto hinzufügen")}</span>
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
        {data?.items.map((item) => <ActivityCard key={item.id} item={item} onHide={() => hide(item)} onChanged={reloadFeed} />)}
      </div>
      )}
      {filter !== "classifieds" && data && data.total > data.items.length ? (
        <Button type="button" tone="ghost" className="w-full" onClick={() => setMore({ key: viewKey, limit: limit + 30 })}>{t("Mehr zeigen · noch {0}", data.total - data.items.length)}
        </Button>
      ) : null}
      {filter !== "classifieds" && data && data.items.length === 0 ? (
        soon ? (
          <Empty
            art="calendar"
            title={t("Gleich ist nichts in der Nähe")}
            body={t("In den nächsten vier Stunden fängt nichts an. Schau, was heute oder morgen kommt.")}
            action={<Button type="button" className="w-full" onClick={() => setSoon(false)}>{t("Alle Treffen zeigen")}</Button>}
          />
        ) : data.nextDay ? (
          <Empty
            art="calendar"
            title={t("An diesem Tag ist nichts")}
            body={t("Am {0} {1} in der Nähe.", new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(new Date(`${data.nextDay}T12:00:00`)), data.nextCount === 1 ? t("ist ein Treffen") : t("sind {0} Treffen", data.nextCount))}
            action={
              <span className="flex flex-col gap-2">
                <Button type="button" className="w-full" onClick={() => setDays([data.nextDay!])}>{t("Diesen Tag zeigen")}</Button>
                <Link to="/create" search={{ community: "" }} className={`${face} w-full`}>{t("Selbst anlegen")}</Link>
              </span>
            }
          />
        ) : (
          <Empty
            art="meet"
            title={t("Das ändern wir")}
            body={t("Gerade bietet niemand {0} an. Sag, dass du Lust hast. Wenn genug Leute dasselbe wollen, melden wir uns, und du kannst es anlegen.", t(sub || LENS_WISH[filter] || "etwas"))}
            action={<WishPrompt category={sub || LENS_WISH[filter] || "Treffen"} day={days[0] ?? ""} />}
          />
        )
      ) : null}
      {hosts.length ? (
        <div>
          <h2 className="text-base font-semibold">{t("Wer einlädt")}</h2>
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/search" className={face}>{t("Suche")}</Link>
        <button type="button" className={face} onClick={() => setTraitsOpen((value) => !value)}>{t("Mindestens")}</button>
      </div>
      {traitsOpen ? (
        <div className="card space-y-2 p-3">
          <p className="text-sm text-muted">{t("Ohne diese Eigenschaft bleibt es unsichtbar. Gilt für Feed, Suche, Communities und Anzeigen.")}</p>
          <div className="flex flex-wrap gap-2">
            {TRAITS.map((trait) => {
              const on = profile?.requireTraits.includes(trait) ?? false;
              return (
                <button
                  key={trait}
                  type="button"
                  className={`inline-flex h-11 items-center rounded-full border-2 px-3 text-sm font-semibold ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}
                  onClick={async () => {
                    const next = on ? (profile?.requireTraits ?? []).filter((item) => item !== trait) : [...(profile?.requireTraits ?? []), trait];
                    await setRequireTraits({ data: { traits: next } });
                    await reload();
                    reloadFeed();
                  }}
                >
                  {t(trait)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {locError ? <Note>{locError}</Note> : null}
      {gone ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">{t("„{0}“ bleibt ausgeblendet.", gone.title)}</p>
          <button type="button" className={face} onClick={undoHide}>{t("Rückgängig")}</button>
        </div>
      ) : null}
      {!profile?.lat ? <Note>{t("Ohne Standort zeige ich dir alles, was zu deiner Absicht passt. Mit Standort gilt der Radius.")}</Note> : null}
      {data && data.missed > 0 ? (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="text-sm">{t("{0} {1} etwas weiter weg.", data.missed, data.missed === 1 ? t("Aktivität liegt") : t("Aktivitäten liegen"))}</p>
          <Button
            type="button"
            tone="ghost"
            className="h-11"
            onClick={async () => {
              await setRadius({ data: { radiusKm: Math.min(100, (profile?.radiusKm ?? 25) * 2 >= 60 ? 100 : 60) } });
              await reload();
              reloadFeed();
            }}
          >{t("Weiter fassen")}</Button>
        </div>
      ) : null}
      {data?.againTitle ? (
        <Note>{t("Letzte Woche: {0}. Diese Woche ist wieder etwas frei, oder du legst selbst eines an.", data.againTitle)}</Note>
      ) : null}
    </div>
  );
}
