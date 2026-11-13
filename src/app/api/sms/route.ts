import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { asUser } from "@/lib/db";
import { errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { smsInput } from "@/lib/validation";
import { ingestSms } from "@/lib/sms/ingest";
import { findUserById, firstUserId, userBySmsToken } from "@/lib/users";
import { isPro } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

/** The active account a bearer token belongs to: the one set in the environment is the first account's. */
async function ownerOf(token: string) {
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
 * Auth: `Authorization: Bearer <the account's SMS token>`, which also says whose alert it is.
 * The token and message text are never logged.
 */
export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  if (!(await rateLimit(`sms:ip:${ip}`, 30, 60))) return errorJson(429, "Too many requests", {});

  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S{1,512})$/.exec(auth);
  const user = m ? await ownerOf(m[1]) : null;
  if (!user) {
    // Slow down token guessing: 10 failures per IP per 10 minutes.
    await rateLimit(`sms:fail:${ip}`, 10, 600);
    return errorJson(401, "Invalid or missing bearer token");
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

  const out = await asUser(user.id, () => ingestSms({ sender: parsed.data.sender, text: parsed.data.text, receivedAt }));
  const status = out.status === "imported" ? 201 : out.status === "review" ? 202 : 200;
  return json({ ok: true, ...out }, status);
});

export function GET() {
  return errorJson(405, "Use POST");
}
