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
  speyer: [49.3173, 8.4312],
  ludwigshafen: [49.4774, 8.4452],
  landau: [49.1989, 8.1169],
  "neustadt an der weinstraße": [49.3501, 8.1368],
  worms: [49.6341, 8.3507],
  kaiserslautern: [49.4401, 7.7491],
  heilbronn: [49.1427, 9.2109],
  ludwigsburg: [48.8975, 9.1920],
  böblingen: [48.6836, 9.0141],
  boeblingen: [48.6836, 9.0141],
  offenburg: [48.4735, 7.9444],
  bühl: [48.6967, 8.1358],
  buehl: [48.6967, 8.1358],
  bretten: [49.0366, 8.7063],
  sinsheim: [49.2530, 8.8795],
  schwetzingen: [49.3829, 8.5732],
  weinheim: [49.5493, 8.6683],
  mosbach: [49.3532, 9.1517],
  calw: [48.7144, 8.7391],
  freudenstadt: [48.4636, 8.4122],
  germersheim: [49.2236, 8.3639],
  wörth: [49.0486, 8.2644],
  pirmasens: [49.2012, 7.6058],
  zweibrücken: [49.2491, 7.3646],
};

export const CITY_CHIPS = [
  "Karlsruhe",
  "Mannheim",
  "Heidelberg",
  "Stuttgart",
  "Pforzheim",
  "Heilbronn",
  "Baden-Baden",
  "Speyer",
  "Offenburg",
  "Kaiserslautern",
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
    .sort((a, b) => Number(b[0].startsWith(q)) - Number(a[0].startsWith(q)))
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