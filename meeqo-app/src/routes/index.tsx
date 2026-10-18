import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { NextUpCard } from "@/components/next-up";
import { PlaceBar } from "@/components/place-bar";
import { ActivityCard, Button, Empty, face, Note } from "@/components/bits";
import { ClassifiedBoard } from "@/components/classifieds";
import { Shell, useMe } from "@/components/shell";
import { AvatarUpload } from "@/components/photo";
import { WhenBar } from "@/components/when-bar";
import { NOW_HOURS, NOW_KM, NOW_WIDE_KM } from "@/lib/meeqo/now-here";
import { activeFilterCount, FilterBar, FilterSheet, LoosenCard } from "@/components/feed-filters";
import { hideActivity, makeWish, setRadius, unhideActivity, wishInfo } from "@/lib/meeqo/api";
import { berlinDay, errText, lensSubs } from "@/lib/meeqo/labels";
import type { ActivityCard as Card } from "@/lib/meeqo/types";
import { RegionNote } from "@/components/region-note";
import { WeekCard } from "@/components/week-card";
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
  const [soonKm, setSoonKm] = useState(NOW_KM);
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
  const viewKey = `${filter}|${sub}|${days.join(",")}|${soon}|${soonKm}|${sort}`;
  const [more, setMore] = useState({ key: "", limit: 30 });
  const limit = more.key === viewKey ? more.limit : 30;
  const { data, error, loading, reload: reloadFeed } = useLoad(
    () => takeFeed(filter, sub, days, limit, soon, sort, soonKm),
    [filter, sub, days.join(","), limit, soon, soonKm, sort, profile?.radiusKm, profile?.lat, profile?.city, profile?.areas.join(","), profile?.openTo, profile?.requireTraits.join(",")],
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

  const on = profile?.flags;
  const lenses = ([
    ["all", "Alles"],
    ["date", "Dating"],
    ["friends", "Freunde"],
    ["essen", "Essen"],
    ["business", "Business"],
    ["classifieds", "Kleinanzeigen"],
    ["events", "Veranstaltungen"],
  ] as const).filter(([id]) => id === "date" ? on?.dating : id === "business" ? on?.business : id === "classifieds" ? on?.classifieds : true);
  const subs = lensSubs(filter);

  const hasOrigin = profile?.lat != null;
  const nowLine = hasOrigin ? t("Nächste {0} Std · bis {1} km", NOW_HOURS, soon ? soonKm : NOW_KM) : t("Nächste {0} Std", NOW_HOURS);
  const filterCount = activeFilterCount(profile?.requireTraits, profile?.lat != null ? profile?.radiusKm : undefined);
  const hosts = (data?.items ?? []).filter((item, index, list) => list.findIndex((other) => other.hostId === item.hostId) === index).slice(0, 12);

  return (
    <div className="space-y-5">
      <RegionNote />
      <NextUpCard />
      <WeekCard nearby={(data?.items ?? []).filter((item) => !item.isHost && !item.myStatus && !item.cancelled && new Date(item.startsAt).getTime() < Date.now() + 7 * 86_400_000).length} />
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
            className={`inline-flex h-10 shrink-0 items-center rounded-control px-3 text-sm font-semibold ${filter === id ? "bg-ink text-onaccent" : "border border-line bg-card text-ink"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {subs.length ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <button type="button" onClick={() => setSub("")} className={`inline-flex h-10 shrink-0 items-center rounded-control px-3 text-sm font-semibold ${sub === "" ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}>{t("Alle")}</button>
          {subs.map((item) => (
            <button key={item} type="button" onClick={() => setSub(item)} className={`inline-flex h-10 shrink-0 items-center rounded-control px-3 text-sm font-semibold ${sub === item ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}>{item}</button>
          ))}
        </div>
      ) : null}
      <FilterBar count={filterCount} onOpen={() => setTraitsOpen(true)} />
      {filter === "business" ? <p className="text-sm text-muted">{t("Business: Kontakte und Kooperationen. Kein Date.")}</p> : null}
      {filter === "classifieds" ? <p className="text-sm text-muted">{t("Kleinanzeigen: Dinge und Angebote statt Verabredungen.")}</p> : null}
      {filter === "classifieds" ? null : (
        <div className="space-y-3">
          <button
            type="button"
            aria-pressed={soon}
            onClick={() => { setSoon((value) => !value); setSoonKm(NOW_KM); }}
            className={`inline-flex min-h-10 flex-col items-start justify-center rounded-control px-3.5 py-1 text-left ${soon ? "bg-accent text-onfill" : "border border-line bg-card text-ink"}`}
          >
            <span className="text-sm font-semibold leading-tight">{t("Jetzt & hier")}</span>
            <span className={`text-[11px] leading-tight ${soon ? "" : "text-muted"}`}>{nowLine}</span>
          </button>
          {soon ? <p className="text-sm text-muted">{t("In den nächsten Stunden, nur ein paar Meter weg. Läuft schon und hat noch Platz zählt auch.")}</p> : <WhenBar days={days} onChange={setDays} />}
          {soon ? null : (
            <div className="flex items-center gap-2" role="group" aria-label={t("Sortierung")}>
              {([["time", "Nach Zeit"], ["fit", "Passend für dich"]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={sort === id} onClick={() => chooseSort(id)} className={`inline-flex h-10 items-center rounded-control px-3.5 text-sm font-semibold ${sort === id ? "bg-ink text-onaccent" : "border border-line bg-card text-ink"}`}>{t(label)}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {!profile?.avatarUrl ? (
        <div className="space-y-2 rounded-2xl bg-sand-deep px-4 py-3 text-sm">
          <p>{t("Mit Foto kannst du anfragen und Treffen anlegen.")}</p>
          <AvatarUpload />
        </div>
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
      {filter !== "classifieds" && data && data.items.length < 3 ? <LoosenCard hidden={data.hiddenByTraits ?? 0} onChanged={reloadFeed} /> : null}
      {filter !== "classifieds" && data && data.total > data.items.length ? (
        <Button type="button" tone="ghost" className="w-full" onClick={() => setMore({ key: viewKey, limit: limit + 30 })}>{t("Mehr zeigen · noch {0}", data.total - data.items.length)}
        </Button>
      ) : null}
      {filter !== "classifieds" && data && data.items.length === 0 ? (
        soon ? (
          <Empty
            art="calendar"
            title={t("Jetzt & hier ist gerade nichts")}
            body={hasOrigin ? t("In den nächsten {0} Stunden fängt im Umkreis von {1} km nichts an.", NOW_HOURS, soonKm) : t("In den nächsten {0} Stunden fängt nichts an.", NOW_HOURS)}
            action={
              <span className="flex flex-col gap-2">
                {hasOrigin && soonKm < NOW_WIDE_KM ? <Button type="button" className="w-full" onClick={() => setSoonKm(NOW_WIDE_KM)}>{t("Auf {0} km erweitern", NOW_WIDE_KM)}</Button> : null}
                <Button type="button" tone="ghost" className="w-full" onClick={() => { setSoon(false); setDays([berlinDay()]); }}>{t("Alles von heute zeigen")}</Button>
              </span>
            }
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
          <h2 className="text-sm font-semibold text-muted">{t("Wer einlädt")}</h2>
          <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
            {hosts.map((item) => (
              <Link key={item.hostId} to="/activity/$id" params={{ id: item.id }} className="w-14 shrink-0 text-center">
                {item.hostAvatar ? (
                  <img src={item.hostAvatar} alt="" className="mx-auto h-11 w-11 rounded-full border border-line object-cover" />
                ) : (
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-base font-semibold text-muted">{item.hostName.slice(0, 1)}</span>
                )}
                <span className="mt-1 block truncate text-[11px] font-medium text-muted">{item.hostName.split(" ")[0]}</span>
              </Link>
            ))}
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
      <FilterSheet open={traitsOpen} onClose={() => setTraitsOpen(false)} onApplied={reloadFeed} shown={data?.total} hidden={data?.hiddenByTraits} />
    </div>
  );
}
