# MarSU OCATMS

Responsive Next.js/TypeScript foundation for the Marinduque State University Off-Campus Activity
Tracking and Monitoring System. The locked requirements are in
[docs/OCATMS_MASTER_LOCK_v1.1.md](./docs/OCATMS_MASTER_LOCK_v1.1.md) and
[docs/OCATMS_SPEC_SHEET_v1.1.md](./docs/OCATMS_SPEC_SHEET_v1.1.md). The referenced mind map was not
present in the supplied workspace.

The interface uses self-hosted Poppins fonts and translucent Tailwind-styled card surfaces with
an opaque fallback when backdrop filters are unavailable. Sign-in and sign-out press feedback
uses Framer Motion and respects the device's reduced-motion preference. The visual treatment
does not add offline caching or change evidence handling.

## Milestone 1 scope

M1 establishes the Next.js App Router application, responsive shell and PWA manifest/service worker,
credentials sign-in, PostgreSQL schema, role/college scoping, protected activity API, canonical
example seed, and operator-driven account provisioning. Only Participant, Dean, and VPSAS are
primary roles. Activity creation/editing and approval are separate protected APIs, authorized by
separate capability grants; there is no management form in the M1 UI.

The canonical seed creates Philippine Startup Week 2026 (November 8–13, 2026), a venue label, the
Faculty-in-Charge placeholder, and the two named pending participant records. It deliberately does
not create daily stops, approvals, attendance, travel sessions, timestamps, GPS coordinates, or
evidence. The seeded activity remains pending approval and has no college association until an
authorized operator supplies the actual institutional data.

## Local setup

Requirements: Node.js 22.6 or later and npm. Use a managed PostgreSQL database for which PostGIS
support has been confirmed before enabling geospatial milestones.

1. Copy `.env.example` to `.env.local` and set:
   - `DATABASE_URL` — runtime PostgreSQL connection string.
   - `DIRECT_URL` — optional direct/session connection for migrations and trusted operator scripts.
   - `NEXTAUTH_SECRET` — strong, unique secret (generate with `openssl rand -base64 32`).
   - `NEXTAUTH_URL` — local origin or the deployment's HTTPS origin.
2. Apply the schema and canonical example:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

3. Provision a real operator account from a trusted terminal:

   ```powershell
   npm run user:provision
   ```

   The command interactively collects an account name, email, one of the three allowed primary
   roles, an optional username, and an initial password without echoing the password to the terminal. Participant/Dean
   accounts require a college name. It stores a bcrypt hash, not the password. Do not expose this
   command as a public endpoint. If the exact name of a pending canonical example participant is
   entered, the CLI activates that placeholder record so its existing pending activity association
   remains intact; it does not mark the assignment or activity approved.
   Users may sign in with their username or existing email. Usernames are case-insensitive, 3–32
   characters, and use letters, numbers, periods, underscores or hyphens, beginning with a letter
   or number. Accounts with an expiry are denied access after that time, including existing sessions.
   The optional "Keep me signed in" checkbox permits a session for up to 30 days from sign-in on
   a trusted device; otherwise sessions last at most eight hours. Account expiry takes precedence.
   Sign out on shared devices. Password change and forced reset are not yet implemented; a trusted
   operator must revoke or replace temporary credentials.
   Apply migration `0004_username_and_expiry.sql` before deploying this version; readiness reports
   pending until it is applied. Test credentials must be shared through a secure channel and revoked
   when testing ends.
4. Start and open the demo:

   ```powershell
   npm run dev
   ```

   Visit `http://localhost:3000/login`, sign in using the operator-provisioned account, and open
   `/participant`, `/dean`, or `/vpsas` according to its assigned role. The seeded pending example
   is visible to VPSAS and remains unavailable to Participant/Dean until actual college and
   participation assignments are entered.
5. Grant scoped activity-management capabilities only when institutionally authorized:

   ```powershell
   npm run permission:grant
   ```

   This trusted-terminal command authenticates an active VPSAS operator by password, requires an
   active Dean/VPSAS grantee, an explicit `ACTIVITY_EDIT` or `ACTIVITY_APPROVE` capability, and
   either a college or activity scope. It appends an audit record. Edit permission never implies
   approval permission. Both operator and grantee can be identified by username or email.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Database migration/seed execution additionally requires a reachable `DATABASE_URL` and PostgreSQL
permissions to create the schema objects. Migrations are not run during Vercel's build.

The activity API provides `POST /api/activities` (create with a college-scoped edit grant),
`PATCH /api/activities/{id}` (edit under an activity or associated-college grant), and
`POST /api/activities/{id}/approval` (approve/reject with a separate grant). Mutations require a
same-origin request, validate input, run in a database transaction, and append an immutable audit
record. The approval endpoint only accepts records still in `PENDING`.

## Milestone 2: Participant Journey

M2 adds institution-managed itinerary stops, participant-controlled milestone travel, explicit
arrival and check-out submissions, location updates only on user action, Mapbox Directions ETA, and
private original/stamped evidence storage. No background or continuous location collection is used.
Every fix includes device accuracy and acquisition time; arrival/check-out receipt timestamps use
PostgreSQL `clock_timestamp()`. GPS or geofence uncertainty, missing evidence, and delayed fixes are
review flags, not proof of presence. Camera output is compressed to at most 3 MB so the multipart
request stays below Vercel Functions' 4.5 MB request-body limit; the uploaded capture bytes are
retained as the original object.

### Configure M2

1. Select a managed PostgreSQL provider with PostGIS and enable/authorize the extension before
   applying `db/migrations/0002_participant_journey.sql`.
2. Configure a private S3-compatible bucket with public access blocked and server-side encryption.
   Set `S3_BUCKET`, `S3_REGION`, and either the runtime's default AWS credential chain or both
   `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. Set `S3_ENDPOINT` and
   `S3_FORCE_PATH_STYLE=true` only when required by the provider.
   `S3_SERVER_SIDE_ENCRYPTION` defaults to `AES256`; use an explicitly empty value only for a
   provider that rejects that S3 header. The application stores no evidence on the Vercel filesystem.
3. Optionally set the server-only `MAPBOX_ACCESS_TOKEN` for Mapbox Directions. If absent or the
   provider is unavailable, the UI reports ETA as unavailable; no mock estimate is supplied.
   Driving, walking and cycling are supported. Two-wheeler, van, and ship ETAs are unavailable:
   dedicated routing profiles for these modes have not been validated. When requesting an ETA, the reported origin and
   itinerary destination coordinates are sent to Mapbox.
4. Optionally tune `GPS_MAX_ACCURACY_M` (default `100`). Lower-accuracy fixes remain accepted where
   valid but are flagged for review.
5. Apply migrations from a trusted deployment environment. Migrations are not run during Vercel's
   build:

   ```powershell
   npm run db:migrate
   ```

### M2 demo path and API surfaces

Authorized Dean or VPSAS users with an explicit `ACTIVITY_EDIT` grant can open the itinerary builder
from an activity monitoring page. The builder lists active stops and allows creation, edits and
removal through the existing protected itinerary APIs. Changes return the activity to pending
approval; editing and approval remain separate permissions. Stops with travel history cannot be
edited or removed. Coordinates, geofence radius, travel mode and optional Philippine-time schedule
must be supplied by an authorized editor. The builder does not persist unfinished drafts.

Migration `0005_itinerary_leg_details.sql` adds a departure-location label and distinct
van and ship modes without changing existing stops. Apply it only after the target environment's
normal migration approval and backup checks. Until it is applied, those inputs are disabled and
the API rejects their use; existing itinerary functions remain available. Departure location is
required for van and ship legs and optional for existing modes. Coordinates and a
geofence radius remain required for every stop. Neither van nor ship currently produces an ETA.
Changing leg details still requires scoped edit permission and renewed activity approval.

Sign in at `/login`, open `/participant`, select an approved assigned activity, then open a stop's
trip page. Select **Start Travel**, **Update Location**, **Check In (Arrival)**, and the separate **Check
Out** action as appropriate. GPS and camera are requested only after an explicit participant action.
Trip submissions and photo upload require a network connection; M2 does not queue private location
or evidence data for offline submission.
Arrival and check-out are separate immutable events; check-out requires arrival, calculates dwell
time, and does not automatically start the next stop.

The canonical seed deliberately has no itinerary, approval, assignments, coordinates, check-ins, or
evidence. A demo therefore requires institutionally authorized participant assignments, a college
association, activity approval, and actual itinerary coordinates/geofence data. These are entered
through the authenticated APIs, not invented by the seed. Production institution data must be explicitly authorized and configured.

| Requirement | Page/component | API | Persistence | Verification |
|---|---|---|---|---|
| Approved assigned itinerary; no invented stops | `/participant`, `/participant/activities/[id]` | `GET /api/participant/activities` | `activity`, `participation`, `itinerary_stop` | Itinerary validation tests; DB-backed flow requires configured PostGIS |
| Explicit, sequential Start Travel and participant-initiated location fixes | `/participant/trips/[stopId]`, `TripControls` | `POST /api/trips/start`, `POST /api/trips/[id]/location` | `travel_session`, `travel_location_update`, `idempotency_record` | Location/travel-state tests; DB-backed flow requires configured PostGIS |
| Separate immutable ARRIVAL and CHECKOUT, review flags, dwell time | `TripControls`, activity stop status | `POST /api/trips/[id]/check-ins/arrival`, `POST /api/trips/[id]/check-ins/checkout` | `check_in`, `travel_session`, `audit_log` | Travel-state/location tests; DB-backed flow requires configured PostGIS |
| Private original plus stamped image, participant-scoped signed read | `TripControls`, `EvidencePreview` | Multipart milestone APIs; `GET /api/evidence/[id]` | `evidence` metadata and private S3-compatible objects | Evidence processing tests; provider integration requires private bucket credentials |
| Scoped itinerary editing; edits require reapproval | `/activities/[id]/itinerary-builder` | `POST /api/activities/[id]/itinerary`, `PATCH/DELETE /api/activities/[id]/itinerary/[stopId]` | `itinerary_change`, activity approval status, `audit_log` | Itinerary validation tests; API workflow requires an explicit `ACTIVITY_EDIT` grant |

All participant mutations require authentication, participant role, same-origin checks, participant
ownership, and idempotency keys. Check-in event fields, evidence records, location updates, and
itinerary history are protected by database immutability triggers. Signed evidence URLs expire after
60 seconds and are issued only after an ownership check.

### M2 verification and remaining gates

Run the verification commands above after applying the M2 changes. Unit tests cover GPS input,
accuracy/geofence classification, milestone state rules, itinerary validation, route ETA parsing,
and image processing.
Staging database and storage checks are summarized in the M4 checklist. Direct Mapbox Directions
requests with synthetic coordinates passed for driving, walking, and cycling; application-level
routing and coverage for approved itineraries remain to be verified. Dean/VPSAS monitoring and
milestone review are implemented in M3 below.
Institutional SSO, retention/privacy policy, GPS/geofence policy, authorized activity
and itinerary data, and production provider selection remain deployment/policy gates.

## Milestone 3: Dean/VPSAS Monitoring

M3 adds college-scoped Dean and university-wide VPSAS monitoring at `/dean` and `/vpsas`, with
activity detail routes under `/dean/activities/[id]` and `/vpsas/activities/[id]`. The dashboards
include activity/date/participant/college filters (college filtering is VPSAS-only), activity and
participant metrics, itinerary-linked last-reported fixes and freshness, ETA, arrival/check-out
state, dwell time, missing/overdue milestones, evidence flags, scoped signed evidence access, and an
audited review form. Reviews append an immutable decision/note record and update the current
validation status; a verified arrival/check-out advances its travel-session state where permitted.

The last reported coordinate is not live tracking. It is rendered with source, GPS acquisition time,
server receipt time, age, and accuracy. A map link is opened only on explicit user action; the UI
warns that this shares the coordinate with the map provider. Evidence remains private and signed
URLs expire after 60 seconds. Dean record, evidence, and review access is limited to participants
whose college is in both the Dean's role scope and the activity's college scope. VPSAS access is
university-wide.

### M3 configuration and demo

M3 applies `db/migrations/0003_monitoring_review.sql` after the M1/M2 migrations. Configure
`CHECKIN_OVERDUE_TOLERANCE_MINUTES` as an integer from 0 to 1440; it defaults to 30. This default is
an explicit operational assumption, not an approved university-wide policy. Overdue arrival means
no arrival receipt after scheduled arrival plus this tolerance. Compliance counts due arrivals and
counts a check-out only after an arrival has been received; pending reviews are shown separately.
An arrival without checkout is shown as `CHECKOUT_PENDING`.

Provision Dean/VPSAS accounts with their approved role scopes, enter authorized institution data,
and grant required activity edit/approval capabilities independently. Then sign in and open the
role-specific dashboard. No canonical seed attendance, review results, fixes, or evidence were
added. The VPSAS college filter and activity/date/participant/exception filters query the server
with scoped authorization; changing UI filters does not widen role access.

| Requirement | Page/component | API | Persistence | Verification |
|---|---|---|---|---|
| Dean college-scoped / VPSAS university-wide filters, KPIs, participant monitoring | `/dean`, `/vpsas`, `/dean/activities/[id]`, `/vpsas/activities/[id]`, `MonitoringConsole` | `GET /api/monitoring/dashboard` | M1/M2 activity, itinerary, participation, travel, check-in data | Monitoring scope/metric tests; DB authorization flow requires managed PostGIS |
| Review evidence and milestone flags with auditable decisions | `MonitoringConsole`, `EvidencePreview` | `POST /api/monitoring/check-ins/[id]/review`, `GET /api/evidence/[id]` | `check_in_review`, mutable current `check_in.validation_status`, append-only `audit_log` | API/input/role tests; DB integration requires database and private storage |
| Checkout status, exit fix, evidence, and dwell oversight | `MonitoringConsole` | Monitoring GET plus scoped evidence API | M2 `check_in`, `evidence`, `travel_session` | Existing M2 dwell/state tests plus M3 view tests |

M3 is not production-verified against an institutional database or S3 provider in this workspace.
Incident submission/alerts, exports, offline queueing, and production map-tile embedding are not
implemented in M3; incident and reporting scope remains staged rather than deleted.

## Vercel deployment

1. Import the project into Vercel and configure the production and preview values for
   `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, private-bucket settings, and
   `CHECKIN_OVERDUE_TOLERANCE_MINUTES`. Configure `MAPBOX_ACCESS_TOKEN` if route ETA is desired.
2. Confirm the managed database supports PostGIS and that its credentials/network allow migrations.
   Run `npm run db:migrate` from a trusted deployment environment; this applies M1, M2, and M3
   migrations in order. Run `npm run db:seed` once if the canonical pending example is desired.
3. Configure the private S3-compatible evidence bucket and credentials before enabling milestone
   evidence submissions. Deploy the application; user sessions use signed, HTTP-only NextAuth
   cookies. PostgreSQL and external object storage are the persistent stores; Vercel local disk is
   not used.
4. Set `NEXTAUTH_URL` to the exact HTTPS deployment origin. Keep secrets out of source control and
   client-side variables. The service worker performs network-only requests and intentionally does
   not cache private evidence, APIs, or other sensitive responses.

## M1 assumptions and remaining gates

- **Authentication assumption:** until institutional SSO availability is confirmed, M1 uses
  application-managed credentials. Confirm SSO before production pilot; SSO availability remains
  an implementation decision, not a role or scope change.
- **Database gate:** no provider has been selected or connected. Choose a managed PostgreSQL
  provider and confirm PostGIS availability before the M2 geospatial migration.
- **Institutional policy gates:** actual college names/associations, activity approval, cross-college
  assignments, retention schedule, privacy notice/legal basis, and privacy impact assessment require
  authorized institutional decisions. The setup CLI only provisions identity and role data.
- **M1–M3 limitations:** activity and itinerary management APIs exist, but no management UI is
  included. Incident workflow/alerts, exports, offline submission, and production map-tile embedding
  remain deferred to later milestones; they are not removed from scope.
- **Authentication abuse controls:** login attempts are rate-limited per hashed email/network pair
  and network address in PostgreSQL, with a 10-attempt/15-minute window. Expired counters are
  cleaned up; raw email and network address are not stored in the rate-limit table.

Run tests and a production build before deployment. No production deployment or database migration
has been performed from this workspace.

## Milestone 4: Hardening and pilot readiness

M4 adds production security headers (including a Content Security Policy and HTTPS
Strict-Transport-Security), a non-cacheable dependency readiness endpoint, an explicit production
environment check, updated location/evidence privacy disclosures, and browser-assisted PWA
installation help. The service worker remains network-only; private APIs, photos, and offline
submissions are not cached or queued.

Before a production deployment, set Vercel environment variables for `DATABASE_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `S3_BUCKET`, and `S3_REGION`; configure either default AWS
credentials or both S3 access-key variables; and set optional policy values only after institutional
approval. Validate configuration from a trusted terminal without printing secret values:

```powershell
npm run production:check
npm run lint
npm run typecheck
npm test
npm run build
```

After deployment, `/api/health` is the liveness check and `/api/health/ready` returns ready only if
PostgreSQL, PostGIS, and migrations `0001`–`0003` are present. The readiness response contains
dependency statuses only, returns `503` when not ready, and is not cached. It does not verify S3
permissions, route-provider billing, or institutional authorization data; validate those separately.

Use [docs/M4_PILOT_READINESS.md](./docs/M4_PILOT_READINESS.md) for controlled Android/browser QA,
provider verification, rollback, and pilot gates. Staging database, R2 adapter, and selected
authenticated workflow and authorization checks have run with synthetic data using a local
server and session pooler; Vercel and device QA remain outstanding. No production
deployment, institution policy approval, or live pilot has occurred from this workspace. The privacy
page documents application behavior but is not a substitute for the University's approved privacy
notice or legal review.

## Supabase provider preparation status

The database client remains `postgres` (postgres.js); Supabase does not require replacing the
PostgreSQL schema or authentication. `DIRECT_URL`, when configured, is preferred by migration,
seed, and trusted account/permission scripts; the Vercel app continues to use `DATABASE_URL`.
The isolated Supabase staging project has PostGIS enabled and migrations `0001`–`0003` applied.
No production data has been copied and no production setting has been changed.

The S3 adapter remains AWS SDK based. It supports a custom endpoint, path-style addressing, and
configurable server-side-encryption request headers. For a Supabase Storage S3 endpoint, provide
server-only S3 credentials, enable path-style addressing, and explicitly set
`S3_SERVER_SIDE_ENCRYPTION` to an empty value because that S3 request header is unsupported by
Supabase Storage. Keep the bucket private; the existing NextAuth server-side scope checks and
short-lived signed reads remain mandatory. Object custom-metadata and signed response-cache header
compatibility still require a real staging integration check.

**Database connection mode remains a production blocker.** Supabase warns that postgres.js
pipelining can hang or return mismatched rows through its shared transaction pooler. The production
configuration check rejects its standard port 6543 endpoint; custom proxies cannot be identified
automatically. A session-pooler connection has passed a basic staging connectivity check, but its
connection limits and application transaction paths must be validated under realistic Vercel
concurrency before pilot use. PostGIS in the staging `extensions` schema and unqualified spatial
queries passed basic checks. Do not copy production data or cut over based on these checks alone.
Staging also exposed legacy string-encoded JSON in idempotency and audit records. New JSON writes
store objects, and idempotency retries accept both forms; existing immutable audit records are not
rewritten, so audit consumers must account for historical string-encoded details.
