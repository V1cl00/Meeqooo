import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";
import { getInvite } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { useLoad } from "@/lib/meeqo/use-load";

export const Route = createFileRoute("/einladung/$token")({ component: Page });

/** Public: opened by someone who got the link and may not have an account yet. */
function Page() {
  const { token } = Route.useParams();
  const { data, error, loading } = useLoad(() => getInvite({ data: { token } }), [token]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      {loading ? <p className="text-sm text-muted">Wird geladen…</p> : null}
      {error ? <Note>{error}</Note> : null}
      {data ? (
        <>
          <h1 className="font-display text-3xl leading-none">{data.hostName} lädt dich ein</h1>
          <article className="card overflow-hidden">
            {data.imageUrl ? <img src={data.imageUrl} alt="" className="aspect-[3/2] w-full object-cover" /> : null}
            <div className="space-y-1 p-4">
              <h2 className="font-display text-2xl leading-tight">{data.title}</h2>
              <p className="text-sm">{formatWhen(data.startsAt)}</p>
              <p className="text-sm text-muted">{data.placeName}, {data.city}</p>
              <p className="pt-1 text-sm font-semibold">{data.spotsLeft > 0 ? `${data.spotsLeft} Plätze frei` : "Gerade keine Plätze frei"}</p>
            </div>
          </article>
          <p className="text-sm text-muted">Mitmachen geht über eine Anfrage. {data.hostName} sagt zu. Du brauchst dafür ein Konto und ein Profilfoto.</p>
          <Link to="/login" search={{ next: `/activity/${data.activityId}` }} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-onaccent">
            Anmelden und ansehen
          </Link>
        </>
      ) : null}
    </main>
  );
}
