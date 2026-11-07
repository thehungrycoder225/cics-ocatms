CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE travel_session_status AS ENUM (
  'IN_TRANSIT',
  'ARRIVAL_SUBMITTED',
  'CHECKED_IN',
  'CHECKOUT_SUBMITTED',
  'CHECKED_OUT',
  'INTERRUPTED',
  'CANCELLED'
);

CREATE TYPE milestone_kind AS ENUM ('ARRIVAL', 'CHECKOUT');
CREATE TYPE geofence_status AS ENUM ('INSIDE', 'OUTSIDE', 'UNCERTAIN');
CREATE TYPE validation_status AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED_FOR_REVIEW');

CREATE TABLE itinerary_stop (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
  itinerary_day smallint NOT NULL CHECK (itinerary_day BETWEEN 1 AND 31),
  stop_sequence smallint NOT NULL CHECK (stop_sequence BETWEEN 1 AND 100),
  destination text NOT NULL CHECK (length(trim(destination)) BETWEEN 1 AND 300),
  location geography(Point, 4326) NOT NULL,
  geofence_radius_m integer NOT NULL CHECK (geofence_radius_m BETWEEN 25 AND 5000),
  planned_departure timestamptz,
  planned_arrival timestamptz,
  travel_mode text NOT NULL DEFAULT 'DRIVE'
    CHECK (travel_mode IN ('DRIVE', 'WALK', 'BICYCLE', 'TWO_WHEELER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_stop_schedule_valid
    CHECK (planned_departure IS NULL OR planned_arrival IS NULL OR planned_arrival >= planned_departure)
);

CREATE INDEX itinerary_stop_activity_day_idx
  ON itinerary_stop (activity_id, itinerary_day, stop_sequence);
CREATE INDEX itinerary_stop_location_gist_idx
  ON itinerary_stop USING gist (location);
CREATE UNIQUE INDEX itinerary_stop_active_sequence_idx
  ON itinerary_stop (activity_id, itinerary_day, stop_sequence)
  WHERE is_active;

ALTER TABLE participation
  ADD CONSTRAINT participation_id_user_unique UNIQUE (id, user_id);

CREATE TABLE travel_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid NOT NULL REFERENCES participation(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL,
  itinerary_stop_id uuid NOT NULL REFERENCES itinerary_stop(id) ON DELETE RESTRICT,
  start_idempotency_key uuid NOT NULL,
  origin_location geography(Point, 4326) NOT NULL,
  origin_accuracy_m double precision NOT NULL CHECK (origin_accuracy_m > 0),
  origin_gps_acquired_at timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  eta_at timestamptz,
  eta_distance_m integer CHECK (eta_distance_m IS NULL OR eta_distance_m >= 0),
  eta_provider text,
  eta_status text NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (eta_status IN ('AVAILABLE', 'UNAVAILABLE')),
  last_location geography(Point, 4326) NOT NULL,
  last_accuracy_m double precision NOT NULL CHECK (last_accuracy_m > 0),
  last_gps_acquired_at timestamptz NOT NULL,
  last_location_received_at timestamptz NOT NULL DEFAULT now(),
  status travel_session_status NOT NULL DEFAULT 'IN_TRANSIT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT travel_session_participant_matches
    FOREIGN KEY (participation_id, participant_id)
    REFERENCES participation(id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX travel_session_start_idempotency_idx
  ON travel_session (participation_id, start_idempotency_key);

CREATE UNIQUE INDEX travel_session_one_open_per_participation_idx
  ON travel_session (participation_id)
  WHERE status IN ('IN_TRANSIT', 'ARRIVAL_SUBMITTED', 'CHECKED_IN');

CREATE INDEX travel_session_participation_recent_idx
  ON travel_session (participation_id, started_at DESC);
CREATE INDEX travel_session_location_gist_idx
  ON travel_session USING gist (last_location);

CREATE TABLE travel_location_update (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_session_id uuid NOT NULL REFERENCES travel_session(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  location geography(Point, 4326) NOT NULL,
  accuracy_m double precision NOT NULL CHECK (accuracy_m > 0),
  gps_acquired_at timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  eta_at timestamptz,
  eta_distance_m integer CHECK (eta_distance_m IS NULL OR eta_distance_m >= 0),
  eta_provider text,
  eta_status text NOT NULL DEFAULT 'UNAVAILABLE'
    CHECK (eta_status IN ('AVAILABLE', 'UNAVAILABLE')),
  UNIQUE (travel_session_id, idempotency_key)
);

CREATE INDEX travel_location_session_received_idx
  ON travel_location_update (travel_session_id, server_received_at DESC);

CREATE TABLE idempotency_record (
  participant_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  operation text NOT NULL,
  request_hash char(64) NOT NULL,
  resource_id uuid NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, idempotency_key)
);

CREATE INDEX idempotency_record_created_idx ON idempotency_record (created_at);

CREATE FUNCTION reject_immutable_record_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME;
END;
$$;

CREATE TABLE itinerary_change (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
  itinerary_stop_id uuid REFERENCES itinerary_stop(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('STOP_CREATED', 'STOP_UPDATED', 'STOP_DEACTIVATED')),
  previous_values jsonb,
  new_values jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX itinerary_change_activity_time_idx
  ON itinerary_change (activity_id, occurred_at DESC);

CREATE TRIGGER itinerary_change_immutable
  BEFORE UPDATE OR DELETE ON itinerary_change
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TABLE check_in (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_session_id uuid NOT NULL REFERENCES travel_session(id) ON DELETE RESTRICT,
  kind milestone_kind NOT NULL,
  idempotency_key uuid NOT NULL,
  location geography(Point, 4326) NOT NULL,
  accuracy_m double precision NOT NULL CHECK (accuracy_m > 0),
  gps_acquired_at timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  geofence_status geofence_status NOT NULL,
  validation_status validation_status NOT NULL DEFAULT 'PENDING',
  review_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_in_session_kind_unique UNIQUE (travel_session_id, kind),
  CONSTRAINT check_in_session_key_unique UNIQUE (travel_session_id, idempotency_key)
);

CREATE INDEX check_in_session_received_idx
  ON check_in (travel_session_id, server_received_at);
CREATE INDEX check_in_review_status_idx
  ON check_in (validation_status, server_received_at DESC);
CREATE INDEX check_in_location_gist_idx ON check_in USING gist (location);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id uuid NOT NULL UNIQUE REFERENCES check_in(id) ON DELETE RESTRICT,
  original_object_key text NOT NULL UNIQUE,
  stamped_object_key text NOT NULL UNIQUE,
  original_sha256 char(64) NOT NULL,
  stamped_sha256 char(64) NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  original_size_bytes integer NOT NULL CHECK (original_size_bytes BETWEEN 1 AND 3145728),
  stamped_size_bytes integer NOT NULL CHECK (stamped_size_bytes BETWEEN 1 AND 16777216),
  processing_status text NOT NULL DEFAULT 'COMPLETED'
    CHECK (processing_status IN ('COMPLETED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_check_in_idx ON evidence (check_in_id);

CREATE FUNCTION protect_check_in_event_fields() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'check_in records cannot be deleted';
  END IF;

  IF OLD.travel_session_id <> NEW.travel_session_id
    OR OLD.kind <> NEW.kind
    OR OLD.idempotency_key <> NEW.idempotency_key
    OR ST_AsEWKB(OLD.location::geometry) <> ST_AsEWKB(NEW.location::geometry)
    OR OLD.accuracy_m <> NEW.accuracy_m
    OR OLD.gps_acquired_at <> NEW.gps_acquired_at
    OR OLD.server_received_at <> NEW.server_received_at
    OR OLD.geofence_status <> NEW.geofence_status
    OR OLD.review_flags <> NEW.review_flags
    OR OLD.created_at <> NEW.created_at
  THEN
    RAISE EXCEPTION 'check_in event fields are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_in_immutable
  BEFORE UPDATE OR DELETE ON check_in
  FOR EACH ROW EXECUTE FUNCTION protect_check_in_event_fields();

CREATE TRIGGER evidence_immutable
  BEFORE UPDATE OR DELETE ON evidence
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TRIGGER travel_location_update_immutable
  BEFORE UPDATE OR DELETE ON travel_location_update
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE FUNCTION reject_check_in_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_status travel_session_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'travel_session records cannot be deleted';
  END IF;

  old_status := OLD.status;
  IF OLD.participation_id <> NEW.participation_id
    OR OLD.itinerary_stop_id <> NEW.itinerary_stop_id
    OR ST_AsEWKB(OLD.origin_location::geometry) <> ST_AsEWKB(NEW.origin_location::geometry)
    OR OLD.origin_accuracy_m <> NEW.origin_accuracy_m
    OR OLD.origin_gps_acquired_at <> NEW.origin_gps_acquired_at
    OR OLD.started_at <> NEW.started_at
    OR OLD.start_idempotency_key <> NEW.start_idempotency_key
  THEN
    RAISE EXCEPTION 'travel_session origin and identity fields are immutable';
  END IF;

  IF NEW.status <> old_status AND NOT (
    (old_status = 'IN_TRANSIT' AND NEW.status IN ('ARRIVAL_SUBMITTED', 'INTERRUPTED', 'CANCELLED'))
    OR (old_status = 'ARRIVAL_SUBMITTED' AND NEW.status IN ('CHECKED_IN', 'CHECKOUT_SUBMITTED', 'INTERRUPTED'))
    OR (old_status = 'CHECKED_IN' AND NEW.status IN ('CHECKOUT_SUBMITTED', 'INTERRUPTED'))
    OR (old_status = 'CHECKOUT_SUBMITTED' AND NEW.status = 'CHECKED_OUT')
  ) THEN
    RAISE EXCEPTION 'invalid travel_session status transition: % -> %', old_status, NEW.status;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER travel_session_transition_guard
  BEFORE UPDATE OR DELETE ON travel_session
  FOR EACH ROW EXECUTE FUNCTION reject_check_in_mutation();
