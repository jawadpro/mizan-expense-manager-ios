import { z } from "zod";
import { assertSameOrigin, requireUser, sessionHeaders, type Authed } from "@/lib/auth";
import { checkNewPassword } from "@/lib/account";
import { claimInstall, finishSetup, setupState } from "@/lib/config";
import { env } from "@/lib/env";
import { HttpError, errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ensureSmsToken, firstUserId, markOnboarded, normalizeEmail, regenerateSmsToken } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether this account's SMS token is the one set in the environment (only the first account's can be). */
async function tokenFromEnv(user: Authed["user"]): Promise<boolean> {
  return !!env.envSmsToken() && (await firstUserId()) === user.id;
}

/** What the setup page needs to know. Says nothing secret; the SMS token only goes to its own signed-in account. */
export const GET = handle(async (req: Request) => {
  const state = await setupState();
  let token: string | null = null;
  let fromEnv = false;
  let signedIn = false;
  let onboarded = false;
  if (state.hasOwner) {
    try {
      const { user } = await requireUser(req);
      signedIn = true;
      onboarded = !!user.onboarded_at;
      fromEnv = await tokenFromEnv(user);
      if (!fromEnv) token = await ensureSmsToken(user.id);
    } catch {
      signedIn = false;
    }
  }
  return json({ ok: true, db: state.db, hasOwner: state.hasOwner, legacyPassphrase: state.legacyPassphrase, signedIn, onboarded, smsToken: token, smsTokenFromEnv: fromEnv });
});

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), email: z.string().max(254), password: z.string().max(256), name: z.string().max(80).optional(), remember: z.boolean().optional() }),
  z.object({ action: z.literal("finish") }),
  z.object({ action: z.literal("new-token") }),
]);

export const POST = handle(async (req: Request) => {
  const parsed = input.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const body = parsed.data;

  if (body.action === "claim") {
    assertSameOrigin(req);
    if (!(await rateLimit(`setup:ip:${clientIp(req)}`, 10, 900))) return errorJson(429, "Too many attempts. Try again in 15 minutes.");
    const state = await setupState();
    if (state.db !== "ok") throw new HttpError(503, "The database isn't ready yet");
    if (state.hasOwner || state.legacyPassphrase) throw new HttpError(409, "Mizan already has an owner. Sign in instead.");
    const email = normalizeEmail(body.email);
    if (!email) throw new HttpError(400, "Enter a valid email address", { fields: { email: ["Enter a valid email address"] } });
    const password = checkNewPassword(body.password);
    const origin = new URL(req.headers.get("origin")!).origin;
    const user = await claimInstall({ email, password, name: body.name }, origin);
    if (!user) throw new HttpError(409, "Mizan already has an owner. Sign in instead.");
    const smsToken = env.envSmsToken() ? null : await ensureSmsToken(user.id);
    return new Response(JSON.stringify({ ok: true, smsToken }), { status: 200, headers: sessionHeaders(user.id, body.remember !== false) });
  }

  const { user } = await requireUser(req);
  if (body.action === "finish") {
    await markOnboarded(user.id);
    if (user.role === "admin") await finishSetup();
    return json({ ok: true });
  }
  if (await tokenFromEnv(user)) throw new HttpError(409, "The SMS token is set in your environment variables; change it there.");
  return json({ ok: true, smsToken: await regenerateSmsToken(user.id) });
});
