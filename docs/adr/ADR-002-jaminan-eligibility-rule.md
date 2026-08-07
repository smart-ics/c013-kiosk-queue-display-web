# ADR-002: Jaminan Eligibility Decision Rule (BPJS vs Umum)

- **Status:** Accepted
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration
- **Relates:** ADR-001

## Context

The PRD makes the biometric step conditional on the patient's guarantor
(jaminan) type: BPJS → biometric mandatory; non-BPJS → skip. The kiosk must
therefore determine jaminan type for a booking before deciding whether to enter
the biometric/eligibility path.

The existing HIS officer client (`c012_myhospital_web`) already implements this
decision in `useRegistrasiJaminan.ts`. Its rule is authoritative:

```
needsEligibility = tipeJaminanId !== '00000' && currentGroupJaminan !== null
```

`AGENTS.md` forbids importing HIS modules into kiosk-web, so the kiosk must
**replicate the rule against the same API endpoints** (not import the composable).

## The Decision Chain (from legacy, confirmed 2026-08-03)

### Step 1 — Booking detail + polis context

```http
GET {bilregApi}/Booking/{bookingId}
```
→ `detailBookingAdapter` includes the key field `coverageInfo.noPeserta`
(plus `coverageInfo.asuransiName`, `coverageInfo.noRujukan`).

```http
GET {bilregApi}/polis/list/{pasienId}
```
→ `z.array(polisCoverSchema)`:
`[{ polisId, noPolis, atasName, pasien, tipeJaminan: { tipeJaminanId, tipeJaminanName }, tglExpired }]`

### Step 2 — tipeJaminanId derivation (watch on `[bookingDetails, listPolisPasien]`)

| Condition | tipeJaminanId | Eligibility needed |
| --- | --- | --- |
| `coverageInfo.noPeserta` is empty | `'00000'` (Umum) | **No** |
| `coverageInfo.noPeserta` matches a polis | matched `polis.tipeJaminan.tipeJaminanId` | Depends on group map |

### Step 3 — Group jaminan lookup

```http
GET {jetliApi}/grupJaminan/map?tipeJaminanId={id}
```
→ `groupJaminanMapSchema: { tipeJaminanId, groupJaminanId, groupJaminanName }`

- Non-null map → `currentGroupJaminan` set → **needsEligibility = true** →
  eligibility warning + `EligibilityForm`.
- Null → `currentGroupJaminan = null` → **needsEligibility = false** → no
  eligibility UI, proceed to registration.

## Eligibility form lookups (only when needsEligibility)

```http
GET {jetliApi}/SEP/rujukan/{noPeserta}/peserta   → rujukanSkpdResponseSchema (peserta/rujukan/listSkdp)
GET {jetliApi}/SEP/finger/peserta/{noPeserta}     → responseFingerprintSchema { id: "0|1|x", status }
GET {jetliApi}/sep/peserta/{noPeserta}            → existing-SEP auto-detect (array)
```

## Registration + SEP attach (legacy happy path)

1. `POST {bilregApi}/reg/rajalByBooking` — payload needs
   `bookingId, userId, karcisId, caraMasukDkId, rujukanId?, tipeJaminanId,
   pesertaJaminanId?, admissionAntrianId? + admissionNoUrut + admissionExpectedRowVersion`
   (queue context is all-or-none). → `returnCreateWalkInSchema { regId, noAntrian }`.
2. `POST {jetliApi}/Sep` → `{ sepId, sepNo }` (payload includes `noPeserta, pasienId,
   userId, diagnosaId, ...`).
3. `PATCH {bilregApi}/reg/setDataEligibility` → `{ regId, sjpNo, pesertaJaminanId?, sjpId? }`.
4. `PATCH {jetliApi}/Sep/upload` → `{ sepId, regId }`.
5. Post-reg loadback: `GET {jetliApi}/sep/reg/{regId}`, `GET {bilregApi}/reg/{regId}`.

> **Kiosk `/direct` variant (confirmed Q14 — option a):** the kiosk's
> `rajalByBooking/direct` / `rajalWalkIn/direct` calls **omit** the admission
> queue-context fields (`admissionAntrianId`/`admissionNoUrut`/
> `admissionExpectedRowVersion`). HIS returns `noAntrian` (antrian poli) from
> its own ledger, fully decoupled from the admission queue. No intake call is
> made for a successful registration.

## Kiosk Implications (confirmed decisions)

- **Q4 (resolved — option c):** The kiosk search response stays lean. After a
  booking match, the kiosk calls `GET {bilregApi}/Booking/{bookingId}` to obtain
  the legacy `detailBookingAdapter` (incl. `coverageInfo.noPeserta`), then
  **replicates Steps 1–3 client-side** via `polis/list/{pasienId}` and
  `grupJaminan/map?tipeJaminanId=X` to compute `needsEligibility`.
- **Q9 (resolved — option b, walk-in):** A walk-in has no booking coverage, so
  jaminan type is derived from `GET {bilregApi}/polis/list/{pasienId}` directly
  — the **first/active polis** is the source of `noPeserta` (`noPolis`). The
  derivation then continues identically to the booking path:
  `tipeJaminanId` from the matched polis → `grupJaminan/map` → `needsEligibility`.
  A BPJS walk-in therefore **does** run the biometric + SEP chain.
- **Q12 (resolved — option a, booking auto-fill):** For **booking** check-in the
  SEP is auto-filled from booking context (`extAppRef.reffId` → rujukan;
  diagnosa/kelas/sepDate derived from booking detail). The patient never types
  SEP data.
- **Q13 (resolved — walk-in BPJS phase):** A BPJS walk-in adds an explicit
  **noPeserta input step** (scan QR or manual entry) before eligibility:
  1. Kiosk fetches `GET {jetliApi}/Sep/rujukan/{noPeserta}/peserta`.
  2. Kiosk lists all available **rujukan / SKDP** entries.
  3. Patient **chooses one** from the list → that selection supplies the SEP's
     rujukan/diagnosa context.
  Full detail of this sub-flow is deferred to the dedicated "walk-in BPJS phase"
  design — this ADR only locks the entry/identity mechanism and the endpoint.
- **Q5 (resolved — option a):** A BPJS booking at the kiosk runs the **full
  chain**: hardware `/biometrik` capture → SEP create (`POST {jetliApi}/Sep`) →
  registration (`rajalByBooking/direct`) → eligibility patch
  (`setDataEligibility`) → SEP upload (`Sep/upload`). The hardware capture is
  not a substitute for the SEP chain; it is the gate that precedes it.
- **Q5b (silent status):** A **silent fingerprint-status probe** is needed to
  determine "ready to upload SEP" before committing. **OPEN:** is this
  `GET {jetliApi}/SEP/finger/peserta/{noPeserta}` (status query) run before
  hardware capture, or a status field inside the `/biometrik` response, or the
  SEP upload result itself? See Q7.
- **OPEN (Q6):** The `/direct` variant endpoints (`rajalByBooking/direct`,
  `rajalWalkIn/direct`) return `{ regId, noAntrian }`. Their **request payload**
  is unspecified. The legacy non-direct payload requires `karcisId`,
  `caraMasukDkId`, `tipeJaminanId` — fields a stateless kiosk does not naturally
  have. Does `/direct` accept a minimal payload and derive these server-side?
