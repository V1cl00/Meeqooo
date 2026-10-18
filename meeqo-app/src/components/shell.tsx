import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { Bell, CalendarDays, Compass, MessageCircle, Plus, UserRound } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { chatUnread, getProfile, listNotifications } from "@/lib/meeqo/api";
import { takeProfile } from "@/lib/meeqo/warm";
import { errText, isUnauthorized } from "@/lib/meeqo/labels";
import type { Profile } from "@/lib/meeqo/types";
import { themeStyle } from "@/lib/meeqo/theme";
import { WelcomeHero, Wordmark } from "@/components/bits";
import { Toaster } from "@/components/toaster";
import { t } from "@/lib/meeqo/i18n";

type Ctx = {
  profile: Profile | null;
  reload: () => Promise<void>;
  unread: number;
  unreadChats: number;
};

const ProfileContext = createContext<Ctx>({
  profile: null,
  reload: async () => {},
  unread: 0,
  unreadChats: 0,
});

export function useMe() {
  return useContext(ProfileContext);
}

const NAV = [
  { to: "/", label: "Entdecken", icon: Compass },
  { to: "/calendar", label: "Kalender", icon: CalendarDays },
  { to: "/create", label: "Neu", icon: Plus },
  { to: "/chat", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profil", icon: UserRound },
] as const;

export function Shell({
  children,
  bare = false,
  requireOnboarding = true,
  requireAge = true,
}: {
  children: ReactNode;
  bare?: boolean;
  requireOnboarding?: boolean;
  requireAge?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [stalled, setStalled] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [online, setOnline] = useState(true);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  async function reload() {
    const next = await getProfile();
    setProfile(next);
  }

  useEffect(() => {
    if (!user) return;
    let live = true;
    const timer = window.setTimeout(() => {
      if (live) setError(t("Das Profil lädt nicht. Prüfe die Verbindung und versuch es nochmal."));
    }, 8000);
    takeProfile()
      .then((next) => {
        if (live) {
          setProfile(next);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (live) setError(isUnauthorized(err) ? "Unauthorized" : /gesperrt/.test(errText(err)) ? errText(err) : t("Profil konnte nicht geladen werden."));
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!isPending) return;
    const timer = window.setTimeout(() => setStalled(true), 4000);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    const pull = () => {
      chatUnread().then((result) => live && setUnreadChats(result.count)).catch(() => {});
      listNotifications()
        .then((rows) => {
          if (!live) return;
          setUnread(rows.filter((row) => !row.read).length);
          if (!primed.current) {
            rows.forEach((row) => seen.current.add(row.id));
            primed.current = true;
            return;
          }
          if (profile?.notifyPush && typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const row of rows) {
              if (seen.current.has(row.id) || row.read) continue;
              seen.current.add(row.id);
              new Notification(row.title, { body: row.body });
            }
          }
        })
        .catch(() => {});
    };
    pull();
    const timer = window.setInterval(pull, 30000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [user?.id, profile?.notifyPush]);

  if (isPending && !stalled) {
    return (
      <div className="min-h-dvh bg-sand px-4 py-6 text-ink">
        <div className="mx-auto w-full max-w-lg">
          <WelcomeHero />
        </div>
      </div>
    );
  }
  if (!user || error === "Unauthorized") return <RedirectToSignIn />;
  if (!profile && !error) {
    return (
      <div className="min-h-dvh bg-sand px-4 py-6 text-ink">
        <div className="mx-auto w-full max-w-lg">
          <WelcomeHero />
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-sand px-6 text-center">
        <div className="max-w-sm space-y-4">
          <Wordmark className="text-3xl" />
          <p>{error || t("Profil fehlt.")}</p>
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-control bg-accent px-5 text-sm font-semibold text-onfill" onClick={() => window.location.reload()}>{t("Neu laden")}</button>
        </div>
      </div>
    );
  }
  if (requireAge && profile && !profile.ageConfirmed) {
    return <Navigate to="/alter" />;
  }
  if (requireOnboarding && profile && !profile.onboardingDone && path !== "/onboarding") {
    return <Navigate to="/onboarding" />;
  }

  const value = { profile, reload, unread, unreadChats };

  if (bare) {
    return (
      <ProfileContext.Provider value={value}>
        <div className="min-h-dvh bg-sand text-ink" style={themeStyle(profile.theme)}>
          <div className="mx-auto w-full max-w-lg px-5 py-8">{children}</div>
        </div>
        <Toaster />
      </ProfileContext.Provider>
    );
  }

  return (
    <ProfileContext.Provider value={value}>
      <Toaster />
      <div className="min-h-dvh bg-sand text-ink" style={themeStyle(profile.theme)}>
        <div className="mx-auto flex w-full max-w-5xl">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line px-5 py-7 md:flex">
            <Link to="/">
              <Wordmark />
            </Link>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} path={path} badge={item.to === "/chat" ? unreadChats : 0} />
              ))}
            </nav>
            {profile?.city ? (
              <p className="mt-auto text-sm text-muted">
                {profile.city}
                <span className="block">{t("{0} km Umkreis", profile.radiusKm)}</span>
              </p>
            ) : (
              <p className="mt-auto text-sm text-muted">{t("Standort noch offen")}</p>
            )}
          </aside>
          <div className="min-w-0 flex-1">
            {online ? null : (
              <p role="status" className="bg-ink px-4 py-2 text-center text-sm font-semibold text-onaccent">{t("Du bist offline. Zum Senden und Anfragen braucht MeeQo Netz.")}</p>
            )}
            <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-sand/80 px-4 py-3 backdrop-blur-xl md:px-8">
              <Link to="/" className="md:hidden">
                <Wordmark className="text-[1.65rem]" />
              </Link>
              <p className="hidden text-sm text-muted md:block">{t("Aktivitäten, nicht Profile.")}</p>
              <Link to="/notifications" aria-label={unread > 0 ? `Benachrichtigungen, ${unread} neu` : "Benachrichtigungen"} className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-card shadow-sm">
                <Bell className="h-5 w-5" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-onfill">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </header>
            <main className="px-4 pb-32 pt-5 md:px-8 md:pb-16">{children}</main>
          </div>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5 rounded-[1.6rem] border border-line bg-card/95 px-1 py-1 shadow-[0_10px_40px_rgba(36,28,24,0.12)] backdrop-blur-xl">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} label={item.label} icon={item.icon} path={path} compact badge={item.to === "/chat" ? unreadChats : 0} />
            ))}
          </div>
        </nav>
      </div>
    </ProfileContext.Provider>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  path,
  compact = false,
  badge = 0,
}: {
  to: string;
  label: string;
  icon: typeof Compass;
  path: string;
  compact?: boolean;
  badge?: number;
}) {
  const active = to === "/" ? path === "/" : path.startsWith(to);
  if (compact) {
    const create = to === "/create";
    return (
      <Link to={to} search={create ? { community: "" } : undefined} className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold">
        <span className={create ? "-mt-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-onfill shadow-[0_10px_20px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]" : active ? "relative grid h-9 w-9 place-items-center text-accent-deep" : "relative grid h-9 w-9 place-items-center text-muted"}>
          <Icon className={create ? "h-6 w-6" : "h-5 w-5"} />
          {badge > 0 ? <span className="absolute right-[1.1rem] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-onfill" aria-label={`${badge} ungelesen`}>{badge}</span> : null}
        </span>
        <span className={create ? "text-ink" : active ? "text-accent-deep" : "text-muted"}>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      to={to}
      search={to === "/create" ? { community: "" } : undefined}
      className={`flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold ${active ? "bg-accent/12 text-accent-deep" : "text-ink hover:bg-card"}`}
    >
      <Icon className="h-5 w-5" />
      {label}
      {badge > 0 ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-onfill" aria-label={`${badge} ungelesen`}>{badge}</span> : null}
    </Link>
  );
}
