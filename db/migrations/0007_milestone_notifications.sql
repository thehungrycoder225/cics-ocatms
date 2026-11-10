CREATE TABLE app_notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  check_in_id uuid NOT NULL REFERENCES check_in(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (recipient_id, check_in_id)
);

CREATE INDEX app_notification_recipient_time_idx
  ON app_notification (recipient_id, created_at DESC);

CREATE INDEX app_notification_unread_idx
  ON app_notification (recipient_id, created_at DESC)
  WHERE read_at IS NULL;
