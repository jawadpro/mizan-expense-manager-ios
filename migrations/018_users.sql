-- Accounts. Mizan used to have one owner who signed in with a passphrase (app.config.password_hash or
-- ADMIN_PASSWORD_HASH). Now everyone signs in with an email and password. The first account on an install
-- is its admin: a new install creates it in the setup wizard, and an existing install creates it by signing
-- in once with the old passphrase (the passphrase stops working after that).
CREATE TABLE IF NOT EXISTS app.users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  password_hash        text NOT NULL CHECK (char_length(password_hash) BETWEEN 20 AND 300),
  name                 text CHECK (name IS NULL OR char_length(name) <= 80),
  role                 text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  email_verified_at    timestamptz,
  -- Sessions issued before this time are refused (set on a password change or reset).
  sessions_valid_after timestamptz,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON app.users (email);
CREATE INDEX IF NOT EXISTS users_created_idx ON app.users (created_at DESC);

-- One-time links sent by email. Only a SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS app.auth_tokens (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user_idx ON app.auth_tokens (user_id, purpose);
