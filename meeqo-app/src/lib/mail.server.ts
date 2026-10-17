/**
 * Sends a plain-text mail through Resend when RESEND_API_KEY and MAIL_FROM are set.
 * Without them nothing is sent, and the caller learns that from the return value.
 */
export const mailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export function appUrl() {
  return (process.env.APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/+$/, "");
}

export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.info(`[mail] not configured, not sent: ${subject} -> ${to}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
