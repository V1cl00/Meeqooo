import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { Briefcase, Calendar, MapPin, Ticket } from "lucide-react";
import { activityIntentLabel, formatWhen, sparteOf, type Sparte } from "@/lib/meeqo/labels";
import type { ActivityCard as Activity } from "@/lib/meeqo/types";

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
      <span>
        Mee<span className="text-accent">Q</span>o
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
              <p className="text-xs font-semibold text-muted">Sonntag · Schlossgarten</p>
              <p className="truncate font-display text-xl leading-none">Laufen, acht Kilometer</p>
            </div>
            <span className="ml-auto rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-bold text-ink">Beispiel</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-5 pt-12">
        <Wordmark className="text-2xl" />
        <h1 className="font-display text-[1.85rem] leading-[1.05]">Treffen über etwas, das ihr wirklich tut.</h1>
        <p className="text-sm leading-relaxed text-muted">Dating und Freundschaft bleiben getrennt. Absicht ist von Anfang an sichtbar.</p>
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
    accent: "bg-accent text-onaccent shadow-[0_8px_18px_color-mix(in_srgb,var(--color-accent)_35%,transparent)] hover:bg-accent-deep",
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
      ? "bg-accent text-onaccent"
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
      <span className="truncate">{business ? "Business" : "Veranstaltung"}{sub ? ` · ${sub}` : ""}</span>
      <span className="ml-auto shrink-0 font-semibold normal-case tracking-normal opacity-80">{business ? "Kein Date" : "Vom Veranstalter"}</span>
    </div>
  );
}

export function ActivityCard({ item, onHide }: { item: Activity; onHide?: () => void }) {
  const sparte = sparteOf(item.area, item.category);
  return (
    <article className={`card overflow-hidden ${sparte.kind === "business" ? "!border-2 !border-ink" : sparte.kind === "event" ? "!border-2 !border-accent-deep" : ""}`}>
      <Link to="/activity/$id" params={{ id: item.id }} className="block">
        <SparteStrip kind={sparte.kind} sub={sparte.sub} />
        <div className="relative aspect-[16/11] bg-sand-deep">
          {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pb-3 pt-12">
            <h2 className="font-display text-[1.45rem] leading-tight text-white">{item.title}</h2>
          </div>
          <div className="absolute left-3 top-3 flex gap-1.5">
            {sparte.kind === "business" ? null : <IntentPill intent={item.intent} />}
          </div>
        </div>
        <div className="space-y-1.5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 shrink-0 text-muted" />{formatWhen(item.startsAt)}</p>
          <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-muted" />{item.placeName}, {item.city}</p>
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
            <span className="ml-auto text-xs font-semibold text-muted">{item.spotsLeft} frei</span>
            {item.myStatus === "pending" ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-onaccent">Angefragt</span> : null}
            {item.myStatus === "accepted" ? <span className="rounded-full bg-friend px-2 py-0.5 text-[11px] font-bold text-onaccent">Dabei</span> : null}
          </div>
        </div>
      </Link>
      {onHide && !item.isHost ? (
        <div className="px-4 pb-3">
          <button type="button" className="text-xs font-semibold text-muted" onClick={onHide}>Ausblenden</button>
        </div>
      ) : null}
    </article>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card px-5 py-10 text-center">
      <Mark className="mx-auto h-12 w-12" />
      <h2 className="mt-4 font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
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
