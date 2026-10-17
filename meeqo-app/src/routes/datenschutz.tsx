import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";

export const Route = createFileRoute("/datenschutz")({ component: Page });

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Wer verantwortlich ist",
    body: "Die Angaben stehen im Impressum.",
  },
  {
    title: "Konto",
    body: "Für dein Konto speichern wir Name, E-Mail-Adresse und dein Passwort (nur als Hash). Meldest du dich über einen Anbieter wie Google oder X an, bekommen wir von dort Name und E-Mail-Adresse.",
  },
  {
    title: "Profil und Standort",
    body: "Du kannst Anzeigename, Beschreibung, Absicht, Interessen, Ort oder Postleitzahl, Koordinaten, Geburtsjahr und ein Profilfoto angeben. Das Geburtsjahr bleibt privat. Es dient nur dazu, bei „Mein Alter“ Personen mit höchstens fünf Jahren Unterschied zu finden. Wer ein Treffen sehen darf, bestimmst du über „Wer darf das sehen?“.",
  },
  {
    title: "Treffen, Anzeigen, Beiträge, Chats",
    body: "Was du einstellst oder schreibst, speichern wir, damit andere es sehen können, die du dafür freigibst. Chats sehen nur die Beteiligten. Nach einem Treffen speichern wir deine Ja/Nein-Bewertung und deinen Check-in.",
  },
  {
    title: "Vertrauensperson und Einladung",
    body: "Erstellst du einen Link für eine Vertrauensperson, sieht jeder mit dem Link deinen Vornamen, das Treffen, Zeit, Ort und ob du eingecheckt bist. Ein Einladungslink zeigt Titel, Zeit, Ort und den Vornamen des Gastgebers. Beides ist nur über den langen, zufälligen Link erreichbar.",
  },
  {
    title: "Orts- und Postleitzahlensuche",
    body: "Wenn du einen Ort oder eine Postleitzahl eingibst, fragt unser Server openplzapi.org, api.zippopotam.us und bei Bedarf nominatim.openstreetmap.org (OpenStreetMap) an. Dorthin gelangt der Suchbegriff. Deine IP-Adresse geht von unserem Server aus nicht an diese Dienste.",
  },
  {
    title: "Schriften",
    body: "Die Schriften liegen auf unserem eigenen Server. Dafür wird keine Verbindung zu Google oder anderen Anbietern aufgebaut.",
  },
  {
    title: "Mitteilungen",
    body: "Erlaubst du Mitteilungen, speichern wir die Adresse deines Browsers beim Push-Dienst und die dazugehörigen Schlüssel, bis du das Konto löschst oder der Browser sie widerruft.",
  },
  {
    title: "Melden und Blockieren",
    body: "Meldest du Inhalte oder Personen, speichern wir Art, Ziel und Grund. Blockierst du jemanden, speichern wir das, damit ihr euch nicht mehr seht.",
  },
  {
    title: "Löschen",
    body: "Unter Einstellungen > Konto löschen entfernen wir dein Profil, deine Treffen, Anzeigen, Chats, Bewertungen, Fotos und Mitteilungen. Meldungen, die andere über dich gemacht haben, bleiben zur Missbrauchsabwehr gespeichert.",
  },
  {
    title: "Deine Rechte",
    body: "Du hast Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren.",
  },
  {
    title: "Hosting",
    body: "[Hosting-Anbieter und Serverstandort eintragen]",
  },
];

function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl leading-none">Datenschutz</h1>
      <Note>Entwurf nach dem, was die App tatsächlich speichert. Vor dem öffentlichen Start rechtlich prüfen lassen.</Note>
      {SECTIONS.map((section) => (
        <section key={section.title} className="card space-y-1 p-4">
          <h2 className="font-display text-xl">{section.title}</h2>
          <p className="text-sm leading-relaxed">{section.body}</p>
        </section>
      ))}
      <p className="text-sm"><Link to="/impressum" className="underline">Impressum</Link></p>
    </main>
  );
}
