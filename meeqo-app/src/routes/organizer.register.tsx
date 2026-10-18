import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Field, Note, TextArea, TextInput } from "@/components/bits";
import { Shell, useMe } from "@/components/shell";
import { registerOrganizer } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/organizer/register")({ component: Page });

function Page() {
  return (
    <Shell>
      <Register />
    </Shell>
  );
}

function Register() {
  const { profile, reload } = useMe();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState(profile?.city ?? "");
  const [bio, setBio] = useState("");
  const [bookingMode, setBookingMode] = useState<"request" | "instant">("request");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await registerOrganizer({ data: { name, city, bio, bookingMode } });
      await reload();
      await navigate({ to: "/organizer" });
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Als Ort eintragen")}</h1>
      <Field label={t("Name")}><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
      <Field label={t("Stadt")}><TextInput value={city} onChange={(event) => setCity(event.target.value)} /></Field>
      <Field label={t("Was ihr anbietet")}><TextArea value={bio} onChange={(event) => setBio(event.target.value)} /></Field>
      <div className="flex gap-2">
        <button type="button" onClick={() => setBookingMode("request")} className={`inline-flex h-10 items-center rounded-control border px-3.5 text-sm font-semibold ${bookingMode === "request" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Anfrage")}</button>
        <button type="button" onClick={() => setBookingMode("instant")} className={`inline-flex h-10 items-center rounded-control border px-3.5 text-sm font-semibold ${bookingMode === "instant" ? "border-ink bg-ink text-onaccent" : "border-line bg-card text-ink"}`}>{t("Sofortbuchung")}</button>
      </div>
      {error ? <Note>{error}</Note> : null}
      <Button type="submit">{t("Speichern")}</Button>
    </form>
  );
}
