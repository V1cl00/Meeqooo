import { createFileRoute, Link } from "@tanstack/react-router";
import { Note, Wordmark } from "@/components/bits";
import { getInvite } from "@/lib/meeqo/api";
import { formatWhen } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

/** Public: opened by someone who got the link and may not have an account yet. The head is filled on the server so WhatsApp and others show a preview. */
export const Route = createFileRoute("/einladung/$token")({
  loader: async ({ params }) => {
    try {
      return await getInvite({ data: { token: params.token } });
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "MeeQo" }, { name: "robots", content: "noindex, nofollow" }] };
    const title = `${loaderData.hostName} lädt dich ein: ${loaderData.title}`;
    const description = `${formatWhen(loaderData.startsAt)} · ${loaderData.placeName}, ${loaderData.city}`;
    const image = loaderData.imageUrl ? (loaderData.imageUrl.startsWith("http") ? loaderData.imageUrl : `${loaderData.origin}${loaderData.imageUrl}`) : "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ],
    };
  },
  component: Page,
});

function Page() {
  const data = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-8">
      <Wordmark className="text-2xl" />
      {!data ? <Note>{t("Diese Einladung gilt nicht mehr.")}</Note> : null}
      {data ? (
        <>
          <h1 className="font-display text-3xl leading-none">{t("{0} lädt dich ein", data.hostName)}</h1>
          <article className="card overflow-hidden">
            {data.imageUrl ? <img src={data.imageUrl} alt="" className="aspect-[3/2] w-full object-cover" /> : null}
            <div className="space-y-1 p-4">
              <h2 className="font-display text-2xl leading-tight">{data.title}</h2>
              <p className="text-sm">{formatWhen(data.startsAt)}</p>
              <p className="text-sm text-muted">{data.placeName}, {data.city}</p>
              <p className="pt-1 text-sm font-semibold">{data.spotsLeft > 0 ? t("{0} Plätze frei", data.spotsLeft) : t("Gerade keine Plätze frei")}</p>
            </div>
          </article>
          <p className="text-sm text-muted">{t("Mitmachen geht über eine Anfrage. {0} sagt zu. Du brauchst dafür ein Konto und ein Profilfoto.", data.hostName)}</p>
          <Link to="/login" search={{ next: `/activity/${data.activityId}` }} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-onfill">{t("Anmelden und ansehen")}</Link>
        </>
      ) : null}
    </main>
  );
}
