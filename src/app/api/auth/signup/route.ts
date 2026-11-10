import { z } from "zod";
import { assertSameOrigin, sessionHeaders } from "@/lib/auth";
import { checkNewPassword, sendVerifyEmail, SIGNUPS_OPEN } from "@/lib/account";
import { setupState } from "@/lib/config";
import { HttpError, errorJson, handle, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createUser, normalizeEmail } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ email: z.string().max(254), password: z.string().max(256), name: z.string().max(80).optional() });

/** Creates an account and signs it in. A link to confirm the email address is sent. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  if (!SIGNUPS_OPEN) return errorJson(403, "Sign-ups aren't open yet.");
  if (!(await setupState()).hasOwner) throw new HttpError(409, "This install isn't set up yet.");
  if (!(await rateLimit(`signup:ip:${clientIp(req)}`, 5, 3600)) || !(await rateLimit("signup:global", 200, 3600))) {
    return errorJson(429, "Too many sign-ups from here. Try again later.");
  }
  const parsed = input.safeParse(await readJson(req, 2048));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const email = normalizeEmail(parsed.data.email);
  if (!email) throw new HttpError(400, "Enter a valid email address", { fields: { email: ["Enter a valid email address"] } });
  const password = checkNewPassword(parsed.data.password);
  const user = await createUser({ email, password, name: parsed.data.name });
  if (!user) throw new HttpError(409, "An account with this email already exists. Sign in instead.", { fields: { email: ["An account with this email already exists"] } });
  await sendVerifyEmail(req, user).catch((e) => console.error("[mizan] verify email failed", (e as Error)?.name));
  return new Response(JSON.stringify({ ok: true }), { status: 201, headers: sessionHeaders(user.id, true) });
});
