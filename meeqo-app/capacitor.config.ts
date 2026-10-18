import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for Android and iOS. The app itself runs on the server (server functions, login, database),
 * so the shell loads the live site: set CAP_SERVER_URL to its https address before `npm run native:sync`.
 * native/www is only the page shown when there is no connection.
 */
const url = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "de.meeqo.app",
  appName: "MeeQo",
  webDir: "native/www",
  ...(url
    ? {
        server: {
          url,
          cleartext: false,
          errorPath: "index.html",
        },
      }
    : {}),
  android: { allowMixedContent: false },
  ios: { contentInset: "always", backgroundColor: "#F4E8D8" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#F4E8D8", showSpinner: false },
    Keyboard: { resize: "body" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
