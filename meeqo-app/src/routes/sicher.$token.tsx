import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";
import { getSafetyView } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/sicher/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

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
      {loading && !data ? <p className="text-sm text-muted">{t("Wird geladen…")}</p> : null}
      {error ? <Note>{error}</Note> : null}
      {data ? (
        <>
          <h1 className="font-display text-3xl leading-none">{t("{0} geht zu einem Treffen", data.name)}</h1>
          <section className="card space-y-1 p-4">
            <p className="font-semibold">{data.title}</p>
            <p className="text-sm text-muted">{formatWhen(data.startsAt)}</p>
            <p className="text-sm text-muted">{data.placeName}, {data.city}</p>
          </section>
          <section
            className={`rounded-[1.5rem] p-5 ${data.state === "ok" || data.state === "safe" ? "bg-friend text-onaccent" : data.state === "late" ? "border-2 border-ink bg-card" : "bg-sand-deep"}`}
            aria-live="polite"
          >
            {data.state === "safe" ? (
              <>
                <p className="font-display text-2xl leading-none">{t("Alles gut")}</p>
                <p className="mt-2 text-sm">{t("{0} hat Bescheid gesagt{1}: gut angekommen.", data.name, data.safeAt ? t(" um {0}", formatWhen(data.safeAt)) : "")}</p>
              </>
            ) : data.state === "ok" ? (
              <>
                <p className="font-display text-2xl leading-none">{t("Eingecheckt")}</p>
                <p className="mt-2 text-sm">{t("{0} ist angekommen{1}.", data.name, data.checkedInAt ? t(" um {0}", formatWhen(data.checkedInAt)) : "")}</p>
              </>
            ) : data.state === "late" ? (
              <>
                <p className="font-display text-2xl leading-none">{t("Kein Check-in seit {0} Minuten", data.minutesLate)}</p>
                <p className="mt-2 text-sm">{t("Melde dich bei {0}. Erreichst du die Person nicht, ruf im Zweifel den Notruf.", data.name)}</p>
                <a href="tel:112" className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-onaccent">{t("112 anrufen")}</a>
              </>
            ) : (
              <>
                <p className="font-display text-2xl leading-none">{t("Noch nicht losgegangen")}</p>
                <p className="mt-2 text-sm">{t("Diese Seite aktualisiert sich selbst. Sie schlägt an, wenn der Check-in 30 Minuten nach Beginn fehlt.")}</p>
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
