import { cityCoords } from "./geo.ts";

export type LatLng = { lat: number; lng: number };

export async function lookupPlace(city: string): Promise<LatLng | null> {
  const known = cityCoords(city);
  if (known) return known;
  const q = city.trim();
  if (q.length < 2) return null;
  const code = q.match(/\b(\d{5})\b/)?.[1];
  if (code) {
    const point = await plzPoint(code);
    if (point) return point;
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=de`,
      { headers: { "User-Agent": "MeeQo/1.0 (activity meetup)", Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(body[0]?.lat);
    const lng = Number(body[0]?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {
    return null;
  }
  return null;
}

export async function plzPoint(code: string) {
  try {
    const res = await fetch(`https://api.zippopotam.us/de/${code}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { places?: { latitude?: string; longitude?: string }[] };
    const lat = Number(body.places?.[0]?.latitude);
    const lng = Number(body.places?.[0]?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function plzChoices(query: string) {
  const q = query.trim();
  const code = q.match(/\b(\d{5})\b/)?.[1] ?? "";
  type Row = { postalCode: string; name: string; state: string };
  const rows: Row[] = [];
  const take = (body: { postalCode?: string; name?: string; federalState?: { name?: string } }[]) => {
    for (const row of body) {
      const postalCode = row.postalCode || "";
      const name = row.name || "";
      if (!/^\d{5}$/.test(postalCode) || name.length < 2) continue;
      rows.push({ postalCode, name, state: row.federalState?.name || "" });
    }
  };
  try {
    if (code) {
      const exact = await fetch(`https://openplzapi.org/de/Localities?postalCode=${code}`, { headers: { Accept: "application/json" } });
      if (exact.ok) take((await exact.json()) as { postalCode?: string; name?: string; federalState?: { name?: string } }[]);
      const city = rows[0]?.name;
      if (city) {
        const more = await fetch(`https://openplzapi.org/de/Localities?name=${encodeURIComponent(city)}`, { headers: { Accept: "application/json" } });
        if (more.ok) take((await more.json()) as { postalCode?: string; name?: string; federalState?: { name?: string } }[]);
      }
    } else if (!/^\d+$/.test(q)) {
      const byName = await fetch(`https://openplzapi.org/de/Localities?name=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      if (byName.ok) take((await byName.json()) as { postalCode?: string; name?: string; federalState?: { name?: string } }[]);
    }
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.postalCode}|${row.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

