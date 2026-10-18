import { useState } from "react";
import { BadgeCheck, MoreHorizontal, Star } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { STYLE_COLORS } from "@/components/page-style";
import { BadgeRow, Button, Note } from "@/components/bits";
import { ActivityCard } from "@/components/bits";
import { PostBoard } from "@/components/posts";
import { SafetyMenu } from "@/components/safety";
import { Shell, useMe } from "@/components/shell";
import { adminStatus, getPublicProfile, setVerified, listPersonActivity, removeFriend, requestFriend, respondFriend, toggleFavorite } from "@/lib/meeqo/api";
import { areaSummary, errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/profile/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <Shell>
      <Person id={id} />
    </Shell>
  );
}

function Person({ id }: { id: string }) {
  const { profile } = useMe();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => getPublicProfile({ data: { id } }), [id]);
  const admin = useLoad(() => adminStatus(), []);
  const doing = useLoad(() => listPersonActivity({ data: { id } }), [id]);
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [safety, setSafety] = useState(false);
  if (profile?.userId === id) {
    return (
      <Note>{t("Das bist du.")}{" "}<Link to="/profile" className="font-semibold">{t("Zum eigenen Profil")}</Link>
      </Note>
    );
  }
  if (loading) return <p className="text-sm text-muted">{t("Wird geladen…")}</p>;
  if (error || !data) return <Note>{error || t("Nicht gefunden.")}</Note>;

  async function befriend() {
    setBusy(true);
    setFail("");
    try {
      if (data?.friend === "friends") await removeFriend({ data: { userId: id } });
      else if (data?.friend === "in") await respondFriend({ data: { userId: id, accept: true } });
      else if (data?.friend === "none") await requestFriend({ data: { userId: id } });
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function star() {
    setBusy(true);
    setFail("");
    try {
      await toggleFavorite({ data: { userId: id } });
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const label = data.friend === "friends" ? t("Freundschaft lösen") : data.friend === "out" ? "Angefragt" : data.friend === "in" ? "Annehmen" : "Befreunden";

  const style = STYLE_COLORS[data.pageStyle] ?? STYLE_COLORS[""];
  const verified = data.verified || data.badges.includes(t("Verifiziert"));
  const otherBadges = data.badges.filter((badge) => badge !== t("Verifiziert"));
  const place = [data.district, data.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="relative rounded-card px-5 pb-5 pt-6 text-center" style={{ background: style.bg, color: style.fg }} data-testid="profile-head">
        <div className="absolute right-2 top-2">
          <button type="button" aria-label={t("Mehr")} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="grid h-11 w-11 place-items-center rounded-full text-current hover:bg-black/5">
            <MoreHorizontal className="h-6 w-6" aria-hidden="true" />
          </button>
          {menu ? (
            <div role="menu" className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-control border border-line bg-card text-left text-ink shadow-lg">
              <button type="button" role="menuitem" className="block w-full px-4 py-3 text-sm font-semibold" onClick={() => { setMenu(false); setSafety(true); }}>{t("Melden oder blockieren")}</button>
              {admin.data?.admin ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full border-t border-line px-4 py-3 text-sm font-semibold"
                  onClick={async () => {
                    setMenu(false);
                    await setVerified({ data: { userId: data.userId, value: !verified } });
                    reload();
                  }}
                >{verified ? t("Admin: Bestätigung aufheben") : t("Admin: als bestätigt markieren")}</button>
              ) : null}
            </div>
          ) : null}
        </div>
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="mx-auto h-[104px] w-[104px] rounded-full border-4 border-card object-cover shadow" />
        ) : (
          <span className="mx-auto grid h-[104px] w-[104px] place-items-center rounded-full border-4 border-card bg-sand-deep font-display text-5xl text-ink shadow">{data.displayName.slice(0, 1)}</span>
        )}
        <h1 className="mt-3 inline-flex items-center justify-center gap-1.5 font-display text-4xl leading-none">
          {data.displayName}
          {verified ? <BadgeCheck className="h-6 w-6 shrink-0" aria-label={t("Verifiziert")} /> : null}
        </h1>
        {place ? <p className="mt-1.5 text-sm opacity-80">{place}</p> : null}
        {data.areas.length ? <p className="text-xs opacity-70">{areaSummary(data.areas)}</p> : null}
      </div>
      {data.bio ? <p className="text-[15px] leading-relaxed">{data.bio}</p> : null}
      {data.interests.length ? (
        <div className="flex flex-wrap gap-1.5">
          {data.interests.map((item) => <span key={item} className="rounded-full bg-sand-deep px-3 py-1.5 text-xs font-semibold">{t(item)}</span>)}
        </div>
      ) : null}
      {otherBadges.length ? <BadgeRow badges={otherBadges} /> : null}
      <div className="flex gap-2">
        <Button type="button" tone={data.friend === "friends" ? "ghost" : "accent"} className="flex-1" disabled={busy || data.friend === "out"} onClick={befriend}>{t(label)}</Button>
        <Button type="button" tone="ghost" className="flex-1 gap-2" disabled={busy} aria-pressed={data.favorite} onClick={star}>
          <Star className={`h-4 w-4 ${data.favorite ? "fill-current" : ""}`} aria-hidden="true" />
          {data.favorite ? t("Favorit lösen") : t("Favorit")}
        </Button>
      </div>
      {data.friend === "friends" ? <Link to="/freunde/$id" params={{ id }} className="flex h-12 items-center justify-center rounded-control bg-ink px-5 text-sm font-semibold text-onaccent">{t("Privat schreiben")}</Link> : null}
      <Link to="/friends" className="inline-block text-sm font-semibold text-ink underline decoration-line underline-offset-4">{t("Was Freunde machen")} →</Link>
      {fail ? <Note>{fail}</Note> : null}
      <SafetyMenu kind="person" targetId={data.userId} personId={data.userId} personName={data.displayName.split(" ")[0]} onBlocked={() => navigate({ to: "/" })} hideTrigger open={safety} onOpenChange={setSafety} />
      <section className="space-y-3">
        <h2 className="font-display text-2xl">{t("Was gerade ansteht")}</h2>
        <p className="text-sm text-muted">{t("Nur das, was diese Person für dich freigegeben hat.")}</p>
        {(doing.data ?? []).map((item) => <ActivityCard key={item.id} item={item} />)}
        {!doing.loading && (doing.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("Nichts, das du sehen darfst.")}</p> : null}
      </section>
      <PostBoard userId={data.userId} canPost={false} />
    </div>
  );
}
