import { assertSameOrigin } from "@/lib/auth";
import { sendResetEmail } from "@/lib/account";
import { EmailNotConfigured } from "@/lib/email";
import { errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findUserByEmail, normalizeEmail } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Emails a reset link. Answers the same whether or not the email has an account. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  if (!(await rateLimit(`forgot:ip:${clientIp(req)}`, 5, 900))) return errorJson(429, "Too many attempts. Try again in 15 minutes.");
  const body = (await readJson(req, 1024)) as { email?: unknown };
  const email = normalizeEmail(body?.email);
  if (!email) return errorJson(400, "Enter a valid email address", { fields: { email: ["Enter a valid email address"] } });
  if (!(await rateLimit(`forgot:email:${email}`, 3, 3600))) return json({ ok: true });
  const user = await findUserByEmail(email);
  if (user && user.status === "active") {
    try {
      await sendResetEmail(req, user);
    } catch (e) {
      if (e instanceof EmailNotConfigured) return errorJson(503, "Password reset emails aren't set up on this server yet.");
      console.error("[mizan] reset email failed", (e as Error)?.name);
    }
  }
  return json({ ok: true });
});
