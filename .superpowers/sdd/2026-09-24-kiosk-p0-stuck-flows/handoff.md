# Handoff — kiosk-web P0 Stuck-Flows Fix

> Created at 2026-09-24. Ready for continuation in a new session.

## Current State

**Branch:** `fix/kiosk-p0-stuck-flows` (fresh branch from main)

### Completed P0 Tasks

| Task | Commit | Status |
|------|--------|--------|
| P0-1: Force PATIENT_CONTEXT_SEARCH transition | `364bdd3` | ✅ Complete |
| P0-2a: Cancellable patient search + stale guard (booking branch) | `c9bd181` → `fb69c0e` | ✅ Complete |
| P0-2b: Guard biometric branch against late results | `fb69c0e` | ✅ Complete |
| P0-3: BiometricStep UI with Batal button | `bf82cbe` | ✅ Complete |
| P0-4: Invalidate in-flight biometric verdict | `5c16174` | ✅ Complete |

**Verification:**
- Tests: 219 passed
- Typecheck: clean
- Build: successful

---

## Pending Work

### Unresolved Question (from checkpoint)

**P1-1** Dual print/intake decision — **STALLED**  
The legacy `useKioskIntake` + `useKioskPrint` coexist with the new `useKioskSelfPrint`. User has **not** decided whether to:
- **Option A:** Keep both with clear state separation
- **Option B:** Migrate intake grid to `printQueueTicket`, remove legacy composables

Cannot proceed on P1 items until user makes this decision.

### P1-2 (`intakeAvailable` prop) — **NOT STARTED**
- File: `apps/kiosk-web/src/views/KioskHome.vue` (lines 16, 160-169)
- Change: wire `:disabled="pending || !intakeAvailable"` to the admission queue button
- TODO: add test case for `intakeAvailable=false` in `KioskHome.spec.ts`

### P2 Items — **NOT STARTED**
1. `KioskPage.vue:388-404` stepper missing `REGISTRATION_REPRINT` and `FAILURE` (add to `.includes()` array)
2. `useKioskRegistration.ts:162-171,570,586` — remove `as any` casts, add proper Zod schema

### P3 Items — **NOT STARTED**
1. Remove `startBookingFlow()` dead code (`useKioskRegistration.ts:272-277`)

---

## Key Files Modified

| File | Changes |
|------|---------|
| `src/composables/useKioskRegistration.ts` | Added `PATIENT_CONTEXT_SEARCH` transition, `patientSearchSeq`/`biometricSeq` token guards, stale-check placement |
| `src/lib/flow.ts` | Added `PATIENT_CONTEXT_SEARCH → BOOKING_CONFIRM` edge |
| `src/views/KioskPage.vue` | Rewired `BiometricStep` props, added cancel button on patient search |
| `src/views/steps/BiometricStep.vue` | Full rewrite with pending UI and Batal button |
| `src/views/__tests__/KioskPage.spec.ts` | Added cancel-late-results tests |
| `src/views/steps/__tests__/BiometricStep.spec.ts` | **NEW FILE** — 2 tests for pending UI |
| `src/composables/__tests__/useKioskRegistration.spec.ts` | Added cancel-token tests for booking and biometric flows |

---

## Git History

```
fix/kiosk-p0-stuck-flows
├── 5c16174 fix(kiosk-web): ignore late biometric verdict after home
├── bf82cbe fix(kiosk-web): interactive biometric pending UI with Batal
├── fb69c0e fix(kiosk-web): guard booking branch against late results after cancel
├── c9bd181 fix(kiosk-web): cancellable patient search with stale-result guard
└── 364bdd3 fix(kiosk-web): enter PATIENT_CONTEXT_SEARCH explicitly during patient search
```

---

## Quick Commands

```bash
# Run full test suite
pnpm --filter kiosk-web test

# Run typecheck
pnpm --filter kiosk-web run typecheck

# Build
pnpm --filter kiosk-web run build

# Run vitest UI (if browser available)
pnpm --filter kiosk-web exec vitest --ui
```

---

## Outstanding Dependency Fix

The `@vitest/ui@3.2.7` package was installed to fix `npx vitest --ui` startup error. If the UI mode still doesn't work, a browser is required to launch the interactive interface.

---

## Next Decision Required

User must decide on **P1-1** before proceeding with P1-2:
> **Keep legacy intake/print composables** (`useKioskIntake` + `useKioskPrint`) OR **migrate** to `useKioskSelfPrint`?

---

## Session Metadata

- **Working directory:** `E:/PROJECT/ICS/PROJECT-ACTIVE/kiosk-display-config/c013-kiosk-queue-display-web`
- **Plan file:** `docs/superpowers/plans/2026-09-24-kiosk-p0-stuck-flows.md`
- **Ledger:** `.superpowers/sdd/2026-09-24-kiosk-p0-stuck-flows/progress.md`
- **Task reports:** `.superpowers/sdd/2026-09-24-kiosk-p0-stuck-flows/task-*-report.md`