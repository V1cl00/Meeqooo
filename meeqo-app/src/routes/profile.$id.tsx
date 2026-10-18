import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="font-display text-4xl leading-none">{data.displayName}</h1>
        <p className="mt-2 text-sm text-muted">{areaSummary(data.areas)}{data.city ? ` · ${data.city}` : ""}</p>
      </div>
      <BadgeRow badges={data.badges} />
      {data.bio ? <p className="text-sm">{data.bio}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" tone={data.friend === "friends" ? "ghost" : "accent"} disabled={busy || data.friend === "out"} onClick={befriend}>{label}</Button>
        <Button type="button" tone="ghost" disabled={busy} onClick={star}>{data.favorite ? t("Favorit lösen") : t("Favorit")}</Button>
        <Link to="/friends" className="inline-flex h-12 items-center rounded-control border-2 border-line bg-card px-5 text-sm font-semibold">{t("Was Freunde machen")}</Link>
      </div>
      {fail ? <Note>{fail}</Note> : null}
      {admin.data?.admin ? (
        <Button
          type="button"
          tone="ghost"
          onClick={async () => {
            await setVerified({ data: { userId: data.userId, value: !data.badges.includes(t("Profil bestätigt")) } });
            reload();
          }}
        >
          {data.badges.includes(t("Profil bestätigt")) ? t("Admin: Bestätigung aufheben") : t("Admin: als bestätigt markieren")}
        </Button>
      ) : null}
      <SafetyMenu kind="person" targetId={data.userId} personId={data.userId} personName={data.displayName.split(" ")[0]} onBlocked={() => navigate({ to: "/" })} />
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
