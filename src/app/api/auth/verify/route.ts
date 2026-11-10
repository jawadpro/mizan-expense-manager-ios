import { assertSameOrigin, requireUser } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/account";
import { HttpError, errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { consumeToken, markVerified } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** { token } confirms an email address from the emailed link; { resend: true } sends a new link to the signed-in account. */
export const POST = handle(async (req: Request) => {
  const body = (await readJson(req, 1024)) as { token?: unknown; resend?: unknown };
  if (body?.resend === true) {
    const { user } = await requireUser(req);
    if (user.email_verified_at) return json({ ok: true, already: true });
    if (!(await rateLimit(`verify-resend:${user.id}`, 3, 3600))) return errorJson(429, "We've sent a few links already. Check your inbox and spam folder, or try again in an hour.");
    await sendVerifyEmail(req, user);
    return json({ ok: true });
  }
  assertSameOrigin(req);
  if (!(await rateLimit(`verify:ip:${clientIp(req)}`, 20, 900))) return errorJson(429, "Too many attempts. Try again in 15 minutes.");
  const userId = await consumeToken(String(body?.token ?? ""), "verify");
  if (!userId) throw new HttpError(400, "This link has expired or was already used. Sign in and send a new one from Settings.");
  await markVerified(userId);
  return json({ ok: true });
});
