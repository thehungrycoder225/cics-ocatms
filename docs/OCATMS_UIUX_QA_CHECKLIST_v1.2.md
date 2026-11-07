# MarSU OCATMS — UI/UX QA & Release Checklist v1.2

**Use:** Record Pass / Fail / Blocked / Not Run, device/browser, evidence link, and issue owner for each item. An unchecked item is not a pass.

## 1. Baseline
- [ ] Repository, versions and dependencies inspected
- [ ] Existing UI components and routes inventoried
- [ ] Baseline screenshots at 360, 390, 768, 1024, 1440 px captured
- [ ] Existing test results and known issues recorded

## 2. Visual design
- [ ] Tokens and typography consistent across Participant, Dean and VPSAS
- [ ] Loading, empty, error, stale GPS, low accuracy and pending evidence states clear
- [ ] Status never conveyed by color alone
- [ ] Responsive tables, cards and chart legends readable
- [ ] Existing institutional identity preserved

## 3. Animation
- [ ] Motion does not block GPS or photo actions
- [ ] prefers-reduced-motion respected
- [ ] No unwanted layout shifts or excessive animation
- [ ] Loading feedback is timely and accurate

## 4. Wizard forms
- [ ] All original fields remain available
- [ ] Back/Next and step validation work
- [ ] Prior-step edits do not silently lose data
- [ ] Review/submit preserves approval logic
- [ ] Keyboard and screen-reader behavior verified
- [ ] Small single-action forms remain simple

## 5. Functional regressions
- [ ] Participant sees only own activities/evidence
- [ ] Dean sees only authorized college data
- [ ] VPSAS sees authorized university-wide data
- [ ] Start Travel records GPS accuracy and trusted timestamp
- [ ] ETA remains an estimate, not a live location claim
- [ ] Arrival check-in retains fresh GPS, geofence and evidence
- [ ] Check Out remains a separate immutable event with fresh GPS and photo
- [ ] Dwell duration calculated from recorded check-in/check-out times
- [ ] Original and stamped evidence preserved and privately authorized
- [ ] Offline/delayed submissions are visibly distinguished where supported
- [ ] No fabricated location or verified evidence displayed

## 6. Mobile / PWA
- [ ] 360 and 390 px portrait screens have no horizontal page overflow
- [ ] Primary controls are reachable and comfortably touch-sized
- [ ] Camera and GPS permission denial paths tested
- [ ] Low GPS accuracy and upload failure paths tested
- [ ] PWA manifest and service worker still work
- [ ] Sensitive evidence and API data not cached publicly
- [ ] Android browser and installed PWA behavior verified

## 7. Accessibility / performance
- [ ] WCAG 2.2 AA audit completed
- [ ] Keyboard navigation and visible focus work
- [ ] Labels, errors and announcements are accessible
- [ ] Contrast and reduced-motion verified
- [ ] LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at p75 where measured
- [ ] Heavy charts/maps lazy-loaded where appropriate
- [ ] Images optimized without altering original evidence

## 8. Release gate
- [ ] Lint, typecheck and test results attached
- [ ] Production build passes
- [ ] Vercel preview checked
- [ ] Before/after screenshots reviewed
- [ ] Functional requirement traceability maintained
- [ ] Open failures and limitations documented
- [ ] Explicit approval recorded for any proposed non-visual change

## Test log template
| Test ID | Device/viewport | Result | Evidence | Owner | Notes |
|---|---|---|---|---|---|
| QA-001 | Android 390px | Not Run | — | — | Participant check-out |
