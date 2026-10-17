import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";

export const Route = createFileRoute("/impressum")({ component: Page });

function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl leading-none">Impressum</h1>
      <Note>Entwurf. Die Angaben in eckigen Klammern fehlen noch und müssen vor dem öffentlichen Start ausgefüllt werden.</Note>
      <section className="card space-y-1 p-4 text-sm">
        <p className="font-semibold">Anbieter</p>
        <p>[Vor- und Nachname oder Firma]</p>
        <p>[Straße und Hausnummer]</p>
        <p>[PLZ und Ort]</p>
      </section>
      <section className="card space-y-1 p-4 text-sm">
        <p className="font-semibold">Kontakt</p>
        <p>E-Mail: [Adresse]</p>
        <p>Telefon: [optional]</p>
      </section>
      <section className="card space-y-1 p-4 text-sm">
        <p className="font-semibold">Weitere Angaben</p>
        <p>Umsatzsteuer-ID, falls vorhanden: [Nummer]</p>
        <p>Verantwortlich für Inhalte nach § 18 Abs. 2 MStV: [Name und Anschrift]</p>
      </section>
      <p className="text-sm"><Link to="/datenschutz" className="underline">Datenschutz</Link></p>
    </main>
  );
}
