import { z } from "zod";
import { assertSameOrigin, sessionHeaders } from "@/lib/auth";
import { checkNewPassword } from "@/lib/account";
import { ensureInstallSecrets, forgetLegacyPassphrase, loadConfig, setupState } from "@/lib/config";
import { verifyPassword } from "@/lib/crypto";
import { env } from "@/lib/env";
import { HttpError, errorJson, handle, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createFirstAdmin, normalizeEmail } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ passphrase: z.string().max(256), email: z.string().max(254), password: z.string().max(256), remember: z.boolean().optional() });

/**
 * For an install from before accounts existed: the owner proves who they are with the old passphrase and
 * creates the admin account. All existing data becomes that account's. The passphrase stops working.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  if (!(await rateLimit(`upgrade:ip:${clientIp(req)}`, 8, 900)) || !(await rateLimit("upgrade:global", 40, 900))) {
    return errorJson(429, "Too many attempts. Try again in 15 minutes.");
  }
  const parsed = input.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  if ((await loadConfig(true)) !== "ok") throw new HttpError(503, "Mizan can't reach its database right now. Try again in a minute.");
  const state = await setupState();
  const legacy = env.legacyPassphraseHash();
  if (state.hasOwner || !legacy) throw new HttpError(409, "This install already has an account. Sign in with your email instead.");
  if (!verifyPassword(parsed.data.passphrase, legacy)) {
    return errorJson(401, "That passphrase is not correct", { fields: { passphrase: ["That passphrase is not correct"] } });
  }
  const email = normalizeEmail(parsed.data.email);
  if (!email) throw new HttpError(400, "Enter a valid email address", { fields: { email: ["Enter a valid email address"] } });
  const password = checkNewPassword(parsed.data.password);
  const user = await createFirstAdmin({ email, password });
  if (!user) throw new HttpError(409, "This install already has an account. Sign in with your email instead.");
  await forgetLegacyPassphrase();
  await ensureInstallSecrets(new URL(req.headers.get("origin")!).origin);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: sessionHeaders(user.id, parsed.data.remember !== false) });
});
