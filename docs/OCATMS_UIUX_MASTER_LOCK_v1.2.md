# MarSU OCATMS — UI/UX Master Lock v1.2
**Status:** Additive UI/UX polishing baseline; MVP assumed implemented, not independently verified.  
**Authority:** All previously approved OCATMS v1.1 functional requirements take precedence.  
**Platform:** Mobile-first responsive Next.js / TypeScript / Tailwind PWA, deployed on Vercel.

## 1. Non-negotiable invariants
- **UI-LOCK-01 — No functional redesign.** Preserve activity management, participant assignments, Faculty-in-Charge, approved daily itineraries, route-based ETA, GPS milestone capture, arrival check-in, destination check-out, photo evidence, review flags, reporting, and incident functionality.
- **UI-LOCK-02 — RBAC.** Primary roles remain Participant, Dean, VPSAS. Participant scope is own data; Dean scope is assigned college; VPSAS scope is university-wide. Faculty-in-Charge remains an activity assignment with separately authorized permissions.
- **UI-LOCK-03 — Tracking truthfulness.** A PWA cannot promise closed-app background GPS. Clearly label last reported location, accuracy, fix age, and ETA as estimates.
- **UI-LOCK-04 — Evidence integrity.** Preserve separate immutable arrival and check-out events, original and stamped images, GPS metadata, server receipt time, geofence checks, hashes, and authorized review.
- **UI-LOCK-05 — Architecture.** Preserve Vercel hosting, secure server-side authorization, managed persistent database, private external evidence storage, PWA behavior, and approved integration contracts.
- **UI-LOCK-06 — Reuse before replacement.** Audit installed dependencies and existing design system before adding shadcn/ui, Motion, Recharts, React Hook Form, Zod, or TanStack Table.
- **UI-LOCK-07 — Visual consistency.** Standardize tokens, typography, spacing, radius, elevation, iconography, semantic colors, and component states; do not arbitrarily change institutional branding.
- **UI-LOCK-08 — Motion discipline.** Use subtle purposeful animation, no obstructive transitions, and honor prefers-reduced-motion.
- **UI-LOCK-09 — Data integrity.** No changes to KPI definitions, status semantics, approval logic, audit logs, or evidence validation due to cosmetic refactoring.
- **UI-LOCK-10 — Wizard standard.** Use multi-step wizard UX for multi-input administrative workflows, retaining all original fields, validations, authorization, and submission semantics.
- **UI-LOCK-11 — Mobile first.** Prioritize Android viewport usability, GPS/camera permissions, reliable check-in/check-out, touch controls, responsive charts and tables.
- **UI-LOCK-12 — Regression gate.** No visual changes ship without RBAC, travel, check-in/check-out, evidence, responsive, accessibility, and build regression checks.

## 2. Change control
Cosmetic refactors may proceed after repository inspection and baseline screenshots. Any modification of routes, database semantics, security, GPS capture behavior, approval rules, API contracts, or primary roles requires an explicit change request and approval. No silent substitutions.

## 3. Phase boundaries
**In scope:** design system, animations, dashboard chart presentation, responsive layout, wizard UI, loading/error/empty states, performance, accessibility, documentation, tests.  
**Out of scope:** new tracking modes, new roles, replacement backend, changes to approved workflows, simulated verified evidence.

## 4. Acceptance
Deliver before/after screenshots at target widths, a component inventory, dependency audit, accessibility results, Core Web Vitals evidence where measurable, and passing functional regression tests. Report unverified checks explicitly.
