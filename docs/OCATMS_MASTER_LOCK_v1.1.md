# MarSU OCATMS — Master Lock v1.1

Status: LOCKED BASELINE. Implementation target: responsive web application and installable PWA, hosted on Vercel.

## Product identity
Marinduque State University Off-Campus Activity Tracking and Monitoring System (OCATMS). Centralized itinerary-linked monitoring of university off-campus activities, participant travel milestones, location evidence, and oversight.

## Immutable functional scope
1. Three primary RBAC roles: Participant, Dean, VPSAS. Faculty-in-Charge is an assigned activity responsibility with optional scoped supervisory permissions, not a fourth primary role.
2. Participant sees assigned activities, approved daily itinerary, trip progress, and own history; can start travel, manually update location, submit arrival and photo evidence, and report incidents.
3. Each travel milestone captures GPS latitude/longitude, accuracy, GPS acquisition time, trusted server receipt timestamp, destination and participant identity.
4. On Start Travel, create independent participant travel session; calculate route-based ETA from reported origin to approved destination; refresh ETA only on subsequent authorized location updates. Do not claim background live tracking in a PWA.
5. On arrival, capture fresh GPS fix, check destination geofence, take in-app photo, preserve original, generate visible coordinate/time stamp, store metadata and cryptographic hash, and submit for validation. A stamp does not guarantee presence or photo authenticity.
6. Dean has college-scoped activity/participant oversight, last-reported location, itinerary adherence, evidence and flags. VPSAS has university-wide upcoming/ongoing/completed activity and college-level oversight.
7. Activity record includes name, dates, venues, assigned participants, Faculty-in-Charge and approved daily itinerary. Example: Philippine Startup Week 2026, November 8–13, 2026; participants Mr. John Ryan P. Rodelas and Ms. Myren Joy N. Lawing; Faculty-in-Charge placeholder; ingress on day 1; later daily stops based on itinerary. Example travel timestamps are illustrative, not factual.
8. Keep activity creation/editing and approval as separate permissions even if assigned to existing roles. No unapproved additional primary role.
9. Support geofence review flags, overdue/missing check-in indicators, incident reports, audit trail, and historical records. Alerts/incident workflows and exports may be staged after MVP; do not delete their scope.
10. Offline submission queue may be staged; distinguish device event time and server receipt time; mark unverified delayed submissions.
11. Dashboards distinguish last reported GPS fix from actual live location. Do not infer participant safety or presence solely from GPS.
12. Privacy: purpose limitation, access scoping, consent/notice as legally appropriate, data retention/deletion policy, encryption, auditability, privacy impact assessment under Philippine Data Privacy Act.

## Delivery and technology lock
- First delivery: mobile-first responsive Next.js + TypeScript + Tailwind CSS PWA, installable via manifest and service worker, hosted on Vercel.
- Server: Vercel-compatible Next.js Route Handlers/server actions (or equivalent compatible API layer). No dependence on persistent Vercel local filesystem or always-running server processes.
- Database: PostgreSQL + PostGIS recommended for geospatial queries. A managed Postgres provider must support required PostGIS extensions; confirm compatibility before implementation. MongoDB with GeoJSON remains a viable alternative only by approved architectural decision, not silent substitution.
- Evidence: private S3-compatible object storage, signed upload/download URLs, authorization checks; never public-by-default photo evidence.
- Maps/routing: Google Maps Platform Routes API or approved equivalent; API keys restricted and costs monitored; distinguish estimated ETA from observed arrival.
- Authentication: institutional SSO if available; otherwise secure application authentication. Server-enforced authorization on every read/write.
- Hosting: Vercel production/preview environments, secrets via environment variables, managed database, external object storage.
- Phase 1: milestone GPS (start, update, arrival check-in, destination check-out). Phase 2: incident alerts, reports, offline queue. Phase 3: optional foreground periodic updates or native-app background tracking with additional privacy controls. Never promise background tracking from a closed PWA.

## Core data model
College(id,name); User(id,collegeId,identity,status); RoleAssignment(id,userId,role,scope); Activity(id,title,startDate,endDate,venue,status,hostCollegeId,facultyInChargeId); Participation(id,activityId,userId,assignmentStatus); ItineraryStop(id,activityId,day,sequence,destination,lat,lng,geofenceRadiusM,plannedArrival,travelMode); TravelSession(id,participationId,itineraryStopId,originLat,originLng,departureAt,etaAt,status); CheckIn(id,travelSessionId,kind [ARRIVAL|CHECKOUT],lat,lng,accuracyM,deviceCapturedAt,serverReceivedAt,geofenceStatus,validationStatus); Evidence(id,checkInId,originalObjectKey,stampedObjectKey,sha256,reviewStatus); Incident(id,activityId,participationId,type,status); Notification(id,userId,type,status); AuditLog(id,actorId,action,resourceId,occurredAt).
Use UTC instants in storage; render Asia/Manila for users. Distinguish GPS acquisition, client event, server receipt, and evidence processing times.

## Acceptance tests
- Participant cannot access other participants' private evidence by guessing IDs.
- Dean cannot read another college's data without an explicit approved cross-college assignment.
- VPSAS can filter by college, date, activity status and participant.
- Independent participant trip states and ETA are maintained for each itinerary stop.
- No GPS permission: show an actionable failure state, not a fabricated fix.
- Geofence outside/low-accuracy submissions are flagged, not silently rejected or marked verified.
- A check-in has immutable server receipt timestamp, original evidence preserved and stamped derivative generated.
- PWA works on narrow Android screens and desktop browsers; map and camera permissions are handled explicitly.
- Vercel deployment builds with production environment configuration and uses external persistent stores.

## Change control
Any requested change to primary roles, scope, location semantics, data privacy, tracking mode, storage, or platform must be presented as a change request with rationale, impact, and approval checkpoint. Do not redesign approved functionality, remove modules, invent live-tracking capability, or alter canonical example names/dates.

## Approved additive amendment v1.1 — destination check-out (LOCKED)
13. After arriving at each approved itinerary destination, the participant must explicitly Check Out before completing that stop. Capture fresh GPS coordinates, accuracy, GPS acquisition time, server receipt timestamp, destination geofence validation, and in-app photo evidence with embedded visible timestamp and coordinates. Retain original and stamped derivative, private access and hash as for arrival.
14. Check-out is a separate immutable CheckIn record with kind CHECKOUT, linked to the same participant, travel session and itinerary stop as ARRIVAL. Do not overwrite arrival evidence or auto-generate departure events.
15. Show CHECKED_IN, CHECKOUT_PENDING, CHECKOUT_SUBMITTED and CHECKED_OUT status as appropriate; review flags for low accuracy, outside geofence, missing evidence and missing check-out. Evidence validation remains separate from submission.
16. Calculate destination dwell duration from check-in and check-out event timestamps, with clear provisional status where review is pending. After checkout allow Start Travel to the next approved stop or mark the itinerary day complete.
17. Dean college-scoped and VPSAS university-wide dashboards show checkout state, departure time/location, dwell duration and evidence. Enforce existing RBAC and privacy controls.
18. This is an additive requirement only. All other v1.0 requirements, technology, scope and roadmap remain locked.
