import { useSensitiveGate } from "@/components/sensitive";
import { t } from "@/lib/meeqo/i18n";
import { TRAITS } from "@/lib/meeqo/labels";

function chip(active: boolean) {
  return `inline-flex h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
}

export function TraitPicker({
  label,
  hint,
  selected,
  onChange,
  personal = false,
}: {
  label: string;
  hint: string;
  selected: string[];
  onChange: (next: string[]) => void;
  /** Traits of the person themselves (not of a meetup or ad): sensitive ones need consent. */
  personal?: boolean;
}) {
  const gate = useSensitiveGate();
  function toggle(trait: string) {
    const next = selected.includes(trait) ? selected.filter((item) => item !== trait) : [...selected, trait].slice(0, 8);
    if (personal && !selected.includes(trait)) gate.guard(next, () => onChange(next));
    else onChange(next);
  }

  return (
    <>
    {personal ? gate.panel : null}
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TRAITS.map((trait) => (
          <button key={trait} type="button" className={chip(selected.includes(trait))} onClick={() => toggle(trait)}>
            {t(trait)}
          </button>
        ))}
      </div>
    </div>
    </>
  );
}
