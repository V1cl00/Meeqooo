import { getWeather } from "@/lib/meeqo/api";
import { useLoad } from "@/lib/meeqo/use-load";
import { t } from "@/lib/meeqo/i18n";

const ICON = { sun: "☀️", cloud: "☁️", fog: "🌫️", rain: "🌧️", snow: "❄️", storm: "⛈️" } as const;

/** One line of forecast for the hour the meetup starts, with a short hint for outdoor meetups when it turns bad. */
export function WeatherChip({ id }: { id: string }) {
  const { data } = useLoad(() => getWeather({ data: { id } }).catch(() => null), [id]);
  if (!data) return null;
  return (
    <div className="space-y-1">
      <p className="inline-flex items-center gap-2 rounded-full bg-sand-deep px-3 py-1 text-sm font-semibold">
        <span aria-hidden>{ICON[data.kind]}</span>
        {t(data.label)}, {data.temp}°{data.rain >= 30 ? ` · ${t("{0} % Regen", data.rain)}` : ""}
      </p>
      {data.hint ? <p className="text-sm text-muted">{t(data.hint)}</p> : null}
    </div>
  );
}
