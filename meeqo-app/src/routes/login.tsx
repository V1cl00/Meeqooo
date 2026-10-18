import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Link } from "@tanstack/react-router";
import { Button, Field, Note, TextInput, WelcomeHero } from "@/components/bits";
import { requestPasswordReset } from "@/lib/meeqo/api";
import { errText } from "@/lib/meeqo/labels";
import { t } from "@/lib/meeqo/i18n";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" && /^\/(?![/\\])/.test(search.next) ? search.next : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetInfo, setResetInfo] = useState("");

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-sand px-4 text-ink">
        <div className="w-full max-w-lg">
          <WelcomeHero />
        </div>
      </main>
    );
  }
  if (user) return <Navigate to={next ?? "/"} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const fetchOptions = {
        onSuccess(ctx: { response: Response }) {
          const token = ctx.response.headers.get("set-auth-token");
          if (token) window.sessionStorage.setItem("grok-auth.bearer-token", token);
        },
      };
      const result = mode === "up"
        ? await authClient.signUp.email({ email, password, name, callbackURL: "/", fetchOptions })
        : await authClient.signIn.email({ email, password, callbackURL: "/", fetchOptions });
      if (result.error) {
        setError(result.error.message || "Anmeldung fehlgeschlagen.");
        setPending(false);
        return;
      }
      window.location.assign(next ?? "/");
    } catch (err) {
      setError(errText(err));
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-sand text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
        <WelcomeHero />
        {authEnabled ? (
          <form onSubmit={submit} className="card space-y-3 p-4">
            <div className="grid grid-cols-2 rounded-full bg-sand-deep p-1">
              <button type="button" onClick={() => setMode("up")} className={`h-10 rounded-full text-sm font-semibold ${mode === "up" ? "bg-card text-ink shadow-sm" : "text-muted"}`}>{t("Neu hier")}</button>
              <button type="button" onClick={() => setMode("in")} className={`h-10 rounded-full text-sm font-semibold ${mode === "in" ? "bg-card text-ink shadow-sm" : "text-muted"}`}>{t("Einloggen")}</button>
            </div>
            {mode === "up" ? (
              <Field label={t("Name")}>
                <TextInput value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" placeholder={t("Wie du heißt")} />
              </Field>
            ) : null}
            <Field label={t("E-Mail")}>
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder={t("du@mail.de")} />
            </Field>
            <Field label={t("Passwort")}>
              <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder={t("Mindestens 8 Zeichen")} />
            </Field>
            {error ? <Note>{error}</Note> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("Moment…") : mode === "up" ? t("Konto anlegen") : t("Einloggen")}
            </Button>
            {mode === "up" ? (
              <p className="text-xs text-muted">{t("Mit dem Konto stimmst du den")}{" "}<Link to="/nutzungsbedingungen" className="underline">{t("Nutzungsbedingungen")}</Link>{" "}{t("und dem")}{" "}<Link to="/datenschutz" className="underline">{t("Datenschutz")}</Link>{t("zu. MeeQo ist ab 18.")}</p>
            ) : (
              <>
                <button type="button" className="text-sm font-semibold underline" onClick={() => setForgot((value) => !value)}>{t("Passwort vergessen?")}</button>
                {forgot ? (
                  <div className="space-y-2 rounded-2xl bg-sand-deep p-3">
                    <p className="text-sm">{t("Schreib deine E-Mail. Wenn es das Konto gibt, schicken wir dir einen Link.")}</p>
                    <Button
                      type="button"
                      tone="ghost"
                      className="w-full"
                      disabled={!email}
                      onClick={async () => {
                        await requestPasswordReset({ data: { email } }).catch(() => {});
                        setResetInfo(t("Wenn es die Adresse gibt, ist eine Mail unterwegs. Sie gilt eine Stunde."));
                      }}
                    >{t("Link schicken")}</Button>
                    {resetInfo ? <p className="text-sm text-friend">{resetInfo}</p> : null}
                  </div>
                ) : null}
              </>
            )}
          </form>
        ) : (
          <Note>{t("Anmeldung ist aus.")}</Note>
        )}
        {GROK_PROVIDERS.length ? (
          <div className="mt-3 space-y-2">
            {GROK_PROVIDERS.map((provider) => (
              <Button key={provider.providerId} type="button" tone="ghost" className="w-full" onClick={() => signIn(provider.providerId, { callbackURL: "/" })}>{t("Weiter mit {0}", provider.label)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
