import "server-only";
import crypto from "node:crypto";
import { asSystem, q, tx } from "./db";
import { hashPassword } from "./crypto";

export type Role = "user" | "admin";
export type UserStatus = "active" | "suspended";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  email_verified_at: string | null;
  /** Epoch ms, or null. Sessions issued before it are refused. */
  sessions_valid_after_ms: number | null;
  /** When the account finished the setup steps (banks, name, iPhone), or null. */
  onboarded_at: string | null;
  created_at: string;
};

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 256;

const COLS =
  "id, email, name, role, status, email_verified_at, onboarded_at, created_at, " +
  "(extract(epoch from sessions_valid_after) * 1000)::float8 AS sessions_valid_after_ms";

/** Lower-cased and trimmed, or null when it isn't a plausible address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 3 || e.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await q<User>(`SELECT ${COLS} FROM app.users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const { rows } = await q<User & { password_hash: string }>(`SELECT ${COLS}, password_hash FROM app.users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function countUsers(): Promise<number> {
  const { rows } = await q<{ n: number }>(`SELECT count(*)::int AS n FROM app.users`);
  return rows[0].n;
}

/** A new account. Returns null when the email is already taken. */
export async function createUser(input: { email: string; password: string; name?: string | null; role?: Role; verified?: boolean }): Promise<User | null> {
  const { rows } = await q<User>(
    `INSERT INTO app.users (email, password_hash, name, role, email_verified_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${COLS}`,
    [input.email, hashPassword(input.password), input.name?.trim() || null, input.role ?? "user", !!input.verified],
  );
  return rows[0] ?? null;
}

/**
 * The install's first account, made an admin. Returns null when any account already exists, so a second
 * visitor to a new install can't make themselves its admin.
 */
export async function createFirstAdmin(input: { email: string; password: string; name?: string | null }): Promise<User | null> {
  return tx(async (run) => {
    // Serialises two first-run requests racing each other.
    await run(`LOCK TABLE app.users IN SHARE ROW EXCLUSIVE MODE`);
    const { rows: [{ n }] } = await run(`SELECT count(*)::int AS n FROM app.users`);
    if (n > 0) return null;
    const { rows } = await run(
      `INSERT INTO app.users (email, password_hash, name, role, email_verified_at)
       VALUES ($1, $2, $3, 'admin', now()) RETURNING ${COLS}`,
      [input.email, hashPassword(input.password), input.name?.trim() || null],
    );
    return (rows[0] as User) ?? null;
  }).then(async (user) => {
    if (user) await adoptUnowned(user.id);
    return user;
  });
}

/** Tables whose rows belong to an account (migration 019). */
const OWNED_TABLES = [
  "transactions", "sms_imports", "review_items", "balance_anchor", "set_asides", "zakat_years",
  "push_subscriptions", "app_secrets", "category_limits", "preferences", "sms_templates", "sms_words",
  "banks", "monthly_items", "monthly_marks", "monthly_mark_txs",
] as const;

/**
 * Data from before accounts existed belongs to the install's first account. Migration 019 assigns it when
 * that account already exists; on an install whose owner creates it later, this does it then. The install's
 * SMS token and finished setup carry over too, so the owner's iPhone Shortcut keeps working.
 */
async function adoptUnowned(userId: string) {
  await asSystem(async () => {
    for (const t of OWNED_TABLES) await q(`UPDATE app.${t} SET user_id = $1 WHERE user_id IS NULL`, [userId]);
  });
  await q(
    `UPDATE app.users u SET sms_token = coalesce(u.sms_token, c.sms_token),
            onboarded_at = coalesce(u.onboarded_at, c.setup_done_at)
     FROM app.config c WHERE c.id = 1 AND u.id = $1`,
    [userId],
  );
}

/** The first account on the install, which an SMS_INGEST_TOKEN set in the environment belongs to. */
export async function firstUserId(): Promise<string | null> {
  const { rows } = await q<{ id: string }>(`SELECT id FROM app.users ORDER BY created_at, id LIMIT 1`);
  return rows[0]?.id ?? null;
}

// ---- SMS token: what the iPhone Shortcut sends, which says whose alert it is ---------------------

export async function getSmsToken(userId: string): Promise<string | null> {
  const { rows } = await q<{ sms_token: string | null }>(`SELECT sms_token FROM app.users WHERE id = $1`, [userId]);
  return rows[0]?.sms_token ?? null;
}

/** The account's token, created on first use. */
export async function ensureSmsToken(userId: string): Promise<string> {
  const { rows } = await q<{ sms_token: string }>(
    `UPDATE app.users SET sms_token = coalesce(sms_token, $2) WHERE id = $1 RETURNING sms_token`,
    [userId, crypto.randomBytes(32).toString("base64url")],
  );
  return rows[0].sms_token;
}

/** A new token; the old one stops working at once. */
export async function regenerateSmsToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await q(`UPDATE app.users SET sms_token = $2, updated_at = now() WHERE id = $1`, [userId, token]);
  return token;
}

/** The active account an SMS token belongs to. */
export async function userBySmsToken(token: string): Promise<User | null> {
  if (token.length < 32 || token.length > 200) return null;
  const { rows } = await q<User>(`SELECT ${COLS} FROM app.users WHERE sms_token = $1 AND status = 'active'`, [token]);
  return rows[0] ?? null;
}

export async function markOnboarded(userId: string) {
  await q(`UPDATE app.users SET onboarded_at = coalesce(onboarded_at, now()), updated_at = now() WHERE id = $1`, [userId]);
}

/** Saves a new password and signs out every session issued before now. Returns the cut-off (epoch ms). */
export async function setPassword(userId: string, password: string): Promise<number> {
  const cutoff = Date.now();
  await q(
    `UPDATE app.users SET password_hash = $2, sessions_valid_after = to_timestamp($3::float8 / 1000), updated_at = now() WHERE id = $1`,
    [userId, hashPassword(password), cutoff],
  );
  return cutoff;
}

export async function touchLogin(userId: string) {
  await q(`UPDATE app.users SET last_login_at = now() WHERE id = $1`, [userId]);
}

export async function markVerified(userId: string) {
  await q(`UPDATE app.users SET email_verified_at = coalesce(email_verified_at, now()), updated_at = now() WHERE id = $1`, [userId]);
}

// ---- One-time email links ----------------------------------------------------------------------

export type TokenPurpose = "verify" | "reset";
const TOKEN_TTL_MS: Record<TokenPurpose, number> = { verify: 3 * 24 * 3600_000, reset: 3600_000 };

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("base64url");

/** A fresh link token. Earlier unused tokens for the same purpose stop working. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await tx(async (run) => {
    await run(`DELETE FROM app.auth_tokens WHERE user_id = $1 AND purpose = $2`, [userId, purpose]);
    await run(
      `INSERT INTO app.auth_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, now() + ($4::float8 * interval '1 millisecond'))`,
      [sha(token), userId, purpose, TOKEN_TTL_MS[purpose]],
    );
  });
  return token;
}

/** Uses up a token. Returns its user id, or null when it is unknown, used, expired or for another purpose. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { rows } = await q<{ user_id: string }>(
    `UPDATE app.auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}
