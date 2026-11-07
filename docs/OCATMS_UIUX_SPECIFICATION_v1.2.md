# MarSU OCATMS — UI/UX Polish Specification v1.2
**Lifecycle:** Post-MVP UI/UX enhancement. **Requirement policy:** additive only; v1.1 remains authoritative.

## 1. Goals
Improve visual cohesion, discoverability, perceived responsiveness, mobile task completion, accessible analytics, and administrative form completion without changing behavior.

## 2. Visual language for 2026–2027
Adopt restrained modern enterprise SaaS patterns: clean information hierarchy, selective bento KPI layouts, subtle depth, progressive disclosure, compact filters, purposeful microinteractions, and responsive data density. Treat these as design directions, not a mandate to reproduce unverified trends. Avoid excessive glassmorphism, gradients, motion, decorative dashboards, or low-contrast controls. Verify institution branding before applying new colors.

## 3. Design tokens
Define semantic tokens for `background`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `focus`, `primary`, `success`, `warning`, `danger`, and `info`; support light/dark only if already approved. Use consistent type scale, spacing scale, border radius, shadows, icon size, and density. Status colors must have text/icon labels.

## 4. Screen-by-screen polish matrix
| Surface | UI improvements | Must preserve |
|---|---|---|
| Participant home | Clear next action, itinerary timeline, prominent status | Own-only data |
| Activity detail | Day tabs, location cards, faculty/participant summary | Approved itinerary |
| Travel session | Sticky Start Travel / Update Location / Arrived actions; GPS accuracy state | GPS and ETA semantics |
| Destination checkout | Explicit Check Out action, exit GPS, photo, confirmation, dwell time | Independent immutable checkout |
| Evidence capture | Camera permission guidance, preview, upload progress, retry | Original/stamped evidence |
| Dean dashboard | College KPI cards, filters, exception table, participant detail drawer | College scoping |
| VPSAS dashboard | Cross-college summary, trends, activity states, map/table toggle | University-wide scoping |
| Activity management | Wizard, review step, draft persistence | Existing fields and approvals |
| Itinerary editor | Multi-stop wizard, ordering and geofence feedback | Approved stops and schedule |
| Reports | Accessible chart/table view, filters, export feedback | Existing metrics and export rules |

## 5. Animation rules
Use animation only for page/section transitions, wizard step changes, expanding detail, notification appearance, and asynchronous feedback. Favor opacity/transform transitions; avoid animating large map canvases, charts with thousands of marks, and sensitive GPS values. Target ~120–240 ms for common microinteractions; tune by usability testing. Support reduced-motion and avoid blocking task completion.

## 6. Chart standards
Recharts with shadcn/ui Chart is preferred if compatible with installed versions. Required visualizations: activity counts by status, participants in transit, check-in compliance, overdue check-ins, evidence exceptions, college breakdown, and time trends. Preserve denominator definitions, date windows, and filters. Use responsive containers, visible units, legends, accessible table alternatives, and no misleading truncated axes.

## 7. Wizard standards
Use a wizard when a workflow requires multiple independent inputs and logical stages. Example Activity Wizard: Activity Details → Participant & Faculty Assignment → Daily Itinerary → Review & Submit. Keep all current fields and approval gates. Use step-level validation, editable previous steps, persisted draft where already supported, explicit unsaved-change warning, progress indicator, keyboard navigation, and mobile sticky Back/Next controls. A simple single-field check-in must **not** become a wizard.

## 8. Responsive standards
Test at 360, 390, 768, 1024, and 1440 px; portrait Android is priority. Avoid horizontal page overflow. Use one-column task screens on mobile, responsive KPI grid, accessible table-to-card conversion where useful, scrollable tab strips, safe-area-aware sticky controls, and readable map alternatives. Keep touch targets at least 24×24 CSS px per WCAG 2.2 AA minimum, preferably 44×44 for high-frequency mobile actions.

## 9. PWA and performance
Preserve manifest/service worker, secure camera/GPS prompts, permission-denied paths, and no private evidence caching by default. Lazy-load map and heavy chart components, minimize client JavaScript, virtualize large tables, optimize non-evidence thumbnails, and avoid layout shifts. Targets at p75: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; measure on representative mobile hardware and real routes.

## 10. Accessibility and states
Aim for WCAG 2.2 AA. Ensure keyboard access, visible focus, semantic headings, form labels, error summaries, screen-reader announcements, contrast, reduced motion, and no color-only status. Design loading, empty, error, permission denied, stale location, low GPS accuracy, upload pending, upload failed, offline queued, and evidence-under-review states.

## 11. Quality gates
Audit → component inventory → baseline screenshots → incremental polish → visual comparison → automated tests → mobile device tests → accessibility audit → Vercel preview validation. Never mark a test passed without running it.
