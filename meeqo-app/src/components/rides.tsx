import { useState } from "react";
import { Car } from "lucide-react";
import { Button } from "@/components/bits";
import { cancelRide, claimRide, leaveRide, listRides, offerRide } from "@/lib/meeqo/api";
import { notice } from "@/lib/meeqo/feel";
import { errText } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

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
      <h2 className="flex items-center gap-2 font-display text-2xl"><Car className="h-5 w-5" aria-hidden="true" />Mitfahren</h2>
      {rides.length === 0 ? <p className="text-sm text-muted">Noch niemand fährt. Wenn du ein Auto hast, nimm jemanden mit.</p> : null}
      {rides.map((ride) => (
        <div key={ride.id} className="space-y-2 rounded-2xl bg-sand-deep p-3">
          <p className="text-sm font-semibold">{ride.mine ? "Du fährst" : `${ride.driverName} fährt`}{ride.origin ? ` ab ${ride.origin}` : ""}</p>
          <p className="text-sm text-muted">{ride.free} von {ride.seats} Plätzen frei{ride.riders.length ? ` · mit ${ride.riders.join(", ")}` : ""}</p>
          {ride.mine ? (
            <button type="button" className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold" onClick={() => run(() => cancelRide({ data: { rideId: ride.id } }), "Fahrt abgesagt.")}>Fahrt absagen</button>
          ) : ride.iRide ? (
            <button type="button" className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold" onClick={() => run(() => leaveRide({ data: { rideId: ride.id } }), "Du fährst nicht mehr mit.")}>Nicht mehr mitfahren</button>
          ) : ride.free > 0 ? (
            <button type="button" className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-onfill" onClick={() => run(() => claimRide({ data: { rideId: ride.id } }), "Du fährst mit.")}>Mitfahren</button>
          ) : (
            <p className="text-sm font-semibold">Voll</p>
          )}
        </div>
      ))}
      {!mine ? (
        open ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={seats} onChange={(event) => setSeats(Number(event.target.value))} aria-label="Freie Plätze" className="h-12 rounded-full border border-line bg-card px-4 text-sm font-semibold">
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? "Platz" : "Plätze"}</option>)}
              </select>
              <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Ab wo? (optional)" maxLength={60} aria-label="Abfahrtsort" className="h-12 min-w-0 flex-1 rounded-full border border-line bg-sand px-4 text-base outline-none focus:border-accent" />
            </div>
            <Button type="button" className="w-full" onClick={() => run(() => offerRide({ data: { activityId, seats, origin } }), "Danke, die anderen sehen deine Fahrt.")}>Fahrt anbieten</Button>
          </div>
        ) : (
          <Button type="button" tone="ghost" className="w-full" onClick={() => setOpen(true)}>Ich nehme jemanden mit</Button>
        )
      ) : null}
      {fail ? <p className="text-sm text-accent-deep">{fail}</p> : null}
    </div>
  );
}
