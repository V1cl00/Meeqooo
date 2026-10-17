import { Capacitor } from "@capacitor/core";
import { saveNativeToken } from "@/lib/meeqo/api";

/** True inside the Android or iOS app (the Capacitor shell), false in a normal browser. */
export function isNative() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function platform(): "android" | "ios" | "web" {
  if (!isNative()) return "web";
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

/** Called once after the first render. Sets up the status bar, back button and links that open the app. */
export async function initNative(go: (path: string) => void) {
  if (!isNative()) return;
  document.documentElement.classList.add("native");
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const paint = async () => {
    try {
      await StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light });
      if (platform() === "android") await StatusBar.setBackgroundColor({ color: dark.matches ? "#1c1815" : "#F7F1EA" });
    } catch {
      /* the bar keeps its default */
    }
  };
  void paint();
  dark.addEventListener("change", () => void paint());
  void SplashScreen.hide();
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
  void App.addListener("appUrlOpen", (event) => {
    try {
      const url = new URL(event.url);
      go(`${url.pathname}${url.search}`);
    } catch {
      /* not a link we know */
    }
  });
}

/** A light tap in the app, the browser's vibration elsewhere. */
export async function tap(ms: number) {
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ms > 20 ? ImpactStyle.Medium : ImpactStyle.Light });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Asks for permission, registers with Apple or Google through Firebase, and hands the token to the server. */
export async function registerNativePush(go: (path: string) => void): Promise<"granted" | "denied"> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const state = await PushNotifications.requestPermissions();
  if (state.receive !== "granted") return "denied";
  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", (token) => {
    void saveNativeToken({ data: { token: token.value, platform: platform() === "ios" ? "ios" : "android" } });
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const href = (action.notification.data as { href?: string } | undefined)?.href;
    if (href && href.startsWith("/") && !href.startsWith("//")) go(href);
  });
  await PushNotifications.register();
  return "granted";
}

/** The system share sheet in the app; the browser's own where it has one. Returns false when nothing could be shown. */
export async function shareText(title: string, text: string, url?: string) {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, url, dialogTitle: title });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return true;
  }
  return false;
}
