// Creates an admin account when the database has no accounts yet (used by the Docker demo).
// Usage: DATABASE_URL=... node scripts/create-admin.mjs email@example.com 'a long password'
import crypto from "node:crypto";
import pg from "pg";

const [email, password] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 10) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password of at least 10 characters>");
  process.exit(1);
}
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || process.env.DATABASE_SSL === "false";
const db = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: true } });
await db.connect();
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
const passwordHash = `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
const { rowCount } = await db.query(
  `INSERT INTO app.users (email, password_hash, role, email_verified_at)
   SELECT $1, $2, 'admin', now() WHERE NOT EXISTS (SELECT 1 FROM app.users)`,
  [email.trim().toLowerCase(), passwordHash],
);
console.log(rowCount ? `[create-admin] created ${email}` : "[create-admin] accounts already exist; leaving them alone.");
await db.end();
