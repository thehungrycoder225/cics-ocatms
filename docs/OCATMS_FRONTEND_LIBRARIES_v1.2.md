# MarSU OCATMS — Frontend Libraries & Compatibility Guidance v1.2

## Principles
This is a **recommendation matrix**, not evidence that dependencies are installed. Inspect `package.json`, lockfile, React/Next.js versions, bundling, existing component architecture, and licensing before installation. Prefer existing compatible libraries. Pin and test versions through the project's package manager.

| Area | Preferred option | Alternative / caution | Implementation rule |
|---|---|---|---|
| Components | shadcn/ui with Radix primitives | Existing design system | Adopt selectively; avoid duplicated primitives |
| Animation | Motion for React (`motion`) | Existing CSS animations | Respect reduced motion; lazy-load where practical |
| Charts | Recharts + shadcn/ui Chart | Existing chart library, visx | Verify React/Next compatibility and chart performance |
| Forms | React Hook Form + Zod | Existing form validator | Preserve server validation and API contracts |
| Tables | TanStack Table | Existing table solution | Server pagination/filtering for large datasets |
| Icons | Lucide React | Existing icon set | One coherent icon family |
| Notifications | Sonner | Existing toast solution | Announce errors accessibly |
| Map | Existing approved Maps/Routes provider | No unapproved migration | Preserve geofence and ETA semantics |
| Testing | Playwright + Testing Library + axe-core | Existing test stack | Test core RBAC and GPS flows |

## Implementation cautions
- shadcn/ui is source-owned component code, not a drop-in themed runtime. Review generated component changes.
- Motion for React may require client components. Avoid turning entire Next.js layouts into client components.
- Recharts can be heavy; dynamic import for chart-only views when appropriate and provide table fallbacks.
- React Hook Form client validation complements, but never replaces, server validation.
- Browser geolocation and camera APIs require HTTPS, permissions, and robust error handling.
- Never cache sensitive evidence, tokens, or private API responses in the service worker.
- Preserve existing storage, authentication, database, and Vercel integration.

## Verification checklist
1. Record installed versions and existing alternatives.
2. Verify package compatibility and bundle-size impact.
3. Run dependency vulnerability and license checks.
4. Prototype on one low-risk screen before broad rollout.
5. Test hydration, SSR/client boundaries, accessibility, reduced motion, and mobile performance.
6. Document rationale for every new dependency.

## Research note
2026–2027 design trend labels are provisional. Validate against contemporary product examples and official library documentation during implementation; never make a trend a functional requirement.
