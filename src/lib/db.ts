import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";

/** "app" is the private workspace; "demo" holds synthetic data and is only ever read. */
export type Space = "app" | "demo";

// ---- Whose data a query may touch ---------------------------------------------------------------
//
// Every account's rows carry a user_id, and row-level security in Postgres (migration 019) only shows
// a query the rows of the account in mizan.uid. Every connection runs as the mizan_tenant role, which
// can't bypass those rules, so a query that forgets to say whose data it wants sees nothing at all.
//
// A request runs inside a context (handle() makes one). requireUser() puts the signed-in account in it,
// and from then on the request's queries share one connection whose mizan.uid is that account. asUser()
// does the same for code that isn't a request (pages, cron), and asSystem() is for the few jobs that
// must see every account (finding whose SMS token this is, the nightly backups, the admin panel).

type Ctx = { uid: string | null; system: boolean; client?: Promise<PoolClient>; done?: boolean; txDepth?: number };
const als = new AsyncLocalStorage<Ctx>();
const TENANT_ROLE = "mizan_tenant";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pool: Pool | undefined;
/** Connections that have already switched to the tenant role. */
const ready = new WeakSet<PoolClient>();

function getPool(): Pool {
  if (!pool) {
    const url = env.databaseUrl();
    // A database on this machine or inside Docker Compose has no TLS.
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || process.env.DATABASE_SSL === "false";
    pool = new Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on("error", () => {
      // Idle client errors (e.g. serverless DB suspending) are recovered on next checkout.
    });
  }
  return pool;
}

/** A pooled connection running as the tenant role. Fails closed: if the role can't be taken, no query runs. */
async function connect(): Promise<PoolClient> {
  const client = await getPool().connect();
  if (!ready.has(client)) {
    try {
      await client.query(`SET ROLE ${TENANT_ROLE}`);
      ready.add(client);
    } catch (e) {
      client.release(true);
      throw e;
    }
  }
  return client;
}

/** Returns a connection to the pool with no account set, or drops it if that can't be guaranteed. */
async function release(client: PoolClient) {
  try {
    await client.query(`SELECT set_config('mizan.uid', '', false), set_config('mizan.system', '', false)`);
    client.release();
  } catch {
    client.release(true);
  }
}

/** The connection a context's queries share, opened on first use with the context's account set on it. */
function ctxClient(ctx: Ctx): Promise<PoolClient> {
  if (!ctx.client) {
    ctx.client = (async () => {
      const client = await connect();
      try {
        await client.query(`SELECT set_config('mizan.uid', $1, false), set_config('mizan.system', $2, false)`, [ctx.uid ?? "", ctx.system ? "on" : ""]);
      } catch (e) {
        client.release(true);
        throw e;
      }
      return client;
    })();
    // A failed open must not leave a rejected promise behind for the next query to reuse.
    ctx.client.catch(() => {
      ctx.client = undefined;
    });
  }
  return ctx.client;
}

async function closeCtx(ctx: Ctx) {
  ctx.done = true;
  const pending = ctx.client;
  ctx.client = undefined;
  if (pending) await pending.then(release, () => {});
}

/** Runs fn in a fresh context with no account yet (requireUser fills it in). Used by handle(). */
export async function withContext<T>(fn: () => Promise<T>): Promise<T> {
  const ctx: Ctx = { uid: null, system: false };
  try {
    return await als.run(ctx, fn);
  } finally {
    await closeCtx(ctx);
  }
}

/** Says whose data the rest of this request may touch. Called by requireUser once the session checks out. */
export function setContextUser(uid: string) {
  if (!UUID.test(uid)) throw new Error("Bad user id");
  const ctx = als.getStore();
  if (!ctx || ctx.done) return;
  if (ctx.uid === uid) return;
  // The account is fixed once queries have run for it; switching would mix two accounts on one connection.
  if (ctx.client || ctx.system) throw new Error("This request already has an account");
  ctx.uid = uid;
}

/** Runs fn with uid's data, in its own context (for pages, cron jobs and scripts). */
export async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  if (!UUID.test(uid)) throw new Error("Bad user id");
  const ctx: Ctx = { uid, system: false };
  try {
    return await als.run(ctx, fn);
  } finally {
    await closeCtx(ctx);
  }
}

/** Runs fn able to see every account's rows. Only for jobs that genuinely span accounts. */
export async function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  const ctx: Ctx = { uid: null, system: true };
  try {
    return await als.run(ctx, fn);
  } finally {
    await closeCtx(ctx);
  }
}

/** The account the current context is for, if any. */
export function contextUser(): string | null {
  const ctx = als.getStore();
  return ctx && !ctx.done ? ctx.uid : null;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const ctx = als.getStore();
  if (ctx && !ctx.done && (ctx.uid || ctx.system)) {
    const client = await ctxClient(ctx);
    return client.query<T>(text, params);
  }
  // No account: the query still runs as the tenant role, so it sees no account's rows.
  const client = await connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/** Schema name for a space. Only these two literals ever reach SQL text. */
export function sch(space: Space): "app" | "demo" {
  return space === "demo" ? "demo" : "app";
}

export async function tx<T>(fn: (query: typeof q) => Promise<T>): Promise<T> {
  const ctx = als.getStore();
  const shared = !!(ctx && !ctx.done && (ctx.uid || ctx.system));
  const client = shared ? await ctxClient(ctx!) : await connect();
  // On the context's shared connection a transaction may already be open: nest with a savepoint.
  const depth = shared ? (ctx!.txDepth ?? 0) : 0;
  const sp = `mizan_sp_${depth}`;
  if (shared) ctx!.txDepth = depth + 1;
  try {
    await client.query(depth ? `SAVEPOINT ${sp}` : "BEGIN");
    const run = (async (text: string, params: unknown[] = []) => client.query(text, params)) as typeof q;
    const out = await fn(run);
    await client.query(depth ? `RELEASE SAVEPOINT ${sp}` : "COMMIT");
    return out;
  } catch (e) {
    await client.query(depth ? `ROLLBACK TO SAVEPOINT ${sp}` : "ROLLBACK").catch(() => {});
    throw e;
  } finally {
    if (shared) ctx!.txDepth = depth;
    else client.release();
  }
}
