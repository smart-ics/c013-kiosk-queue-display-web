# SDD Progress — Kiosk Media Info Layanan RS

Plan: docs/superpowers/plans/2026-08-06-kiosk-media-info.md
Branch: feature/kiosk-self-registration
Started: 2026-08-06

## Tasks
- [x] Task 1: Add mediaInfoDir to app-config schema
- [x] Task 2: Directory listing loader
- [x] Task 3: useKioskMediaInfo composable
- [x] Task 4: Wire media panel into KioskHome.vue
- [x] Task 5: Example media directory + config wiring
- [x] Task 6: Full verification gate

## Ledger
- Task 1: complete (commit 1ded8bd, review clean)
- Task 2: complete (commit d642362, review clean; deviations resolveHref/afterEach deemed necessary)
- Task 3: complete (commit 979c947, review clean)
- Task 4: complete (commit 60cceba, review clean)
- Task 5: complete (commit e5e5489, review clean)
- Task 6: complete (gate run; see Verification results below)
- Final whole-branch review: "With fixes" — 1 Important (stale-fetch race) + minors
- Fix commit: 1aa4fb0 (guard stale media playlist fetches), re-reviewed Approved
- Docs commit: e22a554 (plan + spec)

## Verification results (Task 6)
- `pnpm turbo run typecheck test` — turbo's parallel run hit a Node heap OOM on this machine; re-ran every package individually.
- Typecheck: PASS all 9 packages (kiosk-web vue-tsc incl. new files).
- Tests: PASS except display-web `infrastructure.spec.ts` (3 fails, PRE-EXISTING — `getAdmissionQueueHubUrl` reads configService since fe200766, its test still expects import.meta.env; untouched by this plan).
- Prettier: all plan-touched files already clean.
- Committed docs (plan+spec); prettier install (package.json/pnpm-lock) left uncommitted per controller decision.

## Minor findings roll-up (post-final-review state)
- RESOLVED: stale-fetch race (1aa4fb0 token guard + regression test); default loadList integration test added
- LEFT (documented, non-blocking): mediaDirectory.ts:16 origin-relative normalize/scheme-absolute-href edge; untested .ogv + resolveHref absolute-scheme branch + resolveMediaDirUrl empty dir; `pending` returned but unused; KioskHome.spec await nextTick nit; video a11y aria-hidden optional
