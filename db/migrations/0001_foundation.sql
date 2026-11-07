CREATE TYPE account_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE primary_role AS ENUM ('PARTICIPANT', 'DEAN', 'VPSAS');
CREATE TYPE activity_status AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED');
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE participation_status AS ENUM ('PENDING', 'ASSIGNED', 'WITHDRAWN');
CREATE TYPE activity_permission AS ENUM ('ACTIVITY_EDIT', 'ACTIVITY_APPROVE');

CREATE TABLE college (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  password_hash text,
  college_id uuid REFERENCES college(id) ON DELETE RESTRICT,
  status account_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT active_account_has_login CHECK (status <> 'ACTIVE' OR (email IS NOT NULL AND password_hash IS NOT NULL))
);

CREATE UNIQUE INDEX app_user_email_lower_unique
  ON app_user (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  role primary_role NOT NULL,
  college_id uuid REFERENCES college(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_scope_matches CHECK (
    (role = 'VPSAS' AND college_id IS NULL)
    OR (role IN ('PARTICIPANT', 'DEAN') AND college_id IS NOT NULL)
  )
);

CREATE TABLE auth_login_window (
  attempt_key char(64) PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  updated_at timestamptz NOT NULL
);

CREATE INDEX auth_login_window_updated_idx ON auth_login_window (updated_at);

CREATE UNIQUE INDEX role_assignment_unique_scope
  ON role_assignment (user_id, role, COALESCE(college_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  organizer text,
  venue text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status activity_status NOT NULL DEFAULT 'UPCOMING',
  approval_status approval_status NOT NULL DEFAULT 'PENDING',
  host_college_id uuid REFERENCES college(id) ON DELETE RESTRICT,
  faculty_in_charge_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  faculty_in_charge_label text,
  created_by uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_dates_valid CHECK (end_date >= start_date)
);

CREATE TABLE activity_college (
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
  college_id uuid NOT NULL REFERENCES college(id) ON DELETE RESTRICT,
  PRIMARY KEY (activity_id, college_id)
);

CREATE TABLE participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  assignment_status participation_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX participation_user_activity_idx ON participation (user_id, activity_id);
CREATE INDEX activity_college_scope_idx ON activity_college (college_id, activity_id);
CREATE INDEX activity_dates_status_idx ON activity (start_date, end_date, status);
CREATE INDEX app_user_college_idx ON app_user (college_id, status);

CREATE TABLE activity_permission_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  permission activity_permission NOT NULL,
  activity_id uuid REFERENCES activity(id) ON DELETE RESTRICT,
  college_id uuid REFERENCES college(id) ON DELETE RESTRICT,
  granted_by uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_permission_exact_scope CHECK (
    (activity_id IS NOT NULL AND college_id IS NULL)
    OR (activity_id IS NULL AND college_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX activity_permission_unique_scope
  ON activity_permission_assignment (
    user_id,
    permission,
    COALESCE(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(college_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_resource_idx ON audit_log (resource_type, resource_id, occurred_at DESC);
CREATE INDEX audit_log_actor_time_idx ON audit_log (actor_id, occurred_at DESC);

CREATE FUNCTION reject_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are append-only';
END;
$$;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
