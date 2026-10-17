import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Field, Note, TextInput, Wordmark } from "@/components/bits";
import { resetPassword } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/passwort")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),

  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }),
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await resetPassword({ data: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl leading-none">{t("Neues Passwort")}</h1>
      {done ? (
        <>
          <Note>{t("Gespeichert. Du kannst dich jetzt mit dem neuen Passwort anmelden. Andere Geräte sind abgemeldet.")}</Note>
          <Link to="/login" search={{ next: undefined }} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-onfill">{t("Zur Anmeldung")}</Link>
        </>
      ) : !token ? (
        <Note>{t("Dieser Link ist unvollständig. Fordere auf der Anmeldeseite einen neuen an.")}</Note>
      ) : (
        <form onSubmit={submit} className="card space-y-3 p-4">
          <Field label={t("Neues Passwort")}>
            <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder={t("Mindestens 8 Zeichen")} />
          </Field>
          {error ? <Note>{error}</Note> : null}
          <Button type="submit" className="w-full">{t("Speichern")}</Button>
        </form>
      )}
    </main>
  );
}
