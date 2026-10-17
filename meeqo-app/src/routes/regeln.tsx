import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";

export const Route = createFileRoute("/regeln")({ component: Page });

const RULES: { title: string; body: string }[] = [
  { title: "Echt sein", body: "Dein Profilfoto zeigt dich. Treffen, die du anlegst, gibt es wirklich. Keine erfundenen Veranstaltungen, keine Fotos anderer Leute." },
  { title: "Absicht offen sagen", body: "Dating und Freundschaft sind getrennt. Wer ein Treffen als Freundschaft ausschreibt, flirtet nicht über die Hintertür. Wer ein Date will, sagt es." },
  { title: "Respekt", body: "Keine Belästigung, keine Drohungen, keine Beleidigungen, keine Diskriminierung, auch nicht in Chats und Beiträgen." },
  { title: "Sicher treffen", body: "Erste Dates nur an öffentlichen Orten. Gib einer Vertrauensperson Bescheid, check ein, und im Notfall ruf 112. Teile keine Adresse und keine Zahlungsdaten im Chat." },
  { title: "Keine Geschäfte mit Angst", body: "Kleinanzeigen sind für Dinge und Angebote. Keine Betrugsmaschen, keine Vorauszahlung an Unbekannte, keine illegalen Waren." },
  { title: "Melden hilft", body: "Was dir komisch vorkommt, melde es mit dem Knopf „Melden“. Du bleibst für die gemeldete Person unsichtbar. Wir sehen uns jede Meldung an und sagen dir Bescheid, wenn wir etwas getan haben." },
  { title: "Folgen", body: "Wir können Inhalte entfernen und Konten sperren. Du bekommst dann eine Nachricht mit dem Grund, wenn das möglich ist, und kannst dem widersprechen." },
];

function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl leading-none">Community-Regeln</h1>
      <Note>Entwurf. Vor dem öffentlichen Start rechtlich prüfen lassen.</Note>
      {RULES.map((rule) => (
        <section key={rule.title} className="card space-y-1 p-4">
          <h2 className="font-display text-xl">{rule.title}</h2>
          <p className="text-sm leading-relaxed">{rule.body}</p>
        </section>
      ))}
      <p className="flex gap-4 text-sm"><Link to="/nutzungsbedingungen" className="underline">Nutzungsbedingungen</Link><Link to="/datenschutz" className="underline">Datenschutz</Link></p>
    </main>
  );
}
