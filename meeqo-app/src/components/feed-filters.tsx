import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button, Note } from "@/components/bits";
import { useMe } from "@/components/shell";
import { useSensitiveGate } from "@/components/sensitive";
import { setRadius, setRequireTraits } from "@/lib/meeqo/api";
import { errText, RADIUS_OPTIONS, TRAITS } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

const DEFAULT_RADIUS = 25;

/** Filters that narrow the feed: every "Mindestens" property, plus a radius below the default. */
export function activeFilterCount(requireTraits: readonly string[] | undefined, radiusKm: number | undefined) {
  return (requireTraits?.length ?? 0) + (radiusKm != null && radiusKm < DEFAULT_RADIUS ? 1 : 0);
}

/** Warning under "Mindestens" chips. With counts it says exactly how much is hidden. */
export function MinimumWarning({ count, shown, hidden }: { count: number; shown?: number; hidden?: number }) {
  if (count < 1) return null;
  if (shown != null && hidden != null && hidden > 0) return <Note tone="warn">{t("Damit siehst du {0} statt {1} Treffen.", shown, shown + hidden)}</Note>;
  return <Note tone="warn">{t("Achtung: Damit siehst du deutlich weniger Treffen.")}</Note>;
}

/** Compact bar at the top of the feed: search, filter button with badge, and the "Filter aktiv" chip. */
export function FilterBar({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link to="/search" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-card px-3.5 text-sm text-muted">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{t("Treffen, Orte, Leute suchen")}</span>
        </Link>
        <button type="button" onClick={onOpen} aria-label={count ? t("Filter, {0} aktiv", count) : t("Filter")} className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-control border ${count ? "border-accent bg-accent/12 text-accent-deep" : "border-line bg-card text-ink"}`}>
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
          {count ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-onfill">{count}</span> : null}
        </button>
      </div>
      {count ? (
        <button type="button" onClick={onOpen} className="inline-flex h-8 items-center gap-1.5 rounded-control bg-warn px-3 text-xs font-semibold text-onwarn">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          {t("Filter aktiv · {0}", count)}
        </button>
      ) : null}
    </div>
  );
}

/** Bottom sheet for the feed filters. Changes apply only with "Anwenden". */
export function FilterSheet({ open, onClose, onApplied, shown, hidden }: { open: boolean; onClose: () => void; onApplied: () => void; shown?: number; hidden?: number }) {
  const { profile, reload } = useMe();
  const gate = useSensitiveGate();
  const [traits, setTraits] = useState<string[]>([]);
  const [radius, setRadiusDraft] = useState(DEFAULT_RADIUS);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  useEffect(() => {
    if (!open) return;
    setTraits(profile?.requireTraits ?? []);
    setRadiusDraft(profile?.radiusKm ?? DEFAULT_RADIUS);
    setFail("");
  }, [open, profile?.requireTraits.join(","), profile?.radiusKm]);
  if (!open) return null;
  const saved = profile?.requireTraits ?? [];
  const unchanged = traits.length === saved.length && traits.every((item) => saved.includes(item));

  function apply() {
    const run = async () => {
      setBusy(true);
      setFail("");
      try {
        if (!unchanged) await setRequireTraits({ data: { traits } });
        if (radius !== profile?.radiusKm) await setRadius({ data: { radiusKm: radius } });
        await reload();
        onApplied();
        onClose();
      } catch (err) {
        setFail(errText(err));
      }
      setBusy(false);
    };
    gate.guard(traits, () => void run());
  }

  const chip = (on: boolean) => `inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("Filter")}>
      <div className="card max-h-[88dvh] w-full max-w-lg space-y-4 overflow-y-auto p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{t("Filter")}</h2>
          <button type="button" className="inline-flex h-10 items-center rounded-control border-2 border-line bg-card px-3.5 text-sm font-semibold" onClick={onClose}>{t("Schließen")}</button>
        </div>
        {gate.panel}
        <section className="space-y-2">
          <p className="text-sm font-semibold">{t("Mindestens vorhanden")}</p>
          <p className="text-sm text-muted">{t("Ohne diese Eigenschaft bleibt es unsichtbar. Gilt für Feed, Suche, Communities und Anzeigen.")}</p>
          <div className="flex flex-wrap gap-1.5">
            {TRAITS.map((trait) => {
              const on = traits.includes(trait);
              return (
                <button key={trait} type="button" aria-pressed={on} className={chip(on)} onClick={() => setTraits(on ? traits.filter((item) => item !== trait) : [...traits, trait])}>{t(trait)}</button>
              );
            })}
          </div>
          <MinimumWarning count={traits.length} shown={unchanged ? shown : undefined} hidden={unchanged ? hidden : undefined} />
        </section>
        <section className="space-y-2">
          <p className="text-sm font-semibold">{t("Umkreis")}</p>
          <div className="flex flex-wrap gap-1.5">
            {RADIUS_OPTIONS.map((km) => (
              <button key={km} type="button" aria-pressed={radius === km} className={chip(radius === km)} onClick={() => setRadiusDraft(km)}>{t("{0} km", km)}</button>
            ))}
          </div>
          {radius < DEFAULT_RADIUS ? <Note tone="warn">{t("Kleiner Umkreis: Damit siehst du deutlich weniger Treffen.")}</Note> : null}
          <p className="text-xs text-muted">{t("Den Ort änderst du oben über die Ortszeile.")}</p>
        </section>
        {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
        <div className="flex gap-2">
          <Button type="button" tone="ghost" className="flex-1" disabled={busy} onClick={() => { setTraits([]); setRadiusDraft(DEFAULT_RADIUS); }}>{t("Zurücksetzen")}</Button>
          <Button type="button" className="flex-1" disabled={busy} onClick={apply}>{busy ? t("Speichert …") : t("Anwenden")}</Button>
        </div>
      </div>
    </div>
  );
}

/** Empty or near-empty feed while "Mindestens" hides meetups: one tap to loosen, with undo. */
export function LoosenCard({ hidden, onChanged }: { hidden: number; onChanged: () => void }) {
  const { profile, reload } = useMe();
  const [undo, setUndo] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(next: string[]) {
    setBusy(true);
    try {
      await setRequireTraits({ data: { traits: next } });
      await reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  if (undo) {
    return (
      <div className="card flex items-center justify-between gap-3 p-4">
        <p className="text-sm">{t("Mindestens-Filter sind aus.")}</p>
        <button type="button" disabled={busy} className="inline-flex h-10 items-center rounded-control border-2 border-line bg-card px-3.5 text-sm font-semibold" onClick={async () => { await save(undo); setUndo(null); }}>{t("Rückgängig")}</button>
      </div>
    );
  }
  if (hidden < 1 || !profile?.requireTraits.length) return null;
  return (
    <div className="space-y-3 rounded-2xl bg-warn p-4 text-onwarn">
      <p className="text-sm font-semibold">{hidden === 1 ? t("Deine Filter blenden 1 Treffen aus.") : t("Deine Filter blenden {0} Treffen aus.", hidden)}</p>
      <p className="text-sm">{t("Mindestens: {0}", profile.requireTraits.map((item) => t(item)).join(", "))}</p>
      <Button type="button" className="w-full" disabled={busy} onClick={async () => { const before = profile.requireTraits; await save([]); setUndo(before); }}>{t("Filter lockern")}</Button>
    </div>
  );
}
