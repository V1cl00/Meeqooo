import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/bits";
import { Shell, useMe } from "@/components/shell";
import { organizerStats } from "@/lib/meeqo/api";
import { bookingLabel } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/organizer")({ component: Page });

function Page() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path !== "/organizer") return <Outlet />;
  return (
    <Shell>
      <Organizer />
    </Shell>
  );
}

function Organizer() {
  const { profile } = useMe();
  const stats = useLoad(() => organizerStats(), []);
  if (!profile) return null;
  if (!profile.isOrganizer) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="font-display text-4xl leading-none">{t("Veranstalter")}</h1>
        <p className="text-sm text-muted">{t("Cafés, Studios und Vereine können Aktivitäten mit Sofortbuchung oder Anfrage in den normalen Feed stellen. Zahlungen gibt es noch nicht.")}</p>
        <Link to="/organizer/register" className="inline-flex h-12 items-center rounded-full bg-accent px-5 text-sm font-semibold text-onfill">{t("Profil anlegen")}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-4xl leading-none">{profile.organizerName || profile.displayName}</h1>
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center"><p className="font-display text-3xl">{stats.data?.upcoming ?? 0}</p><p className="text-xs text-muted">{t("Termine")}</p></div>
        <div className="card p-3 text-center"><p className="font-display text-3xl">{stats.data?.pending ?? 0}</p><p className="text-xs text-muted">{t("Offene Anfragen")}</p></div>
        <div className="card p-3 text-center"><p className="font-display text-3xl">{stats.data?.accepted ?? 0}</p><p className="text-xs text-muted">{t("Zusagen")}</p></div>
      </div>
      <p className="text-sm text-muted">{t("Standard: {0}. Jede Aktivität kann das einzeln überschreiben. Ein Badge „Veranstalter“ steht am Profil.", bookingLabel(profile.bookingMode))}</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/create" search={{ community: "" }} className="inline-flex h-12 items-center rounded-full bg-accent px-5 text-sm font-semibold text-onfill">{t("Aktivität anlegen")}</Link>
        <Link to="/my-activities"><Button type="button" tone="ghost">{t("Meine Termine")}</Button></Link>
      </div>
      <p className="text-sm text-muted">{t("Tickets und Zahlung folgen später. Bis dahin ist die Buchung nur die Zusage zum Kommen.")}</p>
    </div>
  );
}
