import { createRootRoute, HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { logClientError } from "@/lib/meeqo/api";
import { warmStart } from "@/lib/meeqo/warm";
import { useEffect } from "react";
import { initNative } from "@/lib/meeqo/native";
import { initLang, useLang } from "@/lib/meeqo/i18n";
import appCss from "../styles.css?url";

warmStart();

if (typeof window !== "undefined") {
  let sent = 0;
  const report = (message: unknown) => {
    if (sent >= 5) return;
    sent += 1;
    void logClientError({ data: { message: String(message ?? "Unbekannter Fehler"), path: window.location.pathname } }).catch(() => {});
  };
  window.addEventListener("error", (event) => report(event.message));
  window.addEventListener("unhandledrejection", (event) => report((event.reason as Error | undefined)?.message ?? event.reason));
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "MeeQo" },
      { name: "description", content: "Menschen über Aktivitäten kennenlernen. Dating und Freundschaft bleiben getrennt." },
      { name: "theme-color", content: "#F4E8D8" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootShell,
});

function RootShell() {
  const lang = useLang();
  const router = useRouter();
  useEffect(() => {
    initLang();
    void initNative((path) => void router.navigate({ to: path }));
  }, [router]);
  return (
    <html lang="de" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider key={lang}>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
