### Task 4: `lib/constants.ts` + `lib/eligibility.ts` (ADR-002 rule)

**Files:**
- Create: `apps/kiosk-web/src/lib/constants.ts`
- Create: `apps/kiosk-web/src/lib/eligibility.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/eligibility.spec.ts`

**Interfaces:**
- Consumes: `BookingDetail`, `Polis` from `@aq/shared-types`
- Produces: `KIOSK_USER_ID`, `IDLE_RESET_MS`, `SUCCESS_RESET_MS`, `ASSISTANCE_RESET_MS` from `constants`; `UMAT_TIPE_JAMINAN_ID`, `JaminanStatus`, `computeNeedsEligibility(tipeJaminanId, groupJaminan): boolean`, `deriveBookingJaminan(detail, polisList): JaminanStatus`, `deriveWalkinJaminan(polisList): JaminanStatus` from `eligibility`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/eligibility.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { BookingDetail, Polis } from '@aq/shared-types'
import {
  computeNeedsEligibility,
  deriveBookingJaminan,
  deriveWalkinJaminan,
  UMAT_TIPE_JAMINAN_ID,
} from '../eligibility'

const bpjsPolis: Polis = {
  polisId: 'P1',
  noPolis: '000123456',
  atasName: 'Andi',
  pasien: { pasienId: 'PT1' },
  tipeJaminan: { tipeJaminanId: 'BPJS', tipeJaminanName: 'BPJS' },
  tglExpired: null,
}

const booking = {
  bookingId: 'BK1',
  bookingDate: '2026-08-03',
  reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
  layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
  dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
  tglBerobat: '2026-08-03',
  jamPraktek: '08:00',
  noAntrian: 3,
  extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
} as BookingDetail

describe('computeNeedsEligibility', () => {
  it('is false for Umum (00000)', () => {
    expect(computeNeedsEligibility(UMAT_TIPE_JAMINAN_ID, { groupJaminanId: 'G1' })).toBe(false)
  })

  it('is true for BPJS with a group map', () => {
    expect(computeNeedsEligibility('BPJS', { groupJaminanId: 'G1' })).toBe(true)
  })

  it('is false when group map is null', () => {
    expect(computeNeedsEligibility('BPJS', null)).toBe(false)
  })
})

describe('deriveBookingJaminan', () => {
  it('defaults to Umum when coverageInfo.noPeserta is empty', () => {
    const detail = { ...booking, coverageInfo: { asuransiName: '', noPeserta: '', noRujukan: '' } }
    expect(deriveBookingJaminan(detail, [bpjsPolis]).tipeJaminanId).toBe(UMAT_TIPE_JAMINAN_ID)
  })

  it('derives BPJS from a matching polis', () => {
    const detail = {
      ...booking,
      coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
    }
    const status = deriveBookingJaminan(detail, [bpjsPolis])
    expect(status.tipeJaminanId).toBe('BPJS')
    expect(status.noPeserta).toBe('000123456')
  })
})

describe('deriveWalkinJaminan', () => {
  it('uses the first polis', () => {
    const status = deriveWalkinJaminan([bpjsPolis])
    expect(status.tipeJaminanId).toBe('BPJS')
    expect(status.noPeserta).toBe('000123456')
  })

  it('defaults to Umum when no polis', () => {
    expect(deriveWalkinJaminan([]).tipeJaminanId).toBe(UMAT_TIPE_JAMINAN_ID)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/eligibility.spec.ts`
Expected: FAIL — cannot find module `../eligibility`.

- [ ] **Step 3: Create `constants.ts`**

Create `apps/kiosk-web/src/lib/constants.ts`:

```ts
export const KIOSK_USER_ID = 'hidokkiosk'
export const IDLE_RESET_MS = 60_000
export const SUCCESS_RESET_MS = 10_000
export const ASSISTANCE_RESET_MS = 15_000
```

- [ ] **Step 4: Create `eligibility.ts`**

Create `apps/kiosk-web/src/lib/eligibility.ts`:

```ts
import type { BookingDetail, GroupJaminanMap, Polis } from '@aq/shared-types'

export const UMAT_TIPE_JAMINAN_ID = '00000'

export type JaminanStatus = {
  tipeJaminanId: string
  tipeJaminanName: string
  noPeserta: string | null
}

const UMAT: JaminanStatus = {
  tipeJaminanId: UMAT_TIPE_JAMINAN_ID,
  tipeJaminanName: 'Umum',
  noPeserta: null,
}

export function computeNeedsEligibility(
  tipeJaminanId: string,
  groupJaminan: Pick<GroupJaminanMap, 'groupJaminanId'> | null,
): boolean {
  return tipeJaminanId !== UMAT_TIPE_JAMINAN_ID && groupJaminan !== null
}

export function deriveBookingJaminan(detail: BookingDetail, polisList: Polis[]): JaminanStatus {
  const noPeserta = detail.coverageInfo.noPeserta
  if (!noPeserta) return UMAT
  const match = polisList.find((p) => p.noPolis === noPeserta || p.polisId === noPeserta)
  if (!match) return UMAT
  return {
    tipeJaminanId: match.tipeJaminan.tipeJaminanId,
    tipeJaminanName: match.tipeJaminan.tipeJaminanName,
    noPeserta,
  }
}

export function deriveWalkinJaminan(polisList: Polis[]): JaminanStatus {
  const first = polisList[0]
  if (!first) return UMAT
  return {
    tipeJaminanId: first.tipeJaminan.tipeJaminanId,
    tipeJaminanName: first.tipeJaminan.tipeJaminanName,
    noPeserta: first.noPolis,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/eligibility.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/lib/constants.ts apps/kiosk-web/src/lib/eligibility.ts apps/kiosk-web/src/lib/__tests__/eligibility.spec.ts
git commit -m "feat(kiosk-web): eligibility decision rule per ADR-002"
```

