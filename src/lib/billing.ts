import "server-only";
import crypto from "node:crypto";
import { q } from "./db";

// Paddle Billing (v2). Checkout runs in the browser with Paddle.js; Paddle then tells us about the
// subscription through webhooks, which are the only thing that changes app.subscriptions.
//
// Environment:
//   PADDLE_ENV               "sandbox" (default) or "production"
//   PADDLE_CLIENT_TOKEN      client-side token for Paddle.js (Developer tools → Authentication)
//   PADDLE_API_KEY           server API key, for the customer portal link
//   PADDLE_WEBHOOK_SECRET    the notification destination's secret key
//   PADDLE_PRICE_MONTHLY     price id (pri_...) of the monthly price
//   PADDLE_PRICE_YEARLY      price id of the yearly price
//   PRICE_MONTHLY_LABEL      what the plans page shows, default "$4.99"
//   PRICE_YEARLY_LABEL       default "$49"
//   TRIAL_DAYS               shown on the plans page, default 14. The trial itself is set on the Paddle prices.
//   BILLING_TEST_MODE        "true" adds a "Simulate payment" button while Paddle isn't set up. Local testing only:
//                            anyone signed in can give themselves Pro with it.

export type Interval = "month" | "year";

export function billingConfig() {
  const env = process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
  const trial = Number(process.env.TRIAL_DAYS ?? "14");
  return {
    env,
    clientToken: process.env.PADDLE_CLIENT_TOKEN || null,
    prices: {
      month: process.env.PADDLE_PRICE_MONTHLY || null,
      year: process.env.PADDLE_PRICE_YEARLY || null,
    },
    labels: {
      month: process.env.PRICE_MONTHLY_LABEL || "$4.99",
      year: process.env.PRICE_YEARLY_LABEL || "$49",
    },
    trialDays: Number.isFinite(trial) && trial > 0 ? Math.round(trial) : 0,
  };
}

/** Whether the browser can open a checkout. */
export function checkoutReady(): boolean {
  const c = billingConfig();
  return !!(c.clientToken && c.prices.month && c.prices.year);
}

/** The local stand-in for checkout: on only when asked for and Paddle isn't set up. */
export function testModeOn(): boolean {
  return process.env.BILLING_TEST_MODE === "true" && !checkoutReady();
}

/** Starts or ends a pretend subscription for the account (test mode only). */
export async function simulateSubscription(userId: string, action: "month" | "year" | "cancel"): Promise<void> {
  const c = billingConfig();
  const subId = `test_${userId}`;
  if (action === "cancel") {
    await q(`UPDATE app.subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now(), provider_updated_at = now()
             WHERE provider = 'paddle' AND provider_subscription_id = $1`, [subId]);
    return;
  }
  const amount = Math.round(Number((action === "month" ? c.labels.month : c.labels.year).replace(/[^0-9.]/g, "")) * 100) || null;
  const days = action === "month" ? 30 : 365;
  await q(
    `INSERT INTO app.subscriptions AS s (user_id, provider, provider_subscription_id, status, billing_interval, price_id, amount_minor,
       currency, current_period_end, provider_updated_at)
     VALUES ($1, 'paddle', $2, 'active', $3, 'test', $4, 'USD', now() + make_interval(days => $5), now())
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET status = 'active', billing_interval = EXCLUDED.billing_interval,
       amount_minor = EXCLUDED.amount_minor, current_period_end = EXCLUDED.current_period_end, ends_at = NULL, canceled_at = NULL,
       provider_updated_at = now(), updated_at = now()`,
    [userId, subId, action, amount, days],
  );
}

function apiBase() {
  return billingConfig().env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

/**
 * Checks the Paddle-Signature header ("ts=...;h1=...") against an HMAC-SHA256 of "ts:rawBody".
 * Rejects signatures older than five minutes, so a captured webhook can't be replayed later.
 */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(";").map((kv) => {
    const i = kv.indexOf("=");
    return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
  }));
  const ts = Number(parts.ts);
  const sigs = header.split(";").filter((p) => p.trim().startsWith("h1=")).map((p) => p.trim().slice(3));
  if (!Number.isFinite(ts) || sigs.length === 0) return false;
  if (Math.abs(nowMs / 1000 - ts) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.ts}:${rawBody}`).digest("hex");
  const e = Buffer.from(expected, "hex");
  return sigs.some((s) => {
    const b = Buffer.from(s, "hex");
    return b.length === e.length && crypto.timingSafeEqual(b, e);
  });
}

type PaddleSub = {
  id: string;
  status: string;
  customer_id?: string | null;
  custom_data?: { user_id?: string } | null;
  currency_code?: string | null;
  updated_at?: string | null;
  canceled_at?: string | null;
  current_billing_period?: { ends_at?: string | null } | null;
  scheduled_change?: { action?: string; effective_at?: string | null } | null;
  items?: { price?: { id?: string; billing_cycle?: { interval?: string } | null; unit_price?: { amount?: string } | null } | null }[];
};

const STATUSES = new Set(["trialing", "active", "past_due", "paused", "canceled"]);

/**
 * Applies a subscription.* webhook. Idempotent, and ignores an event older than what is stored
 * (Paddle doesn't promise delivery order). Returns what happened, for the webhook's response.
 */
export async function applySubscriptionEvent(sub: PaddleSub): Promise<"saved" | "stale" | "unknown-user" | "ignored"> {
  if (!sub?.id || !STATUSES.has(sub.status)) return "ignored";
  const price = sub.items?.[0]?.price ?? null;
  const interval = price?.billing_cycle?.interval;
  const amount = price?.unit_price?.amount;
  const endsAt = sub.scheduled_change?.action === "cancel" ? sub.scheduled_change.effective_at ?? null : null;

  // Whose it is: the checkout's custom data, or the account an earlier event for this subscription named.
  let userId = sub.custom_data?.user_id ?? null;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    const { rows } = await q<{ user_id: string }>(`SELECT user_id FROM app.subscriptions WHERE provider = 'paddle' AND provider_subscription_id = $1`, [sub.id]);
    userId = rows[0]?.user_id ?? null;
  }
  if (!userId) return "unknown-user";
  const exists = await q(`SELECT 1 FROM app.users WHERE id = $1`, [userId]);
  if (!exists.rowCount) return "unknown-user";

  const { rowCount } = await q(
    `INSERT INTO app.subscriptions AS s (user_id, provider, provider_subscription_id, provider_customer_id, status, billing_interval,
       price_id, amount_minor, currency, current_period_end, ends_at, canceled_at, provider_updated_at)
     VALUES ($1, 'paddle', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
       provider_customer_id = coalesce(EXCLUDED.provider_customer_id, s.provider_customer_id),
       status = EXCLUDED.status, billing_interval = coalesce(EXCLUDED.billing_interval, s.billing_interval),
       price_id = coalesce(EXCLUDED.price_id, s.price_id), amount_minor = coalesce(EXCLUDED.amount_minor, s.amount_minor),
       currency = coalesce(EXCLUDED.currency, s.currency), current_period_end = EXCLUDED.current_period_end,
       ends_at = EXCLUDED.ends_at, canceled_at = EXCLUDED.canceled_at,
       provider_updated_at = EXCLUDED.provider_updated_at, updated_at = now()
     WHERE s.provider_updated_at IS NULL OR EXCLUDED.provider_updated_at IS NULL OR EXCLUDED.provider_updated_at >= s.provider_updated_at`,
    [
      userId, sub.id, sub.customer_id ?? null, sub.status,
      interval === "month" || interval === "year" ? interval : null,
      price?.id ?? null, amount && /^\d+$/.test(amount) ? Number(amount) : null,
      sub.currency_code && sub.currency_code.length === 3 ? sub.currency_code : null,
      sub.current_billing_period?.ends_at ?? null, endsAt, sub.canceled_at ?? null, sub.updated_at ?? null,
    ],
  );
  return rowCount ? "saved" : "stale";
}

/** A link to Paddle's customer portal, where the account can change plan, update its card or cancel. */
export async function portalUrl(userId: string): Promise<string | null> {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  const { rows } = await q<{ provider_customer_id: string | null; provider_subscription_id: string }>(
    `SELECT provider_customer_id, provider_subscription_id FROM app.subscriptions
     WHERE user_id = $1 AND provider = 'paddle' AND provider_customer_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row?.provider_customer_id) return null;
  const res = await fetch(`${apiBase()}/customers/${encodeURIComponent(row.provider_customer_id)}/portal-sessions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ subscription_ids: [row.provider_subscription_id] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Paddle responded ${res.status}`);
  const data = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  return data.data?.urls?.general?.overview ?? null;
}
