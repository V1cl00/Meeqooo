import { useState } from "react";
import { setPageStyle } from "@/lib/meeqo/design";
import { notice } from "@/lib/meeqo/feel";
import { t } from "@/lib/meeqo/i18n";

/** Own page colour, only from the brand palette so every page stays readable. */
export const STYLE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  "": { bg: "var(--color-card)", fg: "var(--color-ink)", label: "Standard" },
  terrakotta: { bg: "#E07A5F", fg: "#241C18", label: "Terrakotta" },
  gruen: { bg: "#81B29A", fg: "#241C18", label: "Grün" },
  anthrazit: { bg: "#3D405B", fg: "#F4E8D8", label: "Anthrazit" },
  sand: { bg: "#EADBC6", fg: "#3D405B", label: "Sand" },
};

export function PageStylePicker({ value, onSaved }: { value: string; onSaved: () => void }) {
  const [current, setCurrent] = useState(value);
  async function choose(next: string) {
    setCurrent(next);
    await setPageStyle({ data: { style: next } });
    notice(t("Deine Profilseite hat jetzt diese Farbe."));
    onSaved();
  }
  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-semibold">{t("Farbe deiner Profilseite")}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(STYLE_COLORS).map(([key, style]) => (
          <button key={key || "default"} type="button" aria-pressed={current === key} onClick={() => void choose(key)} className={`inline-flex h-10 items-center gap-2 rounded-control border-2 px-3 text-sm font-semibold ${current === key ? "border-ink" : "border-line"}`}>
            <span className="h-5 w-5 rounded-full border border-line" style={{ background: style.bg }} aria-hidden="true" />
            {t(style.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
