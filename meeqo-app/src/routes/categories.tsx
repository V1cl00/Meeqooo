import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, face, Field, Note, TextInput } from "@/components/bits";
import { Shell } from "@/components/shell";
import { addCategory, listCategories, removeCategory } from "@/lib/meeqo/api";
import { CATEGORIES, CATEGORY_TREE, errText } from "@/lib/meeqo/labels";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await addCategory({ data: { name, parent } });
      setName("");
      reload();
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Kategorien")}</h1>
      <p className="text-sm text-muted">{t("Unterkategorien gehören zu einer Kategorie. Deine eigenen siehst du beim Anlegen und in der Suche.")}</p>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <Field label={t("Kategorie")}>
          <select className="h-12 w-full rounded-2xl border border-line bg-card px-4" value={parent} onChange={(event) => setParent(event.target.value)}>
            {CATEGORIES.map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
        </Field>
        <Field label={t("Eigene Unterkategorie")}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Zum Beispiel Bouldern")} />
        </Field>
        {error ? <Note>{error}</Note> : null}
        <Button type="submit">{t("Hinzufügen")}</Button>
      </form>
      {CATEGORY_TREE.map((group) => {
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
