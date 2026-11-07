CREATE TABLE check_in_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id uuid NOT NULL REFERENCES check_in(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('VERIFIED', 'FLAGGED_FOR_REVIEW')),
  note text NOT NULL CHECK (length(trim(note)) BETWEEN 3 AND 2000),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX check_in_review_check_in_time_idx
  ON check_in_review (check_in_id, reviewed_at DESC);
CREATE INDEX check_in_review_reviewer_time_idx
  ON check_in_review (reviewer_id, reviewed_at DESC);

CREATE TRIGGER check_in_review_immutable
  BEFORE UPDATE OR DELETE ON check_in_review
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();
