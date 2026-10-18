import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Tag } from "lucide-react";
import { Button, Field, Note, TextArea, TextInput } from "@/components/bits";
import { SafetyMenu } from "@/components/safety";
import { TraitPicker } from "@/components/traits";
import { VisibilityPicker } from "@/components/visibility";
import { useMe } from "@/components/shell";
import { isPhotoMissing, PhotoMissing } from "@/components/photo";
import { createClassified, expressInterest, listClassifieds } from "@/lib/meeqo/api";
import { CLASSIFIED_CATS, errText, formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

function chip(active: boolean) {
  return `inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
}

export function ClassifiedBoard({ city, sub }: { city: string; sub: string }) {
  const { profile } = useMe();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => listClassifieds(), []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(sub || "Verkaufen");
  const [price, setPrice] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string>(profile?.defaultVisibility ?? "all");
  const [communityIds, setCommunityIds] = useState<string[]>(profile?.audienceIds ?? []);
  const [fail, setFail] = useState("");
  const [open, setOpen] = useState(false);
  const [needPhoto, setNeedPhoto] = useState<string | null>(null);
  const items = (data ?? []).filter((item) => !sub || item.category === sub);

  async function interest(id: string) {
    setFail("");
    setNeedPhoto(null);
    try {
      const result = await expressInterest({ data: { id } });
      await navigate({ to: "/chat/anzeige/$id", params: { id: result.threadId } });
    } catch (err) {
      if (isPhotoMissing(err)) setNeedPhoto(id);
      else setFail(errText(err));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      await createClassified({ data: { title, body, category: sub || category, city, price, traits, visibility, communityIds: visibility === "community" ? communityIds : [] } });
      setTitle("");
      setBody("");
      setPrice("");
      setOpen(false);
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" className={chip(open)} onClick={() => setOpen((value) => !value)}>{t("Anzeige aufgeben")}</button>
      {open ? (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t("Titel")}><TextInput value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <Field label={t("Worum geht's?")}><TextArea value={body} onChange={(event) => setBody(event.target.value)} /></Field>
          <div className="flex flex-wrap gap-1.5">
            {CLASSIFIED_CATS.map((item) => (
              <button key={item} type="button" className={chip((sub || category) === item)} onClick={() => setCategory(item)}>{t(item)}</button>
            ))}
          </div>
          <Field label={t("Preis, optional")}><TextInput value={price} onChange={(event) => setPrice(event.target.value)} placeholder="12 €" /></Field>
          <TraitPicker label={t("Eigenschaften")} hint={t("Zum Beispiel vegan oder queerfreundlich. Ohne Haken sieht sie jeder, den die Sichtbarkeit durchlässt.")} selected={traits} onChange={setTraits} />
          <VisibilityPicker value={visibility} onChange={setVisibility} communityIds={communityIds} onCommunityIds={setCommunityIds} />
          {fail ? <Note>{fail}</Note> : null}
          <Button type="submit">{t("Veröffentlichen")}</Button>
        </form>
      ) : null}
      {error ? <Note>{error}</Note> : null}
      {!open && fail ? <Note>{fail}</Note> : null}
      {needPhoto ? <PhotoMissing onDone={() => { const id = needPhoto; setNeedPhoto(null); void interest(id); }} /> : null}
      {loading ? <p className="text-sm text-muted">{t("Anzeigen werden geladen…")}</p> : null}
      {items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-[1.5rem] border-2 border-dashed border-ink/40 bg-sand-deep">
          <div className="flex items-center gap-2 bg-ink/90 px-4 py-2 text-xs font-bold uppercase tracking-wide text-onaccent">
            <Tag className="h-4 w-4 shrink-0" />
            <span>{t("Kleinanzeige · {0}", item.category)}</span>
            <span className="ml-auto font-semibold normal-case tracking-normal opacity-80">{t("Kein Treffen")}</span>
          </div>
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl leading-none">{item.title}</h2>
              {item.price ? <span className="shrink-0 rounded-full bg-card px-3 py-1 text-sm font-bold">{item.price}</span> : null}
            </div>
            <p className="text-sm">{item.body}</p>
            <p className="text-sm text-muted">{item.city} · {item.authorName} · {formatWhen(item.createdAt)}</p>
            {item.mine ? (
              <p className="text-sm font-semibold">{item.interested ? t("{0} {1} geschrieben. Antworten findest du unter Chats.", item.interested, item.interested === 1 ? "Person hat" : "Leute haben") : t("Deine Anzeige. Noch niemand hat geschrieben.")}</p>
            ) : item.myThread ? (
              <Link to="/chat/anzeige/$id" params={{ id: item.myThread }} className="inline-flex h-11 items-center justify-center rounded-control bg-ink px-5 text-sm font-semibold text-onaccent">{t("Chat öffnen")}</Link>
            ) : (
              <Button type="button" className="h-11" onClick={() => interest(item.id)}>{t("Interesse melden")}</Button>
            )}
            {item.mine ? null : <SafetyMenu kind="ad" targetId={item.id} personId={item.authorId} personName={item.authorName.split(" ")[0]} onBlocked={reload} />}
          </div>
        </article>
      ))}
      {!loading && items.length === 0 ? <p className="text-sm text-muted">{t("In diesem Filter ist noch nichts eingestellt.")}</p> : null}
    </div>
  );
}
