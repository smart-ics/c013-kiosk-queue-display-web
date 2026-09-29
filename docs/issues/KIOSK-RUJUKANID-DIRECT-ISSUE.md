# ISSUE

## Metadata

ID: KIOSK-RUJUKANID-DIRECT-ISSUE-001
Type: BUG
Status: OPEN
Title: POST /api/Reg/rajalByBooking/direct sends rujukan.noRujukan as rujukanId instead of the expected perujuk identifier

## Source

Reported By: stakeholder (direct report to Issue Intake, 2026-09-29)
Reported Date: 2026-09-29

## Description

On the booking-direct registration path, the request body sent to `POST {BILREGAPI}/api/Reg/rajalByBooking/direct` fills the `rujukanId` field with the referral letter number (`rujukan.noRujukan`) obtained from `GET {JETLIAPI}/api/Sep/rujukan/{noPeserta}/peserta`.

The reported expectation is that `rujukanId` carries the perujuk (referring faskes) identifier — reported as the `rujukanId` value returned by `GET {BilregApi}/api/Rujukan/ppk/{faskesPerujuk.faskesId}` — and not the referral letter number.

This ISSUE captures the reported problem only. It does not identify the cause, select a correction, or define how the correction will be realized.

## Desired Outcome

A booking-direct registration submitted to `POST {BILREGAPI}/api/Reg/rajalByBooking/direct` carries in its `rujukanId` field the expected perujuk identifier consistent with the Bilreg Rujukan/PPK reference data, so the registration is accepted with the correct rujukan linkage from a business perspective.

## Current Situation

- The `rujukanId` value currently sent on `POST {BILREGAPI}/api/Reg/rajalByBooking/direct` is observed/reported to be the `rujukan.noRujukan` value from the `GET {JETLIAPI}/api/Sep/rujukan/{noPeserta}/peserta` response.
- The reported expected value is the `rujukanId` from the `GET {BilregApi}/api/Rujukan/ppk/{faskesPerujuk.faskesId}` result, keyed by the referring faskes identifier (`faskesPerujuk.faskesId`).
- The causal relationship, the authoritative source of `rujukanId`, and the exact mapping between the Jetli SEP rujukan response and the Bilreg Rujukan/PPK lookup are not established by this ISSUE.

## Evidence

- Reporter statement (2026-09-29): payload untuk `POST {BILREGAPI}/api/Reg/rajalByBooking/direct` bagian `rujukanId` seharusnya adalah kode faskes perujuk, bukan nomor rujukan (`rujukan.noRujukan`) yang didapat dari endpoint `GET {JETLIAPI}/api/Sep/rujukan/{noPeserta}/peserta`; seharusnya adalah `rujukanId` dari result dari api `GET {BilregApi}/api/Rujukan/ppk/{faskesPerujuk.faskesId}`.
- No log, screenshot, captured request/response body, or TEST-EXECUTION FAIL record was attached at intake.
- No code location is asserted by this ISSUE.

## Notes

- The reporter names two distinct identifier spaces: the referral letter number (`noRujukan`) from the Jetli SEP rujukan endpoint, and the perujuk identifier (`rujukanId` / kode faskes perujuk) from the Bilreg Rujukan PPK endpoint. Confirming field definitions and the authoritative source belongs to BUG-INVESTIGATION.
- This ISSUE is solution-neutral. It does not define business requirements, architecture decisions, implementation decisions, planning, or testing strategy.
