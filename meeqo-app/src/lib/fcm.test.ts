import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { test } from "node:test";
import { resetFcmCache, sendFcm, signAssertion } from "./fcm.server.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  project_id: "meeqo-test",
  client_email: "push@meeqo-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

test("the login assertion is a signed JWT for the messaging scope", () => {
  const jwt = signAssertion(account, 1_800_000_000_000);
  const [head, claims, signature] = jwt.split(".");
  assert.equal(JSON.parse(Buffer.from(head, "base64url").toString()).alg, "RS256");
  const body = JSON.parse(Buffer.from(claims, "base64url").toString());
  assert.equal(body.iss, account.client_email);
  assert.match(body.scope, /firebase\.messaging/);
  assert.equal(body.exp - body.iat, 3600);
  assert.ok(createVerify("RSA-SHA256").update(`${head}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url")));
});

test("a message is sent with the access token, and a dead token is reported as gone", async () => {
  resetFcmCache();
  const calls: { url: string; body: string }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    return calls.filter((call) => call.url.includes("messages:send")).length === 1
      ? new Response("{}", { status: 200 })
      : new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
  }) as unknown as typeof fetch;
  assert.equal(await sendFcm("phone-1", { title: "Hi", body: "Du bist dabei", href: "/chat/1" }, { account, fetch: fake }), "ok");
  assert.equal(await sendFcm("phone-2", { title: "Hi", body: "x", href: "/" }, { account, fetch: fake }), "gone");
  const sent = JSON.parse(calls.find((call) => call.url.includes("messages:send"))!.body);
  assert.equal(sent.message.token, "phone-1");
  assert.equal(sent.message.data.href, "/chat/1");
  assert.equal(calls.filter((call) => call.url.includes("oauth2")).length, 1, "the access token is reused");
});

test("without a Firebase account nothing is sent", async () => {
  assert.equal(await sendFcm("x", { title: "a", body: "b", href: "/" }, { account: null }), "skipped");
});
