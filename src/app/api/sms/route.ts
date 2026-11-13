import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { asUser } from "@/lib/db";
import { errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { smsInput } from "@/lib/validation";
import { ingestSms, previewSms } from "@/lib/sms/ingest";
import { authenticateDevice, looksLikeDeviceToken, recordIngest, recordTest } from "@/lib/devices";
import { findUserById, firstUserId, userBySmsToken } from "@/lib/users";
import { isPro } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Who a bearer token belongs to: a paired iPhone's own token (from pairing), or the account's SMS token (the
 * older Shortcut where people paste the URL and token by hand). The one set in the environment is the first account's.
 */
async function ownerOf(token: string): Promise<{ user: Awaited<ReturnType<typeof findUserById>>; deviceId: string | null }> {
  if (looksLikeDeviceToken(token)) {
    const dev = await authenticateDevice(token);
    return { user: dev ? await findUserById(dev.userId) : null, deviceId: dev?.deviceId ?? null };
  }
  return { user: await legacyOwner(token), deviceId: null };
}

async function legacyOwner(token: string) {
  const fromEnv = env.envSmsToken();
  if (fromEnv && safeEqual(token, fromEnv)) {
    const id = await firstUserId();
    const user = id ? await findUserById(id) : null;
    return user?.status === "active" ? user : null;
  }
  return userBySmsToken(token);
}

/**
 * Receives bank alert SMS forwarded by an iPhone Shortcut.
 * Auth: `Authorization: Bearer <this iPhone's device token from pairing, or the account's SMS token>`, which
 * also says whose alert it is; nothing in the body can. With `"test": true` the alert is only read, never saved.
 * The token and message text are never logged.
 */
export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  if (!(await rateLimit(`sms:ip:${ip}`, 30, 60))) return errorJson(429, "Too many requests", {});

  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S{1,512})$/.exec(auth);
  const { user, deviceId } = m ? await ownerOf(m[1]) : { user: null, deviceId: null };
  if (!user || user.status !== "active") {
    // Slow down token guessing: 10 failures per IP per 10 minutes.
    await rateLimit(`sms:fail:${ip}`, 10, 600);
    return errorJson(401, "This iPhone isn't connected to Mizan any more. Pair it again from SMS setup › Connected devices.");
  }
  // Free accounts add transactions by hand; nothing from the Shortcut is kept for them.
  if (!isPro(user)) return errorJson(402, "Automatic SMS import is part of Mizan Pro. Upgrade in the app to turn it on.", { upgrade: true, feature: "sms" });
  if (!(await rateLimit(`sms:user:${user.id}`, 60, 60)) || !(await rateLimit("sms:global", 2000, 60))) return errorJson(429, "Too many requests");

  const body = await readJson(req, MAX_BODY_BYTES);
  const parsed = smsInput.safeParse(body);
  if (!parsed.success) {
    return errorJson(400, "Invalid payload", { issues: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`) });
  }
  const receivedAt = new Date(parsed.data.receivedAt);
  if (receivedAt.getTime() > Date.now() + 10 * 60e3) return errorJson(400, "receivedAt is in the future");

  const input = { sender: parsed.data.sender, text: parsed.data.text, receivedAt };
  if (parsed.data.test) {
    const reading = await asUser(user.id, async () => {
      if (deviceId) await recordTest(deviceId);
      return previewSms(input);
    });
    return json({ ok: true, test: true, message: "Mizan received a test from this iPhone. Nothing was saved.", reading });
  }
  const out = await asUser(user.id, async () => {
    try {
      const res = await ingestSms(input);
      if (deviceId) await recordIngest(deviceId, res.status);
      return res;
    } catch (e) {
      if (deviceId) await recordIngest(deviceId, "failed").catch(() => {});
      throw e;
    }
  });
  const status = out.status === "imported" ? 201 : out.status === "review" ? 202 : 200;
  return json({ ok: true, ...out }, status);
});

export function GET() {
  return errorJson(405, "Use POST");
}
