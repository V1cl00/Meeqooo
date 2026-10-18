import { Link } from "@tanstack/react-router";
import { useMe } from "@/components/shell";
import { inLaunchRegion, LAUNCH } from "@/lib/meeqo/region";
import { t } from "@/lib/meeqo/i18n";

/** MeeQo starts around Karlsruhe. Anyone further away is told plainly that it is quiet there, and what they can do. */
export function RegionNote() {
  const { profile } = useMe();
  if (!profile || inLaunchRegion(profile.lat, profile.lng)) return null;
  return (
    <div className="card space-y-2 p-4" role="note">
      <p className="font-semibold">{t("MeeQo startet im Raum {0}", LAUNCH.name)}</p>
      <p className="text-sm text-muted">{t("Wir fangen in {0} und bis {1} km Umkreis an. Bei dir ist noch wenig los. Leg ein Treffen an oder sag, was du gern machen würdest, dann melden wir uns, wenn es losgeht.", LAUNCH.name, LAUNCH.km)}</p>
      <Link to="/create" search={{ community: "" }} className="inline-flex h-10 items-center rounded-control border border-line bg-card px-3.5 text-sm font-semibold">{t("Treffen anlegen")}</Link>
    </div>
  );
}
