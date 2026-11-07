# MarSU OCATMS Copilot Instructions

## Project constraints
- Read the applicable requirements before changing behavior or UI: [Master Lock](../docs/OCATMS_MASTER_LOCK_v1.1.md), [UI/UX Master Lock v1.4](../docs/OCATMS_UIUX_MASTER_LOCK_v1.4.md), and [UI/UX QA checklist](../docs/OCATMS_UIUX_QA_CHECKLIST_v1.2.md).
- Preserve the three primary roles (Participant, college-scoped Dean, university-wide VPSAS); Faculty-in-Charge is an activity assignment, not a primary role.
- Preserve existing workflows, API contracts, database relationships, authorization, GPS semantics, geofencing, check-in/check-out distinction, evidence integrity, audit trails, and PWA privacy.
- Never add continuous background GPS tracking, fabricate locations/statistics/evidence, or present a last-reported fix as live location.
- Do not alter production data, run destructive cleanup, change infrastructure, or add dependencies without explicit approval.

## Change workflow
- For milestone or multi-file work, follow the OCATMS skill workflow: **Audit → Propose → Approve → Implement → Test → Review**. Stop at the approval gate; approval for one phase does not authorize later phases.
- Make small, focused changes. Reuse existing components and dependencies; inspect `package.json` and the established implementation before proposing additions.
- Keep UI copy concise and operational. Preserve essential privacy, safety, permission, error, and accessibility text. Use established MarSU tokens and accessible semantic states.
- For UI changes, verify relevant responsive, keyboard, reduced-motion, loading/empty/error, and role-scope behavior. Never claim a check passed unless it was run; report unavailable checks as `Not Run`.

## Validation commands
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Follow the repository patterns in `src/`, `db/`, and `tests/`. Do not run database migrations or seed scripts as a substitute for tests; they require an explicitly configured database and authorization.
