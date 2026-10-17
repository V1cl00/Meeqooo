import { createSign } from "node:crypto";

type Account = { project_id: string; client_email: string; private_key: string; token_uri?: string };
type Deps = { fetch?: typeof fetch; account?: Account | null; now?: () => number };

let cached: { token: string; until: number } | null = null;

function readAccount(): Account | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Account;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** Signs the service-account login for Google (RS256), as documented for server-to-server access. */
export function signAssertion(account: Account, nowMs: number) {
  const iat = Math.floor(nowMs / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(account.private_key);
  return `${head}.${claims}.${b64url(signature)}`;
}

async function accessToken(account: Account, fetcher: typeof fetch, nowMs: number) {
  if (cached && cached.until > nowMs + 60_000) return cached.token;
  const res = await fetcher(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signAssertion(account, nowMs) }),
  });
  if (!res.ok) throw new Error(`fcm login ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("fcm login without token");
  cached = { token: body.access_token, until: nowMs + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export function resetFcmCache() {
  cached = null;
}

/**
 * Sends one notification to one phone. "gone" means the token is no longer valid and should be deleted;
 * "skipped" means no Firebase account is configured.
 */
export async function sendFcm(token: string, message: { title: string; body: string; href: string }, deps: Deps = {}): Promise<"ok" | "gone" | "skipped" | "error"> {
  const account = deps.account === undefined ? readAccount() : deps.account;
  if (!account) return "skipped";
  const fetcher = deps.fetch ?? fetch;
  const nowMs = (deps.now ?? Date.now)();
  try {
    const access = await accessToken(account, fetcher, nowMs);
    const res = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: { href: message.href },
          android: { priority: "HIGH" },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });
    if (res.ok) return "ok";
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) return "gone";
    return "error";
  } catch {
    return "error";
  }
}
