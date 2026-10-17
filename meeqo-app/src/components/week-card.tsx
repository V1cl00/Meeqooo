import { Link } from "@tanstack/react-router";
import { weekSummary } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

/**
 * A calm look at the week: what is ahead, what repeats, what the year looks like so far.
 * No streaks and no counters that punish a break; with nothing to show, the card stays away.
 */
export function WeekCard({ nearby }: { nearby: number }) {
  const { data } = useLoad(() => weekSummary(), []);
  if (!data || (data.ahead === 0 && data.regulars.length === 0 && data.yearMeetups === 0)) return null;
  return (
    <section className="card space-y-3 p-4" aria-label={t("Deine Woche")}>
      <h2 className="font-display text-2xl">{t("Deine Woche")}</h2>
      {data.ahead > 0 ? (
        <p className="text-sm">{data.ahead === 1 ? t("Ein Treffen steht an.") : t("{0} Treffen stehen an.", data.ahead)}{nearby > 0 ? ` ${t("{0} weitere sind in deiner Nähe.", nearby)}` : ""}</p>
      ) : nearby > 0 ? (
        <p className="text-sm">{t("Diese Woche ist noch frei. {0} Treffen sind in deiner Nähe.", nearby)}</p>
      ) : null}
      {data.regulars.map((item) => (
        <Link key={item.id} to="/activity/$id" params={{ id: item.id }} className="flex items-center justify-between gap-3 rounded-2xl bg-sand px-3 py-2 text-sm">
          <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wide text-muted">{t("Stammtreffen")}</span><span className="block truncate font-semibold">{item.title}</span></span>
          <span className="shrink-0 text-muted">{formatWhen(item.startsAt)}</span>
        </Link>
      ))}
      {data.yearMeetups > 0 ? (
        <p className="text-sm text-muted">
          {data.yearMeetups === 1 ? t("In diesem Jahr: ein Treffen") : t("In diesem Jahr: {0} Treffen", data.yearMeetups)}
          {data.yearPeople > 0 ? ` · ${data.yearPeople === 1 ? t("ein Mensch kennengelernt") : t("{0} Menschen kennengelernt", data.yearPeople)}` : ""}
        </p>
      ) : null}
    </section>
  );
}
