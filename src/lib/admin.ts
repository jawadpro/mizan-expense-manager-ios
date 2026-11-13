import "server-only";
import { asSystem, q, tx } from "./db";
import type { User } from "./users";
import { HttpError } from "./http";

// The admin panel works with accounts, plans and subscriptions. It never reads what is inside an account
// (transactions, messages, balances); the only thing it learns about that is how many transactions there are.

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  email_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  plan: "free" | "pro";
  comp_plan: "pro" | null;
  comp_until: string | null;
  comp_note: string | null;
  sub_status: string | null;
  sub_interval: string | null;
  sub_amount_minor: number | null;
  sub_currency: string | null;
  sub_period_end: string | null;
  sub_ends_at: string | null;
  tx_count: number;
};

export type UserFilter = "all" | "pro" | "paying" | "trial" | "comp" | "free" | "suspended" | "admin";
export const USER_FILTERS: UserFilter[] = ["all", "pro", "paying", "trial", "comp", "free", "suspended", "admin"];

const COMP = `(u.comp_plan = 'pro' AND (u.comp_until IS NULL OR u.comp_until > now()))`;
const PAID = `s.status IN ('trialing', 'active', 'past_due')`;

const FILTER_SQL: Record<UserFilter, string> = {
  all: "true",
  pro: `(${COMP} OR coalesce(${PAID}, false))`,
  paying: `s.status IN ('active', 'past_due')`,
  trial: `s.status = 'trialing'`,
  comp: COMP,
  free: `NOT (${COMP} OR coalesce(${PAID}, false))`,
  suspended: `u.status = 'suspended'`,
  admin: `u.role = 'admin'`,
};

export const PAGE_SIZE = 50;

/** Accounts, newest first, matching an email/name search and a filter. */
export async function listUsers(opts: { search?: string; filter?: UserFilter; page?: number }) {
  const filter = opts.filter && FILTER_SQL[opts.filter] ? opts.filter : "all";
  const page = Math.max(1, Math.min(10_000, Math.floor(opts.page ?? 1)));
  const search = (opts.search ?? "").trim().slice(0, 100);
  const params: unknown[] = [];
  let where = FILTER_SQL[filter];
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where += ` AND (u.email ILIKE $${params.length} OR coalesce(u.name, '') ILIKE $${params.length})`;
  }
  const from = `FROM app.users u
    LEFT JOIN LATERAL (SELECT * FROM app.subscriptions x WHERE x.user_id = u.id ORDER BY x.updated_at DESC LIMIT 1) s ON true
    WHERE ${where}`;
  // Counting transactions spans accounts, so it runs outside any one account's view.
  return asSystem(async () => {
    const total = Number((await q<{ n: string }>(`SELECT count(*) AS n ${from}`, params)).rows[0].n);
    const { rows } = await q<AdminUserRow>(
      `SELECT u.id, u.email, u.name, u.role, u.status, (u.email_verified_at IS NOT NULL) AS email_verified,
              u.created_at, u.last_login_at, u.comp_plan, u.comp_until, u.comp_note,
              CASE WHEN ${COMP} OR coalesce(${PAID}, false) THEN 'pro' ELSE 'free' END AS plan,
              s.status AS sub_status, s.billing_interval AS sub_interval, s.amount_minor::float8 AS sub_amount_minor,
              s.currency AS sub_currency, s.current_period_end AS sub_period_end, s.ends_at AS sub_ends_at,
              (SELECT count(*) FROM app.transactions t WHERE t.user_id = u.id)::int AS tx_count
       ${from}
       ORDER BY u.created_at DESC, u.id
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params,
    );
    return { items: rows, total, page, pageSize: PAGE_SIZE, filter, search };
  });
}

export type Stats = {
  users: number;
  active: number;
  suspended: number;
  verified: number;
  signups7: number;
  signups30: number;
  pro: number;
  paying: number;
  trialing: number;
  pastDue: number;
  comp: number;
  cancelling: number;
  /** Monthly recurring revenue per currency, in minor units (yearly plans count as a twelfth). */
  mrr: { currency: string; amount_minor: number }[];
  signupsByDay: { day: string; n: number }[];
};

export async function getStats(): Promise<Stats> {
  const { rows: [c] } = await q<Record<string, string>>(
    `SELECT count(*) AS users,
            count(*) FILTER (WHERE u.status = 'active') AS active,
            count(*) FILTER (WHERE u.status = 'suspended') AS suspended,
            count(*) FILTER (WHERE u.email_verified_at IS NOT NULL) AS verified,
            count(*) FILTER (WHERE u.created_at > now() - interval '7 days') AS signups7,
            count(*) FILTER (WHERE u.created_at > now() - interval '30 days') AS signups30,
            count(*) FILTER (WHERE ${COMP} OR EXISTS (SELECT 1 FROM app.subscriptions s WHERE s.user_id = u.id AND ${PAID})) AS pro,
            count(*) FILTER (WHERE ${COMP}) AS comp
     FROM app.users u`,
  );
  const { rows: [s] } = await q<Record<string, string>>(
    `SELECT count(*) FILTER (WHERE status IN ('active', 'past_due')) AS paying,
            count(*) FILTER (WHERE status = 'trialing') AS trialing,
            count(*) FILTER (WHERE status = 'past_due') AS past_due,
            count(*) FILTER (WHERE ends_at IS NOT NULL AND status IN ('trialing', 'active', 'past_due')) AS cancelling
     FROM app.subscriptions`,
  );
  const { rows: mrr } = await q<{ currency: string; amount_minor: number }>(
    `SELECT coalesce(currency, 'USD') AS currency,
            round(sum(CASE WHEN billing_interval = 'year' THEN amount_minor / 12.0 ELSE amount_minor END))::float8 AS amount_minor
     FROM app.subscriptions WHERE status IN ('active', 'past_due') AND amount_minor IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC`,
  );
  const { rows: days } = await q<{ day: string; n: number }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(u.id)::int AS n
     FROM generate_series((now() AT TIME ZONE 'UTC')::date - 29, (now() AT TIME ZONE 'UTC')::date, interval '1 day') d
     LEFT JOIN app.users u ON (u.created_at AT TIME ZONE 'UTC')::date = d::date
     GROUP BY d ORDER BY d`,
  );
  const n = (v: string | undefined) => Number(v ?? 0);
  return {
    users: n(c.users), active: n(c.active), suspended: n(c.suspended), verified: n(c.verified),
    signups7: n(c.signups7), signups30: n(c.signups30), pro: n(c.pro), comp: n(c.comp),
    paying: n(s.paying), trialing: n(s.trialing), pastDue: n(s.past_due), cancelling: n(s.cancelling),
    mrr, signupsByDay: days,
  };
}

export type AdminEvent = { id: number; admin_email: string; user_email: string; action: string; detail: string | null; created_at: string };

export async function recentEvents(limit = 30): Promise<AdminEvent[]> {
  const { rows } = await q<AdminEvent>(
    `SELECT id::int AS id, admin_email, user_email, action, detail, created_at FROM app.admin_events ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export type UserPatch = {
  status?: "active" | "suspended";
  role?: "user" | "admin";
  /** null takes Pro away; an object gives it, optionally until a date. */
  comp?: { until: string | null; note: string | null } | null;
  /** Signs the account out everywhere. */
  signOut?: true;
};

type Target = { id: string; email: string; role: string; status: string };

async function target(id: string, query: typeof q): Promise<Target> {
  const { rows } = await query<Target>(`SELECT id, email, role, status FROM app.users WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows[0]) throw new HttpError(404, "No such account");
  return rows[0];
}

async function adminsLeft(query: typeof q, except: string): Promise<number> {
  const { rows } = await query<{ n: string }>(`SELECT count(*) AS n FROM app.users WHERE role = 'admin' AND status = 'active' AND id <> $1`, [except]);
  return Number(rows[0].n);
}

async function log(query: typeof q, admin: User, t: Target, action: string, detail: string | null = null) {
  await query(
    `INSERT INTO app.admin_events (admin_id, admin_email, user_id, user_email, action, detail) VALUES ($1, $2, $3, $4, $5, $6)`,
    [admin.id, admin.email, t.id, t.email, action, detail?.slice(0, 300) ?? null],
  );
}

/** Changes an account's status, role or given Pro. An admin can't lock themselves out, or leave no admin. */
export async function updateUser(admin: User, id: string, patch: UserPatch): Promise<void> {
  await tx(async (query) => {
    // Serialises admin changes, so two admins can't demote each other at the same moment.
    await query(`SELECT pg_advisory_xact_lock(hashtext('mizan:admin-changes'))`);
    const t = await target(id, query);
    const self = t.id === admin.id;
    if (patch.status && patch.status !== t.status) {
      if (self) throw new HttpError(400, "You can't suspend your own account.");
      if (patch.status === "suspended" && t.role === "admin" && (await adminsLeft(query, t.id)) === 0) {
        throw new HttpError(400, "This is the last admin.");
      }
      await query(
        `UPDATE app.users SET status = $2, sessions_valid_after = CASE WHEN $2 = 'suspended' THEN now() ELSE sessions_valid_after END, updated_at = now() WHERE id = $1`,
        [t.id, patch.status],
      );
      await log(query, admin, t, patch.status === "suspended" ? "suspended" : "reactivated");
    }
    if (patch.role && patch.role !== t.role) {
      if (self) throw new HttpError(400, "You can't change your own role.");
      if (patch.role === "user" && (await adminsLeft(query, t.id)) === 0) throw new HttpError(400, "This is the last admin.");
      await query(`UPDATE app.users SET role = $2, updated_at = now() WHERE id = $1`, [t.id, patch.role]);
      await log(query, admin, t, patch.role === "admin" ? "made admin" : "removed admin");
    }
    if (patch.comp !== undefined) {
      if (patch.comp === null) {
        await query(`UPDATE app.users SET comp_plan = NULL, comp_until = NULL, comp_note = NULL, updated_at = now() WHERE id = $1`, [t.id]);
        await log(query, admin, t, "removed free Pro");
      } else {
        await query(`UPDATE app.users SET comp_plan = 'pro', comp_until = $2, comp_note = $3, updated_at = now() WHERE id = $1`, [t.id, patch.comp.until, patch.comp.note]);
        const until = patch.comp.until ? `until ${patch.comp.until.slice(0, 10)}` : "with no end date";
        await log(query, admin, t, "gave free Pro", [until, patch.comp.note].filter(Boolean).join(". "));
      }
    }
    if (patch.signOut) {
      await query(`UPDATE app.users SET sessions_valid_after = now(), updated_at = now() WHERE id = $1`, [t.id]);
      await log(query, admin, t, "signed out everywhere");
    }
  });
}

/**
 * Deletes an account and everything in it (its rows go with it through ON DELETE CASCADE).
 * A paid subscription at Paddle is not cancelled by this; the admin page says so.
 */
export async function deleteUser(admin: User, id: string, confirmEmail: string): Promise<void> {
  await tx(async (query) => {
    await query(`SELECT pg_advisory_xact_lock(hashtext('mizan:admin-changes'))`);
    const t = await target(id, query);
    if (t.id === admin.id) throw new HttpError(400, "You can't delete your own account here.");
    if (confirmEmail.trim().toLowerCase() !== t.email) throw new HttpError(400, "Type the account's email to confirm.");
    if (t.role === "admin" && (await adminsLeft(query, t.id)) === 0) throw new HttpError(400, "This is the last admin.");
    await log(query, admin, t, "deleted account");
    // The account's rows are under row-level security; the cascade has to see all of them.
    await query(`SELECT set_config('mizan.system', 'on', true)`);
    await query(`DELETE FROM app.users WHERE id = $1`, [t.id]);
    await query(`SELECT set_config('mizan.system', '', true)`);
  });
}
