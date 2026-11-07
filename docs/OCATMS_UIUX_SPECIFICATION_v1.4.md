# OCATMS UI/UX Specification v1.4 — macOS-Inspired MarSU Maroon

**Purpose:** Post-MVP aesthetic refinement and concise UI copy. No changes to approved requirements.

## 1. Design direction
Create a calm, premium university operations interface: macOS-inspired surface hierarchy and interaction polish, **not** an OS clone. Prioritize Participant mobile task completion and Dean/VPSAS data clarity over decorative effects.

## 2. Brand palette
| Token | Hex | Use |
|---|---|---|
| Brand primary | `#660033` | MarSU identity, light-mode primary actions |
| Deep burgundy | `#400020` | Dark navigation and shell |
| Ruby | `#B30059` | Selected states and highlights |
| Rose | `#D63384` | Sparing secondary accent |
| Gold | `#FFCC00` | Institutional accent, borders and icons |
| Soft gold | `#F8E8A6` | Highlighted backgrounds |
| Light surface | `#F4F4F6` | Light-mode canvas |
| Dark surface | `#272822` | Dark-mode canvas |
| Light text | `#F8F8F2` | Dark-mode foreground |

Maintain separate semantic success, warning, information and error tokens. Verify WCAG 2.2 AA contrast for each combination; avoid gold small text on white. Use system font stack with SF Pro only where available through the operating system, falling back to Inter/Segoe UI/sans-serif.

## 3. Component standards
- Desktop: collapsible sidebar, compact header, search, filters, restrained translucent surfaces where contrast allows.
- Mobile: bottom navigation or drawer, single-column task cards, safe-area-aware primary actions, clear GPS and camera states.
- Cards: consistent 14–20px radius, subtle border/shadow, strong typography hierarchy, compact information density.
- Controls: visible focus, labeled fields, meaningful hover/pressed/loading/disabled states; prefer 44px touch areas.
- Motion: subtle ~120–240ms transitions; use opacity/transform; honor `prefers-reduced-motion`.
- Charts: Recharts + shadcn/ui Chart only if compatible with installed stack; retain metric definitions, legends, units, filters and accessible table alternatives.
- Wizards: Activity Details → Participants & Faculty → Itinerary → Review & Submit is an illustrative grouping; preserve actual fields and workflow. Include Back/Next, step validation, draft persistence where supported, and final review.

## 4. Screen-by-screen refinement
| Surface | Polish | Preserve |
|---|---|---|
| Participant home | Current activity, next task, compact itinerary | Own-only scope |
| Travel session | Location age/accuracy, ETA, clear action | Start Travel and location updates |
| Arrival | Clear Check In, geofence/evidence state | Fresh GPS and immutable arrival |
| Departure | Explicit Check Out, photo/accuracy feedback | Separate immutable checkout and dwell time |
| Dean dashboard | College KPI cards, filters, exception list | College RBAC and metrics |
| VPSAS dashboard | University summary and comparisons | University RBAC |
| Evidence review | Image viewer, metadata, review status | Private originals/derivatives and hashes |
| Activity forms | Multi-step wizard and review | All validations/approvals |

## 5. Remove unnecessary AI-generated UI text
**Remove:** synthetic greetings (e.g. “Welcome to your revolutionary smart dashboard”), marketing claims, duplicate subtitles, filler helper text, fabricated KPIs, generic motivational prose.

**Rewrite examples:**
| Before | After |
|---|---|
| Welcome to your intelligent activity dashboard! | Dashboard |
| Begin your exciting journey by tapping below | Start Travel |
| Experience seamless next-generation tracking | Remove |
| Live Tracking (when only manual GPS is collected) | Last Reported Location |
| 318 Participants (hard-coded sample) | Real metric or `No data available` |

**Preserve:** `Location permission is required to check in`; `Location accuracy is low. Retry`; `Check-out photo is required`; `Evidence upload failed. Retry`; out-of-geofence and delayed submission notices; privacy/consent, accessibility, and required error messages. Use plain, neutral, actionable wording.

## 6. Responsive and performance
Test 360, 390, 768, 1024, 1440px, Android browser and installed PWA. No horizontal page overflow; charts adapt or offer table view; controls remain thumb-reachable. Lazy-load heavy maps/charts, preserve evidence originals, and avoid private-data caching. Targets at p75 where measured: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.

## 7. Acceptance
Visual review, copy-change inventory, screenshots, keyboard and screen-reader review, reduced-motion verification, role and evidence regression tests, lint/typecheck/build and Vercel preview validation. No claim of passing tests without execution.
