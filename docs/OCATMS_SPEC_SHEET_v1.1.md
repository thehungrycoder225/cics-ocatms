# MarSU OCATMS — System Specification Sheet v1.1

**Project:** Marinduque State University Off-Campus Activity Tracking and Monitoring System
**Platform:** Responsive Web Application + Progressive Web Application (PWA)
**Hosting:** Vercel
**Baseline:** Master Lock v1.1; no redesign of requirements.

## 1. Purpose and scope
Centralize university off-campus activity monitoring by linking participants' departure, transit updates, arrivals, location fixes, timestamps and photographic evidence to approved multi-day itineraries. Provide college-scoped Dean dashboards and university-wide VPSAS oversight.

## 2. Users and RBAC
| Action | Participant | Dean | VPSAS |
|---|---|---|---|
| View activities/itineraries | Own | College | University-wide |
| Start/update/arrive on travel | Own | No | No |
| Upload evidence | Own | No | No |
| View check-ins/evidence | Own | College | University-wide |
| Review flagged evidence | No | College | University-wide |
| Dashboard and reports | Own | College | University-wide |
| Activity management | No | Scoped, if authorized | Scoped, if authorized |
| Activity approval | No | Only if granted | Only if granted |

Faculty-in-Charge is an activity assignment; any additional supervisory permissions are explicit, scoped and audited. Server-side RBAC is mandatory.

## 3. Functional requirements
**FR-01 Identity and access:** sign-in, user-to-college association, role assignments, scoped authorization, session management.
**FR-02 Activities:** title, organizer, venue, dates, status (upcoming/ongoing/completed), college associations, participants, faculty-in-charge, approval state.
**FR-03 Itineraries:** ordered daily stops, destination coordinates, travel mode, scheduled departure/arrival, geofence tolerance, change history.
**FR-04 Participant workspace:** activity list, day timeline, current stop, status, previous submissions.
**FR-05 Start Travel:** user-initiated GPS acquisition with accuracy, departure timestamp from server, new travel session and initial ETA.
**FR-06 Location Update:** user-initiated new GPS fix; store update time; optionally recompute ETA. Do not mislabel as continuously live.
**FR-07 Arrival:** fresh GPS fix, server receipt timestamp, geofence evaluation, photo capture and check-in submission.
**FR-07A Destination Check-Out (MVP):** after arrival check-in, participant explicitly taps Check Out at the current itinerary stop; capture fresh GPS fix, horizontal accuracy, GPS acquisition time, trusted server receipt time, geofence result and in-app photo evidence with stamped derivative. Record check-out separately from check-in, retain both timestamps and calculate dwell time only from recorded events. Flag low accuracy, outside-geofence, missing evidence, and absent check-out for review. Do not silently close a stop or auto-start the next trip.
**FR-08 Evidence:** original photo in private object storage; generated stamped derivative with time and coordinates; cryptographic hash and review state; access-controlled retrieval.
**FR-08A Check-out monitoring:** show checked-in, checkout pending, checked-out, dwell time, exit location, and checkout evidence in participant timelines and oversight dashboards.
**FR-09 Dean monitoring:** college activity lists, per-participant timelines, latest known fix with age, ETAs, missing/late check-ins, evidence review.
**FR-10 VPSAS monitoring:** all colleges, upcoming/ongoing/completed activities, filters, aggregates, incident/exception views.
**FR-11 Flags:** late arrival, low accuracy, outside geofence, missing evidence, offline/delayed submission; human review workflow.
**FR-12 Incident reporting:** participant incident submission and authorized review; advanced notifications may be phase 2.
**FR-13 Reporting:** per-activity attendance/travel/evidence and consolidated college/university exports (phase 2).
**FR-14 Audit:** append-only audit events for sensitive reads, edits, reviews, approvals and overrides.
**FR-15 Offline support:** queued submissions with clear synchronization state and independent device/server times (phase 2).

## 4. Example scenario
Activity: Philippine Startup Week 2026, November 8–13, 2026; destination QC M.I.C.E. Center, Quezon City; Participant A: Mr. John Ryan P. Rodelas; Participant B: Ms. Myren Joy N. Lawing; Faculty-in-Charge: placeholder. Day 1 ingress; Days 2–5 use approved itinerary; Day 6 may include scheduled egress if approved. Both participants independently select next stop, Start Travel, obtain origin fix + timestamp + ETA, and submit arrival fix + timestamp + photo evidence. No sample times/coordinates are represented as real logs.

## 5. Travel state machine
NOT_STARTED -> IN_TRANSIT -> ARRIVAL_SUBMITTED -> CHECKED_IN -> CHECKOUT_SUBMITTED -> CHECKED_OUT (with independent VERIFIED or FLAGGED_FOR_REVIEW validation on arrival and departure evidence). Additional states: CANCELLED, INTERRUPTED, OFFLINE_PENDING. Verification is separate from receipt. Repeated taps must not create duplicate sessions or check-ins (idempotency keys).

## 6. Data entities
College; User; RoleAssignment; Activity; Participation; ItineraryStop; TravelSession; CheckIn (kind ARRIVAL or CHECKOUT); Evidence; Incident; Notification; AuditLog. Foreign keys, scoped indices, geospatial indices, immutable evidence metadata and created/updated timestamps required. See Master Lock for core fields.

## 7. UI routes / screens
- `/login`: authentication.
- `/participant`: assigned activities and today's status.
- `/participant/activities/[id]`: activity details, itinerary and participant's travel sessions.
- `/participant/trips/[id]`: Start Travel, Update Location, I've Arrived, Check Out, camera capture, submission status.
- `/dean`: college dashboard, alerts and recent activity.
- `/dean/activities/[id]`: participant monitoring, timelines, evidence review.
- `/vpsas`: university command center and college breakdown.
- `/vpsas/activities/[id]`: activity-level overview and filters.
- `/activities/[id]/itinerary`: read-only approved itinerary, scoped to authorized users.
- `/settings`: account, privacy information, PWA installation help.
Actual route naming may vary without altering functional requirements.

## 8. Dashboard KPIs
- Active activities: count with active date/status.
- Participants in transit: distinct participants with open travel session.
- Check-in compliance: verified expected milestones / total expected milestones for a selected period; show denominator and pending reviews separately.
- Overdue check-ins: milestones past scheduled arrival plus configurable tolerance without accepted arrival.
- Evidence exceptions: count by outside-geofence, low accuracy, delayed, or missing.
Always show location freshness and source; never imply that a last-known fix is live.

## 9. Architecture and integrations
Next.js + TypeScript + Tailwind CSS + installable PWA on Vercel. Server-side route handlers; managed PostgreSQL/PostGIS; private S3-compatible storage; Maps Routes API; institutional SSO or secure authentication. Use server authorization on every API and signed URLs for evidence. Avoid local disk persistence and background-process assumptions on Vercel. Configure PWA service worker conservatively: do not cache private evidence or sensitive API responses by default.

## 10. Nonfunctional requirements
Responsive Android-first UI; accessibility aligned with WCAG 2.2 AA; HTTPS; security headers; rate limits; validation and sanitization; least privilege; encrypted storage; configurable retention; observability; graceful permission denial and intermittent connectivity; UTC storage and Asia/Manila display; server timestamp source of truth; reliable deployment and rollback.

## 11. Privacy and evidence integrity
Explain location purposes and timing to participants. Capture location only at authorized milestones for MVP. Require appropriate privacy notice/legal basis and institutional privacy impact assessment. Record location accuracy and age. Keep original photo and a derivative with visible date/time/coordinates; hash original and log processing; distinguish evidence submission from independent verification. Document review/override decisions.

## 12. Delivery plan
M1 foundation: project, Vercel, authentication, RBAC, activities, participants.
M2 participant journey: itinerary, travel sessions, GPS, ETA, arrival, photo evidence.
M3 monitoring: Dean and VPSAS views, maps, evidence review, exceptions.
M4 hardening: security, privacy, Android PWA QA, deployment, pilot.
Phase 2: incident alerting, exports, offline queue. Phase 3: optional foreground tracking and native app for authorized background tracking.

## 13. Definition of done
Each feature includes schema migration, authorization tests, input validation, usable loading/error/permission states, responsive UX, audit event where appropriate, and production-compatible configuration. No feature is complete on mocked data alone; test with seeded example records and document mock vs real integration behavior.

## 14. Open implementation decisions (not requirement redesign)
University SSO availability; managed Postgres provider and PostGIS support; object-storage provider; maps API credentials/budget; geofence radii and overdue thresholds; privacy retention schedule; approval ownership; cross-college activity access; exact itinerary stop data. Request confirmation before encoding institution-specific policies.

## v1.1 additive acceptance criteria — destination check-out
- Check Out is available only after a valid arrival submission for the same participant and itinerary stop; pending review is allowed but visibly flagged.
- Arrival and check-out are distinct immutable events with their own GPS accuracy, server timestamps, geofence checks and photo evidence.
- Repeated Check Out requests are idempotent; a missing or flagged check-out does not retroactively change arrival evidence.
- Dwell time is calculated from authoritative event timestamps, labeled provisional when an event is under review.
- Deans see checkout status only for authorized colleges; VPSAS sees university-wide checkout status.
- After check-out, a participant may begin the next approved itinerary stop or finish the day; the system never fabricates movement.
