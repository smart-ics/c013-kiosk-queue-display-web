
### Task 2: `@aq/shared-types` — HIS/JETLI schemas

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/__tests__/hisSchemas.spec.ts`

**Interfaces:**
- Consumes: `zod` (existing)
- Produces (exported from `@aq/shared-types`): `returnCreateWalkInSchema`/`ReturnCreateWalkIn`, `coverageInfoSchema`/`CoverageInfo`, `bookingSearchItemSchema`/`BookingSearchItem`, `bookingDetailSchema`/`BookingDetail`, `polisSchema`/`Polis`, `groupJaminanMapSchema`/`GroupJaminanMap`, `businessDateSchema`/`BusinessDate`, `pasienSearchItemSchema`/`PasienSearchItem`, `bookingAssistanceBodySchema`/`BookingAssistanceBody`, `serviceItemSchema`/`ServiceItem`, `jadwalItemSchema`/`JadwalItem`, `serviceSelectionSchema`/`ServiceSelection`

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/__tests__/hisSchemas.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  returnCreateWalkInSchema,
} from '../index'

const bookingItem = {
  bookingId: 'BK1',
  bookingDate: '2026-08-03',
  reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
  layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
  dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
  tglBerobat: '2026-08-03',
  jamPraktek: '08:00',
  noAntrian: 3,
  extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
}

describe('hisSchemas', () => {
  it('parses returnCreateWalkIn', () => {
    expect(returnCreateWalkInSchema.parse({ regId: 'R1', noAntrian: 12 })).toEqual({
      regId: 'R1',
      noAntrian: 12,
    })
  })

  it('parses booking search item', () => {
    expect(bookingSearchItemSchema.parse(bookingItem).bookingId).toBe('BK1')
  })

  it('parses booking detail with coverageInfo', () => {
    const parsed = bookingDetailSchema.parse({
      ...bookingItem,
      coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
    })
    expect(parsed.coverageInfo.noPeserta).toBe('000123456')
  })

  it('allows bookingAssistance without bookingId', () => {
    const parsed = bookingAssistanceBodySchema.parse({
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
    expect(parsed.bookingId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aq/shared-types exec vitest run src/__tests__/hisSchemas.spec.ts`
Expected: FAIL — imported schemas are not exported.

- [ ] **Step 3: Append schemas to `index.ts`**

Append to `packages/shared-types/src/index.ts`:

```ts
export const returnCreateWalkInSchema = z.object({
  regId: z.string(),
  noAntrian: z.number(),
})
export type ReturnCreateWalkIn = z.infer<typeof returnCreateWalkInSchema>

export const bookingSearchItemSchema = z.object({
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
export type BookingSearchItem = z.infer<typeof bookingSearchItemSchema>

export const coverageInfoSchema = z.object({
  asuransiName: z.string(),
  noPeserta: z.string(),
  noRujukan: z.string(),
})
export type CoverageInfo = z.infer<typeof coverageInfoSchema>

export const bookingDetailSchema = bookingSearchItemSchema.extend({
  coverageInfo: coverageInfoSchema,
})
export type BookingDetail = z.infer<typeof bookingDetailSchema>

export const polisSchema = z.object({
  polisId: z.string(),
  noPolis: z.string(),
  atasName: z.string(),
  pasien: z.object({ pasienId: z.string() }),
  tipeJaminan: z.object({ tipeJaminanId: z.string(), tipeJaminanName: z.string() }),
  tglExpired: z.string().nullable(),
})
export type Polis = z.infer<typeof polisSchema>

export const groupJaminanMapSchema = z.object({
  tipeJaminanId: z.string(),
  groupJaminanId: z.string(),
  groupJaminanName: z.string(),
})
export type GroupJaminanMap = z.infer<typeof groupJaminanMapSchema>

export const businessDateSchema = z.object({
  businessDate: z.string(),
})
export type BusinessDate = z.infer<typeof businessDateSchema>

// Assumed shape (ADR-001 open item): fields the picker needs. Confirm against HIS.
export const pasienSearchItemSchema = z.object({
  pasienId: z.string(),
  pasienName: z.string(),
  noMR: z.string().nullable().optional(),
  nik: z.string().nullable().optional(),
  tglLahir: z.string().nullable().optional(),
})
export type PasienSearchItem = z.infer<typeof pasienSearchItemSchema>

export const bookingAssistanceBodySchema = z.object({
  bookingId: z.string().optional(),
  servicePointId: z.string().min(1),
  kioskId: z.string().min(1),
  userId: z.string().min(1),
})
export type BookingAssistanceBody = z.infer<typeof bookingAssistanceBodySchema>

// Assumed shapes (ADR-006 open items): service catalog wire shape. Confirm against HIS.
export const serviceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type ServiceItem = z.infer<typeof serviceItemSchema>

export const jadwalItemSchema = z.object({
  jadwalId: z.string(),
  ppaId: z.string(),
  jamPraktek: z.string(),
  sisaKuota: z.number().int(),
})
export type JadwalItem = z.infer<typeof jadwalItemSchema>

export const serviceSelectionSchema = z.object({
  poli: serviceItemSchema,
  dokter: serviceItemSchema,
  jadwal: jadwalItemSchema,
})
export type ServiceSelection = z.infer<typeof serviceSelectionSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aq/shared-types exec vitest run src/__tests__/hisSchemas.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/index.ts packages/shared-types/src/__tests__/hisSchemas.spec.ts
git commit -m "feat(shared-types): HIS/JETLI registration schemas"
```
