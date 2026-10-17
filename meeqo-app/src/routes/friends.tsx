import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityCard, Button, Empty, Note } from "@/components/bits";
import { Shell } from "@/components/shell";
import { friendOverview, listCircle, listFavorites, removeFriend, respondFriend } from "@/lib/meeqo/api";
import { errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { useState } from "react";

export const Route = createFileRoute("/friends")({ component: Page });

function Page() {
  return (
    <Shell>
      <Friends />
    </Shell>
  );
}

function Friends() {
  const { data, error, loading, reload } = useLoad(() => friendOverview(), []);
  const favorites = useLoad(() => listFavorites(), []);
  const circle = useLoad(() => listCircle(), []);
  const [fail, setFail] = useState("");

  async function act(kind: "accept" | "decline" | "remove", userId: string) {
    setFail("");
    try {
      if (kind === "remove") await removeFriend({ data: { userId } });
      else await respondFriend({ data: { userId, accept: kind === "accept" } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="font-display text-4xl leading-none">Freunde</h1>
        <p className="mt-2 text-sm text-muted">Befreundete Personen und das, was sie gerade machen. Was du siehst, hängt an deren Einstellung.</p>
      </div>
      {error ? <Note>{error}</Note> : null}
      {fail ? <Note>{fail}</Note> : null}
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      <section className="space-y-2">
        <h2 className="font-display text-2xl">Wieder getroffen</h2>
        <p className="text-sm text-muted">Nur Leute, bei denen ihr beide Ja gesagt habt. Sie entstehen nach einem echten Treffen, nicht durch Suchen.</p>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {(circle.data ?? []).map((person) => (
            <Link key={person.id} to="/profile/$id" params={{ id: person.id }} className="w-20 shrink-0 text-center">
              {person.avatar ? (
                <img src={person.avatar} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-card font-display text-xl">{person.name.slice(0, 1)}</span>
              )}
              <span className="mt-1 block truncate text-xs font-bold">{person.name.split(" ")[0]}</span>
              <span className="block text-[10px] text-muted">{person.meetings}× zusammen</span>
            </Link>
          ))}
        </div>
        {!circle.loading && (circle.data ?? []).length === 0 ? <p className="text-sm text-muted">Noch niemand. Nach dem Check-in fragt dich die App: wieder treffen?</p> : null}
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-2xl">Favoriten</h2>
        <p className="text-sm text-muted">Leute, die du wieder einladen willst. Merken geht auf dem Profil.</p>
        {(favorites.data ?? []).map((person) => (
          <Link key={person.userId} to="/profile/$id" params={{ id: person.userId }} className="card block px-4 py-3 font-semibold">
            {person.displayName}
            {person.city ? <span className="ml-2 text-sm font-normal text-muted">{person.city}</span> : null}
          </Link>
        ))}
        {!favorites.loading && (favorites.data ?? []).length === 0 ? <p className="text-sm text-muted">Noch niemand gemerkt.</p> : null}
      </section>
      {(data?.incoming.length ?? 0) > 0 ? (
        <section className="card space-y-3 p-4">
          <h2 className="font-display text-2xl">Anfragen</h2>
          {data?.incoming.map((person) => (
            <div key={person.userId} className="flex flex-wrap items-center justify-between gap-2">
              <Link to="/profile/$id" params={{ id: person.userId }} className="font-semibold">{person.displayName}</Link>
              <div className="flex gap-2">
                <Button type="button" className="h-11" onClick={() => act("accept", person.userId)}>Annehmen</Button>
                <Button type="button" tone="ghost" className="h-11" onClick={() => act("decline", person.userId)}>Ablehnen</Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-display text-2xl">Befreundet</h2>
        {(data?.friends.length ?? 0) === 0 && !loading ? <Empty art="people" title="Noch niemand" body="Auf einem Profil kannst du eine Freundschaft anfragen." /> : null}
        {data?.friends.map((person) => (
          <div key={person.userId} className="card flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link to="/profile/$id" params={{ id: person.userId }} className="font-semibold">{person.displayName}</Link>
              {person.city ? <p className="text-sm text-muted">{person.city}</p> : null}
            </div>
            <Button type="button" tone="ghost" className="h-11" onClick={() => act("remove", person.userId)}>Lösen</Button>
          </div>
        ))}
        {(data?.outgoing.length ?? 0) > 0 ? <p className="text-sm text-muted">Angefragt: {data?.outgoing.map((person) => person.displayName).join(", ")}</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Was sie machen</h2>
        {(data?.activities.length ?? 0) === 0 && (data?.posts.length ?? 0) === 0 && !loading ? (
          <p className="text-sm text-muted">Noch nichts, das du sehen darfst.</p>
        ) : null}
        {data?.activities.map((item) => <ActivityCard key={item.id} item={item} />)}
        {data?.posts.map((post) => (
          <article key={post.id} className="card space-y-1 p-4">
            <Link to="/profile/$id" params={{ id: post.authorId }} className="font-semibold">{post.authorName}</Link>
            <p className="text-xs text-muted">{formatWhen(post.createdAt)}</p>
            <p className="text-sm whitespace-pre-wrap">{post.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
