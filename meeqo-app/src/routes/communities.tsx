import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Button, Field, Note, TextArea, TextInput } from "@/components/bits";
import { CategorySelect } from "@/components/categories";
import { Shell } from "@/components/shell";
import { createCommunity, listCategories, listCommunities } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/communities")({ component: Page });

function Page() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path !== "/communities") return <Outlet />;
  return (
    <Shell>
      <Communities />
    </Shell>
  );
}

function Communities() {
  const { data, loading, reload } = useLoad(() => listCommunities(), []);
  const cats = useLoad(() => listCategories(), []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("Outdoor");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await createCommunity({ data: { name, topic, city, description } });
      setOpen(false);
      reload();
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none">{t("Communities")}</h1>
        <Button type="button" tone="ghost" className="h-11" onClick={() => setOpen((value) => !value)}>{t("Neu")}</Button>
      </div>
      <p className="text-sm text-muted">{t("Gruppen zu einem Thema und einem Ort. Mitglieder sehen die Aktivitäten und können eigene vorschlagen.")}</p>
      {open ? (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t("Name")}><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label={t("Thema")}>
            <CategorySelect value={topic} onChange={setTopic} custom={cats.data ?? []} />
          </Field>
          <Field label={t("Stadt")}><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
          <Field label={t("Worum es geht")}><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          {error ? <Note>{error}</Note> : null}
          <Button type="submit">{t("Community anlegen")}</Button>
        </form>
      ) : null}
      {loading ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((item) => (
          <Link key={item.id} to="/communities/$id" params={{ id: item.id }} className="card block p-4">
            <p className="text-xs font-semibold text-muted">{item.city} · {item.topic}</p>
            <h2 className="font-display text-2xl">{item.name}</h2>
            <p className="mt-1 text-sm text-muted">{t("{0} Mitglieder · {1} Aktivitäten", item.members, item.activityCount)}</p>
            {item.joined ? <p className="mt-2 text-xs font-semibold text-friend">{t("Dabei")}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
