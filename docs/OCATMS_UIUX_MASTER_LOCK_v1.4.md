# OCATMS UI/UX Master Lock v1.4 — MarSU Maroon Edition

**Status:** Proposed additive visual/UI polish specification. **Scope:** No functional redesign. **Authority:** Approved OCATMS v1.1 requirements and v1.2 UX standards remain binding; v1.3 Supabase is a separate infrastructure proposal.

## Immutable requirements
- Preserve Participant, college-scoped Dean and university-wide VPSAS RBAC. Faculty-in-Charge remains an activity assignment.
- Preserve activity and itinerary management, route-based ETA, Start Travel, location updates, arrival check-in, explicit destination check-out, geofence verification, and independent immutable arrival/checkout events.
- Preserve original and stamped photographic evidence, hashes, timestamps, accuracy, dwell time, review status, exception flags, privacy and audit logs.
- Preserve Next.js/TypeScript/Tailwind responsive PWA on Vercel; do not migrate authentication, database or storage as part of this UI work.
- Do not label last-reported GPS as continuous live tracking or fabricate records or statistics.

## Visual locks
- **V14-01:** Primary MarSU institutional brand color `#660033`.
- **V14-02:** Supporting colors: deep burgundy `#400020`, ruby `#B30059`, rose `#D63384`, gold `#FFCC00`, soft gold `#F8E8A6`, light surface `#F4F4F6`, dark charcoal `#272822`.
- **V14-03:** macOS-inspired clarity: compact toolbar, restrained translucency, subtle shadows, rounded cards, system typography, purposeful motion. Do not imitate nonfunctional macOS window controls.
- **V14-04:** Monokai-first branding is superseded; preserve semantic success, warning, error and information colors and WCAG 2.2 AA contrast.
- **V14-05:** Android/mobile-first task accessibility, 360–1440px responsive layouts, reduced-motion support, keyboard focus and readable labels.
- **V14-06:** Wizard forms for workflows with multiple independent inputs; preserve all existing fields, validation, draft state and approval rules. Simple check-in/out actions must not become wizards.
- **V14-07:** Charts must use actual authorized metrics, accessible labels, and data-table alternatives.

## UI text cleanup lock
- Remove unnecessary AI-generated filler, exaggerated greetings, marketing slogans, redundant explanatory subtitles, fake sample statistics and misleading claims of real-time GPS.
- Prefer concise task labels such as `Activities`, `Start Travel`, `Check In`, `Check Out`, `Upload Evidence`, `Review`, `Submit`, `Retry`.
- **Do not remove** required GPS permission and accuracy messages, geofence exceptions, evidence instructions, upload errors, privacy notices, legal text, accessible labels, or essential safety instructions.
- Review policy/legal wording rather than automatically rewriting it. Do not replace genuine data with fabricated placeholders.

## Change and release gates
Audit repository and existing libraries before edits. Capture before/after screenshots. Implement small reviewable batches. Run responsive, accessibility, RBAC, GPS/check-in/check-out, photo evidence, lint, typecheck, build and regression tests. Mark unexecuted tests `Not Run`. Any functional, schema, API, RBAC, or infrastructure change needs separate approval.
