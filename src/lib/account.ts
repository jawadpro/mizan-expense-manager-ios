import "server-only";
import { HttpError } from "./http";
import { MAX_PASSWORD, MIN_PASSWORD, issueToken, type User } from "./users";
import { resetPasswordMail, sendMail, verifyEmailMail } from "./email";

/** Whether anyone can create an account. On unless SIGNUPS=closed is set in the environment. */
export const SIGNUPS_OPEN = (process.env.SIGNUPS ?? "open").toLowerCase() !== "closed";

/** Throws a field error when a new password is too short or too long. */
export function checkNewPassword(pw: unknown, field = "password"): string {
  const p = typeof pw === "string" ? pw : "";
  if (p.trim().length < MIN_PASSWORD) throw new HttpError(400, `Use at least ${MIN_PASSWORD} characters`, { fields: { [field]: [`Use at least ${MIN_PASSWORD} characters`] } });
  if (p.length > MAX_PASSWORD) throw new HttpError(400, `Use at most ${MAX_PASSWORD} characters`, { fields: { [field]: [`Use at most ${MAX_PASSWORD} characters`] } });
  return p;
}

/** The public address of this install, for links in emails. APP_URL wins; otherwise the request's own origin. */
export function appUrl(req: Request): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendVerifyEmail(req: Request, user: Pick<User, "id" | "email">) {
  const token = await issueToken(user.id, "verify");
  await sendMail(verifyEmailMail(user.email, `${appUrl(req)}/verify?token=${token}`));
}

export async function sendResetEmail(req: Request, user: Pick<User, "id" | "email">) {
  const token = await issueToken(user.id, "reset");
  await sendMail(resetPasswordMail(user.email, `${appUrl(req)}/reset?token=${token}`));
}

/** What the browser may know about the signed-in account. */
export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, emailVerified: !!u.email_verified_at };
}
