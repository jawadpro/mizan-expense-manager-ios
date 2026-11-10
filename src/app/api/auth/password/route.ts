import { requireUser, sessionHeaders } from "@/lib/auth";
import { checkNewPassword } from "@/lib/account";
import { verifyPassword } from "@/lib/crypto";
import { errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findUserByEmail, setPassword } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Changes the password. Needs the current one; signs out every other device and keeps this one signed in. */
export const POST = handle(async (req: Request) => {
  const { user, session } = await requireUser(req);
  if (!(await rateLimit(`password:${user.id}`, 5, 900)) || !(await rateLimit(`password:ip:${clientIp(req)}`, 10, 900))) {
    return errorJson(429, "Too many attempts. Try again in 15 minutes.");
  }
  const body = (await readJson(req, 2048)) as { current?: unknown; next?: unknown };
  const current = typeof body?.current === "string" ? body.current.slice(0, 256) : "";
  const withHash = await findUserByEmail(user.email);
  if (!current || !withHash || !verifyPassword(current, withHash.password_hash)) {
    return errorJson(400, "Your current password is not correct", { fields: { current: ["Your current password is not correct"] } });
  }
  const next = checkNewPassword(body?.next, "next");
  if (next === current) return errorJson(400, "Choose a password different from the current one", { fields: { next: ["Choose a password different from the current one"] } });
  await setPassword(user.id, next);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: sessionHeaders(user.id, session.rem) });
});

export function GET() {
  return json({ ok: false, error: "Use POST" }, 405);
}
