---
name: ocatms-ui-refinement
description: "Use for MarSU OCATMS repository audits, UI/UX refinement, dashboard or participant workflow changes, accessibility, and regression review. Enforces Audit → Propose → Approve → Implement → Test → Review while preserving approved system behavior."
---

# OCATMS UI Refinement

Use this workflow for OCATMS interface audits and implementation. The skill does not authorize later milestone phases, production changes, or data cleanup.

## Non-negotiable invariants

Before any work, consult the relevant project locks and checklist:

- [OCATMS Master Lock](../../../docs/OCATMS_MASTER_LOCK_v1.1.md)
- [UI/UX Master Lock v1.4](../../../docs/OCATMS_UIUX_MASTER_LOCK_v1.4.md)
- [UI/UX QA Checklist](../../../docs/OCATMS_UIUX_QA_CHECKLIST_v1.2.md)
- [Frontend Libraries guidance](../../../docs/OCATMS_FRONTEND_LIBRARIES_v1.2.md)

Preserve Participant, college-scoped Dean, and university-wide VPSAS access; approved workflows and API/data contracts; itinerary, ETA, travel-session, GPS, geofence, check-in and explicit check-out semantics; original and stamped evidence, review and audit records; privacy controls; and mobile PWA behavior. Faculty-in-Charge remains an activity assignment. Never introduce continuous background GPS tracking, fabricate records or metrics, or call a last-reported fix live location.

## Required sequence

### 1. Audit
- Inspect relevant routes, components, server logic, tests, design tokens, installed dependencies, and current documentation before proposing edits.
- Trace related authorization, data/API boundaries, and workflows; do not infer missing functionality from one screen.
- Record existing behavior and distinguish verified facts from assumptions. Identify regressions and unrelated existing defects separately.

### 2. Propose
- Describe the specific change, affected files/surfaces, expected behavior, preservation risks, and focused validation plan.
- Prefer a small reversible batch and existing libraries. Do not install a library before checking for compatible existing functionality and the project guidance.
- For copy cleanup, report `File → Component → Current Text → Proposed Text → Reason → Risk`; retain essential policy, privacy, safety, permission, error, and accessibility language.

### 3. Approve
- Stop before application-code changes and request explicit approval for the proposed batch.
- Approval is limited to the approved scope. It does not authorize a later phase, schema/API/RBAC/infrastructure change, production deployment, or data deletion.
- If approval is absent, continue only with read-only audit/report work.

### 4. Implement
- Make only approved changes; preserve existing business logic, API contracts, data relationships, and authorization boundaries.
- Use MarSU tokens and accessible hierarchy; avoid decorative or generic UI that does not aid an operational task.
- Use authorized, real data for dashboards. Provide clear loading, empty, stale, permission, and error states where relevant.
- Keep check-in and check-out separate. Do not simulate successful GPS, camera, or evidence submission.

### 5. Test
- Run the smallest relevant existing tests, then applicable checks from the repository: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- For UI changes, validate affected role workflows, responsive layouts (360, 390, 768, 1024, 1440 px as applicable), keyboard/focus, screen-reader semantics, and `prefers-reduced-motion`.
- Verify GPS/camera denial, accuracy/geofence exceptions, evidence failures, and retry behavior when those surfaces change.
- Do not access or modify production data for UI work. Report every unrun check as `Not Run`; do not infer success from type-checking or a build alone.

### 6. Review
- Review the final diff for scope, regressions, accessibility, and unintended changes.
- Report phase, status, files inspected/modified, changes, preserved behavior, tests and actual results, outstanding issues, and any approval needed.
- Do not claim a deployment, data cleanup, or release occurred unless it was explicitly authorized and verified.
