import type { CSSProperties } from "react";

export type AppTheme = {
  name: string;
  sand: string;
  sandDeep: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentDeep: string;
  friend: string;
  onaccent: string;
  radius: "soft" | "round" | "tight";
  font: "warm" | "calm" | "plain";
};

const HEX = /^#[0-9a-f]{6}$/i;

const FONTS = {
  warm: {
    sans: '"Outfit", ui-sans-serif, system-ui, sans-serif',
    display: '"Fraunces", Georgia, serif',
  },
  calm: {
    sans: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    display: '"Literata", Georgia, serif',
  },
  plain: {
    sans: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    display: '"Newsreader", Georgia, serif',
  },
} as const;

function hex(value: unknown) {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : null;
}

function channel(value: number) {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relLum(color: string) {
  const n = Number.parseInt(color.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string) {
  const hi = Math.max(relLum(a), relLum(b));
  const lo = Math.min(relLum(a), relLum(b));
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, amount: number) {
  const left = Number.parseInt(a.slice(1), 16);
  const right = Number.parseInt(b.slice(1), 16);
  const parts = [16, 8, 0].map((shift) => {
    const from = (left >> shift) & 255;
    const to = (right >> shift) & 255;
    return Math.round(from + (to - from) * amount);
  });
  return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function readable(bg: string, prefer: string | null) {
  const dark = "#1c1917";
  const light = "#f7f3ee";
  if (prefer && contrast(bg, prefer) >= 4.5) return prefer;
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
}

export function hsl(h: number, s: number, l: number) {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((part) => Math.round((part + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeTheme(raw: unknown): AppTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const sand = hex(row.sand) ?? "#f7f1ea";
  const accent = hex(row.accent) ?? "#e07a5f";
  let friend = hex(row.friend) ?? "#3f6b58";
  const ink = readable(sand, hex(row.ink));
  const card = relLum(sand) > 0.45 ? mix(sand, "#ffffff", 0.7) : mix(sand, "#ffffff", 0.07);
  const finalInk = readable(card, ink);
  if (contrast(sand, friend) < 3) friend = mix(friend, finalInk, 0.5);
  const dark = relLum(sand) < 0.4;
  const name = typeof row.name === "string" ? row.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  return {
    name: name || "Dein Design",
    sand,
    sandDeep: dark ? mix(sand, "#000000", 0.25) : mix(sand, finalInk, 0.08),
    card,
    ink: finalInk,
    muted: contrast(sand, mix(finalInk, sand, 0.38)) >= 3 ? mix(finalInk, sand, 0.38) : mix(finalInk, sand, 0.22),
    line: mix(sand, finalInk, dark ? 0.22 : 0.14),
    accent,
    accentDeep: mix(accent, dark || relLum(accent) > 0.45 ? "#000000" : "#ffffff", 0.22),
    friend,
    onaccent: readable(accent, "#fff8f4"),
    radius: row.radius === "tight" || row.radius === "round" ? row.radius : "soft",
    font: row.font === "calm" || row.font === "plain" ? row.font : "warm",
  };
}

const PRESETS: { keys: string[]; theme: Record<string, string> }[] = [
  { keys: ["nacht", "dunkel", "schwarz"], theme: { name: "Nacht", sand: "#171412", accent: "#e08a6a", friend: "#9dceb8", ink: "#f6efe8", radius: "soft", font: "warm" } },
  { keys: ["meer", "blau", "ozean", "wasser"], theme: { name: "Meer", sand: "#eef3f4", accent: "#2f6f8f", friend: "#3d6b56", ink: "#1c2a30", radius: "round", font: "calm" } },
  { keys: ["wald", "grün", "gruen", "natur"], theme: { name: "Wald", sand: "#f2f3ec", accent: "#3c6b48", friend: "#8a5a34", ink: "#243028", radius: "soft", font: "calm" } },
  { keys: ["sonne", "gold", "gelb", "warm"], theme: { name: "Sonne", sand: "#fbf6ec", accent: "#c47a12", friend: "#3f6b58", ink: "#2c2416", radius: "round", font: "warm" } },
  { keys: ["rosa", "blüte", "bluete", "weich"], theme: { name: "Blüte", sand: "#fbf4f2", accent: "#c45d6a", friend: "#5c6b4a", ink: "#2c2224", radius: "round", font: "warm" } },
];

export function localTheme(note: string): AppTheme {
  const text = note.toLowerCase();
  const preset = PRESETS.find((item) => item.keys.some((key) => text.includes(key)));
  if (preset) return normalizeTheme(preset.theme) ?? normalizeTheme({ sand: "#f7f1ea", accent: "#e07a5f" })!;
  let hash = 0;
  for (const char of note) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const dark = text.includes("abend") && text.includes("dunkel");
  return normalizeTheme({
    name: "Für dich",
    sand: dark ? hsl(hue, 16, 12) : hsl(hue, 32, 95),
    accent: hsl(hue, 48, dark ? 62 : 46),
    friend: hsl((hue + 140) % 360, 26, dark ? 70 : 30),
    ink: dark ? "#f4efe8" : hsl(hue, 18, 16),
    radius: hash % 3 === 0 ? "tight" : hash % 3 === 1 ? "round" : "soft",
    font: hash % 3 === 0 ? "plain" : hash % 3 === 1 ? "calm" : "warm",
  })!;
}

export function themeStyle(theme: AppTheme | null): CSSProperties | undefined {
  if (!theme) return undefined;
  const font = FONTS[theme.font];
  return {
    "--color-sand": theme.sand,
    "--color-sand-deep": theme.sandDeep,
    "--color-card": theme.card,
    "--color-ink": theme.ink,
    "--color-muted": theme.muted,
    "--color-line": theme.line,
    "--color-accent": theme.accent,
    "--color-accent-deep": theme.accentDeep,
    "--color-friend": theme.friend,
    "--color-onaccent": theme.onaccent,
    "--font-sans": font.sans,
    "--font-display": font.display,
    "--radius-card": theme.radius === "tight" ? "0.7rem" : theme.radius === "round" ? "1.85rem" : "1.35rem",
    fontFamily: "var(--font-sans)",
    background: theme.sand,
    color: theme.ink,
    colorScheme: relLum(theme.sand) < 0.4 ? "dark" : "light",
  } as CSSProperties;
}
