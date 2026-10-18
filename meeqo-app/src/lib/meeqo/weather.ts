/** Forecast for a meetup, from Open-Meteo (no key). The parsing is plain so it can be tested without network. */
export type Weather = {
  /** Degrees Celsius, rounded */
  temp: number;
  /** Chance of rain in percent */
  rain: number;
  kind: "sun" | "cloud" | "fog" | "rain" | "snow" | "storm";
  /** German key for t(), e.g. "Sonnig" */
  label: string;
  /** Only set for outdoor meetups when the weather is bad */
  hint: string;
};

type Hourly = { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weathercode: number[] };

function kindOf(code: number): { kind: Weather["kind"]; label: string } {
  if (code === 0) return { kind: "sun", label: "Sonnig" };
  if (code <= 2) return { kind: "sun", label: "Meist sonnig" };
  if (code === 3) return { kind: "cloud", label: "Bewölkt" };
  if (code === 45 || code === 48) return { kind: "fog", label: "Neblig" };
  if (code >= 95) return { kind: "storm", label: "Gewitter" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: "snow", label: "Schnee" };
  if (code >= 51) return { kind: "rain", label: code >= 61 ? "Regen" : "Nieselregen" };
  return { kind: "cloud", label: "Bewölkt" };
}

const OUTDOOR = /^(Outdoor|Sport · (Laufen|Radfahren|Ballsport|Calisthenics))|Picknick|Wandern|Spaziergang|Gassi/;

/**
 * Picks the hour of the meetup (Berlin wall time, "2026-10-17T19:00") out of the hourly forecast.
 * Returns null when the forecast does not reach that far.
 */
export function pickWeather(hourly: Hourly, localHour: string, category: string): Weather | null {
  const index = hourly.time.indexOf(localHour);
  if (index === -1) return null;
  const temp = hourly.temperature_2m[index];
  const code = hourly.weathercode[index];
  if (typeof temp !== "number" || typeof code !== "number") return null;
  const rain = Math.round(hourly.precipitation_probability[index] ?? 0);
  const { kind, label } = kindOf(code);
  let hint = "";
  if (OUTDOOR.test(category)) {
    if (kind === "storm") hint = "Bei Gewitter lieber drinnen treffen.";
    else if (kind === "rain" || rain >= 60) hint = "Regenjacke mitnehmen oder einen Ort drinnen wählen.";
    else if (kind === "snow") hint = "Warm anziehen, es kann rutschig sein.";
    else if (temp <= 3) hint = "Kalt, warm anziehen.";
    else if (temp >= 30) hint = "Heiß, Wasser mitnehmen.";
  }
  return { temp: Math.round(temp), rain, kind, label, hint };
}

/** "2026-10-17T19:00" in Berlin time for an ISO instant. */
export function berlinHour(startsAt: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(startsAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:00`;
}
