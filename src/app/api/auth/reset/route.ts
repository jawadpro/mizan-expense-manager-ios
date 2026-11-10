import { assertSameOrigin, sessionHeaders } from "@/lib/auth";
import { checkNewPassword } from "@/lib/account";
import { HttpError, errorJson, handle, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { consumeToken, findUserById, markVerified, setPassword } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets a new password from an emailed link, signs out every other device and signs this one in. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  if (!(await rateLimit(`reset:ip:${clientIp(req)}`, 10, 900))) return errorJson(429, "Too many attempts. Try again in 15 minutes.");
  const body = (await readJson(req, 2048)) as { token?: unknown; password?: unknown };
  const password = checkNewPassword(body?.password);
  const userId = await consumeToken(String(body?.token ?? ""), "reset");
  if (!userId) throw new HttpError(400, "This link has expired or was already used. Ask for a new one.");
  const user = await findUserById(userId);
  if (!user || user.status !== "active") throw new HttpError(400, "This account can't be signed in to.");
  await setPassword(user.id, password);
  // Opening the emailed link proves the address works.
  await markVerified(user.id);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: sessionHeaders(user.id, true) });
});
