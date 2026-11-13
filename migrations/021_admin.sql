-- What admins did to accounts, newest first on the admin page. The emails are copied in, so the record
-- stays readable after either account is deleted.
CREATE TABLE IF NOT EXISTS app.admin_events (
  id          bigserial PRIMARY KEY,
  admin_id    uuid REFERENCES app.users (id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  user_id     uuid REFERENCES app.users (id) ON DELETE SET NULL,
  user_email  text NOT NULL,
  action      text NOT NULL CHECK (char_length(action) <= 40),
  detail      text CHECK (detail IS NULL OR char_length(detail) <= 300),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_events_created_idx ON app.admin_events (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON app.admin_events TO mizan_tenant;
GRANT USAGE, SELECT ON SEQUENCE app.admin_events_id_seq TO mizan_tenant;
