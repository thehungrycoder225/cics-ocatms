# OCATMS — Design System & Interface Architecture

**Version:** 1.5 · MarSU Operations Console  
**Status:** Proposed design refinement; approval required before code changes  
**Owner:** Marinduque State University / OCATMS  
**Primary implementation:** Existing Next.js + TypeScript + Tailwind PWA; shadcn/ui component conventions  
**Target audience:** VS Code GitHub Copilot Agent, developers, reviewers  
**Design references:** Current Dean monitoring dashboard screenshots provided November 2026; approved OCATMS functional v1.1, UI/UX v1.2 and v1.4; proposed infrastructure v1.3 (not an authorization to migrate).

> **One-line design directive:** Build an institutional **operations console**, not a generic analytics template. Design around activities, itinerary milestones, participants, evidence, and last-reported locations. Preserve all existing behavior.

## 0. Non-negotiable scope and authority

This is a **visual and interaction refinement** specification. It does not authorize changes to roles, backend APIs, database models, business rules, record retention, itinerary approval, location capture, or deployment. Before editing, inspect the actual repository, identify installed shadcn/ui and Tailwind versions, review Git status and existing tests, and report a change plan for approval.

**Preserve:** Participant; college-scoped Dean; university-wide VPSAS; Faculty-in-Charge as an activity assignment; approved activity and itinerary; Start Travel; manual location updates; GPS coordinates/accuracy/timestamps; route-based ETA; explicit Arrival Check In and separate destination Check Out; geofence logic; original and stamped evidence photos; immutable evidence and audit metadata; privacy/RBAC; PWA constraints. Never imply continuous background GPS tracking.

Do not change production data, delete M4 synthetic records, alter database/storage provider, or deploy as part of a visual redesign. Those are separately gated M5 workstreams.

## 1. Screenshot-based diagnosis (current Dean UI)

Source: six supplied screenshots of current Dean monitoring screens. These are **observations of the screenshots**, not claims about code implementation.

| ID | Observed UI issue | Refined treatment | Priority |
|---|---|---|---|
| D-01 | Six similarly sized metric cards occupy the top of the page | Compact 3–4 metric strip with one prominent insight and separate exception summary | P0 |
| D-02 | Filter panel shows many full-width selects and two large action buttons | A compact filter toolbar plus expandable `Sheet`/filter panel; show active filter chips and one Reset control | P0 |
| D-03 | Overview, filters, activities and monitoring are long sections on one scroll | Task-oriented dashboard zones and purposeful navigation or tabs; retain route anchors where used | P0 |
| D-04 | Activity and chart panels resemble raw two-column/count tables | Render appropriate graphical summaries with accessible tabular alternative, avoiding false precision | P1 |
| D-05 | Activity list horizontally scrolls despite a single activity | Responsive table with prioritized columns and accessible detail view; keep complete data available | P1 |
| D-06 | Participant cards repeat dense GPS and evidence details for every stop | One participant summary, compact itinerary timeline, expandable stop detail and evidence inspector | P0 |
| D-07 | UI states `Fix age: reported 0 seconds ago` when last fix is `Not reported` | Show `Not available`/`No location reported`; only calculate age for an actual fix | P0 |
| D-08 | Synthetic-record audit checkbox appears within primary monitoring filters | Move to authorized audit-only tools, if needed; never hide records by deleting or modifying them | P0 |
| D-09 | Small uppercase eyebrow labels compete with normal labels | Consistent 12–14 px metadata; no decorative uppercase headings everywhere | P1 |
| D-10 | Visible Next.js development issue badge overlays sidebar | Diagnose build/runtime issue; do not suppress a genuine error or conceal it with CSS | P0 |
| D-11 | Sidebar repeats generic labels with weak active-state emphasis | Group navigation by function; consistent active rail, icon support where useful, compact sidebar | P1 |
| D-12 | Current UI is maroon-on-white but lacks distinct spatial hierarchy | Map-first asymmetrical Bento composition, restrained secondary surfaces and clearer prioritization | P0 |

**Do not assume** that missing maps, charts, or behaviors are absent from the repository until inspected. Dashboard counts visible in screenshots are not a verified database baseline.

## 2. Product design principles

1. **Operational clarity first.** Show the next action, current status, and exceptions before decorative analytics.
2. **Truthful monitoring.** `Last reported location` and `Last updated` must correspond to actual server-authorized reports. No fabricated markers or live animation.
3. **Asymmetric, purposeful Bento.** Larger panels must represent more important work, not random visual variety.
4. **Calm university identity.** Maroon carries institutional identity; neutrals carry most UI surface area; gold provides rare emphasis.
5. **Progressive disclosure.** Surface critical states; place extended metadata and rarely used filters behind expandable detail.
6. **Dense but readable.** Prefer compact controls and information-rich tables, not oversized cards.
7. **Accessible by default.** Keyboard, visible focus, explicit labels, meaningful status text, and reduced motion.
8. **Change presentation, not state.** Preserve existing API shape, role gates, component behavior and action semantics.

## 3. Visual identity, semantic tokens and themes

### 3.1 Institutional palette

| Design token | Hex | Role |
|---|---|---|
| `brand.maroon` | `#660033` | Primary identity, active navigation, selected controls, primary CTA |
| `brand.burgundy` | `#400020` | Sidebar/header on dark theme; subtle brand depth |
| `brand.ruby` | `#B30059` | Selected indicators; use only where contrast-tested |
| `brand.rose` | `#D63384` | Limited auxiliary accent; not routine body text |
| `brand.gold` | `#FFCC00` | Sparse institutional accent; never a universal warning color |
| `brand.softGold` | `#F8E8A6` | Light accent surface, with dark text |
| `surface.canvasLight` | `#F4F4F6` | Light app background |
| `surface.canvasDark` | `#272822` | Dark app background |
| `surface.paper` | `#FFFFFF` | Elevated light cards and workspaces |
| `text.ink` | `#1F2024` | Main light-mode text (proposed supporting neutral) |
| `text.muted` | `#62646D` | Secondary light-mode text (contrast-test) |
| `border.subtle` | `#E3E4E8` | Quiet light borders (proposed supporting neutral) |

Neutral support colors are design proposals, not official university colors. Preserve distinct **success, warning, danger and info** semantic palettes; never rely on color alone. Validate WCAG 2.2 AA contrast for every foreground/background pairing. White foreground on `#660033` is suitable for primary branded surfaces; gold on white is not a body-text treatment.

### 3.2 shadcn/ui semantic token mapping

Use the **existing** `components.json`, globals CSS and Tailwind version as the source of truth. Do not replace shadcn initialization or silently switch between Tailwind v3/v4 or Radix/Base/React Aria primitives. Map the following **semantic intent** to the installed theme implementation:

| shadcn semantic variable | Light appearance | Dark appearance |
|---|---|---|
| `background` / `foreground` | `#F4F4F6` / `#1F2024` | `#272822` / `#F8F8F2` |
| `card` / `card-foreground` | `#FFFFFF` / `#1F2024` | dark elevated neutral / near-white |
| `popover` / `popover-foreground` | white / ink | dark elevated neutral / near-white |
| `primary` / `primary-foreground` | `#660033` / `#FFFFFF` | contrast-tested maroon accent / readable foreground |
| `secondary` / `secondary-foreground` | neutral tinted background / ink | elevated dark neutral / near-white |
| `muted` / `muted-foreground` | `#F4F4F6` / tested muted | elevated dark neutral / tested muted |
| `accent` / `accent-foreground` | maroon-tinted neutral / maroon | dark maroon tint / near-white |
| `border` / `input` | `#E3E4E8` | low-contrast dark divider, accessible boundary |
| `ring` | `#660033`, visible outline | contrast-tested focus ring |
| `destructive` | distinct danger red | accessible danger treatment |
| `sidebar-*` | warm white/neutral and maroon active | burgundy/charcoal and accessible foreground |
| `chart-1..5` | coherent accessible series | accessible dark equivalents |

Use `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, etc. Prefer semantic variables to hardcoded one-off hex classes. If CSS tokens are currently defined as HSL/OKLCH channels, **convert carefully to the project's actual syntax**; do not paste hex directly into syntax expecting numeric channels.

### 3.3 Typography — Poppins (approved)

- **Primary UI family:** `Poppins`, fallback `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- Audit existing font loading first. Prefer Next.js font optimization (`next/font/google`) **if compatible and permitted by build/network constraints**; otherwise use the project's approved local/self-hosted font mechanism. Do not bundle undisclosed/proprietary font files.
- Weights: `400` body, `500` labels, `600` page/card headings, `700` only high-priority metrics. Avoid all-bold cards.
- Suggested hierarchy: page title 24–28 px/600; section 16–18 px/600; card title 14–16 px/600; body 13–14 px/400–500; label 12–13 px/500; operational metadata 12 px/400. Respect 200% zoom and do not enforce tiny inaccessible text.
- Use tabular numerals for KPIs, dates, elapsed durations, and accuracy values. Prefer `font-variant-numeric: tabular-nums`.
- Avoid `text-transform: uppercase` for whole headings and long eyebrow labels; reserve tiny uppercase for a few deliberate section markers.
- Long names and activity titles wrap cleanly; no clipped text or impossible table widths.

### 3.4 Radius, spacing and elevation

- 8 px base spacing grid; 4 px for micro-spacing. Main workspace gutters 20–28 px desktop, 16 px tablet/mobile.
- Sidebar width target 220–248 px expanded, compact rail 64–72 px if the existing shell supports it.
- Main card radius 12–16 px; inputs 8–10 px; chips fully rounded only when semantically appropriate.
- Border: 1 px neutral. Shadow: subtle elevation on floating surfaces, not on every control. Avoid neon glow, thick strokes, exaggerated glass and unnecessary gradients.
- `--radius` should be set consistently through the installed shadcn theme conventions (proposed baseline `0.75rem`, adjust existing components carefully).
- Animation ~120–200 ms for lightweight state transitions; no looping attention effects. Respect `prefers-reduced-motion`.

## 4. Information architecture and global application shell

**Desktop:** fixed/collapsible left sidebar; compact top contextual header; content workspace with action toolbar. Maintain role-scoped existing routes and links; do not break deep links.

**Suggested navigation grouping (not an authorization to add new routes):**

- Workspace: Overview, Activities, Participant Monitoring.
- Operations: Evidence/Exceptions where already implemented.
- Secondary controls: Reports, Settings where authorized and present.
- Put Sign Out in account menu; preserve functionality and discoverability.
- Do **not** present `Filters` as a full primary navigation destination if filters logically belong to monitoring; preserve existing anchors/URLs if already in use.

**Mobile:** use a drawer or approved bottom navigation for key Participant destinations; include clear safe-area handling. Never simply compress desktop Dean/VPSAS tables to 360 px.

**Top bar:** page title + concise context + role + essential actions. The current paragraph about location reporting should become a compact info disclosure/help panel, not a prominent repeated banner; do not suppress its safety meaning.

## 5. Dean Operations Dashboard — recommended redesign

### 5.1 Desktop composition (12-column Bento grid)

```text
┌────────────── Sidebar ──────────────┬──────────────────────────────────────────────────────┐
│ MarSU OCATMS                        │ Dean / Monitoring             [Date] [Filters] [User] │
│                                    ├────────────┬────────────┬────────────┬────────────────┤
│ Overview                           │ Activities │ In transit │ Compliance │ Exceptions     │
│ Activities                         ├────────────┴────────────┴────────────┴────────────────┤
│ Participant Monitoring             │ Last Reported Locations [MAP]     │ Needs Attention │
│ Evidence / Exceptions (if present) │ participant markers + timestamps │ prioritized     │
│                                    │                              │ exception queue  │
│                                    ├──────────────────────────────┴──────────────────┤
│                                    │ Activities & Itineraries [search][filters][sort]  │
│                                    │ Dense accessible table / grouped timeline         │
│                                    ├───────────────────────────┬──────────────────────┤
│                                    │ Activity Trend            │ Compliance Summary   │
│                                    └───────────────────────────┴──────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Responsiveness:** at ≥1280 px map 8 columns, exception rail 4; at ~1024 map 7/5 or stack based on usable space; at 768 stack map/queue; at 360/390 one column, replace table with details/list cards as appropriate. Never hardcode a grid that overflows.

### 5.2 KPI strip

- Display 3–4 concise high-value metrics (`Active Activities`, `In Transit`, `Compliance`, `Needs Attention`) with consistent height and distinct informational priority.
- Move secondary metrics to contextual panels, not six equal promotional cards.
- Preserve definitions. Distinguish `UPCOMING` vs `ACTIVE` and `NO ELIGIBLE MILESTONES` vs `0%` vs `—`; never divide by zero or portray 0/0 as a real compliance percentage.
- Show denominator, timeframe and filter scope in tooltips or accessible detail where meaningful.

### 5.3 Actionable exception panel

- Highest priority: genuinely overdue milestones, geofence exceptions, low GPS accuracy, missing required evidence, and failed submissions.
- Rows show participant, activity, exception type and timestamp; selecting opens authorized detail.
- If there are no exceptions: `No exceptions in this view` (based on authorized data). Do not invent severity labels.

### 5.4 Filtering redesign

- Primary compact toolbar: activity selector/search, date range, status, `More filters` (`Sheet` on desktop/mobile if appropriate), `Clear`.
- Secondary panel: participant, travel, arrival, checkout and evidence statuses, exceptions-only, advanced audit controls only if authorized.
- Use shadcn `Select`, `Popover`, `Command`, `Calendar`, `Sheet`, `Checkbox`, `Badge`, `Button` as appropriate; reuse installed versions.
- Active filter chips should be removable individually; reflect server/query state and role-scoped permissions.
- No two full-width Apply/Clear buttons stacked beneath a long form on desktop. If server-side Apply is needed, keep it in the sheet footer; do not silently change filtering semantics.
- Synthetic-record controls must be reviewed as restricted audit tooling, not casually exposed to Dean monitoring.

### 5.5 Activities table

- Priority columns: Activity, Dates, Stage/Status, Participants, Exceptions, Open/Details; college shown when useful and authorized.
- Activity title has strong hierarchy; supporting metadata compact; dates formatted legibly (`Nov 8–13, 2026` rather than one digit per line).
- Use shadcn `Table` + existing TanStack Table if already present; sorting, column visibility, filter and pagination according to existing data API.
- Do not remove information: expose hidden columns through detail view or responsive table overflow with clear affordance.
- On narrow screens, switch to semantic activity list cards with explicit actions.

### 5.6 Charts

- Prefer actual charts over count-only table placeholders when multiple comparable records exist. Appropriate: monthly activity bar/line, status bar, milestone-compliance stacked bar, review exception trend.
- For only one category or one event, a compact labeled summary is often better than an empty/decorative pie chart.
- Use shadcn chart composition/Recharts only after verifying compatibility with installed version. Keep data accessible in text/table form.
- Filter scope, units, date periods and no-data messages must be clear. Never synthesize points to create visually appealing charts.

## 6. Signature component A — Travel Journey Timeline

**Audience:** Participant first; Dean/VPSAS in authorized drill-down.  
**Purpose:** Make multi-day activity legs understandable and actionable.

### Layout

- Group by itinerary day; each leg is a vertical node with transport icon (`ship`, `van`), `From → To`, planned date and real status.
- State hierarchy: `Not started`, `In transit`, `Arrived / Check-in pending`, `Checked in`, `Checked out`, `Exception` **only as supported by existing state machine**.
- One expanded current/relevant leg at a time; completed/past or future legs compact.
- Show `Start Travel`, `Update Location`, `Check In`, `Check Out` only when current permissions and business rules authorize each action.
- Photo capture and status remain integrated; never imply evidence was accepted before server confirmation.
- Display geofence, accuracy, timestamp and ETA in the expanded detail only when available.
- Optional progress indicator uses real milestone completion, not inferred route progress or continuous movement.

### Example visual structure

```text
DAY 1 · NOV 08                          [Not started]
  ○  Marinduque  ── Ship ──► Lucena
  │  Destination: Dalahican Port (if approved)
  │  [Start Travel]  (authorized only)
  ○  Lucena ── Van ──► Hotel

DAY 2 · NOV 09
  ○  Hotel ── Van ──► QC M.I.C.E. Center
```

The sample illustrates **presentation structure**, not actual travel, port confirmation or approved route data.

## 7. Signature component B — Location Intelligence Panel

**Audience:** Dean (college scope); VPSAS (university scope).  
**Purpose:** Spatial overview of **last reported**, not continuously live, locations.

### Desktop layout

- Large map with authorized participant markers and optional geofence/approved routes.
- Click marker/row to open contextual `Sheet`/side drawer; avoid permanently repeated full GPS cards below the map.
- Drawer fields: participant, activity, current leg, last reported coordinates/time, GPS accuracy, acquisition time, source, ETA if available, arrival/checkout status, evidence indicator, last refresh.
- Show location freshness derived from real report timestamps. Do not show `reported 0 seconds ago` if no fix exists; instead `No location reported` and a `—` age.
- If a last reported fix is stale, show recorded date/time plus `Stale`; avoid claiming current position.
- Always show map/list toggle and accessible list view for users who cannot use a map.
- Empty state: `No reported locations for the selected scope` with explanation, not invented markers.
- Ensure route/geofence coordinates are verified; do not geocode ambiguous hotel names silently.
- Use the existing routing/map provider unless separately approved for change.
- Polling/SSE/realtime updates are **dashboard refresh mechanisms**, not a promise of background GPS from mobile browsers.

## 8. Signature component C — Evidence Inspector

**Audience:** Authorized Dean/VPSAS reviewers.  
**Purpose:** Review arrival/check-out evidence and immutable metadata quickly and safely.

### Desktop split workspace

- Left ≈ 60%: secured photo preview, ability to inspect original/stamped derivative where authorization permits, placeholder if absent.
- Right ≈ 40%: participant/activity/leg; event type; GPS acquisition and server receipt timestamps; accuracy; geofence validation; digest/hash metadata; review status; exception indicators; existing authorized review actions.
- Keep `Arrival Evidence` and `Check-out Evidence` distinctly labeled. Missing one must not imply the other was completed.
- Use `Tabs`, `ScrollArea`, `Badge`, `Separator`, `Dialog`, `Skeleton` only where installed/appropriate.
- Preserve protected object access; never make evidence public or expose raw storage keys.
- On mobile, photo area precedes metadata/review panel, both scrollable and accessible.
- Preserve original evidence, stamped derivative, hashes, server receipt and audit semantics. No destructive image transformations.

## 9. Screen patterns and reusable components

| Component | Suggested shadcn primitive | UX behavior |
|---|---|---|
| App shell | `Sidebar`, `Sheet`, `DropdownMenu`, `Separator` | Role-scoped navigation; existing routes preserved |
| KPI strip | `Card`, custom metric typography, `Tooltip` | Real values, denominators and concise labels |
| Filters | `Select`, `Popover`, `Command`, `Sheet`, `Calendar`, `Badge` | Compact toolbar + expandable filters |
| Activities | `Table`, existing TanStack integration | Sorting/filtering with server authorization |
| Monitoring map | Existing map library + `Sheet`, `Tabs`, `Skeleton` | Last reported locations, list alternative |
| Journey timeline | Existing state logic + custom timeline composition | Current leg expanded; clear state transitions |
| Evidence inspector | `Tabs`, `Dialog`, `ScrollArea`, `Separator` | Private evidence and immutable metadata |
| Dashboard charts | Existing Recharts/shadcn chart if compatible | True data, chart labels and table fallback |
| Wizard forms | Existing form state + `Form`, `Progress`, `Button` | Retain all fields and validation |
| Alert feedback | `Alert`, existing Sonner/Toast if present | Useful recoverable error messaging |

No new library is mandatory. Prefer style composition on existing primitives. Shadcn/UI code is project-owned: check current customizations before updating any component.

## 10. Copywriting and anti-AI-slop specification

**Voice:** institutional, direct, neutral, accurate. UI copy should tell users **what this shows** or **what to do next**, not advertise the app.

| Current/undesirable | Replacement / handling |
|---|---|
| `Monitoring overview` | `Overview` or `Activity Monitoring` according to location |
| `REFINE RECORDS` | Remove eyebrow; use `Filters` in sheet/button |
| `AUTHORIZED RECORDS` | Remove redundant label; authorization is enforced, not marketed |
| `ITINERARY-LINKED EXCEPTION AND MILESTONE VIEW` | `Participant Monitoring` |
| `Fix age: reported 0 seconds ago` with no fix | `Last reported: None` and `Age: —` |
| `Check-in compliance — (0/0)` | `Not applicable` + `0 eligible milestones` where supported |
| `No matching records in the selected scope` repeated | `No records for these filters` with relevant reset action |
| `Include synthetic test records (audit review)` | Remove from routine interface; retain only if approved and authorized for audit |
| `Locations are last-reported fixes, not live positions or proof of safety...` | Keep substance in concise contextual info/help; do not imply safety assurances |

Never remove GPS/geofence warnings, camera permissions, check-in/out instructions, essential evidence requirements, meaningful error recovery, privacy terms or accessibility labels. No fake participants, metrics, alerts, trend data, or ``live`` badges without true semantics.

## 11. Interaction states

For every screen: loading, empty, success, invalid input, permission denied, stale GPS, out-of-geofence, missing evidence, offline/delayed submission, expired session, forbidden role scope, and retry behavior where relevant. Component states must map to **actual backend status**, not locally invented placeholder outcomes. Labels and feedback must remain accessible when color alone is unavailable.

## 12. Responsive, accessibility and performance gates

- Breakpoint test widths: 360, 390, 768, 1024 and 1440 CSS px; additionally test narrower/zoomed states where practical.
- WCAG 2.2 AA target: color contrast, keyboard operability, meaningful focus indicator, explicit labels, noncolor status, adequate target size, reflow and reduced motion.
- Poppins weights and asset loading must not cause cumulative layout shift; verify build/offline behavior.
- Chart interaction and map interaction must provide accessible summaries or list alternatives.
- Avoid full-width filter panels, tables with clipped dates, overflowing sidebar and giant unscannable metadata cards.
- If measured, aim for Core Web Vitals at p75: LCP ≤2.5s; INP ≤200ms; CLS ≤0.1.
- Avoid dramatic page transitions, heavy animation libraries or excessive blur on GPS/photo-critical screens.

## 13. Implementation protocol for VS Code Copilot Agent

**Required sequence:**

1. **Audit:** Inspect `package.json`, `components.json`, app routes, globals CSS, font setup, current `Sidebar`, `Card`, `Table`, chart, participant and evidence components. Capture baseline screenshots if tools permit.
2. **Inventory:** Build a screen-to-route-to-component map and identify actual backends/hooks powering every visible metric and action. Include current UI-copy inventory.
3. **Plan:** Show a before/after component matrix, file-change list, dependencies, regression risks, and approval gates. **Stop for approval before editing.**
4. **Implement in narrow batches:** (A) tokens/Poppins/shell; (B) overview/KPIs/filters; (C) activities/charts; (D) participant timeline; (E) map panel; (F) evidence inspector and copy cleanup.
5. **Verify each batch:** `git diff`, existing test suite, typecheck, lint, build, UI regression and role-scope tests; manually inspect 360/390/768/1024/1440 widths. Mark skipped checks `Not Run`.
6. **Review:** Summarize files changed, visuals, behaviors retained, tests executed, risks and unresolved issues. Request approval before subsequent batches.

**Prohibited shortcuts:** Rebuild the app, change APIs or schemas, fake a map/metrics, introduce real-time GPS assumptions, suppress runtime errors via CSS, delete synthetic data, alter auth/RBAC, migrate Supabase, or deploy to production during this design phase.

## 14. Acceptance checklist

- [ ] Dean dashboard no longer consists primarily of six equal KPI cards and a huge filter form.
- [ ] Clear asymmetrical Bento hierarchy prioritizes location and actionable exceptions.
- [ ] Filters are usable, compact, keyboard-operable and reflect actual query semantics.
- [ ] Poppins used consistently without readability or layout regressions.
- [ ] MarSU maroon `#660033` anchors brand without overwhelming the interface.
- [ ] Long activity dates and participant names are readable without broken table layout.
- [ ] Charts represent real authorized data with correct zero/empty states.
- [ ] GPS UI never shows a fake `0 seconds ago` when no location was reported.
- [ ] Synthetic-record audit UI is not casually exposed in routine monitoring.
- [ ] Three signature components are implemented or explicitly scoped/approved.
- [ ] Arrival and explicit checkout evidence flows remain independent.
- [ ] Role scope, GPS, photo access, routes, and APIs unchanged.
- [ ] No unnecessary AI-generated marketing language or redundant UI subtitles remain.
- [ ] Accessibility, responsive and functional tests documented with actual results.
- [ ] No changes to production records or deployment without separate approval.

## 15. Reference documentation

- shadcn/ui semantic theme tokens: https://ui.shadcn.com/docs/theming
- shadcn/ui component configuration: https://ui.shadcn.com/docs/components-json
- shadcn/ui Sidebar patterns: https://ui.shadcn.com/docs/components/sidebar
- shadcn/ui Chart documentation: https://ui.shadcn.com/docs/components/chart

**Final instruction to Copilot:** This file is the visual system and review checklist, **not** permission to change functionality. Audit first, propose targeted redesigns, and seek approval before edits.
