import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, face, Field, Note, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { addCategory, listCategories, removeCategory } from "@/lib/meeqo/api";
import { CATEGORIES, CATEGORY_TREE, errText, joinCategory } from "@/lib/meeqo/labels";
import { readDraft, returnTarget, setPicked } from "@/lib/meeqo/draft";
import { useOpenCategories } from "@/components/categories";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/categories")({ component: Page });

function Page() {
  return (
    <Shell>
      <Categories />
    </Shell>
  );
}

function Categories() {
  const { data, reload } = useLoad(() => listCategories(), []);
  const [parent, setParent] = useState<string>(CATEGORIES[0]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const own = data ?? [];
  const open = useOpenCategories();
  const navigate = useNavigate();
  const [fromCreate, setFromCreate] = useState(false);

  // Coming from /create: preselect its main category and go back after adding.
  useEffect(() => {
    const target = returnTarget();
    if (target === null) return;
    setFromCreate(true);
    if ((CATEGORIES as readonly string[]).includes(target)) setParent(target);
  }, []);

  function backToCreate() {
    return navigate({ to: "/create", search: { community: readDraft()?.communityId ?? "" } });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await addCategory({ data: { name, parent } });
      if (fromCreate) {
        // Same cleanup as the server, so the new subcategory is selected on return.
        setPicked(joinCategory(parent, name.replace(/·/g, "").trim().slice(0, 30)));
        await backToCreate();
        return;
      }
      setName("");
      reload();
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {fromCreate ? (
        <Link to="/create" search={{ community: readDraft()?.communityId ?? "" }} className="text-sm font-semibold underline">{t("Zurück zum Treffen")}</Link>
      ) : null}
      <h1 className="font-display text-4xl leading-none">{t("Kategorien")}</h1>
      <p className="text-sm text-muted">{t("Unterkategorien gehören zu einer Kategorie. Deine eigenen siehst du beim Anlegen und in der Suche.")}</p>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <Field label={t("Kategorie")}>
          <select className="h-12 w-full rounded-2xl border border-line bg-card px-4" value={parent} onChange={(event) => setParent(event.target.value)}>
            {open.map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
        </Field>
        <Field label={t("Eigene Unterkategorie")}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Zum Beispiel Bouldern")} />
        </Field>
        {error ? <Note>{error}</Note> : null}
        <Button type="submit">{fromCreate ? t("Hinzufügen und zurück zum Treffen") : t("Hinzufügen")}</Button>
      </form>
      {CATEGORY_TREE.filter((group) => open.includes(group.name)).map((group) => {
        const mine = own.filter((item) => item.parent === group.name);
        return (
          <section key={group.name} className="card space-y-3 p-4">
            <h2 className="font-display text-2xl">{t(group.name)}</h2>
            <div className="flex flex-wrap gap-2">
              {group.subs.map((sub) => <span key={sub} className="rounded-full bg-sand px-3 py-2 text-sm">{t(sub)}</span>)}
              {mine.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-2 rounded-full bg-sand-deep px-3 py-2 text-sm">
                  {item.name}
                  <button
                    type="button"
                    className={`${face} h-8 px-3`}
                    onClick={async () => {
                      await removeCategory({ data: { id: item.id } });
                      reload();
                    }}
                  >{t("Entfernen")}</button>
                </span>
              ))}
            </div>
          </section>
        );
      })}
      {own.some((item) => !item.parent) ? (
        <section className="card space-y-2 p-4">
          <h2 className="font-display text-2xl">{t("Ohne Kategorie")}</h2>
          <div className="flex flex-wrap gap-2">
            {own.filter((item) => !item.parent).map((item) => (
              <span key={item.id} className="rounded-full bg-sand-deep px-3 py-2 text-sm">{item.name}</span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
