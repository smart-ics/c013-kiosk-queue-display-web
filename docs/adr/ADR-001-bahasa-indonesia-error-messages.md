# ADR-001: Bahasa Indonesia Error Messages for Kiosk Display

**Status:** Accepted
**Date:** 2026-09-02
**Deciders:** Kiosk frontend team

## Context

The KIOSK display (apps/kiosk-web) is deployed in Indonesian hospitals and used
by patients with varying levels of digital literacy. Backend errors come back
in English with technical codes (e.g. `AQ_RESOURCE_NOT_FOUND`), and many
catch-all handlers in the frontend showed raw `error.message` strings, leading
to user confusion, mistrust, and abandoned intake flows.

## Decision

1. **Localize all user-facing error messages to Bahasa Indonesia.** The kiosk
   is a patient-facing station in a hospital; English technical strings fail
   the user.

2. **Keep a strict technical/user boundary.** Backend codes (e.g. `AQ_*`) are
   *only* logged via `console.error`. Users see natural-language Indonesian
   strings with actionable next steps (e.g. "Coba lagi", "Hubungi administrator").

3. **Two-layer mapping:**
   - Layer 1 (`@aq/api-client`): Backend error codes → Indonesian strings
     (`AQ_ERROR_MESSAGES_ID`) + HTTP-status fallbacks
     (`HTTP_STATUS_MESSAGES_ID`) + raw `error.message` fallback. Exposed as
     `mapBackendErrorToUserMessage(error)`.
   - Layer 2 (`@kiosk-web/lib/failureCode`): App failure codes
     (`FAILURE_CODES`) → Indonesian strings (`FAILURE_MESSAGES_ID`). Exposed
     as `getFailureMessage(code)`.

4. **Single source of truth for catalogs.** Both catalogs live in
   `packages/api-client/src/errors.ts` and
   `apps/kiosk-web/src/lib/failureCode.ts`. No inline English strings
   in Vue components or composables.

5. **Action-oriented tone.** Every user-facing message includes a verb
   (Coba lagi / Hubungi administrator / Mulai ulang). The decision is
   **specific** over generic: e.g. "Nomor antrian untuk Service Point ini
   sudah habis hari ini" instead of just "Maaf, silakan hubungi petugas".

6. **Separate catalogs per concern.** Admission Queue errors and HIS/registration
   errors stay in separate maps (not a single merged dictionary), so
   domain boundaries remain clear.

7. **Login has special-case wording.** Since login failures cannot recover via
   the kiosk UI (the kiosk account is fixed), login exhaustion renders a red
   raw-HTML screen with a console hint — this is intentional and not localized
   in this PR.

## Consequences

### Positive

- Patients see clear, actionable Indonesian messages in every error path.
- Backend code changes that add new error codes surface a "fallback" message
  until a new mapping is added — preventing raw codes leaking to users.
- Layered architecture means `mapBackendErrorToUserMessage` can be reused
  by `display-web` and `config-web` in future (same `@aq/api-client`).

### Negative

- Every new backend error code requires adding a Bahasa Indonesia string.
- Two catalogs (`AQ_ERROR_MESSAGES_ID` + `FAILURE_MESSAGES_ID`) must stay in
  sync with backend constants and app failure codes.
- Indonesian translations require review by a native speaker before any
  production release.

## Alternatives Considered

- **Generic messages only ("Terjadi kesalahan, coba lagi")** — rejected;
  doesn't help users understand the actual problem.
- **Show technical codes to admin users** — rejected; this is a public kiosk,
  not an admin tool.
- **Single merged error catalog** — rejected; domain boundaries (Admission
  Queue vs HIS registration) would be lost.

## References

- Implementation: `packages/api-client/src/errors.ts`,
  `apps/kiosk-web/src/lib/failureCode.ts`,
  `apps/kiosk-web/src/composables/useKioskRegistration.ts`,
  `apps/kiosk-web/src/views/steps/WalkinServiceStep.vue`,
  `apps/kiosk-web/src/views/KioskPage.vue`,
  `packages/device-config/src/kioskApiProvider.ts`,
  `packages/device-config/src/provider.ts`
- Canonical doc: [docs/kiosk-canonical.md](../kiosk-canonical.md)
- Backend source: `b09-bilreg-api/src/bilreg/Bilreg.Api/Configurations/ErrorHandlerMiddleware.cs`
