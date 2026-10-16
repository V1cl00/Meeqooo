import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button, face, IntentPill, Note, TextArea } from "@/components/bits";
import { ShareSheet } from "@/components/share";
import { VisibilityPicker } from "@/components/visibility";
import { useMe } from "@/components/shell";
import { createPost, deletePost, listPosts } from "@/lib/meeqo/api";
import { TRAITS, activityIntentLabel, errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

const AUDIENCES = ["friends", "date", "both"] as const;

export function PostBoard({
  userId,
  communityId,
  canPost,
}: {
  userId?: string;
  communityId?: string;
  canPost: boolean;
}) {
  const { profile } = useMe();
  const { data, error, loading, reload } = useLoad(
    () => listPosts({ data: { userId, communityId } }),
    [userId, communityId],
  );
  const fallback = profile?.openTo === "friends" ? "friends" : profile?.openTo === "dating" ? "date" : "both";
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>(fallback);
  const [visibility, setVisibility] = useState<string>(profile?.defaultVisibility ?? "all");
  const [communityIds, setCommunityIds] = useState<string[]>(profile?.audienceIds ?? []);
  const [requireTraits, setRequireTraits] = useState<string[]>([]);
  const [share, setShare] = useState<{ title: string; text: string } | null>(null);
  const [fail, setFail] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFail("");
    try {
      await createPost({ data: { body, audience, communityId, requireTraits, visibility, communityIds: visibility === "community" ? communityIds : [] } });
      setBody("");
      reload();
    } catch (err) {
      setFail(errText(err));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setFail("");
    try {
      await deletePost({ data: { id } });
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl">Beiträge</h2>
        <p className="text-sm text-muted">
          Nur deine Zielgruppe sieht den Beitrag. Eigenschaften schränken das zusätzlich ein.
        </p>
      </div>
      {canPost ? (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ein Satz reicht." maxLength={500} />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Wer sieht das?</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setAudience(item)}
                className={`inline-flex h-10 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${audience === item ? "border-accent bg-accent text-onaccent" : "border-line bg-card text-ink"}`}
              >
                {activityIntentLabel(item)}
              </button>
            ))}
          </div>
          <VisibilityPicker value={visibility} onChange={setVisibility} communityIds={communityIds} onCommunityIds={setCommunityIds} />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Nur Menschen mit</p>
          <div className="flex flex-wrap gap-2">
            {TRAITS.map((trait) => (
              <button
                key={trait}
                type="button"
                onClick={() => setRequireTraits((current) => current.includes(trait) ? current.filter((item) => item !== trait) : [...current, trait])}
                className={`inline-flex h-10 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${requireTraits.includes(trait) ? "border-accent bg-accent text-onaccent" : "border-line bg-card text-ink"}`}
              >
                {trait}
              </button>
            ))}
          </div>
          {fail ? <Note>{fail}</Note> : null}
          <Button type="submit" disabled={pending || body.trim().length < 2}>{pending ? "Wird gepostet…" : "Posten"}</Button>
        </form>
      ) : null}
      {!canPost && fail ? <Note>{fail}</Note> : null}
      {error ? <Note>{error}</Note> : null}
      {loading ? <p className="text-sm text-muted">Beiträge werden geladen…</p> : null}
      {(data ?? []).map((post) => (
        <article key={post.id} className="card space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              {post.mine ? (
                <Link to="/profile" className="font-semibold">{post.authorName}</Link>
              ) : (
                <Link to="/profile/$id" params={{ id: post.authorId }} className="font-semibold">{post.authorName}</Link>
              )}
              <p className="text-xs text-muted">{formatWhen(post.createdAt)}</p>
            </div>
            <IntentPill intent={post.audience} />
          </div>
          <p className="text-sm whitespace-pre-wrap">{post.body}</p>
          {post.requireTraits.length ? <p className="text-xs text-muted">Nur für {post.requireTraits.join(", ")}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={face} onClick={() => setShare({ title: post.authorName, text: `${post.authorName}: ${post.body}` })}>Teilen</button>
            {post.mine ? (
              <button type="button" className={face} onClick={() => remove(post.id)}>Löschen</button>
            ) : null}
          </div>
        </article>
      ))}
      {!loading && (data ?? []).length === 0 ? (
        <div className="card px-4 py-8 text-center">
          <p className="font-display text-2xl">Noch still hier</p>
          <p className="mt-1 text-sm text-muted">Ein Satz reicht. Du bestimmst, wer ihn sieht.</p>
        </div>
      ) : null}
      <ShareSheet open={Boolean(share)} title={share?.title ?? "MeeQo"} text={share?.text ?? ""} onClose={() => setShare(null)} />
    </section>
  );
}
