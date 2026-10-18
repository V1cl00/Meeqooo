import { Link } from "@tanstack/react-router";
import { listCommunities } from "@/lib/meeqo/api";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const VISIBILITIES = [
  { id: "all", label: "Egal" },
  { id: "friends", label: "Nur Freunde" },
  { id: "community", label: "Communities" },
  { id: "events", label: "Veranstaltungen" },
  { id: "age", label: "Mein Alter" },
] as const;

/** One short line for the selected option. */
const VISIBILITY_HINTS: Record<string, string> = {
  all: "Jeder, den die Absicht erreicht.",
  friends: "Nur angenommene Freundschaften.",
  community: "Nur Mitglieder der gewählten Gruppen.",
  events: "Leute, mit denen du schon ein Treffen geteilt hast.",
  age: "±5 Jahre, dein Geburtsjahr bleibt privat.",
};

export function visibilityLabel(value: string) {
  return VISIBILITIES.find((item) => item.id === value)?.label ?? "Egal";
}

function chip(active: boolean) {
  return `inline-flex h-10 items-center rounded-control border-2 px-3.5 text-sm font-semibold ${active ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`;
}

export function VisibilityPicker({
  value,
  onChange,
  communityIds = [],
  onCommunityIds,
}: {
  value: string;
  onChange: (next: string) => void;
  communityIds?: string[];
  onCommunityIds?: (ids: string[]) => void;
}) {
  const groups = useLoad(() => listCommunities(), []);
  const mine = (groups.data ?? []).filter((item) => item.joined);

  function toggle(id: string) {
    if (!onCommunityIds) return;
    onCommunityIds(communityIds.includes(id) ? communityIds.filter((item) => item !== id) : [...communityIds, id]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Wer darf das sehen?")}</p>
      <div className="flex flex-wrap gap-1.5">
        {VISIBILITIES.map((item) => (
          <button key={item.id} type="button" className={chip(value === item.id)} onClick={() => onChange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {value === "community" && onCommunityIds ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("Welche Communities")}</p>
          {mine.length ? (
            <div className="flex flex-wrap gap-1.5">
              {mine.map((item) => (
                <button key={item.id} type="button" className={chip(communityIds.includes(item.id))} onClick={() => toggle(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("Du bist noch in keiner Community.")}{" "}<Link to="/communities" className="font-semibold text-ink">{t("Eine finden")}</Link>
            </p>
          )}
          <p className="text-sm text-muted">{t(VISIBILITY_HINTS.community)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t(VISIBILITY_HINTS[value] ?? VISIBILITY_HINTS.all)}</p>
      )}
    </div>
  );
}
