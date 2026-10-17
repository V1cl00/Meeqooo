import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, Field, Note, TextInput, Wordmark } from "@/components/bits";
import { Shell, useMe } from "@/components/shell";
import { confirmAge } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";

export const Route = createFileRoute("/alter")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

function Page() {
  return (
    <Shell bare requireOnboarding={false} requireAge={false}>
      <Age />
    </Shell>
  );
}

function Age() {
  const { reload } = useMe();
  const navigate = useNavigate();
  const [year, setYear] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!terms) {
      setError("Stimm den Nutzungsbedingungen und dem Datenschutz zu.");
      return;
    }
    setPending(true);
    try {
      await confirmAge({ data: { year: Number(year), adult } });
      await reload();
      await navigate({ to: "/" });
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <Wordmark className="text-2xl" />
      <div>
        <h1 className="font-display text-4xl leading-none">Erst mal kurz zu dir</h1>
        <p className="mt-2 text-sm text-muted">MeeQo ist für Erwachsene. Dein Geburtsjahr bleibt privat. Es dient nur dazu, bei „Mein Alter“ Leute mit höchstens fünf Jahren Unterschied zu finden.</p>
      </div>
      <Field label="Geburtsjahr">
        <TextInput inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="1994" maxLength={4} required />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
        <span>Ich bin mindestens 18 Jahre alt.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
        <span>
          Ich stimme den <Link to="/nutzungsbedingungen" className="underline">Nutzungsbedingungen</Link>, den <Link to="/regeln" className="underline">Community-Regeln</Link> und dem <Link to="/datenschutz" className="underline">Datenschutz</Link> zu.
        </span>
      </label>
      {error ? <Note>{error}</Note> : null}
      <Button type="submit" disabled={pending || !adult || !year} className="w-full">{pending ? "Speichern…" : "Weiter"}</Button>
    </form>
  );
}
