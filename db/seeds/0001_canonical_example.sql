INSERT INTO activity (
  id, title, venue, start_date, end_date, status, approval_status, faculty_in_charge_label
) VALUES (
  '11000000-0000-4000-8000-000000000001',
  'Philippine Startup Week 2026',
  'QC M.I.C.E. Center, Quezon City',
  '2026-11-08',
  '2026-11-13',
  'UPCOMING',
  'PENDING',
  'Faculty-in-Charge (placeholder)'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_user (id, full_name, status)
VALUES
  ('22000000-0000-4000-8000-000000000001', 'Mr. John Ryan P. Rodelas', 'PENDING'),
  ('22000000-0000-4000-8000-000000000002', 'Ms. Myren Joy N. Lawing', 'PENDING')
ON CONFLICT (id) DO NOTHING;

INSERT INTO participation (activity_id, user_id, assignment_status)
VALUES
  ('11000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'PENDING'),
  ('11000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', 'PENDING')
ON CONFLICT (activity_id, user_id) DO NOTHING;
