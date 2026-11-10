import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { loadConfig } from "./config";
import { hmac, safeEqual } from "./crypto";
import { findUserById, type User } from "./users";

export const SESSION_COOKIE = "mizan_session";
export const CSRF_COOKIE = "mizan_csrf";
/** "Remember me" keeps the device signed in for 180 days; otherwise the cookie ends with the browser session (max 12 h). */
const REMEMBER_TTL_S = 180 * 24 * 3600;
const SHORT_TTL_S = 12 * 3600;

/** uid is the signed-in account, iat when it was issued (epoch ms) and rem whether "Remember me" was on. */
export type Session = { sid: string; uid: string; exp: number; iat: number; rem: boolean };

export function issueSession(uid: string, remember: boolean): { cookie: string; csrf: string; maxAge: number | null } {
  const ttl = remember ? REMEMBER_TTL_S : SHORT_TTL_S;
  const now = Date.now();
  const payload: Session = { sid: crypto.randomBytes(18).toString("base64url"), uid, exp: Math.floor(now / 1000) + ttl, iat: now, rem: remember };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(env.sessionSecret(), `session:${body}`);
  return { cookie: `${body}.${sig}`, csrf: csrfFor(payload.sid), maxAge: remember ? ttl : null };
}

/** Set-Cookie headers for a new session. */
export function sessionHeaders(uid: string, remember: boolean): Headers {
  const s = issueSession(uid, remember);
  const age = s.maxAge ? `; Max-Age=${s.maxAge}` : "";
  // The local Docker demo runs on plain http, where some browsers drop Secure cookies.
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false" ? "; Secure" : "";
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", `${SESSION_COOKIE}=${s.cookie}; Path=/; HttpOnly; SameSite=Lax${age}${secure}`);
  headers.append("set-cookie", `${CSRF_COOKIE}=${s.csrf}; Path=/; SameSite=Lax${age}${secure}`);
  return headers;
}

/** Set-Cookie headers that sign this device out. */
export function clearSessionHeaders(): Headers {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  headers.append("set-cookie", `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`);
  return headers;
}

function csrfFor(sid: string): string {
  return hmac(env.sessionSecret(), `csrf:${sid}`);
}

export function parseSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(env.sessionSecret(), `session:${body}`))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    // Sessions from before accounts existed carry no uid and are refused, which signs everyone in again once.
    if (typeof s.sid !== "string" || typeof s.uid !== "string" || typeof s.exp !== "number" || typeof s.iat !== "number") return null;
    if (s.exp < Date.now() / 1000) return null;
    return { ...s, rem: s.rem === true };
  } catch {
    return null;
  }
}

/** The account behind a valid session, or null when it is gone, suspended, or signed out by a password change. */
async function activeUser(s: Session): Promise<User | null> {
  const user = await findUserById(s.uid);
  if (!user || user.status !== "active") return null;
  if (user.sessions_valid_after_ms && s.iat < user.sessions_valid_after_ms) return null;
  return user;
}

/** For server components / layouts. */
export async function getUser(): Promise<User | null> {
  await loadConfig();
  const jar = await cookies();
  const s = parseSession(jar.get(SESSION_COOKIE)?.value);
  return s ? activeUser(s) : null;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export type Authed = { user: User; session: Session };

/**
 * Verifies the session cookie for an API request and loads its account. For state-changing methods it
 * also requires a same-origin Origin header and a CSRF token bound to the session.
 */
export async function requireUser(req: Request): Promise<Authed> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const raw = readCookie(cookieHeader, SESSION_COOKIE);
  const session = parseSession(raw);
  if (!session) throw new AuthError(401, "Sign in required");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    assertSameOrigin(req);
    const token = req.headers.get("x-csrf-token") ?? "";
    if (!token || !safeEqual(token, csrfFor(session.sid))) throw new AuthError(403, "Invalid CSRF token");
  }
  const user = await activeUser(session);
  if (!user) throw new AuthError(401, "Sign in required");
  return { user, session };
}

/** Like requireUser, but only for an admin account. */
export async function requireAdmin(req: Request): Promise<Authed> {
  const a = await requireUser(req);
  if (a.user.role !== "admin") throw new AuthError(403, "Admins only");
  return a;
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new AuthError(403, "Missing origin");
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    throw new AuthError(403, "Bad origin");
  }
  if (o.host !== host) throw new AuthError(403, "Cross-origin request blocked");
}

export function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
