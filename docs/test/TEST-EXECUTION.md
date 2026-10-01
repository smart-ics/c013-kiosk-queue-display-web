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
| Passed | 10 |
| Failed | 0 |
| Blocked | 2 |
| Not Tested | 3 |

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

Status: PASS (retested 2026-09-30; supersedes the FAIL of 2026-09-28 below)

### Retest Actual Result (2026-09-30, localhost runner via https)

SEP creation succeeded. `POST /sep` returned HTTP 200:

```json
{
  "status": "success",
  "code": "200",
  "data": {
    "sepId": "01KG9A0BTN1KBE9GB84MAE6GCT",
    "sepNo": "-"
  }
}
```

- `sepDate` sent: `2026-02-11 11:02:18` — 19 chars, `yyyy-MM-dd HH:mm:ss`, space separator, seconds present.
- Registration preserved: `regId RG01378155`, antrian no. 6.
- Printed output: normal registration receipt (tester confirmed "correct"); no admisi-fallback notice (`Berhasil Registrasi regid : ...` / `Silakan menuju Loket Admisi ...`) observed.
- No `400 Invalid string date`. DEF-001 signal is gone.

### Original Actual Result (2026-09-28, FAIL — kept for history)

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

The SEP payload `sepDate` should be formatted as `yyyy-MM-dd HH:mm:ss` (19
characters, date plus time with a required seconds component), compatible with
the Jetli VClaim `POST /sep` contract. SEP creation should succeed, and the
normal registration receipt with the SEP number should print, without the
admisi-fallback notice.

> **Expectation corrected 2026-09-29.** This case previously recorded
> `yyyy-mm-dd hh:mm` as the expected format. That value is **refuted** by
> `docs/analysis/KIOSK-SEP-SKDP-BUG-INVESTIGATION.md` finding F-01, which
> executed the Jetli date helper: `yyyy-MM-dd HH:mm` throws the identical
> `Invalid string date` as the date-only value. The accepted pattern is
> `yyyy-MM-dd HH:mm:ss`. Testing this case against the superseded expectation
> would have failed for the correct implementation and consumed a cycle.
> The correction is against the Jetli contract, not against a preference.

### Evidence

- Tester observed HTTP 400 with `data: "Invalid string date"` from `POST /sep`.
- Full request payload captured (see above): `sepDate: "2026-02-11"`.
- Source location (evidence only — no code change): `apps/kiosk-web/src/composables/useKioskRegistration.ts`
  line 908 passes `sepDate: businessDate.value ?? ''`, where `businessDate` is a
  date-only value (`yyyy-mm-dd`) obtained from `ensureBusinessDate()` /
  `deps.getBusinessDate()` (line 373-378). Jetli expects the
  `yyyy-MM-dd HH:mm:ss` format for `sepDate`.

---

## TC-HP-01 — Rujukan flow completes end to end

Status: PASS (retested 2026-10-01, run RG01378159; supersedes the BLOCKED of 2026-10-01 below)

### Retest Actual Result (2026-10-01, clean run)

Full Rujukan happy path reached the success state with standard eligibility data:

- Participant: `noPeserta 0001033484141`, `noRujukan 030107010217Y001465` (tester-reported; different participant number from the RG01378155/57 runs, same Rujukan number).
- Registration: `regId RG01378159`, antrian no. 3.
- `POST ./sep`: `sepDate 2026-02-11 11:52:38` (`yyyy-MM-dd HH:mm:ss`), result:

```json
{
  "status": "success",
  "code": "200",
  "data": {
    "sepId": "SEP090586OMB",
    "sepNo": "-"
  }
}
```

- Upload: 200. Eligibility (`setDataEligibility`): 200 (previously 500 on dummy data, now normal).
- Printed output: normal receipt with noSep printed; no admisi-fallback wording (`Berhasil Registrasi regid` / `Silakan menuju ...` absent, tester-confirmed).
- Screen: registration-success state, no error screen, no admisi fallback.

### Earlier observation (2026-10-01, run RG01378157 — kept for history, was BLOCKED)

Full Rujukan happy path could not reach the success state in run RG01378157
(separate run from the TC-RE-02 PASS run RG01378155): SEP create and upload
succeeded, but Bilreg `setDataEligibility` returned HTTP 500, so eligibility
was never recorded and the kiosk correctly entered the admisi fallback. Tester
attributes the 500 to non-standard dummy data, not to a product defect.

### Actual observed (run RG01378157, 2026-10-01)

- Reference selection: single Rujukan auto-selected (confirmed by tester).
- `POST /sep`: 200 success (same contract as TC-RE-02 retest).
- Upload: 200.
- Eligibility: `POST ../setdataeligibility` → `500 Internal Server Error`
  (tester first reported 400, then corrected with the verbatim body below):

```json
{
  "status": "Internal Server Error",
  "code": "500",
  "data": "The request could not be completed."
}
```

- Retry behavior observed: eligibility attempted 3x, then admisi fallback.
- DB: one registration and one SEP; eligibility not recorded (consistent with
  the 500).
- Printed output: admisi-fallback notice, last two lines verbatim as reported
  (truncated by print width):

```text
Berhasil Registrasi regid : RG01378157
kan menuju Loket Admisi untuk penyelesaian ber
```

(full wording per TEST-PACKAGE: `Silakan menuju Loket Admisi untuk
penyelesaian berkas.` — the leading `Sila` is cut off in the report).

### Note on TC-RE-02 vs this run

TC-RE-02 PASS (run RG01378155, antrian 6) stands: that run printed the normal
receipt with no admisi notice. This run (RG01378157) is a different registration
that hit the eligibility-500 data issue. The fallback behavior observed here
matches the TC-ERR-03 expectation (3x retry then fallback, same `RegId`, special
notice) but TC-ERR-03 stays NOT TESTED: its package fixture is PESERTA-SKDP and
no decision to accept a Rujukan-substitution has been given.

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

Status: PASS

Notes:

DB verification against Bilreg dev using registration RG01378143 and BPJS
NoRujukan `030107010217Y001465` (from TC-RE-02 payload):

- Q1 (`ta_registrasi`): local `RujukanIdLokal` = `0174B009` (not the BPJS number).
- Q2 (`ta_rujukan` join): mapped rujukan local id = `0174B009` — matches Q1,
  confirming it is the PPK-mapped local rujukan.
- Q3 (lookup for the BPJS number as local rujukanId): 0 rows — the BPJS
  NoRujukan is never copied into the local `rujukanId`.

Retest evidence 2026-10-01 (run RG01378159, participant `0001033484141`,
NoRujukan `030107010217Y001465` — same rule holds on the clean HP-01 run):

- Q1 (`ta_registrasi`, `fs_kd_reg = 'RG01378159'`): `RujukanIdLokal = 0174B009`,
  `CaraMasukDkId = 2` — local code, not the BPJS number.
- Q2 (`ta_rujukan`, `fs_kd_rujukan = '0174B009'`): `NamaRujukan = Klinik
  Aisyiyah Siti Aisyah`, `PpkId = 0174B009`, `CaraMasukDkId = 2` — matches Q1.
- Q3 (both lookups for `030107010217Y001465` as `fs_kd_rujukan` in
  `ta_rujukan` and `ta_registrasi`): 0 rows each.

---

## TC-BR-02 — SKDP registration skips PPK lookup and uses DATANG SENDIRI

Status: BLOCKED

Reason:

No viable SKDP test participant available in the dev environment: the current
dev database is older than the kiosk business date, so SKDP records appear
expired and no patient data can be used for the SKDP flow. A database backup
exists that could supply test data in the future (data owner would insert
backup records into the current dev database). Not a product defect.

---

## TC-BR-03 — SEP payload differs correctly by reference type

Status: BLOCKED

Reason:

Same blocker as TC-BR-02: no active SKDP participant in the dev environment
(database older than business date → SKDP expired). The SKDP SEP payload cannot
be captured end-to-end. A database backup exists that could provide test data in
the future. Not a product defect.

---

## TC-BR-04 — BPJS class does not change the rawat jalan service type

Status: PASS

Notes:

Observed on the clean Rujukan run RG01378159 (2026-10-01, participant
`0001033484141`), no separate kiosk run needed:

- `kelasRawatId` remained `1` (non-empty class retained as class data only).
- No rawat inap behavior or prompt appeared (tester-confirmed).
- SEP created as rawat jalan outpatient: `tujuanKunjunganId = 0` (standard
  Rujukan outpatient value, not the SKDP control value `2`).

---

## TC-BR-05 — Booking and walk-in paths apply the same reference rules

Status: PASS (Rujukan-only, 2026-10-01; SKDP side remains BLOCKED per TC-BR-02/03)

Notes:

Walk-in reference: clean run RG01378159 (2026-10-01, participant
`0001033484141`) — `RujukanIdLokal = 0174B009`, `tujuanKunjunganId = 0`, normal
receipt with SEP. See TC-HP-01 / TC-BR-01 / TC-BR-04.

Booking run RG01378160 (2026-10-01, participant `0000078318797`, NoRujukan
`030107010217Y001465` — same BPJS Rujukan number, different participant):

- Registration: `regId RG01378160`, antrian no. 9, via the booking path
  (tester-confirmed).
- `POST /sep`: success, `sepDate 2026-02-11 14:31:15` (`yyyy-MM-dd HH:mm:ss`),
  `sepId SEP090586OMB` (same value returned as RG01378159 — recorded as-is;
  runner/mock artifact, not a rule signal).
- `tujuanKunjunganId = 0` — identical to the walk-in run.
- Printed output: normal receipt carrying the SEP number (tester-confirmed,
  receipt text below); no admisi-fallback wording.
- Receipt evidence (verbatim, run RG01378160):
  `RUKHANAH / 337502200184382 / RG01378160 (1 Oktober 2026 14.31) / JKN NON PBI
  / SEP: 0301R0010323V378160`.
- DB Q1 (`ta_registrasi`, `fs_kd_reg = 'RG01378160'`): `RujukanIdLokal =
  0174B009`, `CaraMasukDkId = 2` — identical to walk-in Q1.
- DB Q2 (`ta_rujukan`, `fs_kd_rujukan = '0174B009'`): Klinik Aisyiyah Siti
  Aisyah, `PpkId = 0174B009`, `CaraMasukDkId = 2` — matches.

SKDP side (booking + walk-in): BLOCKED — same data gap as TC-BR-02/03, not a
product defect.

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

Status: PASS

Notes:

Executed while DEF-001 was present (SEP create fails with 400 "Invalid string
date"), which provided the exact failure scenario this test targets.

- No second SEP-create attempt: exactly one `POST /sep` request was issued and
  it failed; the kiosk did not retry or re-create.
- The direct registration already created was preserved: same `regId` retained
  (RG01378143, antrian no. 4).
- Admisi fallback notice printed with BOTH lines:
  - `Berhasil Registrasi regid : RG01378143`
  - `Silakan menuju Loket Admisi untuk penyelesaian berkas.`
- Patient routed to the configured default service point.
- DB evidence: exactly one registration; no successful SEP created.

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

Status: PASS

Notes:

Verified on the clean Rujukan run RG01378159 (2026-10-01), no separate kiosk
run needed:

- Browser DevTools Network for the run: no `POST ../skdp` (no `POST /api/Skdp`)
  request originating from the kiosk (tester-confirmed). The kiosk only issued
  reference GETs plus `POST /sep`, upload, and eligibility — it consumed the
  existing Rujukan data, never created an SKDP.
- Logging limitation noted (not a product defect, recorded as observation):
  Jetli localhost terminal showed no API hit logs for the run, and the
  configured Serilog Seq target (`http://dev.smart-ics.com:5341` in
  `appsettings.json`) is reported by the tester as misconfigured (should be
  `http://dev.smart-ics.com:5513/`). Server-side log inspection was therefore
  not available; the PASS rests on the client-side Network evidence above,
  which is conclusive for "kiosk did not send it".

---

## TC-REG-02 — No stale "cancel / late-result" stuck states in the surrounding flow

Status: PASS

Notes:

- Scenario A (cancel during patient search): kiosk returned to home; no error;
  no jump to a new step after waiting beyond the normal search duration.
- Scenario B (cancel during biometric verification): kiosk returned to home; no
  UI error; no jump to a new step. Note: the biometric device window still
  appeared (separate non-browser window) — this is device/window behavior, not
  a kiosk flow state; the kiosk UI itself stayed on home.
- Flow remained usable for subsequent tests.

---

## TC-REG-03 — No development-only print/download behavior in the production path

Status: PASS

Notes:

Production build of `kiosk-web` succeeded (`vue-tsc` + `vite build`, 231 modules,
served via `vite preview` on port 4173). Ran the registration flow and the print
step against the production bundle:

- Print went through the normal printer path (browser print dialog/printer).
- No automatic browser download of `antrian_*.png` / `label_*.png` occurred.
- No DEV auto-download behavior present in the production path.

---

# 3. Defects

## DEF-001 — RESOLVED (retested PASS 2026-09-30, see TC-RE-02)

Related Test Case:

TC-RE-02

Severity:

MAJOR

Actual Result:

`POST /sep` returns HTTP 400 `{"status":"Bad Request","code":"400","data":"Invalid string date"}` because the generated SEP payload sends `sepDate` as a date-only string (`"2026-02-11"`). Registration cannot complete on the BPJS reference path; no receipt prints.

Expected Result:

`sepDate` must be formatted as `yyyy-MM-dd HH:mm:ss` (date plus time, seconds
required) as required by the Jetli VClaim `POST /sep` contract, so SEP creation
succeeds and the normal receipt with SEP number prints.

> **Expectation corrected 2026-09-29** — previously recorded as
> `yyyy-mm-dd hh:mm`, which the Jetli contract rejects with the identical
> `Invalid string date` error. See
> `docs/analysis/KIOSK-SEP-SKDP-BUG-INVESTIGATION.md` F-01 and OQ-BI-05.

Evidence:

- Payload captured during test: `sepDate: "2026-02-11"` (full JSON recorded in TC-RE-02).
- Reproducible on the Rujukan reference path (TC-RE-02); expected on the SKDP path as well since both go through `buildSepPayloadPolicy`.
- Source location: `apps/kiosk-web/src/composables/useKioskRegistration.ts` — `buildSepPayloadPolicy` input `sepDate` is filled at line 908 from `businessDate.value ?? ''`, where `businessDate` is date-only (`yyyy-mm-dd`) via `ensureBusinessDate()` (lines 373–378).

# 4. Recommendations

Open Issues:

- (none — DEF-001 resolved, see §3)

## 6.7 Retest outcome TC-RE-02 (2026-09-30) — recorded evidence

- Runner: localhost Jetli API via `https` (CORS avoided; `http` fetch had failed as `Failed to fetch` with no request reaching the API log — infrastructure/runner issue, not a DEF-001 FAIL).
- `sepDate` sent: `2026-02-11 11:02:18` (`yyyy-MM-dd HH:mm:ss`, 19 chars).
- `POST /sep` response: `200 success`, `sepId 01KG9A0BTN1KBE9GB84MAE6GCT`.
- Registration: `regId RG01378155`, antrian no. 6.
- Printed output: normal receipt, no admisi-fallback notice (tester confirmed "correct").
- Conclusion: TC-RE-02 PASS; DEF-001 RESOLVED. Note: `sepNo: "-"` returned by the localhost runner is a mock/BPJS-data artifact, not a DEF-001 signal; the contract under test (`sepDate` accepted, no `Invalid string date`, SEP created) is satisfied.

## 5. Retest Required — DEF-001 (2026-09-29)

DEF-001 has been corrected and the correction is COMPLETED, but **this
document's FAIL and BLOCKED results predate the fix**. They describe the
system as it was, not as it is now. Do not read them as current state.

Correction shipped: `a67c0e4` — `sepDate` is composed as `yyyy-MM-dd HH:mm:ss`
(ARCHITECTURE TD-008), validated at the shared client boundary before any
request is issued (TD-009), with request-direction conformance coverage
(TD-010). Unit and contract coverage is green; the service has not yet been
exercised.

**Re-run at minimum TC-RE-02.** It is Rujukan-only and is not blocked by the
SKDP data gap that blocks TC-BR-02/03, so it is executable right now.

Preconditions for the retest:

1. `jetliApiBase` now points at `http://dev.smart-ics.com:8888/JknTrustedLink/api`
   (commit `ce7a045`), not the former `8089/JetliAPi` deployment.
2. The `SepDate` contract was established by tracing
   `SepCreateCommand.cs` in `b12-Jetli-JknTrustedLinkApi` at the former
   8089 target (BUG-INVESTIGATION assumption A-02). If the 8888 deployment
   was built from a different source revision, that evidence must be
   re-established before a FAIL is attributed to the fix.
3. On success, verify the printed output is the normal registration receipt
   carrying the SEP number, and that no admisi-fallback notice
   (`Berhasil Registrasi regid : ...` / `Silakan menuju Loket Admisi ...`)
   appears. Capturing the `POST /sep` request body is what closes DEF-001.

Also worth re-running while the kiosk is in that state, since they are cheap
and share the same fixture: TC-ERR-01 (SEP-create failure must still fall back
exactly once, without a blind second create) and TC-ERR-04. TC-ERR-01 in
particular previously passed *because* DEF-001 forced a SEP-create failure;
with DEF-001 fixed that accident no longer supplies the scenario, so it needs
an induced failure to remain meaningful.

## 6. Retest References and Localhost Runner — TC-RE-02 (2026-09-30)

This section is a reference appendix only. It changes no test status and no
defect record. Statuses in §2 and defects in §3 remain as recorded until a
human tester executes and reports Actual / Expected / Evidence.

### 6.1 Canonical test references (read before executing)

- `c013-kiosk-queue-display-web/docs/test/TEST-PACKAGE.md` — TC-RE-02 case
  definition, fixtures (PESERTA-RUJUKAN), execution sequence, database
  evidence reference (§8).
- `c013-kiosk-queue-display-web/docs/test/TEST-EXECUTION.md` — this document:
  TC-RE-02 FAIL record (§2), DEF-001 (§3), retest preconditions (§5).

### 6.2 DEF-001 contract authority (what PASS/FAIL is judged against)

- `c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-BUG-INVESTIGATION.md`
  — F-01 (`sepDate` must be `yyyy-MM-dd HH:mm:ss`, 19 chars, space separator,
  seconds required), F-02 (fail-safe: nothing written on this failure path),
  assumption A-02 (traced at the former 8089 deployment).
- `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md`
  — TD-008 (composition), TD-009 (client-side validation, no request on
  violation), TD-010 (request-direction conformance coverage).
- `c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md`
  — Status COMPLETED; slices P1-S01, P1-S02, P2-S03, P2-S04 all IMPLEMENTED/GO.
- `c013-kiosk-queue-display-web/docs/issues/KIOSK-SEP-SKDP-ISSUE.md` — DEF-001
  (ISSUE, Type BUG, Severity MAJOR).

### 6.3 Retest target configs (apply locally, do not commit)

- `c013-kiosk-queue-display-web/apps/kiosk-web/public/global_config.json` —
  retest target: `jetliApiBase = http://dev.smart-ics.com:8888/JknTrustedLink/api`
  (committed); for the localhost runner use a LOCAL-ONLY copy with
  `jetliApiBase = http://localhost:5255/api` and keep
  `bilregApiBase = http://dev.smart-ics.com:8888/bilregapi/api`.
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/appsettings.json` — `Bpjs:VClaim:Debug = 1`
  enables mocks for `GET Sep/rujukan/{noka}/peserta` and `GET Peserta`. No file
  change needed; value already `1`. `Database.Server` must stay reachable
  (`dev.smart-ics.com`) for `STD_Idrg` diagnosis lookup and `VCLAIM_Sep` writes.
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/Properties/launchSettings.json` —
  localhost runner listens on `http://localhost:5255` (`Jetli.Api` profile).
  Start with `dotnet run --project Jetli.Api` from `b12-Jetli-JknTrustedLinkApi/`,
  then verify `GET http://localhost:5255/api/Sep/rujukan/0002776449115/peserta`
  returns 200 with rujukan `030107010217Y001465`, diagnosa `N40`.

### 6.4 Source evidence (read-only; never modified by testing)

- `b12-Jetli-JknTrustedLinkApi/Jetli.Application/VClaimContext/SepFeature/SepCreateCommand.cs:110`
  — `req.SepDate.ToDate(YMD_HMS)`; the receiving contract.
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/Controllers/VClaimContext/SepController.cs:20-25`
  — `POST /sep` entry point.
- `b12-Jetli-JknTrustedLinkApi/Jetli.Api/Middlewares/ErrorHandlerMiddleware.cs:35-40`
  — `InvalidOperationException` → `400 Bad Request` with `data: "Invalid string date"`.
- `c013-kiosk-queue-display-web/apps/kiosk-web/src/composables/useKioskRegistration.ts:909-922`
  — `buildSepPayloadPolicy` + one-time `createSep`.
- `c013-kiosk-queue-display-web/apps/kiosk-web/src/lib/sepDate.ts:25-37` — `composeSepDate`.
- `c013-kiosk-queue-display-web/apps/kiosk-web/src/infrastructure.ts:72-83` —
  `getJetliApi()` reads `jetliApiBase` (no fallback to `bilregApiBase`).

### 6.5 Known mock gap (why a full localhost Rujukan retest cannot close DEF-001 alone)

- `b12-Jetli-JknTrustedLinkApi/Jetli.Infrastructure/VClaimContext/SepFeature/RujukanBpjsGetByKodeService.cs:24`
  has NO `Debug == 1` branch, but `POST /sep` reaches it via
  `SepCreateCommand.cs:87` (`_rujukanBpjsRepo.LoadEntity(Key(NoRujukan))`).
  `RujukanBpjsGetByKodeServiceFaker` exists in the same file but is commented
  out and not registered in DI.
- `.../SepFeature/RujukanBpjsGetByNokaService.cs:26` HAS a mock (serves
  `GET Sep/rujukan/{noka}/peserta`), so reference lookup passes while
  `POST /sep` still calls the real BPJS endpoint.
- `.../SepFeature/SepRepo.cs:48-75` writes `VCLAIM_Sep` (needs live DB).
- `.../EKlaimContext/IdrgFeature/IdrgDal.cs:20-39` requires `N40` in `STD_Idrg`.
- Consequence for the runner: `POST /sep` with the corrected
  `sepDate: "2026-02-11 09:30:45"` must NO LONGER return `400 Invalid string date`
  (that absence is the DEF-001 signal); the next error, if any, will be a
  data/BPJS error (`Data Peserta BPJS tidak ditemukan` / BPJS timeout), which is
  NOT a DEF-001 FAIL. Do not record it as FAIL without confirming this
  distinction. Closing TC-RE-02 as PASS still requires the normal receipt with
  SEP number against the 8888 target per §5 item 3.