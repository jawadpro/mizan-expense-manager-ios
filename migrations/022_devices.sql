-- iPhone pairing. Each iPhone gets its own token by pairing with a short, single-use code shown in Mizan, so
-- nobody copies a URL or token into a Shortcut. Mizan keeps only a SHA-256 digest of each device token and an
-- HMAC of each pairing code.

CREATE TABLE IF NOT EXISTS app.devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL DEFAULT app.current_uid() REFERENCES app.users (id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind             text NOT NULL DEFAULT 'shortcut' CHECK (kind IN ('shortcut')),
  token_digest     bytea NOT NULL UNIQUE,
  token_hint       text NOT NULL DEFAULT '' CHECK (char_length(token_hint) <= 8),
  paired_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz,
  last_sms_at      timestamptz,
  last_test_at     timestamptz,
  revoked_at       timestamptz,
  imported_count   integer NOT NULL DEFAULT 0,
  review_count     integer NOT NULL DEFAULT 0,
  duplicate_count  integer NOT NULL DEFAULT 0,
  ignored_count    integer NOT NULL DEFAULT 0,
  failed_count     integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON app.devices (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS app.pairing_codes (
  code_digest  bytea PRIMARY KEY,
  user_id      uuid NOT NULL DEFAULT app.current_uid() REFERENCES app.users (id) ON DELETE CASCADE,
  device_name  text CHECK (device_name IS NULL OR char_length(device_name) <= 60),
  replaces_id  uuid REFERENCES app.devices (id) ON DELETE SET NULL,
  device_id    uuid REFERENCES app.devices (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz
);
CREATE INDEX IF NOT EXISTS pairing_codes_user_idx ON app.pairing_codes (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON app.devices, app.pairing_codes TO mizan_tenant;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['devices', 'pairing_codes'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS own_rows ON app.%I', t);
    EXECUTE format(
      'CREATE POLICY own_rows ON app.%I USING (user_id = app.current_uid() OR app.is_system()) WITH CHECK (user_id = app.current_uid() OR app.is_system())', t);
  END LOOP;
END $$;
