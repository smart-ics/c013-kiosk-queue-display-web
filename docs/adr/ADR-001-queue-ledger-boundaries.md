# ADR-001: Queue Ledger Boundaries — Antrian Poli vs Antrian Pendaftaran

- **Status:** Accepted
- **Date:** 2026-08-03
- **Branch:** feature/kiosk-self-registration

## Context

The self-registration enhancement introduces two registration paths
(check-in booking, go-show walk-in) on top of the existing
"Ambil Antrian Pendaftaran" queue intake flow. The PRD shows a success screen
with a *nomor antrian poli*, and a failure fallback flow (booking-assistance)
that yields a queue number. AGENTS.md forbids a second client-side queue ledger
and client-side Queue Label allocation.

This ADR fixes which system mints each number the kiosk displays.

## Decision

There are **three distinct queue numbers**, each minted by its own authoritative
ledger. The kiosk never allocates, formats, or increments any of them — it only
renders and prints what the backend returns.

| Number displayed | Minted by | Endpoint | Purpose |
| --- | --- | --- | --- |
| **Antrian Pendaftaran** (registration desk queue) | Admission-queue ledger (existing) | `POST /api/v1/admission-queue/intake` | Existing "Ambil Antrian Pendaftaran" flow — unchanged; **also the fallback for walk-in registration failure** |
| **Antrian Poli** (clinic/outpatient queue) | HIS Registration service | Response of `POST /api/Reg/rajalByBooking/direct` or `POST /api/Reg/rajalWalkIn/direct` | Success outcome of booking / walk-in registration |
| **Antrian Bantuan** (assistance desk queue) | Admission-queue ledger | `POST /api/v1/admission-queue/booking-assistance` | Failure fallback for **booking** check-in that could not be completed |

### Failure fallback routing (confirmed 2026-08-03)

| Failure path | Fallback endpoint | Resulting number |
| --- | --- | --- |
| Booking check-in failure (any cause) | `POST /api/v1/admission-queue/booking-assistance` | **Antrian Bantuan** |
| Walk-in registration failure (any cause) | `POST /api/v1/admission-queue/intake` | **Antrian Pendaftaran** |

### Response contract (HIS registration)

Both direct-registration endpoints return the antrian poli directly in their
response body. No separate `intake` call is made after a successful registration.

```ts
export const returnCreateWalkInSchema = z.object({
  regId: z.string(),
  noAntrian: z.number(),
})
```

> Note: the booking path (`rajalByBooking/direct`) is expected to mirror this
> shape. Exact field names (e.g. `noAntrian` vs `nomorAntrian`) for the booking
> variant are still to be confirmed against the HIS API — flagged as an open
> integration item, not a blocker for frontend state design.

### Booking search result shape (confirmed 2026-08-03)

`GET /api/Booking/search/{tglBerobat}/{keyword}` returns an **array**. The
kiosk expects **one match**; an empty array means booking not found. Check-in is
only valid for the active business date — the kiosk never searches another date.

```ts
export const schema = z.object({
  bookingId: z.string(),
  bookingDate: z.string(),
  reg: z.object({
    regId: z.string(),
    pasienId: z.string(),
    pasienName: z.string(),
  }),
  layanan: z.object({
    layananId: z.string(),
    layananName: z.string(),
  }),
  dokter: z.object({
    ppaId: z.string(),
    ppaName: z.string(),
    isDefault: z.boolean(),
  }),
  tglBerobat: z.string(),
  jamPraktek: z.string(),
  noAntrian: z.number(),
  extAppRef: z.object({
    extAppName: z.string(),
    reffId: z.string(),
    checkInQr: z.string(),
  }),
})
```

- `keyword` (manual or QR) is the **raw booking code** — no decode step needed.
- An array length > 1 is unexpected; the kiosk should treat it as an error state
  rather than display a picker (confirm with backend; `isDefault` hints the
  intended single default booking).

### Walk-in patient search shape (confirmed 2026-08-03)

`GET /api/Pasien/search/{keyword}` returns an **array**. The kiosk **always
shows a picker list** — even for a single-element array — because UX treats
selection as an explicit user confirmation of "this is my patient." Empty array
= not found.

- **No identity-type selector (confirmed Q19).** Single keyword input; the
  backend matches by whatever ID the keyword represents (NIK/MR/BPJS/rujukan).
  The PRD's "pilihan jenis identitas" UI is dropped.
- **OPEN:** the walk-in patient item schema (fields to render in the picker —
  name + disambiguator like MR/NIK/DOB — and whether it carries
  jaminan/polis context for the eligibility chain) is not yet confirmed.

## Consequences

- **Booking-assistance is a backup, not a flow.** It is only invoked when a
  registration attempt fails. It must not be offered as a standalone option on
  the home screen beyond the fallback path.
- **The kiosk displays two possibly-unrelated numbers in a session** — the
  antrian poli from HIS (success) *or* the antrian bantuan from admission-queue
  (failure). They never coexist on the same screen.
- **No client-side allocation anywhere.** The frontend continues the existing
  rule: render `queueLabel`/`noAntrian` verbatim from the API response.
- **`noAntrian` is a raw number, not a prefixed queue label.** Printing a
  success receipt reuses the existing print proxy, but the ticket layout must
  not fabricate a `queueLabel` that the ledger never issued.

### Success receipt layout (confirmed Q18 — option a)

Both booking and walk-in success print a **new "Bukti Registrasi" layout**
(regId + noAntrian + patient/booking/service summary) rendered as a PNG and
sent through the existing print proxy with a **different `doctype`** (e.g.
`'registrasi'`). The existing antrian ticket layout is **unchanged** and stays
for the intake and fallback flows. One new layout serves both registration
paths — no per-path variants.
