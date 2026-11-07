MarSU OCATMS — Supabase Database & Storage Technical Specification v1.3
Type: Implementation proposal, not evidence of an inspected repository.

1. Objective
   Simplify operational setup by consolidating managed PostgreSQL and photo evidence storage in one Supabase project, while preserving the existing Vercel PWA and all functional behavior.
2. Provider evaluation
   Service Free offering Setup Verdict
   Supabase Database 500 MB database, 2 active projects Create project, connection string Preferred
   Supabase Storage 1 GB storage, 50 MB max per file on Free Private bucket, policies Preferred
   Cloudinary Free plan, 25 monthly credits across storage/transformations/bandwidth Account, upload controls, delivery policies Fallback if storage needs exceed Supabase limits
   Firebase Storage Cloud Storage generally requires Blaze billing; no-cost quotas may apply Firebase + billing setup + security rules Not preferred for low-friction deployment

Supabase Free may pause after one week of inactivity. A production safety-monitoring workflow should not depend on a pausable free-tier service without institutional acceptance of that risk. 3. Target architecture
Client: existing Next.js PWA on Vercel.
Server: existing authorized Next.js route handlers / backend.
Database: Supabase PostgreSQL, preserving current ORM and schema. Enable PostGIS extension only if current geospatial queries require it.
Evidence: Supabase Storage private bucket activity-evidence (proposed name), with separate immutable original and stamped derivative object keys.
Maps and routing: unchanged.
Auth and role assignment: unchanged; Supabase Auth migration NOT authorized. 4. Database migration and compatibility

- Inspect existing database engine, ORM, migrations, PostGIS functions, connection management and data volumes.
- If existing engine is PostgreSQL, prefer changing managed host and connection configuration, with tested backup/restore.
- Validate PostGIS extension availability, indexes, geofence queries, migration permissions and ORM support.
- Use transaction pooler for Vercel serverless runtime where compatible; migrations may need a direct/session connection. Verify prepared statement behavior.
- Store credentials only in Vercel environment variables; restrict access by environment.
- Preserve College, User, RoleAssignment, Activity, Participation, ItineraryStop, TravelSession, CheckIn, Evidence, Incident, Notification, AuditLog.
- Preserve UTC storage and Asia/Manila presentation; no data-model redesign.

5. Photo evidence storage

- Use private bucket(s), no public-read policy.
- Preserve separate original and stamped photo objects, immutable check-in/check-out metadata, SHA-256 hashes, and review status.
- Generate secure object keys from opaque IDs rather than participant names.
- Validate file type, actual content, maximum file size, ownership, and check-in association server-side.
- Authorize signed uploads/downloads through existing backend; signed URLs should be short-lived.
- Apply RLS to storage.objects where client access is used; service-role key remains server-only and must never bypass application authorization checks.
- Preserve original quality needed for evidentiary review; optimize separate display thumbnails only.
- Record failed uploads, partial processing, and retries idempotently.

6. Capacity planning
   Illustration: 2 photos per destination milestone (original and stamped) × 1 MB each = 2 MB per milestone. At 500 milestones, ~1 GB storage, excluding thumbnails and other files. Both arrival and checkout require evidence, so actual consumption may be higher. Track usage and set operational alerts before free-tier exhaustion.
7. Minimal environment variables

- DATABASE_URL: pooled runtime connection (server-only).
- DIRECT_URL: migration connection if required by ORM (server-only).
- SUPABASE_URL: project URL.
- SUPABASE_SERVICE_ROLE_KEY or current equivalent server secret: server-only, if needed for privileged storage operations.
- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY: only if browser client is actually needed; these are not authorization substitutes.
  Use current Supabase key naming in installed SDK; do not hardcode values. No .env file with secrets in Git.

8. Migration acceptance tests

- All existing records retained; counts and key relations match.
- Geofence queries produce equivalent results.
- Participant, Dean and VPSAS authorization isolation unchanged.
- Arrival and checkout evidence stored privately and independently.
- Original/stamped objects retrievable by authorized users only.
- Unauthorized direct object access denied.
- Server timestamps, hashes and audit logs preserved.
- Vercel preview build, integration tests, and rollback test pass.
- Free-tier pause, quota and upload-limit risks documented.

9. Open decisions
   Confirm current ORM, existing database engine, current S3 provider, estimated evidence volume, privacy/retention rules, institutional availability requirement, and whether Supabase Free is acceptable for a non-production pilot. Do not invent these details.
   Official references (checked November 2026)

- Supabase pricing: https://supabase.com/pricing
- Supabase free-project pausing: https://supabase.com/kb/faqs/platform/free-project-pausing
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage upload limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- Supabase + Vercel: https://supabase.com/kb/faqs/database/nextjs-on-vercel
- Supabase connection pooling: https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits
- Cloudinary pricing: https://cloudinary.com/pricing
- Firebase pricing: https://firebase.google.com/pricing
  Free-tier allowances and policies can change. Recheck official pricing before provisioning.
