# M4 hardening and pilot readiness

This checklist is an operational gate, not evidence that a production environment or university
policy has been approved. Do not enter real participant data or run live check-ins until the required
institutional approvals and provider controls are confirmed.

## Staging evidence (2026-11-08)

- M5 migration `0005_itinerary_leg_details.sql` was tested in a disposable local
  PostgreSQL 12/PostGIS database, not staging. The normal migration runner
  applied it once and skipped it on a second run; an existing stop retained
  its destination coordinates, radius, and mode. Synthetic van/ship legs were
  stored, and invalid mode, blank departure, missing coordinates and missing
  radius were rejected. PostgreSQL 12 needed `pgcrypto` enabled for the
  baseline migrations; this does not establish parity with the staging server.
  An isolated application with synthetic authenticated JWT sessions exercised
  itinerary create/update, cross-college edit denial, required departure
  validation, approval reset, itinerary change history, participant visibility,
  and scoped monitoring. It did not test real sign-in, GPS, evidence, backups,
  or a deployed environment. No staging migration or real itinerary was added.
- Migration `0004_username_and_expiry.sql` was applied and verified idempotent on staging.
  Four temporary synthetic test accounts (one Dean scoped to a newly created CiCS college, one
  VPSAS, and two CiCS Participants) were later suspended and their history retained. Username sign-in,
  legacy email sign-in, role separation, expired sign-in and denial of an existing expired session
  were checked locally against staging. VPSAS remains university-wide. No activities, travel
  milestones, coordinates, attendance or evidence were created for these accounts. Test
  credentials are held separately in a restricted local file; revoke accounts when testing ends.
- Four separately named accounts were created in staging with expiring credentials. Two are assigned
  to the canonical Philippine Startup Week 2026 activity, which is still pending approval and has
  no itinerary stops. CiCS is associated with that activity. The original canonical placeholder
  participants remain unchanged. An authenticated VPSAS grantor issued activity-scoped edit and
  approval grants separately to both the named Dean and VPSAS accounts; each grant was audited.
  Both can open the itinerary builder. The activity is still pending, and no real travel, location
  or evidence records were created for the named accounts.
- Supabase staging migrations `0001`–`0003`, PostGIS search path, and distance queries passed.
  A session-pooler transaction verified advisory locking, distinct synthetic arrival/checkout and
  evidence rows, immutable receipt timestamps, and rollback. This was not an application API test.
  Two session-pooler connections also correctly contended for and released a transaction advisory
  lock; this is not a concurrency or capacity test.
- R2 staging tests through the application adapter verified independent synthetic original and
  stamped objects, hashes, signed downloads, and deletion. An earlier synthetic signed URL expired
  and the unsigned S3 request was denied. Access through public domains remains unverified.
- A temporary local production server using the staging session pooler passed readiness, no-store
  and security-header checks, and denied unauthenticated participant, monitoring, and evidence
  requests. This does not verify Vercel deployment or authenticated college scoping.
- A synthetic authenticated staging run using the session pooler covered travel start and retry,
  checkout-before-arrival rejection, arrival and checkout with separate evidence, arrival retry,
  geofencing, receipt ordering and dwell, owner/Dean/VPSAS evidence authorization, cross-college
  denial, monitoring, review, hashes, audit entries, and no automatic new trip. Ten synthetic
  accounts from two test runs were suspended; labelled fixtures and immutable records remain in
  staging. Signed original and stamped checkout evidence were also downloaded and checked against
  their stored hashes; a Dean from the other college was denied. Synthetic evidence objects
  referenced by the successful run remain private in R2.
- Synthetic activity fixtures are marked explicitly as `SYNTHETIC_TEST` by migration
  `0006_activity_data_classification.sql`. Operational activity and monitoring views exclude them by
  default; authorized Dean/VPSAS monitoring can opt in for audit review. Synthetic accounts and
  immutable travel, check-in, evidence and audit history are retained; this classification does not
  delete records or alter event contents.
- The first run exposed JSON values stored as strings instead of objects. New writes now store
  objects, and cached idempotency responses accept the earlier encoding. Existing audit records are
  immutable and are not rewritten; consumers must account for historical string-encoded details.
- Direct Mapbox Directions adapter checks with synthetic coordinates returned valid driving, walking,
  and cycling estimates; two-wheeler ETA was unavailable as intended. This did not test a route
  request through the application or verify coverage for an approved itinerary.
- Participant UI inspection found that the earlier participant-home baseline showed a server error,
  not the intended screen. PostgreSQL rejected the activity query's `DISTINCT` ordering; the query
  now orders by the selected date expression. A rebuilt local server returned the synthetic
  participant's activity, while another participant was denied the activity and evidence. The
  participant home, itinerary and completed trip were captured at the five requested widths;
  active-trip, permission and evidence-capture states still need device and browser testing.
- These checks do not establish device behavior, Vercel deployment behavior, production scalability,
  provider backup recovery, or readiness for real participant information.

## Release checks

- [ ] Run `npm run production:check` against the intended Vercel production environment. It checks
  required configuration without printing secret values.
- [ ] Do not use the Supabase shared transaction pooler with this application's postgres.js client:
  Supabase warns pipelining can hang or return mismatched rows. Validate an alternative connection
  mode and its connection limits under realistic serverless concurrency before pilot approval.
  The configuration check detects the standard shared transaction-pooler hostname and port only;
  it cannot identify proxies or custom hostnames.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Confirm Vercel production and preview use separate credentials and database/storage scopes.
- [ ] Apply migrations from a trusted environment; verify `/api/health/ready` returns `200` and
  reports database, PostGIS, and migrations as ready.
- [ ] Verify `/api/health` returns `200`; confirm readiness errors and authenticated responses are
  not cached by a CDN or browser.
- [ ] Verify production headers include CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and the camera/geolocation `Permissions-Policy`.
- [ ] Confirm TLS, database encryption in transit/at rest, private bucket access, server-side
  encryption, least-privilege storage credentials, backup/restore procedures, and monitoring.
- [ ] Upload and retrieve controlled test evidence; verify the original and stamped derivative
  exist in private object storage, signed links expire, and an unauthorized account cannot read
  evidence by guessing an ID.
- [ ] Validate an authorized Dean can access only its college's records and VPSAS can access
  university-wide records. Verify role grants, college/activity associations, and audit records.
- [ ] Configure the server-only Mapbox Directions token, review available token restrictions and
  usage limits/alerts, and verify application routing and coverage for approved itineraries in
  staging. Confirm Mapbox terms, data retention and institutional approval for sharing
  origin/destination coordinates. Two-wheeler ETA is intentionally unavailable.

## Android and responsive browser QA

Use a current Android device and Chrome over HTTPS with approved test accounts and institutionally
authorized test itinerary data. Do not invent or seed GPS fixes, check-ins, or evidence.

- [ ] Install from Chrome's install prompt or browser menu; launch from the home-screen icon.
- [ ] Check the sign-in, participant, Dean, VPSAS, and activity detail screens at narrow and desktop
  widths; check keyboard focus, readable status/error text, and touch target usability.
- [ ] Deny location access and verify the action explains how to recover without creating a travel
  event. Repeat with device location disabled and with a timed-out fix.
- [ ] Deny camera access and verify no evidence submission is created. Allow camera access and
  confirm the rear-facing camera is preferred when available.
- [ ] Submit a controlled milestone and confirm the screen distinguishes GPS acquisition time from
  server receipt time and that last-reported coordinates are not described as live.
- [ ] Disconnect before a submission; verify the UI states that nothing was queued. Reconnect and
  check server state before retrying.
- [ ] Verify the service worker never serves authenticated API data or evidence from a cache, and
  that a PWA launch without connectivity does not imply offline submission support.
- [ ] Verify arrival and explicit check-out remain distinct and that no trip to the next stop starts
  automatically.

## Institutional and pilot approval gates

- [ ] Confirm institutional SSO decision or approve the current application-managed authentication
  for a limited pilot.
- [ ] Obtain the University's privacy notice, legal basis, retention/deletion schedule, privacy
  impact assessment, and participant communication approval.
- [ ] Approve the managed PostgreSQL/PostGIS and private S3-compatible providers, data residency,
  encryption, access, backup, incident response, and retention controls.
- [ ] Confirm the overdue tolerance, GPS accuracy threshold, itinerary/geofence values, activity
  approval ownership, cross-college access rules, and named pilot operators.
- [ ] Populate only institution-authorized activities, itinerary stops, participants, and scoped
  assignments. The canonical example seed intentionally has no approved route, coordinates,
  attendance, or evidence.
- [ ] Record pilot scope, contacts, support process, success criteria, stop conditions, and rollback
  owner before enabling accounts.

## Rollback

Keep the last known-good Vercel deployment available. If a release fails readiness or authorization
checks, stop participant access, redeploy the last known-good application through Vercel, and preserve
the database and private evidence objects for investigation. Do not delete migration history or
rewrite immutable travel, evidence, review, or audit records as a rollback technique. Database
changes require a separately reviewed forward-fix or recovery plan.
