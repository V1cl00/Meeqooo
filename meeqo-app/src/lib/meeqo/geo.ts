const CITIES: Record<string, [number, number]> = {
  karlsruhe: [49.0069, 8.4037],
  mannheim: [49.4875, 8.466],
  heidelberg: [49.3988, 8.6724],
  stuttgart: [48.7758, 9.1829],
  freiburg: [47.999, 7.8421],
  berlin: [52.52, 13.405],
  hamburg: [53.5511, 9.9937],
  münchen: [48.1351, 11.582],
  muenchen: [48.1351, 11.582],
  köln: [50.9375, 6.9603],
  koeln: [50.9375, 6.9603],
  frankfurt: [50.1109, 8.6821],
  durlach: [49.0, 8.47],
  bruchsal: [49.1242, 8.5981],
  ettlingen: [48.9408, 8.4076],
  düsseldorf: [51.2277, 6.7735],
  duesseldorf: [51.2277, 6.7735],
  dortmund: [51.5136, 7.4653],
  essen: [51.4556, 7.0116],
  leipzig: [51.3397, 12.3731],
  dresden: [51.0504, 13.7373],
  hannover: [52.3759, 9.732],
  nürnberg: [49.4521, 11.0767],
  nuernberg: [49.4521, 11.0767],
  bremen: [53.0793, 8.8017],
  bonn: [50.7374, 7.0982],
  mainz: [49.9929, 8.2473],
  wiesbaden: [50.0782, 8.2398],
  augsburg: [48.3705, 10.8978],
  aachen: [50.7753, 6.0839],
  potsdam: [52.3906, 13.0645],
  konstanz: [47.6779, 9.1732],
  ulm: [48.4011, 9.9876],
  tübingen: [48.5216, 9.0576],
  tuebingen: [48.5216, 9.0576],
  pforzheim: [48.8922, 8.6946],
  rastatt: [48.8574, 8.2066],
  "baden-baden": [48.7606, 8.2398],
};

export const CITY_CHIPS = [
  "Karlsruhe",
  "Mannheim",
  "Heidelberg",
  "Stuttgart",
  "Freiburg",
  "Frankfurt",
  "Köln",
  "Berlin",
  "Hamburg",
  "München",
] as const;

export function matchCities(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const label = new Map<string, string>();
  for (const chip of CITY_CHIPS) label.set(chip.toLowerCase(), chip);
  for (const key of Object.keys(CITIES)) {
    if (!label.has(key)) label.set(key, key.replace(/(^|[\s-])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase()));
  }
  return [...label.entries()]
    .filter(([key]) => key.startsWith(q) || key.includes(q))
    .slice(0, 6)
    .map(([key, city]) => ({ city, lat: CITIES[key][0], lng: CITIES[key][1] }));
}

export function cityCoords(city: string) {
  const key = city.trim().toLowerCase();
  const hit = CITIES[key];
  if (!hit) return null;
  return { lat: hit[0], lng: hit[1] };
}

export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}