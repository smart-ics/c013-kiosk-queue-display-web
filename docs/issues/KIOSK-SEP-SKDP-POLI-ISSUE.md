---
Title: Kiosk SEP and SKDP Integration Issue — destination poli
Code: KIOSK-SEP-SKDP
Artifact: ISSUE
Version: 1.0
LastUpdated: 2026-09-28
Status: OPEN
Type: BUG
NextStage: ARCHITECTURE
Origin: User report
Investigation: c013-kiosk-queue-display-web/docs/analysis/KIOSK-SEP-SKDP-POLI-BUG-INVESTIGATION.md
---

# Metadata
ID: KIOSK-SEP-SKDP-ISSUE-DEF-002
Type: BUG
Status: OPEN
Title: SEP upload fails with `Poli BPJS is invalid state` because the kiosk-selected
layanan is not constrained by the BPJS reference's destination poli

# Source
Reported By: stakeholder (direct report to Issue Intake, 2026-09-28)
Reported Date: 2026-09-28

Related artifacts (context only, not modified by this ISSUE):

- ARCHITECTURE: `c013-kiosk-queue-display-web/docs/architecture/KIOSK-SEP-SKDP-ARCHITECTURE.md` v1.1
- IMPLEMENTATION-PLAN (DEF-001, COMPLETED): `c013-kiosk-queue-display-web/docs/plans/KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md`
- ISSUE (DEF-001, separate defect): `c013-kiosk-queue-display-web/docs/issues/KIOSK-SEP-SKDP-ISSUE.md`

Not derived from TEST-EXECUTION. No originating test case is recorded for this
report, because the reported failure was observed outside a recorded test
execution. See `# Open Questions`.

# Description

On the BPJS reference path of kiosk self-registration, the reference returned by
`GET /api/Sep/rujukan/{noPeserta}/peserta` already carries the destination
poliklinik/layanan. The kiosk nevertheless presents a stepper in which the
patient or officer selects a layanan, and that selection is not observed to be
constrained by the destination poli carried in the BPJS reference.

When the selected layanan does not correspond to the reference's destination
poli, the subsequent `PATCH /api/Sep/upload` call is rejected with HTTP 400 and
the body:

```json
{
  "status": "Bad Request",
  "code": "400",
  "data": "Poli BPJS is invalid state"
}
```

The reported concern is that the manual selection step can produce a poli
mismatch that is only detected at upload time, after the patient has already
completed the interactive steps, rather than being prevented or made
inconsistent by construction.

This ISSUE captures the reported problem only. It does not identify the cause,
does not assert that the poli mismatch is the origin of the rejection, and does
not select or define a correction. Those belong to BUG-INVESTIGATION.

# Desired Outcome

A patient registering through the kiosk with an active BPJS Rujukan or SKDP
reference obtains a completed registration, and the destination poli declared
by that reference is honoured throughout the flow: the outcome the patient
reaches is consistent with the poli the reference was issued for, and the
`PATCH /api/Sep/upload` call is not rejected because of a poli mismatch between
the reference and the selected layanan.

# Current Situation

The following are observations of the current implementation and reported
behaviour. They are recorded as observations; their causal relationship to the
400 response is **not** established by this ISSUE.

- The BPJS reference response declares a destination poli in two shapes, both
  present in the shared response contract
  (`packages/shared-types/src/index.ts`):
  - rujukan: `rujukan.tujuan.poliBpjsId` / `poliBpjsName` (line 555)
  - SKDP: `skdp.poliTujuan.layananId` / `layananName`, alongside
    `skdp.poliPerujuk` (lines 566–567)

- The kiosk maps that response into its reference-selection display model
  `BpjsReference` (`apps/kiosk-web/src/composables/useKioskRegistration.ts`
  lines 177–187, populated in `fetchAndParseBpjsReferences` lines 700–736).
  The mapping lifts `diagnosaId`, `diagnosaName`, `kelasRawatId`, `tglLahir`,
  and — for rujukan — `faskesPerujukId`. The destination poli is **not** a
  field of `BpjsReference`; it is retained only inside the untyped `original`
  bag and is not read by the flow.

- The `poliBpjsId` field is declared in the shared schema and appears in test
  fixtures, but is not read by any production kiosk code path.

- The SEP create request contract carries no destination poli field.
  `sepCreateBodySchema` (`packages/shared-types/src/index.ts` lines 618–645)
  contains no poli or layanan attribute; the payload built by
  `buildSepPayloadPolicy` (lines 204–241) therefore does not convey the poli.

- The SEP upload request contract likewise carries no poli field:
  `sepUploadBodySchema` (lines 647–653) consists of `sepId` and `regId` only.

- The destination poli that reaches the server is therefore carried by the
  local Bilreg registration referenced by `regId`. On the walk-in path that
  value is `layananId: service.poli.id` (line 1078), i.e. the **kiosk-selected**
  layanan, and the karcis resolution and validation for that registration is
  likewise keyed on `service.poli.id` (lines 1060–1061). On the booking path
  the value is `detail.layanan.layananId` (line 1025), taken from the booking
  detail. Neither value is observed to be derived from, or validated against,
  the destination poli of the selected BPJS reference.

- No mapping between the BPJS destination poli identifier
  (`poliBpjsId`, and SKDP `poliTujuan.layananId`) and the Bilreg local
  layanan identifier (`service.poli.id`) was found in the kiosk client. The two
  are distinct identifier spaces as declared in the shared contracts.

- Reported stepper behaviour: the selection step presents the whole local
  service catalog. The patient or officer is not restricted, and the selection
  is not narrowed or defaulted by the destination poli of the selected BPJS
  reference. The selection surface is therefore unbounded with respect to the
  reference.

- Reported scope of the failure: the walk-in path only. The booking path was not
  exercised, because no booking data was available for the test. The booking
  path sources `layananId` from a different place
  (`detail.layanan.layananId`, line 1025) and is **unverified** for this defect;
  absence of a booking-path report is not evidence that the booking path is
  unaffected.

# Evidence

- Reported response from `PATCH /api/Sep/upload`:
  `{"status":"Bad Request","code":"400","data":"Poli BPJS is invalid state"}`.
  This body is free text as returned by the service; no field-level rejection
  detail is available to the client.

- Values for the failing case, reported by the reporter on 2026-09-28:

  | Item | Value |
  |---|---|
  | Reference destination | `poliBpjsId: "URO"`, `poliBpjsName: "UROLOGI"` |
  | Selected local layanan | `2RJ01` (identifier, as reported) |

  The two are drawn from distinct identifier spaces: `poliBpjsId` is declared on
  the BPJS reference contract, `2RJ01` is a local `service.poli.id` registered
  as the walk-in `layananId`.

- **Scope of what these values establish.** They establish that the reference
  destination and the registered local layanan are *different identifiers in
  different spaces*. They do **not** by themselves establish that the two denote
  *different clinical destinations*: it has not been shown what local layanan
  `2RJ01` is called, nor whether the local catalog represents UROLOGI as `2RJ01`.
  No mapping between `poliBpjsId` and local `layananId` exists in the kiosk
  client, so the two identifiers cannot be compared by any available means.
  A search of the repository for `2RJ01`, `URO` and `UROLOGI` returned no
  matches, so the local catalog's content could not be inspected to resolve this
  from the repository alone.

- Code references as listed under `# Current Situation`, all in
  `c013-kiosk-queue-display-web`.

- This ISSUE was raised after IMPLEMENTATION-PLAN
  `KIOSK-SEP-SKDP-DEF-001-IMPLEMENTATION-PLAN.md` reached `Status: COMPLETED`
  on 2026-09-28. That plan explicitly excluded this concern: its Planning Scope
  states the SEP policy must not be widened for other reference-specific fields
  and that TD-005 is unchanged, and `sepDate`-only validation of the request
  contract is in scope. The poli/layanan relationship was therefore not
  addressed and is not a regression introduced by that plan.

# Notes

- The reporter's working hypothesis is that the manual layanan selection step is
  unnecessary because the reference already determines the destination poli, and
  that it is a source of wrong selection. That hypothesis is recorded, not
  accepted. Establishing whether the poli mismatch causes this specific 400 is a
  BUG-INVESTIGATION activity.

- The reported failure is raised against `PATCH /api/Sep/upload`, which is a
  different call from the `POST /sep` request whose `sepDate` defect was
  DEF-001. The two must not be conflated when retesting.

- Whether the reported rejection is confined to the walk-in path, the booking
  path, or both, is not established. The two paths source `layananId` from
  different places, as recorded above.

- No patient identity, credential, or full request body is recorded in this
  artifact.

# Open Questions

To be answered during BUG-INVESTIGATION or by the reporter. These are intake
gaps, not analysis outputs.

1. ~~Which path produced the reported 400?~~ **RESOLVED** — walk-in only. The
   booking path was not exercised (no booking data available). The booking path
   is unverified for this defect, not cleared.

2. ~~For the failing case, what were the reference destination and the selected
   layanan?~~ **RESOLVED** — recorded under `# Evidence`: reference destination
   `URO` / `UROLOGI`, selected local layanan `2RJ01`. See the scope note there:
   the two are different identifiers in different spaces, but whether they
   denote different clinical destinations is **not** established, because no
   mapping exists and `2RJ01` cannot be resolved to a name from available data.
   Carried forward as OQ-BI-07.

3. **OPEN** — What local layanan is `2RJ01`, and does the local catalog represent
   UROLOGI at all — and if so, under which identifier? This is now the pivotal
   question, because the two possible answers change the diagnosis in opposite
   directions:
   - If `2RJ01` is **not** UROLOGI, the destination conflict is demonstrated and
     the reported rejection is explained.
   - If `2RJ01` **is** the local representation of UROLOGI, then the kiosk
     registered to the correct destination, the mismatch theory does not hold,
     and the reported rejection needs an entirely different explanation.
   A repository search for `2RJ01`, `URO` and `UROLOGI` returned no matches, so
   this cannot be answered from the repository and requires the local service
   catalog or the reporting party.

4. **OPEN** — Is `Poli BPJS is invalid state` a rejection that occurs
   specifically on poli mismatch, or does the service emit it for other SEP
   state conditions? The service response is free text and does not
   distinguish. This cannot be settled from the client alone.

5. **OPEN** — Should the destination poli influence the patient's queue
   experience only, or also the `POST /sep` payload? The current request
   contract carries no poli field, so the answer affects which artifacts are in
   scope.
