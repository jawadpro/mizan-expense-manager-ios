import "server-only";
import crypto from "node:crypto";
import { asSystem, q, tx } from "./db";
import { env } from "./env";
import { formatCode, normalizeCode, randomCode } from "./pairing-code";

// iPhone pairing: Mizan shows a short single-use code; the universal Mizan Shortcut sends it to /api/devices/pair
// and gets back a token for that iPhone alone, which it keeps on the phone. See docs/iphone-shortcut.md.

export const PAIRING_TTL_MIN = 10;
export const MAX_DEVICES = 5;
const TOKEN_RE = /^mzd_[A-Za-z0-9_-]{43}$/;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest();
const codeDigest = (code: string) => crypto.createHmac("sha256", env.sessionSecret()).update(`pair:${code}`).digest();

/** The shared iCloud Shortcut everyone installs, and the name the run-shortcut link opens. */
export function shortcutConfig() {
  const url = process.env.MIZAN_SHORTCUT_URL?.trim();
  return {
    url: url && /^https:\/\/www\.icloud\.com\/shortcuts\/[A-Za-z0-9]+$/.test(url) ? url : null,
    name: (process.env.MIZAN_SHORTCUT_NAME?.trim() || "Mizan").slice(0, 60),
  };
}

/** The address the iPhone should use: APP_URL if set, otherwise the address the request came in on. */
export function phoneUrl(req: Request): string {
  return process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}

/** A fresh single-use code for the signed-in user (runs in their context). Any unused code they made before stops working. */
export async function createPairingCode(userId: string, opts: { name?: string; replaces?: string } = {}) {
  const code = randomCode();
  const { rows } = await tx(async (run) => {
    await run(`DELETE FROM app.pairing_codes WHERE user_id = $1 AND (used_at IS NULL OR created_at < now() - interval '1 day')`, [userId]);
    return run<{ expires_at: Date }>(
      `INSERT INTO app.pairing_codes (code_digest, user_id, device_name, replaces_id, expires_at)
       VALUES ($1, $2, $3, (SELECT id FROM app.devices WHERE id = $4::uuid AND user_id = $2 AND revoked_at IS NULL),
               now() + make_interval(mins => $5))
       RETURNING expires_at`,
      [codeDigest(code), userId, opts.name?.trim().slice(0, 60) || null, opts.replaces ?? null, PAIRING_TTL_MIN],
    );
  });
  return { code, display: formatCode(code), expiresAt: rows[0].expires_at };
}

export type PairResult = { ok: true; deviceId: string; token: string; userId: string } | { ok: false; reason: "invalid" | "limit" };

/**
 * Turns a valid, unused, unexpired code into a new device and returns its token, once. Runs across accounts
 * (the code says whose it is). Mizan keeps only a SHA-256 digest of the token.
 */
export async function redeemPairingCode(rawCode: string, rawName: string): Promise<PairResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "invalid" };
  const token = `mzd_${crypto.randomBytes(32).toString("base64url")}`;
  return asSystem(() => tx(async (run) => {
    const used = await run<{ user_id: string; device_name: string | null; replaces_id: string | null }>(
      `UPDATE app.pairing_codes pc SET used_at = now()
       FROM app.users u
       WHERE pc.code_digest = $1 AND pc.used_at IS NULL AND pc.expires_at > now() AND u.id = pc.user_id AND u.status = 'active'
       RETURNING pc.user_id, pc.device_name, pc.replaces_id`,
      [codeDigest(code)],
    );
    const pc = used.rows[0];
    if (!pc) return { ok: false, reason: "invalid" } as const;
    if (pc.replaces_id) {
      await run(`UPDATE app.devices SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [pc.replaces_id, pc.user_id]);
    }
    const active = await run<{ n: number }>(`SELECT count(*)::int AS n FROM app.devices WHERE user_id = $1 AND revoked_at IS NULL`, [pc.user_id]);
    if (active.rows[0].n >= MAX_DEVICES) return { ok: false, reason: "limit" } as const;
    const name = (pc.device_name || rawName.replace(/[\u0000-\u001f]/g, "").trim() || "iPhone").slice(0, 60);
    const dev = await run<{ id: string }>(
      `INSERT INTO app.devices (user_id, name, token_digest, token_hint) VALUES ($1, $2, $3, $4) RETURNING id`,
      [pc.user_id, name, sha256(token), token.slice(-4)],
    );
    await run(`UPDATE app.pairing_codes SET device_id = $1 WHERE code_digest = $2`, [dev.rows[0].id, codeDigest(code)]);
    return { ok: true, deviceId: dev.rows[0].id, token, userId: pc.user_id } as const;
  }));
}

export const looksLikeDeviceToken = (t: string) => TOKEN_RE.test(t);

/** Whose paired iPhone a device token belongs to, or null (wrong, removed, or the account is suspended). */
export async function authenticateDevice(token: string): Promise<{ deviceId: string; userId: string } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { rows } = await asSystem(() =>
    q<{ id: string; user_id: string }>(
      `UPDATE app.devices d SET last_seen_at = now() FROM app.users u
       WHERE d.token_digest = $1 AND d.revoked_at IS NULL AND u.id = d.user_id AND u.status = 'active'
       RETURNING d.id, d.user_id`,
      [sha256(token)],
    ),
  );
  return rows[0] ? { deviceId: rows[0].id, userId: rows[0].user_id } : null;
}

const COUNTER: Record<string, string> = {
  imported: "imported_count", review: "review_count", duplicate: "duplicate_count", ignored: "ignored_count", failed: "failed_count",
};

/** Counts one delivery for the device (in the owner's context). Stores no message content. */
export async function recordIngest(deviceId: string, outcome: string) {
  const col = COUNTER[outcome];
  if (!col) return;
  // col comes from the fixed table above, never from input.
  await q(`UPDATE app.devices SET ${col} = ${col} + 1${outcome === "failed" ? "" : ", last_sms_at = now()"} WHERE id = $1`, [deviceId]);
}

export async function recordTest(deviceId: string) {
  await q(`UPDATE app.devices SET last_test_at = now() WHERE id = $1`, [deviceId]);
}

export type DeviceRow = {
  id: string; name: string; kind: "shortcut"; token_hint: string; paired_at: string;
  last_seen_at: string | null; last_sms_at: string | null; last_test_at: string | null; revoked_at: string | null;
  imported_count: number; review_count: number; duplicate_count: number; ignored_count: number; failed_count: number;
};

export async function listDevices(): Promise<DeviceRow[]> {
  const { rows } = await q<DeviceRow>(
    `SELECT id, name, kind, token_hint, paired_at, last_seen_at, last_sms_at, last_test_at, revoked_at,
            imported_count, review_count, duplicate_count, ignored_count, failed_count
     FROM app.devices WHERE revoked_at IS NULL OR revoked_at > now() - interval '30 days'
     ORDER BY revoked_at IS NOT NULL, paired_at DESC`,
  );
  return rows;
}

/** What happened to the user's latest pairing code, for the setup screen to follow along. */
export async function latestPairing() {
  const { rows } = await q<{ expires_at: string; used_at: string | null; device_id: string | null }>(
    `SELECT expires_at, used_at, device_id FROM app.pairing_codes ORDER BY created_at DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function renameDevice(id: string, name: string): Promise<boolean> {
  const { rowCount } = await q(`UPDATE app.devices SET name = $2 WHERE id = $1 AND revoked_at IS NULL`, [id, name]);
  return rowCount === 1;
}

/** Removes a device: its token stops working at once. */
export async function revokeDevice(id: string): Promise<boolean> {
  const { rowCount } = await q(`UPDATE app.devices SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  return rowCount === 1;
}
