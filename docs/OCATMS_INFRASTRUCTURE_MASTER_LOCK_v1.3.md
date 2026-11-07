# MarSU OCATMS — Infrastructure Master Lock v1.3
**Status:** Proposed additive infrastructure amendment, pending approval and repository audit.
**Scope:** Database hosting and photographic evidence storage providers ONLY.

## Authoritative invariants
- Preserve all v1.1 functional requirements and v1.2 UI/UX polish requirements.
- Preserve Participant / Dean / VPSAS RBAC, college scopes, Faculty-in-Charge assignment, itineraries, ETA, GPS start-travel and arrival, separate destination checkout, geofence verification, immutable evidence, and audit logs.
- Preserve Next.js/TypeScript/Tailwind responsive PWA hosted on Vercel.
- No changes to public-facing workflows, field meanings, KPI definitions, approval rules, API contracts, or retention requirements without explicit approval.
- No unapproved switch of authentication provider. Supabase Auth is OPTIONAL and OUT OF SCOPE.
- No deletion of existing data or storage objects during migration.
- Never expose Supabase service-role/secret keys to the browser.

## INFRA-LOCK-01: Database provider
**Preferred:** Supabase-managed PostgreSQL. This is a hosting/provider change, NOT a replacement of PostgreSQL. Preserve existing relational schema, keys, constraints, migrations, and geospatial behavior. Enable and validate PostGIS if used by the current codebase. If current database is not PostgreSQL, stop and produce a separate migration-impact assessment before edits.

## INFRA-LOCK-02: Evidence provider
**Preferred:** Supabase Storage private bucket(s). Preserve original images and timestamp/coordinate-stamped derivatives separately; retain hashes, object references, authorized access, and auditability. Use signed URLs or authenticated server proxy, enforce storage policies and existing RBAC. Do not make evidence buckets public.

## INFRA-LOCK-03: Vercel compatibility
Use Supabase connection pooling appropriate for serverless traffic; verify ORM compatibility with transaction pooling. Use Vercel environment variables and external persistent storage. Do not use Vercel local disk for durable evidence.

## INFRA-LOCK-04: Free-tier constraints
Supabase Free currently advertises 500 MB database, 1 GB file storage, 5 GB egress, 50,000 monthly active users, and two active projects. Free projects may pause after one week of inactivity. Free storage uploads are capped at 50 MB per file. Free tier is for prototype/pilot only until capacity, continuity, and university privacy review are completed.

## INFRA-LOCK-05: Migration gates
Before migration: inspect live code, dependencies, schema, data volumes, object storage, permissions, and current environment. Back up data and evidence; document restore. Create new resources only with explicit authorization. Run parallel verification, compare record counts/hashes, and obtain sign-off before cutover. Maintain rollback path. Never claim migration or deployment occurred without evidence.

## INFRA-LOCK-06: No redesign
All non-provider modifications require a separate approved change request. Changes to schemas or adapters must be minimal and behavior-preserving.

## Official references (checked November 2026)
- Supabase pricing: https://supabase.com/pricing
- Supabase free-project pausing: https://supabase.com/kb/faqs/platform/free-project-pausing
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage upload limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- Supabase + Vercel: https://supabase.com/kb/faqs/database/nextjs-on-vercel
- Supabase connection pooling: https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits
- Cloudinary pricing: https://cloudinary.com/pricing
- Firebase pricing: https://firebase.google.com/pricing

Free-tier allowances and policies can change. Recheck official pricing before provisioning.
