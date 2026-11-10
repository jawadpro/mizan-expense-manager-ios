-- Each account's data is its own.
--
-- Every table that holds someone's data gets a user_id. Row-level security then shows a query only the
-- rows of the account named in the mizan.uid setting (or every row when mizan.system is on, for jobs that
-- span accounts). The app connects as the database owner and immediately switches to the mizan_tenant
-- role, which can't bypass row-level security, so a query that doesn't say whose data it wants sees none.
--
-- New rows get user_id from mizan.uid automatically, so inserts don't have to name it.
-- Rows that existed before this migration belong to the install's first account. On an install whose
-- owner hasn't created that account yet, they stay unowned (hidden from everyone) until they do.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mizan_tenant') THEN
    CREATE ROLE mizan_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;
-- The connecting user (the owner running this migration) may switch to it.
DO $$
BEGIN
  EXECUTE format('GRANT mizan_tenant TO %I', current_user);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA app TO mizan_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO mizan_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO mizan_tenant;
-- Tables later migrations create are usable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mizan_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO mizan_tenant;

-- Each account's SMS token and whether it has finished the setup steps.
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS sms_token text CHECK (sms_token IS NULL OR char_length(sms_token) BETWEEN 32 AND 200);
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_sms_token_uniq ON app.users (sms_token) WHERE sms_token IS NOT NULL;

CREATE OR REPLACE FUNCTION app.current_uid() RETURNS uuid LANGUAGE sql STABLE AS
  $f$ SELECT nullif(current_setting('mizan.uid', true), '')::uuid $f$;
CREATE OR REPLACE FUNCTION app.is_system() RETURNS boolean LANGUAGE sql STABLE AS
  $f$ SELECT coalesce(current_setting('mizan.system', true), '') = 'on' $f$;
GRANT EXECUTE ON FUNCTION app.current_uid(), app.is_system() TO mizan_tenant;

DO $$
DECLARE
  t text;
  owner_id uuid := (SELECT id FROM app.users ORDER BY created_at, id LIMIT 1);
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions', 'sms_imports', 'review_items', 'balance_anchor', 'set_asides', 'zakat_years',
    'push_subscriptions', 'app_secrets', 'category_limits', 'preferences', 'sms_templates', 'sms_words',
    'banks', 'monthly_items', 'monthly_marks', 'monthly_mark_txs'
  ] LOOP
    EXECUTE format('ALTER TABLE app.%I ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES app.users (id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE app.%I ALTER COLUMN user_id SET DEFAULT app.current_uid()', t);
    IF owner_id IS NOT NULL THEN
      EXECUTE format('UPDATE app.%I SET user_id = $1 WHERE user_id IS NULL', t) USING owner_id;
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON app.%I (user_id)', t || '_user_idx', t);
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS own_rows ON app.%I', t);
    EXECUTE format(
      'CREATE POLICY own_rows ON app.%I USING (user_id = app.current_uid() OR app.is_system()) WITH CHECK (user_id = app.current_uid() OR app.is_system())', t);
  END LOOP;
END $$;

-- Settings that were one per install become one per account.
ALTER TABLE app.balance_anchor DROP CONSTRAINT IF EXISTS balance_anchor_pkey;
ALTER TABLE app.balance_anchor DROP CONSTRAINT IF EXISTS balance_anchor_id_check;
CREATE UNIQUE INDEX IF NOT EXISTS balance_anchor_user_uniq ON app.balance_anchor (user_id);

ALTER TABLE app.preferences DROP CONSTRAINT IF EXISTS preferences_pkey;
ALTER TABLE app.preferences DROP CONSTRAINT IF EXISTS preferences_id_check;
CREATE UNIQUE INDEX IF NOT EXISTS preferences_user_uniq ON app.preferences (user_id);

ALTER TABLE app.sms_words DROP CONSTRAINT IF EXISTS sms_words_pkey;
ALTER TABLE app.sms_words DROP CONSTRAINT IF EXISTS sms_words_id_check;
CREATE UNIQUE INDEX IF NOT EXISTS sms_words_user_uniq ON app.sms_words (user_id);

-- Keys that were unique per install become unique per account.
ALTER TABLE app.category_limits DROP CONSTRAINT IF EXISTS category_limits_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS category_limits_user_uniq ON app.category_limits (user_id, category);

ALTER TABLE app.zakat_years DROP CONSTRAINT IF EXISTS zakat_years_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS zakat_years_user_uniq ON app.zakat_years (user_id, hijri_year);

ALTER TABLE app.app_secrets DROP CONSTRAINT IF EXISTS app_secrets_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS app_secrets_user_uniq ON app.app_secrets (user_id, name);

ALTER TABLE app.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_uniq ON app.push_subscriptions (user_id, endpoint);

DROP INDEX IF EXISTS app.transactions_bank_ref_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_bank_ref_uniq ON app.transactions (user_id, bank_ref) WHERE bank_ref IS NOT NULL;

DROP INDEX IF EXISTS app.sms_imports_fingerprint_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS sms_imports_user_fingerprint_uniq ON app.sms_imports (user_id, fingerprint);

-- The first account takes over the install's SMS token, so the owner's iPhone Shortcut keeps working,
-- and counts as set up when the install already was.
UPDATE app.users u SET sms_token = c.sms_token
FROM app.config c
WHERE c.id = 1 AND c.sms_token IS NOT NULL AND u.sms_token IS NULL
  AND u.id = (SELECT id FROM app.users ORDER BY created_at, id LIMIT 1);
UPDATE app.users u SET onboarded_at = coalesce(c.setup_done_at, now())
FROM app.config c
WHERE c.id = 1 AND c.setup_done_at IS NOT NULL AND u.onboarded_at IS NULL
  AND u.id = (SELECT id FROM app.users ORDER BY created_at, id LIMIT 1);
