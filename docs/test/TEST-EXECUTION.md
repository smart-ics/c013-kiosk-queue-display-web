---
Title: Kiosk SEP and SKDP Integration Test Execution
Code: KIOSK-SEP-SKDP
Feature: Kiosk BPJS self-registration integration with Jetli VClaim (Rujukan/SKDP reference selection, SEP create/upload, Bilreg eligibility) — see docs/analysis/KIOSK-SEP-SKDP-FEASIBILITY-ASSESSMENT.md (no formal FEATURE artifact exists for this capability)
ImplementationPlanStatus: COMPLETED
Tester: (human tester — to be filled)
ExecutionDate: 2026-09-28
Artifact: TEST-EXECUTION
---

# Entry Criteria

Testing requires:

- IMPLEMENTATION-PLAN with status COMPLETED — ✅ COMPLETED (docs/plans/KIOSK-SEP-SKDP-IMPLEMENTATION-PLAN.md, all 7 slices IMPLEMENTED/GO per RV-001)
- FEATURE — ✅ via FEASIBILITY-ASSESSMENT v1.6 (no formal FEATURE artifact found; assessment is the business-rule source for this capability)
- ARCHITECTURE — ✅ docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md v1.0
- TEST-PACKAGE — ✅ docs/test/TEST-PACKAGE.md v1.0

IMPLEMENTATION-PLAN is COMPLETED only when every slice has implementation
status IMPLEMENTED and review status GO. An individual slice with review status
GO is not sufficient to start testing.

# 1. Execution Summary

| Item | Value |
|--------|--------|
| Total Cases | 15 |
| Passed | 1 |
| Failed | 1 |
| Blocked | 0 |
| Not Tested | 13 |

---

# 2. Test Results

## TC-RE-01 — Non-BPJS (no-reference) registration still works

Status: PASS

Notes:

Registration completed normally for a no-reference patient; kiosk printed the
ordinary receipt. No BPJS reference selection screen, no SEP attempt, and no
admisi-fallback notice observed. Registration ID: RG01378140.

---

## TC-RE-02 — Successful SEP path prints the normal receipt, not the admisi notice

Status: FAIL

### Actual Result

Registration could not be completed because SEP creation failed. `POST /sep`
returned HTTP 400 Bad Request with body `{"status":"Bad Request","code":"400","data":"Invalid string date"}`.
The generated SEP payload contained `sepDate: "2026-02-11"` (date only). Example
payload captured at failure:

```json
{
  "sepId": "",
  "noPeserta": "0002776449115",
  "sepDate": "2026-02-11",
  "noRujukan": "030107010217Y001465",
  "pasienId": "337502200085623",
  "kelasRawatId": "1",
  "diagnosaId": "N40",
  "tujuanKunjunganId": "0",
  "flagProcedureId": "",
  "assesmentPelayananId": "",
  "penunjangId": "",
  "katarak": "0",
  "catatan": "Kiosk Self Registration",
  "kll": "0",
  "tglKLL": "",
  "noLaporanPolisi": "",
  "keteranganKLL": "",
  "propIdKll": "",
  "kabIdKll": "",
  "kecIdKll": "",
  "userId": "hidokkiosk"
}
```

### Expected Result

The SEP payload `sepDate` should be formatted as `yyyy-mm-dd hh:mm` (date plus
time), compatible with the Jetli VClaim `POST /sep` contract. SEP creation should
succeed, and the normal registration receipt with the SEP number should print,
without the admisi-fallback notice.

### Evidence

- Tester observed HTTP 400 with `data: "Invalid string date"` from `POST /sep`.
- Full request payload captured (see above): `sepDate: "2026-02-11"`.
- Source location (evidence only — no code change): `apps/kiosk-web/src/composables/useKioskRegistration.ts`
  line 908 passes `sepDate: businessDate.value ?? ''`, where `businessDate` is a
  date-only value (`yyyy-mm-dd`) obtained from `ensureBusinessDate()` /
  `deps.getBusinessDate()` (line 373-378). Jetli expects the `yyyy-mm-dd hh:mm`
  format for `sepDate`.

---

## TC-HP-01 — Rujukan flow completes end to end

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-HP-02 — SKDP flow completes end to end

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-HP-03 — Multiple references require an explicit choice that is honored

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-BR-01 — Rujukan registration uses the mapped local RujukanId, never the BPJS number

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-BR-02 — SKDP registration skips PPK lookup and uses DATANG SENDIRI

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-BR-03 — SEP payload differs correctly by reference type

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-BR-04 — BPJS class does not change the rawat jalan service type

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-BR-05 — Booking and walk-in paths apply the same reference rules

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-VAL-01 — Missing diagnosis stops the flow safely (no Z00.0 fallback)

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-VAL-02 — Missing/incompatible required reference fields are rejected

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-ERR-01 — SEP-create failure never re-creates and routes to admisi preserving the registration

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-ERR-02 — SEP-upload failure retries at most three times then falls back

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-ERR-03 — Eligibility-update failure retries at most three times then falls back

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-ERR-04 — Unknown SEP-create outcome does not trigger a blind second create

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-ERR-05 — Recovery never creates a second registration

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-REG-01 — No kiosk endpoint/action creates an SKDP

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-REG-02 — No stale "cancel / late-result" stuck states in the surrounding flow

Status: NOT TESTED

Notes:

(awaiting execution)

---

## TC-REG-03 — No development-only print/download behavior in the production path

Status: NOT TESTED

Notes:

(awaiting execution)

---

# 3. Defects

## DEF-001

Related Test Case:

TC-RE-02

Severity:

MAJOR

Actual Result:

`POST /sep` returns HTTP 400 `{"status":"Bad Request","code":"400","data":"Invalid string date"}` because the generated SEP payload sends `sepDate` as a date-only string (`"2026-02-11"`). Registration cannot complete on the BPJS reference path; no receipt prints.

Expected Result:

`sepDate` must be formatted as `yyyy-mm-dd hh:mm` (date plus time) as required by the Jetli VClaim `POST /sep` contract, so SEP creation succeeds and the normal receipt with SEP number prints.

Evidence:

- Payload captured during test: `sepDate: "2026-02-11"` (full JSON recorded in TC-RE-02).
- Reproducible on the Rujukan reference path (TC-RE-02); expected on the SKDP path as well since both go through `buildSepPayloadPolicy`.
- Source location: `apps/kiosk-web/src/composables/useKioskRegistration.ts` — `buildSepPayloadPolicy` input `sepDate` is filled at line 908 from `businessDate.value ?? ''`, where `businessDate` is date-only (`yyyy-mm-dd`) via `ensureBusinessDate()` (lines 373–378).

# 4. Recommendations

Open Issues:

- DEF-001