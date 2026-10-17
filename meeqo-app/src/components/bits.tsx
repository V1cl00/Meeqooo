import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Briefcase, Calendar, MapPin, MoreHorizontal, Ticket, Users } from "lucide-react";
import { CardSheet } from "@/components/card-menu";
import { activityIntentLabel, formatWhen, sparteOf, type Sparte } from "@/lib/meeqo/labels";
import type { ActivityCard as Activity } from "@/lib/meeqo/types";
import { t } from "@/lib/meeqo/i18n";

export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#E07A5F" />
      <circle cx="11.5" cy="11.3" r="3.15" fill="#F7F1EA" />
      <circle cx="20.5" cy="11.3" r="3.15" fill="#F7F1EA" />
      <path fill="#F7F1EA" d="M7.7 16.6C6.5 19.2 8.4 23.6 13.2 24.2 15.4 21.6 14.8 17.2 12.4 15.8 10.6 14.8 8.6 15.2 7.7 16.6Z" />
      <path fill="#F7F1EA" d="M24.3 16.6C25.5 19.2 23.6 23.6 18.8 24.2 16.6 21.6 17.2 17.2 19.6 15.8 21.4 14.8 23.4 15.2 24.3 16.6Z" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display tracking-tight ${className}`}>
      <Mark className="h-[1.05em] w-[1.05em] shrink-0" />
      <span>{t("Mee")}<span className="text-accent">Q</span>o
      </span>
    </span>
  );
}

export function WelcomeHero() {
  return (
    <section className="card overflow-hidden">
      <div className="relative h-44 bg-[linear-gradient(145deg,#f3c7b8_0%,#e07a5f_42%,#c45d45_100%)]">
        <div className="absolute inset-x-4 bottom-0 translate-y-8 rounded-2xl border border-line bg-card p-3 shadow-[0_12px_28px_rgba(36,28,24,0.12)]">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand">
              <Mark className="h-8 w-8" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">{t("Sonntag · Schlossgarten")}</p>
              <p className="truncate font-display text-xl leading-none">{t("Laufen, acht Kilometer")}</p>
            </div>
            <span className="ml-auto rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-bold text-ink">{t("Beispiel")}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-5 pt-12">
        <Wordmark className="text-2xl" />
        <h1 className="font-display text-[1.85rem] leading-[1.05]">{t("Treffen über etwas, das ihr wirklich tut.")}</h1>
        <p className="text-sm leading-relaxed text-muted">{t("Dating und Freundschaft bleiben getrennt. Absicht ist von Anfang an sichtbar.")}</p>
      </div>
    </section>
  );
}

export const face =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-[0_1px_0_rgba(255,255,255,0.7)] active:scale-[0.98]";

export function Button({
  tone = "accent",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "accent" | "ink" | "ghost" }) {
  const tones = {
    accent: "bg-accent text-onfill shadow-[0_8px_18px_color-mix(in_srgb,var(--color-accent)_35%,transparent)] hover:brightness-95",
    ink: "bg-ink text-onaccent",
    ghost: "border border-line bg-card text-ink",
  };
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${tones[tone]} ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-2xl border border-line bg-sand px-4 text-base outline-none transition placeholder:text-muted focus:border-accent focus:bg-card ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-line bg-sand px-4 py-3 text-base outline-none transition placeholder:text-muted focus:border-accent focus:bg-card ${props.className ?? ""}`}
    />
  );
}

export function IntentPill({ intent }: { intent: string }) {
  const styles =
    intent === "date"
      ? "bg-accent text-onfill"
      : intent === "friends"
        ? "bg-friend text-onaccent"
        : "bg-ink text-onaccent";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{activityIntentLabel(intent)}</span>;
}

export function BadgeRow({ badges }: { badges: string[] }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span key={badge} className="inline-flex h-7 items-center rounded-full border border-line bg-card px-2.5 text-xs font-medium text-ink">
          {badge}
        </span>
      ))}
    </div>
  );
}

export function SparteStrip({ kind, sub }: { kind: Sparte; sub: string }) {
  if (kind === "meetup") return null;
  const business = kind === "business";
  const Icon = business ? Briefcase : Ticket;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide text-onaccent ${business ? "bg-ink" : "bg-accent-deep"}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{business ? t("Business") : t("Veranstaltung")}{sub ? ` · ${sub}` : ""}</span>
      <span className="ml-auto shrink-0 font-semibold normal-case tracking-normal opacity-80">{business ? t("Kein Date") : t("Vom Veranstalter")}</span>
    </div>
  );
}

function friendsLine(names: string[]) {
  if (names.length === 1) return t("{0} ist dabei", names[0]);
  if (names.length === 2) return t("{0} und {1} sind dabei", names[0], names[1]);
  return t("{0}, {1} und {2} weitere sind dabei", names[0], names[1], names.length - 2);
}

export function ActivityCard({ item, onHide, onChanged }: { item: Activity; onHide?: () => void; onChanged?: () => void }) {
  const [menu, setMenu] = useState(false);
  const press = useRef<number | null>(null);
  const suppress = useRef(false);
  const sparte = sparteOf(item.area, item.category);
  return (
    <article className={`card overflow-hidden ${sparte.kind === "business" ? "!border-2 !border-ink" : sparte.kind === "event" ? "!border-2 !border-accent-deep" : ""}`}>
      <Link
        to="/activity/$id"
        params={{ id: item.id }}
        className="block"
        onPointerDown={() => {
          suppress.current = false;
          press.current = window.setTimeout(() => {
            suppress.current = true;
            setMenu(true);
          }, 500);
        }}
        onPointerUp={() => press.current && window.clearTimeout(press.current)}
        onPointerLeave={() => press.current && window.clearTimeout(press.current)}
        onPointerCancel={() => press.current && window.clearTimeout(press.current)}
        onPointerMove={(event) => {
          if (press.current && (Math.abs(event.movementX) > 3 || Math.abs(event.movementY) > 3)) window.clearTimeout(press.current);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(true);
        }}
        onClick={(event) => {
          if (suppress.current) {
            event.preventDefault();
            suppress.current = false;
          }
        }}
      >
        <SparteStrip kind={sparte.kind} sub={sparte.sub} />
        <div className="relative aspect-[16/11] bg-sand-deep">
          {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-12">
            <h2 className="font-display text-[1.45rem] leading-tight text-white">{item.title}</h2>
          </div>
          <div className="absolute left-3 top-3 flex gap-1.5">
            {sparte.kind === "business" ? null : <IntentPill intent={item.intent} />}
          </div>
        </div>
        <div className="space-y-1.5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 shrink-0 text-muted" />{formatWhen(item.startsAt)}</p>
          <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-muted" />{item.placeName}, {item.city}</p>
          {item.friendsGoing.length ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-friend"><Users className="h-4 w-4 shrink-0" />{friendsLine(item.friendsGoing)}</p>
          ) : item.matchesInterest ? (
            <p className="text-sm font-semibold text-accent-deep">{t("Passt zu deinen Interessen")}</p>
          ) : null}
          {item.fitReason ? <p className="text-xs text-muted">{t("Weit oben: {0}", item.fitReason)}</p> : null}
          <div className="flex items-center gap-2 pt-1">
            {item.hostAvatar ? (
              <img src={item.hostAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sand-deep text-sm font-semibold">{item.hostName.slice(0, 1)}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{item.hostName}</span>
              {item.hostBadges[0] ? <span className="block truncate text-xs text-muted">{item.hostBadges[0]}</span> : null}
            </span>
            <span className="ml-auto text-xs font-semibold text-muted">{t("{0} frei", item.spotsLeft)}</span>
            {item.myStatus === "pending" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-onfill">{t("Angefragt")}</span> : null}
            {item.myStatus === "accepted" ? <span className="rounded-full bg-friend px-2 py-0.5 text-[11px] font-bold text-onaccent">{t("Dabei")}</span> : null}
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between px-4 pb-3">
        {onHide && !item.isHost ? (
          <button type="button" className="text-xs font-semibold text-muted" onClick={onHide}>{t("Ausblenden")}</button>
        ) : <span />}
        <button type="button" aria-label={t("Mehr zu diesem Treffen")} className="grid h-11 w-11 place-items-center rounded-full text-muted" onClick={() => setMenu(true)}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      {menu ? <CardSheet item={item} onClose={() => setMenu(false)} onHide={onHide} onChanged={onChanged} /> : null}
    </article>
  );
}

export type Art = "meet" | "chat" | "calendar" | "bell" | "people" | "plant";

/** Small scenes in the brand colours. They read on light and dark because they only use theme variables. */
export function Illustration({ art, className = "h-28 w-auto" }: { art: Art; className?: string }) {
  const accent = "var(--color-accent)";
  const soft = "var(--color-sand-deep)";
  const green = "var(--color-friend)";
  const ink = "var(--color-ink)";
  const card = "var(--color-card)";
  const scenes: Record<Art, ReactNode> = {
    meet: (
      <>
        <ellipse cx="80" cy="104" rx="64" ry="8" fill={soft} />
        <rect x="52" y="74" width="56" height="6" rx="3" fill={ink} opacity="0.85" />
        <rect x="76" y="80" width="8" height="22" rx="3" fill={ink} opacity="0.85" />
        <rect x="64" y="62" width="14" height="12" rx="3" fill={card} stroke={ink} strokeWidth="2" />
        <circle cx="40" cy="48" r="11" fill={accent} />
        <path d="M24 90c0-16 7-26 16-26s16 10 16 26z" fill={accent} />
        <circle cx="120" cy="48" r="11" fill={green} />
        <path d="M104 90c0-16 7-26 16-26s16 10 16 26z" fill={green} />
        <path d="M78 40c0-6 8-6 8 0 0 5-8 9-8 9s-8-4-8-9c0-6 8-6 8 0z" fill={accent} opacity="0.9" transform="translate(2 -8)" />
      </>
    ),
    chat: (
      <>
        <ellipse cx="80" cy="106" rx="60" ry="7" fill={soft} />
        <path d="M30 28h70a10 10 0 0 1 10 10v26a10 10 0 0 1-10 10H62l-16 14v-14H30a10 10 0 0 1-10-10V38a10 10 0 0 1 10-10z" fill={accent} />
        <rect x="34" y="42" width="44" height="5" rx="2.5" fill={card} opacity="0.9" />
        <rect x="34" y="53" width="30" height="5" rx="2.5" fill={card} opacity="0.7" />
        <path d="M70 62h56a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-8v12l-14-12H70a10 10 0 0 1-10-10V72a10 10 0 0 1 10-10z" fill={green} opacity="0.95" transform="translate(0 -4)" />
      </>
    ),
    calendar: (
      <>
        <ellipse cx="80" cy="108" rx="58" ry="7" fill={soft} />
        <rect x="32" y="24" width="96" height="78" rx="14" fill={card} stroke={ink} strokeWidth="2.5" />
        <path d="M32 40a14 14 0 0 1 14-14h68a14 14 0 0 1 14 14v10H32z" fill={accent} />
        <rect x="52" y="16" width="6" height="18" rx="3" fill={ink} />
        <rect x="102" y="16" width="6" height="18" rx="3" fill={ink} />
        {[0, 1, 2, 3].map((col) => [0, 1].map((row) => <circle key={`${col}${row}`} cx={52 + col * 19} cy={66 + row * 19} r="4" fill={ink} opacity="0.18" />))}
        <circle cx="90" cy="85" r="9" fill={accent} />
      </>
    ),
    bell: (
      <>
        <ellipse cx="80" cy="108" rx="48" ry="6" fill={soft} />
        <path d="M80 22c-18 0-30 13-30 32v14l-8 14h76l-8-14V54c0-19-12-32-30-32z" fill={accent} />
        <circle cx="80" cy="96" r="8" fill={ink} opacity="0.85" />
        <rect x="76" y="14" width="8" height="10" rx="4" fill={ink} opacity="0.85" />
        <path d="M118 36c6 4 10 10 12 18M42 36c-6 4-10 10-12 18" stroke={green} strokeWidth="4" strokeLinecap="round" fill="none" />
      </>
    ),
    people: (
      <>
        <ellipse cx="80" cy="106" rx="62" ry="7" fill={soft} />
        <circle cx="46" cy="50" r="12" fill={accent} />
        <path d="M28 96c0-18 8-30 18-30s18 12 18 30z" fill={accent} />
        <circle cx="114" cy="50" r="12" fill={green} />
        <path d="M96 96c0-18 8-30 18-30s18 12 18 30z" fill={green} />
        <circle cx="80" cy="42" r="14" fill={ink} opacity="0.85" />
        <path d="M60 98c0-20 9-34 20-34s20 14 20 34z" fill={ink} opacity="0.85" />
      </>
    ),
    plant: (
      <>
        <ellipse cx="80" cy="108" rx="40" ry="6" fill={soft} />
        <path d="M60 80h40l-5 24H65z" fill={accent} />
        <path d="M80 80V44" stroke={green} strokeWidth="4" strokeLinecap="round" />
        <path d="M80 62c-16 0-24-10-24-22 16 0 24 8 24 22z" fill={green} />
        <path d="M80 54c14 0 22-9 22-20-14 0-22 7-22 20z" fill={green} opacity="0.8" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-hidden="true">
      {scenes[art]}
    </svg>
  );
}

export function Empty({ title, body, action, art = "meet" }: { title: string; body: string; action?: ReactNode; art?: Art }) {
  return (
    <div className="card px-5 py-8 text-center">
      <Illustration art={art} className="mx-auto h-28 w-auto" />
      <h2 className="mt-3 font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Grey blocks in the shape of the page, so loading feels like arriving instead of waiting. */
export function Skeleton({ lines = 3, photo = false }: { lines?: number; photo?: boolean }) {
  return (
    <div className="card animate-pulse overflow-hidden" aria-hidden="true">
      {photo ? <div className="aspect-[3/2] bg-sand-deep" /> : null}
      <div className="space-y-3 p-4">
        <div className="h-6 w-2/3 rounded-full bg-sand-deep" />
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className={`h-4 rounded-full bg-sand-deep ${index === lines - 1 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-sand-deep px-4 py-3 text-sm text-ink">{children}</p>;
}

export function StatusLine({ error, info }: { error?: string; info?: string }) {
  if (error) return <p className="text-sm text-accent-deep">{error}</p>;
  if (info) return <p className="text-sm text-friend">{info}</p>;
  return null;
}
