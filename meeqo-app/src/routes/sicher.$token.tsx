import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";
import { getSafetyView } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/sicher/$token")({ component: Page });

/** Public: opened by someone who got the link, usually without an account. */
function Page() {
  const { token } = Route.useParams();
  const { data, error, loading, reload } = useLoad(() => getSafetyView({ data: { token } }), [token]);

  useEffect(() => {
    const timer = window.setInterval(reload, 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      {loading && !data ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {error ? <Note>{error}</Note> : null}
      {data ? (
        <>
          <h1 className="font-display text-3xl leading-none">{data.name} geht zu einem Treffen</h1>
          <section className="card space-y-1 p-4">
            <p className="font-semibold">{data.title}</p>
            <p className="text-sm text-muted">{formatWhen(data.startsAt)}</p>
            <p className="text-sm text-muted">{data.placeName}, {data.city}</p>
          </section>
          <section
            className={`rounded-[1.5rem] p-5 ${data.state === "ok" ? "bg-friend text-onaccent" : data.state === "late" ? "border-2 border-ink bg-card" : "bg-sand-deep"}`}
            aria-live="polite"
          >
            {data.state === "ok" ? (
              <>
                <p className="font-display text-2xl leading-none">Eingecheckt</p>
                <p className="mt-2 text-sm">{data.name} ist angekommen{data.checkedInAt ? ` um ${formatWhen(data.checkedInAt)}` : ""}.</p>
              </>
            ) : data.state === "late" ? (
              <>
                <p className="font-display text-2xl leading-none">Kein Check-in seit {data.minutesLate} Minuten</p>
                <p className="mt-2 text-sm">Melde dich bei {data.name}. Erreichst du die Person nicht, ruf im Zweifel den Notruf.</p>
                <a href="tel:112" className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-onaccent">112 anrufen</a>
              </>
            ) : (
              <>
                <p className="font-display text-2xl leading-none">Noch nicht losgegangen</p>
                <p className="mt-2 text-sm">Diese Seite aktualisiert sich selbst. Sie schlägt an, wenn der Check-in 30 Minuten nach Beginn fehlt.</p>
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
