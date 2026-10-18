import { t } from "@/lib/meeqo/i18n";

/** A short, flat list for the first minute. The full category tree stays in the profile. */
export const QUICK_INTERESTS = [
  "Kaffee", "Spaziergang", "Brunch", "Laufen", "Klettern", "Radfahren", "Yoga", "Wandern", "Kochen",
  "Museum", "Kino", "Konzert", "Brettspiele", "Quiz", "Sauna", "Fotografie", "Tanzen", "Sprache", "Hunde",
] as const;

export const LANGUAGES = ["Deutsch", "Englisch", "Türkisch", "Arabisch", "Französisch", "Spanisch", "Italienisch", "Russisch", "Polnisch", "Ukrainisch"] as const;

export const KA_DISTRICTS = [
  "Innenstadt-Ost", "Innenstadt-West", "Südstadt", "Südweststadt", "Weststadt", "Nordweststadt", "Oststadt", "Mühlburg", "Daxlanden",
  "Knielingen", "Grünwinkel", "Oberreut", "Beiertheim-Bulach", "Weiherfeld-Dammerstock", "Rüppurr", "Waldstadt", "Rintheim", "Hagsfeld",
  "Durlach", "Grötzingen", "Stupferich", "Hohenwettersbach", "Wolfartsweier", "Grünwettersbach", "Palmbach", "Neureut", "Nordstadt",
];

export function ChipToggle({ label, active, onClick, data }: { label: string; active: boolean; onClick: () => void; data?: string }) {
  return (
    <button
      type="button"
      data-chip={data}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold transition ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}
    >
      {t(label)}
    </button>
  );
}
