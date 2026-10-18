import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { loadPreview, previewText } from "@/lib/meeqo/share-card.server";

export type ShareMeta = { title: string; description: string; image: string; url: string; open: boolean };

function originOf(request: Request) {
  const configured = process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL || "";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  if (host) return `${proto || new URL(request.url).protocol.replace(":", "")}://${host.split(",")[0].trim()}`;
  return configured.replace(/\/$/, "") || new URL(request.url).origin;
}

/** Link-preview data for /activity/$id. Needs no login: crawlers fetch it. Only public activities reveal anything. */
export const getShareMeta = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => ({ id: String(input?.id ?? "").slice(0, 80) }))
  .handler(async ({ data }): Promise<ShareMeta> => {
    const preview = await loadPreview(data.id);
    const origin = originOf(getRequest());
    const text = previewText(preview);
    const version = preview.open ? preview.version : "g";
    return {
      ...text,
      open: preview.open,
      url: `${origin}/activity/${encodeURIComponent(data.id)}`,
      image: `${origin}/og/activity/${encodeURIComponent(data.id)}?v=${version}`,
    };
  });

export function shareMetaTags(meta: ShareMeta | undefined) {
  if (!meta) return [];
  return [
    { title: meta.open ? `${meta.title} · MeeQo` : "MeeQo" },
    { name: "description", content: meta.description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "MeeQo" },
    { property: "og:title", content: meta.title },
    { property: "og:description", content: meta.description },
    { property: "og:url", content: meta.url },
    { property: "og:image", content: meta.image },
    { property: "og:image:type", content: "image/jpeg" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: meta.title },
    { property: "og:locale", content: "de_DE" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: meta.title },
    { name: "twitter:description", content: meta.description },
    { name: "twitter:image", content: meta.image },
  ];
}
