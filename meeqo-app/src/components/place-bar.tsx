import { useEffect, useRef, useState } from "react";
import { face, Note } from "@/components/bits";
import { useMe } from "@/components/shell";
import { setLocation, setPlace, setRadius, suggestPlaces, type PlaceHit } from "@/lib/meeqo/api";
import { errText, RADIUS_OPTIONS } from "@/lib/meeqo/labels";

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlaceBar({ onChange }: { onChange?: () => void }) {
  const { profile, reload } = useMe();
  const [open, setOpen] = useState<"city" | "radius" | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLooking(false);
      return;
    }
    let cancel = false;
    setLooking(true);
    const timer = window.setTimeout(() => {
      suggestPlaces({ data: { q } })
        .then((next) => {
          if (!cancel) setHits(next);
        })
        .catch((err) => {
          if (!cancel) setError(errText(err));
        })
        .finally(() => {
          if (!cancel) setLooking(false);
        });
    }, 350);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function choose(hit: PlaceHit) {
    setError("");
    try {
      await setPlace({ data: { city: hit.city, lat: hit.lat, lng: hit.lng } });
      await reload();
      onChange?.();
      setOpen(null);
      setQuery("");
      setHits([]);
    } catch (err) {
      setError(errText(err));
    }
  }

  async function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError("Dein Browser gibt keinen Standort her.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await setLocation({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          await reload();
          onChange?.();
          setOpen(null);
        } catch (err) {
          setError(errText(err));
        }
      },
      () => setError("Standort nicht freigegeben."),
    );
  }

  async function pickRadius(radiusKm: number) {
    setError("");
    try {
      await setRadius({ data: { radiusKm } });
      await reload();
      onChange?.();
      setOpen(null);
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-line bg-card px-3 text-sm font-semibold text-ink"
          onClick={() => setOpen(open === "city" ? null : "city")}
          aria-expanded={open === "city"}
        >
          {profile?.city || "Standort"}
          <Chevron />
        </button>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-line bg-card px-3 text-sm font-semibold text-ink"
          onClick={() => setOpen(open === "radius" ? null : "radius")}
          aria-expanded={open === "radius"}
        >
          {profile?.radiusKm ?? 25} km
          <Chevron />
        </button>
      </div>
      {open === "city" ? (
        <div className="card space-y-3 p-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const typed = query.trim();
              if (hits[0]) void choose(hits[0]);
              else if (typed.length >= 2) void choose({ city: typed, label: typed, detail: "", lat: Number.NaN, lng: Number.NaN });
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Postleitzahl, Stadt oder Dorf"
              className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-line bg-sand px-3 text-sm"
              autoFocus
            />
            <button type="submit" className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-semibold text-onaccent">
              Übernehmen
            </button>
          </form>
          {looking ? <p className="text-sm text-muted">Suche Orte…</p> : null}
          {hits.length ? (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Auswahl</p>
              {hits.map((hit) => (
                <button
                  key={`${hit.label}-${hit.detail}-${hit.lat}`}
                  type="button"
                  onClick={() => choose(hit)}
                  className="flex w-full flex-col items-start rounded-2xl border-2 border-line bg-card px-3 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold">{hit.label}</span>
                  {hit.detail ? <span className="text-xs text-muted">{hit.detail}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {!looking && /^\d{1,4}$/.test(query.trim()) ? (
            <p className="text-sm text-muted">Postleitzahl hat fünf Stellen. Danach kommen die Orte darunter.</p>
          ) : null}
          {!looking && query.trim().length >= 2 && !/^\d{1,4}$/.test(query.trim()) && hits.length === 0 ? (
            <p className="text-sm text-muted">Nichts Passendes. Schreib den Namen oder die Postleitzahl genauer.</p>
          ) : null}
          <button type="button" className={face} onClick={locate}>Standort nutzen</button>
        </div>
      ) : null}
      {open === "radius" ? (
        <div className="card flex flex-wrap gap-2 p-3">
          {RADIUS_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => pickRadius(item)}
              className={`inline-flex h-11 items-center rounded-full border-2 px-3 text-sm font-semibold ${item === profile?.radiusKm ? "border-accent bg-accent text-onfill" : "border-line bg-card text-ink"}`}
            >
              {item} km
            </button>
          ))}
        </div>
      ) : null}
      {error ? <Note>{error}</Note> : null}
    </div>
  );
}

export function PlaceSuggest({
  value,
  onChange,
  onPick,
  placeholder,
}: {
  value: string;
  onChange: (city: string) => void;
  onPick?: (hit: PlaceHit) => void;
  placeholder: string;
}) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [looking, setLooking] = useState(false);
  const picked = useRef("");

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === picked.current) {
      setHits([]);
      setLooking(false);
      return;
    }
    let cancel = false;
    setLooking(true);
    const timer = window.setTimeout(() => {
      suggestPlaces({ data: { q } })
        .then((next) => {
          if (!cancel) setHits(next);
        })
        .catch(() => {
          if (!cancel) setHits([]);
        })
        .finally(() => {
          if (!cancel) setLooking(false);
        });
    }, 350);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={(event) => {
          picked.current = "";
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-line bg-card px-4 text-base outline-none focus:border-accent"
      />
      {looking ? <p className="text-sm text-muted">Suche Orte…</p> : null}
      {hits.length ? (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Auswahl</p>
          {hits.map((hit) => (
            <button
              key={`${hit.label}-${hit.detail}-${hit.lat}`}
              type="button"
              onClick={() => {
                picked.current = hit.city;
                onChange(hit.city);
                onPick?.(hit);
                setHits([]);
              }}
              className="flex w-full flex-col items-start rounded-2xl border-2 border-line bg-card px-3 py-2.5 text-left"
            >
              <span className="text-sm font-semibold">{hit.label}</span>
              {hit.detail ? <span className="text-xs text-muted">{hit.detail}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
