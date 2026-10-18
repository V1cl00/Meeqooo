import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";

export const Route = createFileRoute("/nutzungsbedingungen")({ component: Page });

const TERMS: { title: string; body: string }[] = [
  { title: "Wer mitmachen darf", body: "MeeQo ist ab 18 Jahren. Du bestätigst das bei der Anmeldung. Falsche Angaben zum Alter führen zur Sperrung." },
  { title: "Was MeeQo ist", body: "MeeQo bringt Leute über Aktivitäten zusammen. Wir organisieren die Treffen nicht, wir sind nicht Veranstalter privater Treffen und nicht verantwortlich für das, was dort geschieht. Veranstalter, die ihr Angebot als solches kennzeichnen, sind selbst verantwortlich." },
  { title: "Deine Inhalte", body: "Fotos, Texte, Treffen und Anzeigen bleiben deine. Du erlaubst MeeQo, sie so anzuzeigen, wie du es einstellst. Du versicherst, dass du die Rechte daran hast." },
  { title: "Regeln", body: "Es gelten die Community-Regeln. Verstöße können zum Entfernen von Inhalten oder zur Sperrung führen." },
  { title: "Sicherheit", body: "Triff dich nur an öffentlichen Orten, sag einer Vertrauensperson Bescheid und nutze den Notruf, wenn du dich bedroht fühlst. Wir können niemandes Absichten überprüfen." },
  { title: "Kündigung", body: "Du kannst dein Konto jederzeit unter Einstellungen löschen. Wir können Konten bei Verstößen sperren." },
  { title: "Änderungen und Recht", body: "[Regelung zu Änderungen, anwendbarem Recht und Gerichtsstand einsetzen]" },
];

function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl leading-none">Nutzungsbedingungen</h1>
      <Note>Entwurf. Die Angaben in eckigen Klammern fehlen, und der Text muss vor dem öffentlichen Start rechtlich geprüft werden.</Note>
      {TERMS.map((item) => (
        <section key={item.title} className="card space-y-1 p-4">
          <h2 className="font-display text-xl">{item.title}</h2>
          <p className="text-sm leading-relaxed">{item.body}</p>
        </section>
      ))}
      <p className="flex gap-4 text-sm"><Link to="/regeln" className="underline">Community-Regeln</Link><Link to="/datenschutz" className="underline">Datenschutz</Link><Link to="/impressum" className="underline">Impressum</Link></p>
    </main>
  );
}
