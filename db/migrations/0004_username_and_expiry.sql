ALTER TABLE app_user
  ADD COLUMN username text,
  ADD COLUMN account_expires_at timestamptz;

ALTER TABLE app_user DROP CONSTRAINT active_account_has_login;
ALTER TABLE app_user
  ADD CONSTRAINT app_user_username_format CHECK (
    username IS NULL OR username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
  ),
  ADD CONSTRAINT active_account_has_login CHECK (
    status <> 'ACTIVE' OR ((email IS NOT NULL OR username IS NOT NULL) AND password_hash IS NOT NULL)
  );

CREATE UNIQUE INDEX app_user_username_unique ON app_user (username) WHERE username IS NOT NULL;
