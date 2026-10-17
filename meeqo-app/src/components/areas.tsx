import { useMe } from "@/components/shell";
import { t } from "@/lib/meeqo/i18n";
import { AREAS } from "@/lib/meeqo/labels";

export function AreaPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const { profile } = useMe();
  const on = profile?.flags;
  const visible = AREAS.filter((item) => item.id === "friends" || on?.[item.id as "dating" | "business" | "classifieds"]);
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => {
        const on = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`w-full rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}
          >
            <span className="block font-semibold">{t(item.title)}</span>
            <span className={`text-sm ${on ? "text-onfill" : "text-muted"}`}>{t(item.hint)}</span>
          </button>
        );
      })}
    </div>
  );
}
