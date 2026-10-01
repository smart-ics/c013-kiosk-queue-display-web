---
Title: Kiosk SEP and SKDP Integration Test Package
Code: KIOSK-SEP-SKDP
Artifact: TEST-PACKAGE
Version: 1.0
LastUpdated: 2026-09-28
Plan: c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-IMPLEMENTATION-PLAN.md
Architecture: c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md
Feasibility: c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT.md
---

# 1. Purpose

This package verifies, as a whole, that the kiosk BPJS self-registration flow
correctly handles participant Rujukan/SKDP references, rawat jalan registration,
SEP creation and upload, eligibility recording, and the admisi fallback that
protects an already-created registration. It covers the completed feature only;
it does not test parts of the kiosk outside this feature.

The package is written for a human tester. It describes what must be tested and
what must be observed. A person with knowledge of the kiosk screen flow and the
dev environment can execute it; deep technical knowledge of the code is not
required. Where a check needs database or API access, the package says so and
states the exact value to look for.

# 2. Scope of Testing

## Included (verified by this package)

- Reading participant, Rujukan, and active SKDP data from Jetli.
- Selecting a Rujukan or SKDP reference with the reference type preserved.
- Rujukan registration: PPK-to-local-Rujukan mapping before registration.
- SKDP registration: no PPK lookup; empty local `rujukanId` and `caraMasukDkId = "8"` (DATANG SENDIRI).
- SEP creation payload per reference type (Rujukan standard outpatient; SKDP control values).
- One-time SEP creation (no automatic re-create).
- SEP upload retried at most three times; eligibility update retried at most three times.
- Post-registration admisi fallback preserving `regId`, with the special print notice.
- Normal SEP printing unchanged when SEP processing succeeds.

## Excluded (must NOT happen; guarded by regression checks)

- Kiosk-initiated SKDP creation.
- Second registration or second SEP during recovery.
- Using a BPJS Rujukan/SKDP number as the Bilreg local `rujukanId`.
- Automatic diagnosis fallback to `Z00.0` when Jetli data is missing.

# 3. Environment and Preconditions

## Environment

| Item | Requirement |
|---|---|
| Kiosk app | `c013-kiosk-queue-display-web/apps/kiosk-web` running against the dev backends (see `global_config.json`; Jetli = `jetliApiBase`, Bilreg = `bilregApiBase`) |
| Jetli API | Dev deployment matching `b12-Jetli-JknTrustedLinkApi` (authoritative for Rujukan/SKDP/SEP) |
| Bilreg API | Dev deployment matching `b09-bilreg-api` (authoritative for registration, PPK mapping, eligibility) |
| Printer | A test printer or PDF print destination for kiosk ticket/receipt outputs |
| DB access (optional) | Read access to Bilreg devTest and Jetli dev DB, for the "database evidence" checks. If no DB access, use the kiosk screen and printed output plus API response logs |

## Preconditions

- The kiosk is displayed at its start (home) screen.
- The configured fallback service point (default admisi service point for booking-failure) is set in configuration.
- No stale kiosk session exists (start each test from the home screen; use the flow's cancel/home or restart the page between tests).
- Test BPJS participants (see section 4) exist in the dev Jetli/Bilreg environment and are active on the test date.
- At least one rawat jalan service with a schedule is available for the test date, so the kiosk can offer registration.

# 4. Required Test Data

The tester does not create these data. They must be prepared by the data owner
in the dev environment. The labels below are used throughout this package.

| Fixture | Label | Required characteristics |
|---|---|---|
| Participant with exactly one active BPJS Rujukan | PESERTA-RUJUKAN | One active Rujukan; the Rujukan's referring facility (`FaskesPerujuk.FaskesId`) is mapped to a local Bilreg `RujukanId` with `CaraMasukDkId`; Rujukan has a diagnosis |
| Participant with exactly one active SKDP (control letter) | PESERTA-SKDP | One active SKDP (not expired); no Rujukan; SKDP has a diagnosis |
| Participant with both an active Rujukan and an active SKDP | PESERTA-GANDA | Has at least one active Rujukan AND one active SKDP, so the kiosk must let the user choose |
| Participant with no active Rujukan/SKDP | PESERTA-TANPA-REFERENSI | No active Rujukan and no active SKDP (non-BPJS or no reference), used for regression of the ordinary non-BPJS path |
| Participant whose SKDP data is incomplete (missing diagnosis) | PESERTA-SKDP-TANPA-DIAGNOSA | SKDP record present but its diagnosis is blank/missing in the Jetli source — used for the validation-failure check. If not preparable, the equivalent check is done by an API/log simulation by a qualified person (see TC-VAL-01 note) |

While executing, record which fixture values (participant number, registration
ID, SEP number) are used so the database-evidence checks can look them up.

# 5. Execution Sequence

Run in this order. Each section can be executed independently, but later
sections assume the happy paths passed.

| Order | Group | Purpose |
|---|---|---|
| 1 | RE — Regression of the ordinary path | Prove the normal non-BPJS and successful-SEP paths are unchanged |
| 2 | HP — Happy Path | Prove both reference types complete successfully |
| 3 | BR — Business Rules | Prove reference-type-specific mapping and SEP payloads |
| 4 | VAL — Validation Rules | Prove missing data stops the flow safely |
| 5 | ERR — Error Handling / Recovery | Prove retries and the admisi fallback protect the registration |
| 6 | REG — Regression Risks | Prove excluded behaviors do not occur and prints stay correct |

# 6. Test Cases

Every test case has: Objective, Preconditions, Test Data, Steps, Expected Result.
Use the fixtures from section 4. Unless stated otherwise, "the flow" means: the
patient searches/selects the service, provides the BPJS participant, completes
biometric/underage steps where applicable, and proceeds to registration — exactly
the normal kiosk self-registration sequence.

---

## Group RE — Regression of the ordinary path

### TC-RE-01 — Non-BPJS (no-reference) registration still works

- **Objective:** confirm the existing ordinary registration path is not broken by this feature.
- **Preconditions:** kiosk at home screen; rawat jalan service available.
- **Test Data:** PESERTA-TANPA-REFERENSI (or a non-BPJS patient).
- **Steps:**
  1. Start self-registration and select a rawat jalan service.
  2. Confirm the patient has no BPJS reference to select.
  3. Complete registration and the print step.
- **Expected Result:** registration completes; the ordinary registration receipt/label prints; no BPJS reference selection screen is shown; no SEP is attempted; no admisi-fallback notice prints.

### TC-RE-02 — Successful SEP path prints the normal receipt, not the admisi notice

- **Objective:** confirm that when SEP processing succeeds, printing is unchanged (P3-S07 criterion).
- **Preconditions:** kiosk at home screen.
- **Test Data:** PESERTA-RUJUKAN or PESERTA-SKDP.
- **Steps:**
  1. Run the full happy-path flow with a successful SEP create/upload/eligibility.
  2. Observe the printed output.
- **Expected Result:** the normal registration receipt is printed (with SEP number when available); the queue ticket/admisi notice (`Berhasil Registrasi regid : ...`) is NOT printed; no fallback wording appears.

---

## Group HP — Happy Path

### TC-HP-01 — Rujukan flow completes end to end

- **Objective:** prove the full Rujukan-based self-registration succeeds.
- **Preconditions:** kiosk at home screen; Jetli and Bilreg reachable.
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Start the flow; select the BPJS participant with one Rujukan.
  2. Confirm the single Rujukan is selected automatically (auto-select), or offered and selected.
  3. Proceed through registration, SEP create, upload, and eligibility.
  4. Observe the printed receipt.
- **Expected Result:** flow reaches the success/printed state; receipt prints with the SEP number; no error screen; database evidence: one registration created (`RegId`), one SEP created, eligibility recorded against `RegId` (see section 8).

### TC-HP-02 — SKDP flow completes end to end

- **Objective:** prove the full SKDP-based self-registration succeeds.
- **Preconditions:** kiosk at home screen.
- **Test Data:** PESERTA-SKDP.
- **Steps:**
  1. Start the flow; select the BPJS participant with one SKDP.
  2. Confirm the single SKDP is selected automatically.
  3. Proceed through registration, SEP create, upload, and eligibility.
  4. Observe the printed receipt.
- **Expected Result:** flow reaches the success/printed state; SEP number prints; database evidence: registration created with empty local `rujukanId` and `caraMasukDkId = "8"`; one SEP created using the SKDP as its reference (see section 8).

### TC-HP-03 — Multiple references require an explicit choice that is honored

- **Objective:** prove the multi-reference selection is offered and the selected type controls the flow.
- **Preconditions:** kiosk at home screen.
- **Test Data:** PESERTA-GANDA (Rujukan + SKDP).
- **Steps:**
  1. Start the flow with this participant.
  2. Complete the registration steps TWICE: once choosing the Rujukan, once choosing the SKDP (use two fresh sessions/registrations).
- **Expected Result:** in the first run the Rujukan is chosen and the flow behaves exactly like TC-HP-01; in the second run the SKDP is chosen and the flow behaves like TC-HP-02; the selected reference type is visibly retained (e.g., in the reference review/confirmation step the chosen number and type are shown).

---

## Group BR — Business Rules

### TC-BR-01 — Rujukan registration uses the mapped local RujukanId, never the BPJS number

- **Objective:** verify the PPK-to-local-Rujukan mapping rule (TD-003/TD-004).
- **Preconditions:** as TC-HP-01.
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Run the Rujukan happy path.
  2. Database evidence: inspect the created registration's local `RujukanId` and `CaraMasukDkId`.
- **Expected Result:** the local `RujukanId` is the value returned by the Bilreg PPK mapping for the Rujukan's referring facility, and `CaraMasukDkId` equals that mapping's value; the BPJS `NoRujukan` is used ONLY as the Jetli SEP reference and never as the Bilreg local `rujukanId`.

### TC-BR-02 — SKDP registration skips PPK lookup and uses DATANG SENDIRI

- **Objective:** verify the SKDP local registration rule (TD-003: no PPK lookup; `rujukanId = ""`, `caraMasukDkId = "8"`).
- **Preconditions:** as TC-HP-02.
- **Test Data:** PESERTA-SKDP.
- **Steps:**
  1. Run the SKDP happy path.
  2. Database evidence: inspect the registration's local admission data.
- **Expected Result:** the registration was created with empty `rujukanId` and `caraMasukDkId = "8"` (DATANG SENDIRI); no Rujukan/PPK mapping request occurred for this participant (observable via API logs or by confirming no PPK mapping API call appears for this registration).

### TC-BR-03 — SEP payload differs correctly by reference type

- **Objective:** verify the reference-specific SEP payload policy (TD-005).
- **Preconditions:** as TC-HP-01 / TC-HP-02; API request-log access or Jetli DB access.
- **Test Data:** PESERTA-RUJUKAN and PESERTA-SKDP.
- **Steps:**
  1. Run the Rujukan happy path and capture the SEP-create request payload.
  2. Run the SKDP happy path and capture the SEP-create request payload.
- **Expected Result:**
  - Rujukan SEP payload uses the standard outpatient values (approved defaults; `NoRujukan` = `Rujukan.NoRujukan`; diagnosis from the Rujukan).
  - SKDP SEP payload uses the control visit: `tujuanKunjunganId = "2"`, `assesmentPelayananId = "5"`, empty `flagProcedureId`, empty `penunjangId`, empty `faskesPerujukId`, `NoRujukan` = the SKDP number, diagnosis from the SKDP.

### TC-BR-04 — BPJS class does not change the rawat jalan service type

- **Objective:** verify the outpatient/class semantics (GAP-002, OQ-001) observed from the kiosk behavior.
- **Preconditions:** as TC-HP-01, with a participant whose BPJS class is not empty.
- **Test Data:** PESERTA-RUJUKAN (any class).
- **Steps:**
  1. Run the Rujukan happy path with a non-empty class participant.
  2. Confirm the kiosk composes/requests a rawat jalan (outpatient) SEP.
- **Expected Result:** the kiosk behaves as rawat jalan regardless of BPJS class; no rawat inap behavior or prompt appears; the SEP request retains the patient's class as class data only.

### TC-BR-05 — Booking and walk-in paths apply the same reference rules

- **Objective:** verify shared rules across both kiosk entry paths (P2-S04/P2-S05 criteria).
- **Preconditions:** kiosk at home screen; a booking and a walk-in service available.
- **Test Data:** one Rujukan participant and one SKDP participant (or reuse PESERTA-RUJUKAN / PESERTA-SKDP in two runs).
- **Steps:**
  1. Complete a Rujukan registration via the booking path and via the walk-in path (two runs, fresh sessions).
  2. Complete an SKDP registration via the booking path and via the walk-in path (two runs, fresh sessions).
- **Expected Result:** in all four runs, the reference-type rules of TC-BR-01/02/03 hold identically; no difference in local mapping or SEP payload between booking and walk-in.

---

## Group VAL — Validation Rules

### TC-VAL-01 — Missing diagnosis stops the flow safely (no Z00.0 fallback)

- **Objective:** verify missing required Jetli data is a validation failure, not a silent default (GAP-001/OQ-003).
- **Preconditions:** Jetli returns a reference with missing/blank diagnosis (fixture PESERTA-SKDP-TANPA-DIAGNOSA, or an API/log simulation by a qualified person if the fixture cannot be prepared).
- **Test Data:** PESERTA-SKDP-TANPA-DIAGNOSA.
- **Steps:**
  1. Start the flow with this participant and attempt to use the SKDP reference.
  2. Observe the kiosk screen.
- **Expected Result:** the flow stops with a clear error/validation message (no SEP is created, no registration is created); `Z00.0` is NOT used as an automatic diagnosis; the participant is not sent to SEP creation with an invented diagnosis.

### TC-VAL-02 — Missing/incompatible required reference fields are rejected

- **Objective:** verify legacy-shape data (`tglMulai`, nested diagnosis aliases) is not accepted as a substitute for current Jetli fields.
- **Preconditions:** a reference response lacking current Jetli required fields is available via API/log simulation by a qualified person (network-level), or the fixture data lacks the required current field.
- **Test Data:** simulated/available incomplete reference data.
- **Steps:**
  1. Trigger reference retrieval/selection with the incomplete reference data.
  2. Observe the kiosk screen.
- **Expected Result:** the flow fails validation with a clear message; no registration/SEP is created; no invented default date or diagnosis is used.

---

## Group ERR — Error Handling / Recovery

### TC-ERR-01 — SEP-create failure never re-creates and routes to admisi preserving the registration

- **Objective:** verify one-time SEP creation and safe recovery (TD-006, GAP-005).
- **Preconditions:** the environment can force SEP-create to fail on the first attempt (e.g., Jetli business error) while registration succeeds; kiosk at home screen.
- **Test Data:** PESERTA-RUJUKAN (or PESERTA-SKDP).
- **Steps:**
  1. Run the flow up to the point where registration succeeds and SEP creation fails.
  2. Observe the kiosk screen and the printed output.
  3. Database evidence: confirm the registration exists; confirm no second SEP-create request was issued.
- **Expected Result:** the kiosk does NOT retry/create a second SEP; it keeps the same `RegId`; it enters the admisi fallback; the printed output is the special notice: `Berhasil Registrasi regid : <regId>` plus the instruction to go to admisi for document completion (`Silakan menuju Loket Admisi untuk penyelesaian berkas.`); the patient is routed to the configured default service point.

### TC-ERR-02 — SEP-upload failure retries at most three times then falls back

- **Objective:** verify the three-attempt upload limit and fallback.
- **Preconditions:** the environment can force SEP upload to fail repeatedly while registration and SEP creation succeed.
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Run the flow so that SEP upload fails each attempt.
  2. Observe the kiosk retry behavior and outcome.
- **Expected Result:** upload is attempted exactly three times, then the flow enters the admisi fallback; the same `RegId` and SEP are reused (no second SEP); the special print notice appears; no success state is shown.

### TC-ERR-03 — Eligibility-update failure retries at most three times then falls back

- **Objective:** verify the three-attempt eligibility limit and fallback.
- **Preconditions:** the environment can force Bilreg `Reg/setDataEligibility` to fail repeatedly while SEP create/upload succeed.
- **Test Data:** PESERTA-SKDP.
- **Steps:**
  1. Run the flow so that eligibility update fails each attempt.
  2. Observe the kiosk retry behavior and outcome.
- **Expected Result:** eligibility is attempted exactly three times, then the flow enters the admisi fallback; the same `RegId` is preserved; the special print notice appears.

### TC-ERR-04 — Unknown SEP-create outcome does not trigger a blind second create

- **Objective:** verify unknown-outcome recovery (GAP-005/OQ-009): no automatic re-create.
- **Preconditions:** the environment can produce an SEP-create request whose outcome is unknown/ambiguous (e.g., timeout, no confirmation).
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Run the flow so SEP create times out / returns an unknown outcome.
  2. Observe behavior; inspect for a second SEP-create request.
- **Expected Result:** no second SEP-create request is issued; the flow either reconciles via lookup or routes to the admisi fallback; the existing `RegId` is preserved; no duplicate SEP is created (database evidence).

### TC-ERR-05 — Recovery never creates a second registration

- **Objective:** verify the no-second-registration invariant across all recovery paths.
- **Preconditions:** any failing post-registration operation is forced (as in TC-ERR-01/02/03/04).
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Force a post-registration failure and let the flow reach the admisi fallback.
  2. Database evidence: count registrations/SEPs for this participant and date.
- **Expected Result:** exactly ONE registration and (where applicable) ONE SEP exist; the kiosk never created a second registration while recovering.

---

## Group REG — Regression Risks

### TC-REG-01 — No kiosk endpoint/action creates an SKDP

- **Objective:** verify the excluded behavior (no kiosk SKDP creation).
- **Preconditions:** as any happy-path test.
- **Test Data:** PESERTA-SKDP.
- **Steps:**
  1. Run the SKDP happy path.
  2. Inspect Jetli request logs for any `POST /api/Skdp` call originating from the kiosk.
- **Expected Result:** no SKDP-creation API call is made; the kiosk only consumes the existing SKDP data returned by Jetli.

### TC-REG-02 — No stale "cancel / late-result" stuck states in the surrounding flow

- **Objective:** verify the P0 stuck-flow guards (cancel search, cancel biometric, late-result invalidation) still behave correctly as a regression for this feature.
- **Preconditions:** kiosk at home screen.
- **Test Data:** none special (use any participant that triggers the patient-search and biometric steps).
- **Steps:**
  1. Start a patient search, then press Batal/cancel; wait beyond the point where the search would return.
  2. Start a biometric verification, then press Batal and go home; wait for any late verdict.
- **Expected Result:** after cancel, the kiosk returns home and a late result does not pull the user into a new step; after biometric cancel, the screen stays at home with no error; the flow remains usable for the next test.

### TC-REG-03 — No development-only print/download behavior in the production path

- **Objective:** verify the production build does not auto-download print images (AGENTS.md Print Development Mode Guidelines).
- **Preconditions:** production build of `kiosk-web` available (run `pnpm --filter kiosk-web run build` and serve `dist/`, or a deployed dev build without `import.meta.env.DEV`).
- **Test Data:** PESERTA-RUJUKAN.
- **Steps:**
  1. Run the happy path against the production build and print.
  2. Observe the browser/download dialog.
- **Expected Result:** no automatic browser download of `antrian_*.png` / `label_*.png` occurs; printing happens through the normal printer path only.

---

# 7. Result Recording

- Record every test case result as **PASS** (observed behavior matches Expected Result) or **FAIL** (any mismatch).
- For each FAIL record:
  - test case ID and date/time;
  - the exact step being executed;
  - what was observed (screen text, printed output, API/DB evidence) — copy the exact wording;
  - what was expected;
  - any evidence artifact (photo of the screen/print, log excerpt, DB query result).
- Do not change the system to make a test pass. A FAIL is reported as-is and flows to issue creation.
- Record results in the TEST-EXECUTION artifact (created during execution assistance).

# 8. Database Evidence Reference

These checks need read access to the dev databases or API logs. If access is not
available, state that in the result record so a qualified person can verify later.

| Check | Where | Expected value |
|---|---|---|
| One registration per flow | Bilreg devTest, registration for the participant+date used | exactly one `RegId` (except when the flow correctly fails before registration in VAL cases) |
| Rujukan local mapping | Bilreg registration row | local `RujukanId` = PPK-mapped value; `CaraMasukDkId` = mapped value |
| SKDP local mapping | Bilreg registration row | `rujukanId` empty; `caraMasukDkId = "8"` |
| One SEP per successful flow | Jetli dev DB, SEP for `RegId` | one SEP row; SEP visible in receipt |
| No duplicate SEP | Jetli dev DB | no second SEP for the same reference/registration |
| Upload/eligibility attempts | API logs or Jetli/Bilreg audit | at most 3 upload attempts; at most 3 eligibility attempts |
| Admisi fallback | Bilreg admission queue | fallback queue record at the configured default service point |

# 9. Traceability

| Test Case | Feasibility/Architecture reference | Plan slice |
|---|---|---|
| TC-RE-01, TC-RE-02 | OQ-006 (normal success unchanged); P3-S07 print criterion | P3-S07 |
| TC-HP-01, TC-BR-01, TC-BR-03(Rujukan), TC-BR-04, TC-BR-05(booking/walk-in) | GAP-001/002/005/010; OQ-001/005/011; TD-002/003/004/005 | P1-S01, P2-S03, P2-S04, P2-S05 |
| TC-HP-02, TC-BR-02, TC-BR-03(SKDP) | GAP-002/009/010/011; OQ-010/011; TD-003/005 | P2-S04, P2-S05 |
| TC-HP-03 | OQ-004/005/008; TD-002 | P2-S03 |
| TC-VAL-01, TC-VAL-02 | GAP-001/004; OQ-003; TD-001 (no silent fallback) | P2-S03 |
| TC-ERR-01..05 | GAP-005/006; OQ-006/009; TD-006/007 | P3-S06 |
| TC-REG-01 | GAP-003; OQ-002 (no kiosk SKDP creation) | P1-S01, P3-S07 |
| TC-REG-02 | P0 stuck-flow fixes around the feature | (surrounding regression) |
| TC-REG-03 | AGENTS.md Print Development Mode Guidelines | P3-S07 |

# 10. Notes for the Tester

- Run the tests in the order of section 5. If an earlier group fails, still record the result and continue to later independent groups so the failure set is complete.
- The exact BPJS rules are externally governed; the expected values in this package come from the approved decisions (feasibility OQ-001/006/009/010/011) and the plan notes.
- If a fixture cannot be prepared exactly (e.g., PESERTA-SKDP-TANPA-DIAGNOSA), state that in the result record and use the API/log simulation described in the test case, or mark the case as not executable and report it — do not guess a pass.