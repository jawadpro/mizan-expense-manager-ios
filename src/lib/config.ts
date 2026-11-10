import "server-only";
import crypto from "node:crypto";
import webpush from "web-push";
import { q } from "./db";
import { env, setStoredConfig, type StoredConfig } from "./env";
import { countUsers, createFirstAdmin, type User } from "./users";

// The install-wide settings the setup page saves (signing secret, SMS token, notification keys).
// Read once per instance and kept for a short while; before setup is finished it is read every time.

const COLS =
  "session_secret, password_hash, sms_token, vapid_public, vapid_private, vapid_subject, setup_done_at";
const TTL_MS = 30_000;
let loadedAt = 0;
let complete = false;

export type DbState = "missing" | "unreachable" | "not-migrated" | "ok";

async function read(): Promise<{ db: DbState; row: Partial<StoredConfig> }> {
  if (!env.hasDatabase()) return { db: "missing", row: {} };
  try {
    const { rows } = await q<StoredConfig>(`SELECT ${COLS} FROM app.config WHERE id = 1`);
    return { db: "ok", row: rows[0] ?? {} };
  } catch (e) {
    // 42P01 = table missing, 3F000 = schema missing: the migrations haven't run on this database.
    const code = (e as { code?: string })?.code;
    return { db: code === "42P01" || code === "3F000" ? "not-migrated" : "unreachable", row: {} };
  }
}

/** Loads saved settings into env. Never throws: without a database the environment alone decides. */
export async function loadConfig(force = false): Promise<DbState> {
  if (!force && complete && Date.now() - loadedAt < TTL_MS) return "ok";
  const { db, row } = await read();
  // Keep what was loaded before if the database blips, so signed-in sessions don't drop.
  if (db === "ok" || !complete) setStoredConfig(row);
  loadedAt = Date.now();
  complete = db === "ok" && env.setupDone();
  return db;
}

/**
 * hasOwner: the install has its first (admin) account. legacyPassphrase: an install from before accounts
 * existed, whose owner signs in once with the old passphrase to create that account.
 */
export type SetupState = { db: DbState; hasOwner: boolean; legacyPassphrase: boolean; done: boolean };

export async function setupState(): Promise<SetupState> {
  const db = await loadConfig(!env.setupDone());
  let hasOwner = false;
  if (db === "ok") {
    try {
      hasOwner = (await countUsers()) > 0;
    } catch {
      hasOwner = false;
    }
  }
  return { db, hasOwner, legacyPassphrase: !hasOwner && !!env.legacyPassphraseHash(), done: env.setupDone() };
}


const secret = () => crypto.randomBytes(32).toString("base64url");

/** Creates the secrets the environment doesn't provide. Never replaces one that exists. */
export async function ensureInstallSecrets(origin: string) {
  const keys = env.vapid() ? null : webpush.generateVAPIDKeys();
  await q(
    `INSERT INTO app.config AS c (id, session_secret, sms_token, vapid_public, vapid_private, vapid_subject)
     VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET session_secret = coalesce(c.session_secret, EXCLUDED.session_secret),
       sms_token = coalesce(c.sms_token, EXCLUDED.sms_token),
       vapid_public = coalesce(c.vapid_public, EXCLUDED.vapid_public), vapid_private = coalesce(c.vapid_private, EXCLUDED.vapid_private),
       vapid_subject = coalesce(c.vapid_subject, EXCLUDED.vapid_subject), updated_at = now()`,
    [
      env.fromEnv("SESSION_SECRET") ? null : secret(),
      env.fromEnv("SMS_INGEST_TOKEN") ? null : secret(),
      keys?.publicKey ?? null,
      keys?.privateKey ?? null,
      keys ? origin : null,
    ],
  );
  await loadConfig(true);
}

/**
 * First run: creates the admin account and the install's secrets. Returns null when an account already
 * exists, so a second visitor can't take over the install.
 */
export async function claimInstall(input: { email: string; password: string; name?: string | null }, origin: string): Promise<User | null> {
  const user = await createFirstAdmin(input);
  if (!user) return null;
  await ensureInstallSecrets(origin);
  return user;
}

/** The old passphrase stops working once the owner has an account. */
export async function forgetLegacyPassphrase() {
  await q(`UPDATE app.config SET password_hash = NULL, updated_at = now() WHERE id = 1`);
  await loadConfig(true);
}

/** Marks the install as set up (its admin finished the setup steps). Each account's own steps are users.onboarded_at. */
export async function finishSetup() {
  await q(`INSERT INTO app.config AS c (id, setup_done_at) VALUES (1, now())
           ON CONFLICT (id) DO UPDATE SET setup_done_at = coalesce(c.setup_done_at, now()), updated_at = now()`);
  await loadConfig(true);
}
