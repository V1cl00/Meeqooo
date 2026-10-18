import { useState } from "react";
import { Car } from "lucide-react";
import { Button } from "@/components/bits";
import { cancelRide, claimRide, leaveRide, listRides, offerRide } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

/** Carpooling for one meetup. Only people who are in see it. */
export function RidesCard({ activityId }: { activityId: string }) {
  const { data, reload } = useLoad(() => listRides({ data: { activityId } }), [activityId]);
  const [seats, setSeats] = useState(2);
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);
  const [fail, setFail] = useState("");
  const rides = data ?? [];
  const mine = rides.find((ride) => ride.mine);

  async function run(action: () => Promise<unknown>, message: string) {
    setFail("");
    try {
      await action();
      notice(message);
      setOpen(false);
      reload();
    } catch (err) {
      setFail(errText(err));
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-2xl"><Car className="h-5 w-5" aria-hidden="true" />{t("Mitfahren")}</h2>
      {rides.length === 0 ? <p className="text-sm text-muted">{t("Noch niemand fährt. Wenn du ein Auto hast, nimm jemanden mit.")}</p> : null}
      {rides.map((ride) => (
        <div key={ride.id} className="space-y-2 rounded-2xl bg-sand-deep p-3">
          <p className="text-sm font-semibold">{ride.mine ? t("Du fährst") : t("{0} fährt", ride.driverName)}{ride.origin ? t(" ab {0}", ride.origin) : ""}</p>
          <p className="text-sm text-muted">{t("{0} von {1} Plätzen frei{2}", ride.free, ride.seats, ride.riders.length ? t(" · mit {0}", ride.riders.join(", ")) : "")}</p>
          {ride.mine ? (
            <button type="button" className="inline-flex h-10 items-center rounded-control border border-line bg-card px-3.5 text-sm font-semibold" onClick={() => run(() => cancelRide({ data: { rideId: ride.id } }), "Fahrt abgesagt.")}>{t("Fahrt absagen")}</button>
          ) : ride.iRide ? (
            <button type="button" className="inline-flex h-10 items-center rounded-control border border-line bg-card px-3.5 text-sm font-semibold" onClick={() => run(() => leaveRide({ data: { rideId: ride.id } }), t("Du fährst nicht mehr mit."))}>{t("Nicht mehr mitfahren")}</button>
          ) : ride.free > 0 ? (
            <button type="button" className="inline-flex h-10 items-center rounded-control bg-accent px-3.5 text-sm font-semibold text-onfill" onClick={() => run(() => claimRide({ data: { rideId: ride.id } }), t("Du fährst mit."))}>{t("Mitfahren")}</button>
          ) : (
            <p className="text-sm font-semibold">{t("Voll")}</p>
          )}
        </div>
      ))}
      {!mine ? (
        open ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={seats} onChange={(event) => setSeats(Number(event.target.value))} aria-label={t("Freie Plätze")} className="h-12 rounded-control border border-line bg-card px-4 text-sm font-semibold">
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? t("Platz") : t("Plätze")}</option>)}
              </select>
              <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={t("Ab wo? (optional)")} maxLength={60} aria-label={t("Abfahrtsort")} className="h-12 min-w-0 flex-1 rounded-control border border-line bg-sand px-4 text-base outline-none focus:border-accent" />
            </div>
            <Button type="button" className="w-full" onClick={() => run(() => offerRide({ data: { activityId, seats, origin } }), t("Danke, die anderen sehen deine Fahrt."))}>{t("Fahrt anbieten")}</Button>
          </div>
        ) : (
          <Button type="button" tone="ghost" className="w-full" onClick={() => setOpen(true)}>{t("Ich nehme jemanden mit")}</Button>
        )
      ) : null}
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}
