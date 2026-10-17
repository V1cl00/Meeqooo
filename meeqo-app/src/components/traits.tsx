import { TRAITS } from "@/lib/meeqo/labels";

function chip(active: boolean) {
  return `inline-flex h-11 items-center rounded-full border-2 px-3.5 text-sm font-semibold ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
}

export function TraitPicker({
  label,
  hint,
  selected,
  onChange,
}: {
  label: string;
  hint: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(trait: string) {
    onChange(selected.includes(trait) ? selected.filter((item) => item !== trait) : [...selected, trait].slice(0, 8));
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TRAITS.map((trait) => (
          <button key={trait} type="button" className={chip(selected.includes(trait))} onClick={() => toggle(trait)}>
            {trait}
          </button>
        ))}
      </div>
    </div>
  );
}
