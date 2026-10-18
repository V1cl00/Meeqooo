import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Field, Note, TextArea } from "@/components/bits";
import { Shell } from "@/components/shell";
import { supportAsk } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/support")({ component: Page });

const FAQ = [
  ["Warum sehe ich keine Dates?", "Nur wenn deine Absicht Dating ist oder du „sowohl als auch“ gewählt hast. Freunde-Aktivitäten bleiben für Dater unsichtbar und umgekehrt."],
  ["Wie funktioniert eine Anfrage?", "Du fragst an, die Person nimmt an oder lehnt ab. Erst danach gibt es den Chat. Veranstalter können Sofortbuchung erlauben."],
  ["Was ist mit Sicherheit?", "1:1-Dates nur an öffentlichen Orten oder bei Veranstaltern. Du kannst die Details teilen, einchecken und im Notfall 112 wählen. Wiedersehen wird nur angezeigt, wenn beide es wollen."],
  ["Kann ich eine Aktivität ausblenden?", "Ja, auf jeder fremden Karte und auf der Aktivitätsseite. Sie bleibt aus Feed, Suche, Communities und Vorschlägen weg, bis du sie unter Einstellungen wieder zeigst. Eigene Termine und Zusagen bleiben sichtbar."],
  ["Kann ich etwas posten?", "Ja, auf deinem Profil und in Gruppen, denen du beigetreten bist. Du wählst, ob der Beitrag für Dates, Freundschaft oder beides sichtbar ist. Eigene Beiträge kannst du löschen."],
  ["Kann ich Unterkategorien anlegen?", "Ja, unter Kategorien. Du wählst eine Kategorie und gibst der Unterkategorie einen Namen. Sie erscheint dann beim Anlegen, in der Suche und bei „Ich suche aktiv“."],
  ["Kann ich das Design ändern?", "Ja, unter Einstellungen. Beschreib Farben oder Stimmung, die KI setzt Grund, Akzent, Schrift und Ecken. Zurück zu MeeQo stellt das Original wieder her. Das gilt nur für dich."],
  ["Ist das Profil geprüft?", "„Verifiziert“ heißt: Ein Mensch bei MeeQo hat ein Selfie mit dem Profilfoto verglichen. Das Selfie wird danach gelöscht. Bewertungen gibt es nur nach einem echten Check-in, ohne Sterne."],
];

function Page() {
  return (
    <Shell>
      <Support />
    </Shell>
  );
}

function Support() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await supportAsk({ data: { question } });
      setAnswer(result.text);
    } catch (err) {
      setError(errText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{t("Hilfe")}</h1>
      <div className="space-y-2">
        {FAQ.map(([title, body]) => (
          <details key={title} className="card p-4">
            <summary className="cursor-pointer font-semibold">{t(title)}</summary>
            <p className="mt-2 text-sm text-muted">{t(body)}</p>
          </details>
        ))}
      </div>
      <form onSubmit={ask} className="space-y-3">
        <Field label={t("Eigene Frage")}>
          <TextArea value={question} onChange={(event) => setQuestion(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>{pending ? t("Antwortet…") : t("Fragen")}</Button>
      </form>
      {error ? <Note>{error}</Note> : null}
      {answer ? <div className="card p-4 text-sm whitespace-pre-wrap">{answer}</div> : null}
    </div>
  );
}
