import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "@/lib/db";

/**
 * Link previews for shared activities: the text for og/twitter tags and a generated card image.
 * Only activities visible to everyone get a personal preview. Anything else gets the generic MeeQo card,
 * so a shared link never leaks title, place or photo of a restricted meetup.
 */

const BRAND = { sand: "#f6f1eb", sandDeep: "#efe6db", card: "#fffcf9", ink: "#241c18", muted: "#6f6159", accent: "#e07a5f", accentDeep: "#a8462f", onaccent: "#fff8f4" };
const TAGLINE = "Menschen über Aktivitäten kennenlernen.";

export type SharePreview =
  | { open: false }
  | { open: true; id: string; title: string; when: string; place: string; spotsLeft: number; intent: string; photo: string; version: string };

const INTENT_LABEL: Record<string, string> = { friends: "Freundschaft", date: "Date", both: "Freundschaft oder Date" };

export function whenLabel(value: unknown) {
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(date);
  return parts.replace(/,(?=[^,]*$)/, " ·") + " Uhr";
}

export async function loadPreview(id: string): Promise<SharePreview> {
  const clean = String(id ?? "").slice(0, 80);
  if (!clean) return { open: false };
  try {
    const sql = await getSql();
    const rows = await sql<{ id: string; title: string; place_name: string; city: string; starts_at: unknown; spots: number; image_url: string; visibility: string; cancelled: boolean; intent: string; area: string; taken: number }>`
      select a.id, a.title, a.place_name, a.city, a.starts_at, a.spots, a.image_url, a.visibility, a.cancelled, a.intent, a.area,
        (select count(*)::int from join_requests r where r.activity_id = a.id and r.status = 'accepted') as taken
      from activities a where a.id = ${clean}
    `;
    const row = rows[0];
    // Only "Egal" (everyone) is public. Friends, communities, events and age stay generic.
    if (!row || row.cancelled || (row.visibility && row.visibility !== "all")) return { open: false };
    const spotsLeft = Math.max(0, Number(row.spots) - Number(row.taken));
    const intent = row.area === "event" ? "Veranstaltung" : INTENT_LABEL[row.intent] ?? "Freundschaft";
    const when = whenLabel(row.starts_at);
    const place = [row.place_name, row.city].filter(Boolean).join(", ");
    const version = String(hash(`${row.title}|${when}|${place}|${spotsLeft}|${intent}|${row.image_url.length}`));
    return { open: true, id: row.id, title: row.title, when, place, spotsLeft, intent, photo: row.image_url, version };
  } catch {
    return { open: false };
  }
}

export function previewText(preview: SharePreview) {
  if (!preview.open) return { title: "MeeQo", description: TAGLINE + " Dating und Freundschaft bleiben getrennt." };
  const spots = preview.spotsLeft === 0 ? "Ausgebucht" : preview.spotsLeft === 1 ? "1 Platz frei" : `${preview.spotsLeft} Plätze frei`;
  return { title: preview.title, description: [preview.when, preview.place, spots, preview.intent].filter(Boolean).join(" · ") };
}

function hash(text: string) {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) value = ((value << 5) + value + text.charCodeAt(index)) >>> 0;
  return value.toString(36);
}

// satori and resvg (native) are loaded from node_modules at runtime instead of being bundled into the server build.
const load = (() => {
  let ready: Promise<{
    satori: (node: unknown, options: unknown) => Promise<string>;
    Resvg: new (svg: string, options?: unknown) => { render: () => { width: number; height: number; pixels: Buffer; asPng: () => Buffer } };
    jpeg: { encode: (image: { data: Buffer; width: number; height: number }, quality: number) => { data: Buffer } };
    fonts: unknown[];
  }> | null = null;
  return () => {
    ready ??= (async () => {
      const base = process.cwd();
      const req = createRequire(join(base, "package.json"));
      const satoriMod = req("satori");
      const { Resvg } = req("@resvg/resvg-js");
      const font = (pkg: string, file: string) => readFileSync(join(base, "node_modules", pkg, "files", file));
      const fonts = [
        { name: "Outfit", data: font("@fontsource/outfit", "outfit-latin-400-normal.woff"), weight: 400, style: "normal" },
        { name: "Outfit", data: font("@fontsource/outfit", "outfit-latin-700-normal.woff"), weight: 700, style: "normal" },
        { name: "Fraunces", data: font("@fontsource/fraunces", "fraunces-latin-600-normal.woff"), weight: 600, style: "normal" },
      ];
      const jpeg = req("jpeg-js");
      return { satori: satoriMod.default ?? satoriMod, Resvg, jpeg, fonts };
    })();
    ready.catch(() => (ready = null));
    return ready;
  };
})();

type Node = { type: string; props: Record<string, unknown> };
function h(type: string, style: Record<string, unknown>, ...children: Array<Node | string | null | false>): Node {
  const kids = children.filter((child): child is Node | string => Boolean(child));
  return { type, props: { style: { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
function img(src: string, style: Record<string, unknown>): Node {
  return { type: "img", props: { src, style } };
}

function wordmark(size: number, color = BRAND.ink) {
  return h("div", { alignItems: "center", gap: size * 0.35 },
    h("div", { width: size * 1.1, height: size * 1.1, borderRadius: size * 0.32, background: BRAND.accent, alignItems: "center", justifyContent: "center", color: BRAND.onaccent, fontFamily: "Fraunces", fontSize: size * 0.72 }, "M"),
    h("div", { fontFamily: "Fraunces", fontSize: size, color, letterSpacing: -1 }, "MeeQo"),
  );
}

function pill(text: string, size: number, solid = true) {
  return h("div", { paddingTop: Math.round(size * 0.35), paddingBottom: Math.round(size * 0.35), paddingLeft: Math.round(size * 0.8), paddingRight: Math.round(size * 0.8), borderRadius: Math.round(size * 0.5), backgroundColor: solid ? BRAND.accent : BRAND.sandDeep, color: solid ? BRAND.onaccent : BRAND.ink, fontSize: size, fontWeight: 700 }, text);
}

async function photoSrc(raw: string) {
  if (/^data:image\/(jpeg|png);base64,/.test(raw)) return raw;
  // Seed photos live in public/ (e.g. /activities/calisthenics.jpg).
  if (/^\/[\w\-/.]+\.(jpe?g|png)$/i.test(raw) && !raw.includes("..")) {
    for (const dir of ["public", ".output/public"]) {
      try {
        const bytes = readFileSync(join(process.cwd(), dir, raw));
        return `data:image/${/png$/i.test(raw) ? "png" : "jpeg"};base64,${bytes.toString("base64")}`;
      } catch {
        /* try the next place */
      }
    }
    return "";
  }
  if (!/^https:\/\//.test(raw)) return "";
  try {
    const response = await fetch(raw, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/image\/(jpeg|png)/.test(type)) return "";
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 4_000_000 ? "" : `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

function genericCard(width: number, height: number): Node {
  const story = height > width;
  return h("div", { width, height, flexDirection: "column", justifyContent: "center", alignItems: "center", background: BRAND.sand, fontFamily: "Outfit", color: BRAND.ink, gap: story ? 60 : 36, position: "relative" },
    h("div", { position: "absolute", top: -height * 0.25, right: -width * 0.2, width: width * 0.7, height: width * 0.7, borderRadius: width, background: BRAND.accent, opacity: 0.18 }),
    h("div", { position: "absolute", bottom: -height * 0.2, left: -width * 0.15, width: width * 0.5, height: width * 0.5, borderRadius: width, background: BRAND.accent, opacity: 0.12 }),
    wordmark(story ? 150 : 110),
    h("div", { fontSize: story ? 56 : 40, color: BRAND.muted, textAlign: "center", maxWidth: width * 0.8 }, TAGLINE),
    pill("Dating und Freundschaft bleiben getrennt", story ? 34 : 26, false),
  );
}

function activityCard(preview: Extract<SharePreview, { open: true }>, photo: string, width: number, height: number): Node {
  const { title, description } = previewText(preview);
  void description;
  const spots = preview.spotsLeft === 0 ? "Ausgebucht" : preview.spotsLeft === 1 ? "1 Platz frei" : `${preview.spotsLeft} Plätze frei`;
  if (height > width) {
    // Story 1080x1920: photo on top, text card below.
    return h("div", { width, height, flexDirection: "column", background: BRAND.sand, fontFamily: "Outfit", color: BRAND.ink },
      photo ? img(photo, { width, height: 1100, objectFit: "cover" }) : h("div", { width, height: 1100, background: BRAND.accent, alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontSize: 420, color: BRAND.onaccent }, "M"),
      h("div", { flexDirection: "column", flexGrow: 1, padding: "64px 80px", gap: 28, marginTop: -90, marginLeft: 50, marginRight: 50, borderRadius: 56, background: BRAND.card, boxShadow: "0 20px 60px rgba(36,28,24,0.18)" },
        h("div", { gap: 18 }, pill(preview.intent, 34, false), pill(spots, 34)),
        h("div", { fontFamily: "Fraunces", fontSize: 86, lineHeight: 1.05, lineClamp: 3 } as Record<string, unknown>, title),
        h("div", { fontSize: 44, color: BRAND.muted }, preview.when),
        h("div", { fontSize: 40, color: BRAND.muted, lineClamp: 2 } as Record<string, unknown>, preview.place),
        h("div", { marginTop: "auto", justifyContent: "space-between", alignItems: "center" }, wordmark(64), h("div", { fontSize: 32, color: BRAND.muted }, "Link in der App")),
      ),
    );
  }
  // Link card 1200x630: photo left, text right.
  return h("div", { width, height, background: BRAND.sand, fontFamily: "Outfit", color: BRAND.ink },
    photo
      ? img(photo, { width: 520, height, objectFit: "cover", flexShrink: 0 })
      : h("div", { width: 520, height, flexShrink: 0, background: BRAND.accent, alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontSize: 260, color: BRAND.onaccent }, "M"),
    h("div", { flexDirection: "column", flexGrow: 1, alignSelf: "stretch", paddingTop: 52, paddingBottom: 52, paddingLeft: 56, paddingRight: 56, justifyContent: "space-between" },
      wordmark(44),
      h("div", { flexDirection: "column", gap: 14 },
        h("div", { fontFamily: "Fraunces", fontSize: title.length > 40 ? 52 : 62, lineHeight: 1.08, lineClamp: 3 } as Record<string, unknown>, title),
        h("div", { fontSize: 30, color: BRAND.muted }, preview.when),
        h("div", { fontSize: 28, color: BRAND.muted, lineClamp: 1 } as Record<string, unknown>, preview.place),
      ),
      h("div", { gap: 14, flexShrink: 0 }, pill(spots, 26), pill(preview.intent, 26, false)),
    ),
  );
}

const cache = new Map<string, Buffer>();

/** JPEG for a link card (1200x630) or a story (1080x1920). Generic MeeQo card for anything not public.
 * JPEG, not PNG: WhatsApp drops preview images much over ~300 KB, and a photo as PNG is about 1 MB. */
export async function renderCard(id: string, story: boolean) {
  const preview = await loadPreview(id);
  const key = `${story ? "s" : "c"}:${preview.open ? `${preview.id}:${preview.version}` : "generic"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { satori, Resvg, jpeg, fonts } = await load();
  const [width, height] = story ? [1080, 1920] : [1200, 630];
  const node = preview.open ? activityCard(preview, await photoSrc(preview.photo), width, height) : genericCard(width, height);
  const svg = await satori(node, { width, height, fonts });
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: BRAND.sand }).render();
  const image = jpeg.encode({ data: rendered.pixels, width: rendered.width, height: rendered.height }, story ? 84 : 80).data;
  if (cache.size > 60) cache.delete(cache.keys().next().value as string);
  cache.set(key, image);
  return image;
}
