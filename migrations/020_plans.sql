-- Plans. Everyone starts on Free (adding transactions by hand). Pro comes from a paid subscription
-- (app.subscriptions, kept in step with the payment provider's webhooks) or is given by an admin (comp_plan).

-- Pro given by an admin, optionally until a date. The install's admin gets it, so nothing is taken away.
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS comp_plan text CHECK (comp_plan IS NULL OR comp_plan = 'pro');
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS comp_until timestamptz;
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS comp_note text CHECK (comp_note IS NULL OR char_length(comp_note) <= 200);
UPDATE app.users SET comp_plan = 'pro', comp_note = coalesce(comp_note, 'Admin') WHERE role = 'admin' AND comp_plan IS NULL;

-- One row per subscription at the payment provider. Written only by the webhook handler.
CREATE TABLE IF NOT EXISTS app.subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  provider                  text NOT NULL DEFAULT 'paddle' CHECK (provider IN ('paddle')),
  provider_subscription_id  text NOT NULL CHECK (char_length(provider_subscription_id) <= 100),
  provider_customer_id      text CHECK (provider_customer_id IS NULL OR char_length(provider_customer_id) <= 100),
  status                    text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  billing_interval          text CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  price_id                  text CHECK (price_id IS NULL OR char_length(price_id) <= 100),
  amount_minor              bigint,
  currency                  text CHECK (currency IS NULL OR char_length(currency) = 3),
  current_period_end        timestamptz,
  -- Set when the subscription is due to end (cancelled, but paid up until then).
  ends_at                   timestamptz,
  canceled_at               timestamptz,
  -- The provider's own time for the last event applied, so an older, late webhook can't undo a newer one.
  provider_updated_at       timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_uniq ON app.subscriptions (provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON app.subscriptions (user_id, status);
