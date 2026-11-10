import { assertSameOrigin, sessionHeaders } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { errorJson, handle, json, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findUserByEmail, normalizeEmail, touchLogin } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Checked when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ip = clientIp(req);
  if (!(await rateLimit(`login:ip:${ip}`, 10, 900)) || !(await rateLimit("login:global", 300, 900))) {
    return errorJson(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }
  const body = (await readJson(req, 2048)) as { email?: unknown; password?: unknown; remember?: unknown };
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password.slice(0, 256) : "";
  if (email && !(await rateLimit(`login:email:${email}`, 10, 900))) {
    return errorJson(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }
  const user = email ? await findUserByEmail(email) : null;
  const ok = verifyPassword(password || "x", user?.password_hash ?? DUMMY_HASH) && !!user && !!password;
  if (!ok || !user) return errorJson(401, "That email or password is not correct");
  if (user.status !== "active") return errorJson(403, "This account is suspended. Contact support if you think this is a mistake.");
  await touchLogin(user.id);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: sessionHeaders(user.id, body?.remember !== false) });
});

export function GET() {
  return json({ ok: false, error: "Use POST" }, 405);
}
