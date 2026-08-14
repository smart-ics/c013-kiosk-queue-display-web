# Kiosk Self-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three kiosk flows on top of the existing "Ambil Antrian Pendaftaran" intake: check-in booking, go-show walk-in, and booking-assistance fallback, with conditional BPJS biometric verification and registration-receipt printing.

**Architecture:** A new `useKioskRegistration` orchestrator owns the extended state machine (ADR-005) and all mutating calls with a single-flight `submitting` guard. Pure rules (eligibility ADR-002, failure mapping, biometric verdict seam ADR-003) live in `apps/kiosk-web/src/lib/*` and are fully unit-tested. New step components render the current flow; `KioskPage.vue` keeps the existing intake flow untouched as the third home-screen entry. HIS/JETLI API clients are added to `@aq/api-client`; shared response schemas go in `@aq/shared-types`.

**Tech Stack:** Vue 3 + Vite + TypeScript + Zod + TanStack Query (existing), `@aq/api-client`, `@aq/shared-types`, `@aq/app-config`, `@aq/device-config`.

## Global Constraints

- The existing `useKioskIntake` flow and its `KioskPage.vue` sections are **preserved untouched** except for adding home-screen entry buttons and a back button.
- `POST /api/Reg/rajalByBooking/direct` and `POST /api/Reg/rajalWalkIn/direct` are **not idempotent** — no auto-retry on uncertain reg failure (ADR-005).
- No client-side queue-label allocation; render `noAntrian`/`queueLabel` verbatim (ADR-001).
- Do not import HIS modules (`c012_myhospital_web`); replicate the ADR-002 rule client-side.
- `userId` is the constant `"hidokkiosk"` for all HIS/JETLI kiosk calls.
- Indonesian UI copy. No comments unless explaining non-obvious intent. Prettier on modified files only.
- Open integration items (walk-in patient item schema, service catalog paths, `/direct` payload, biometric JSON) are handled **behind typed seams** with documented assumed shapes — never as TODO placeholders.

---

### Task 1: `@aq/app-config` — optional `jetliApiBase` + schema test

**Files:**
- Modify: `packages/app-config/src/index.ts`
- Modify: `packages/app-config/package.json`
- Create: `packages/app-config/src/index.spec.ts`

**Interfaces:**
- Consumes: existing `configService`, `AppConfig`
- Produces: `appConfigSchema` exported with optional `jetliApiBase`; `AppConfig` type gains optional `jetliApiBase: string`

- [ ] **Step 1: Write the failing test**

Create `packages/app-config/src/index.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appConfigSchema } from './index'

describe('appConfigSchema', () => {
  it('accepts bilregApiBase without jetliApiBase', () => {
    const result = appConfigSchema.safeParse({ bilregApiBase: 'http://localhost:5000/api' })
    expect(result.success).toBe(true)
  })

  it('accepts jetliApiBase when provided', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      jetliApiBase: 'http://localhost:6000/api',
    })
    expect(parsed.jetliApiBase).toBe('http://localhost:6000/api')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aq/app-config exec vitest run src/index.spec.ts`
Expected: FAIL — `appConfigSchema` is not exported from `./index`.

- [ ] **Step 3: Modify the schema**

In `packages/app-config/src/index.ts`, export the schema and add the optional field:

```ts
export const appConfigSchema = z.object({
  bilregApiBase: z.string().min(1, 'bilregApiBase must not be empty'),
  jetliApiBase: z.string().optional(),
})
```

`AppConfig` stays derived from the schema (`z.infer`). The `configService` implementation is unchanged.

- [ ] **Step 4: Add vitest devDependency and test script**

In `packages/app-config/package.json`:

```json
{
  "name": "@aq/app-config",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm install && pnpm --filter @aq/app-config test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/app-config
git commit -m "feat(app-config): optional jetliApiBase for BPJS integration"
```

---

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

---

### Task 3: `@aq/api-client` — HIS + JETLI clients

**Files:**
- Create: `packages/api-client/src/his.ts`
- Modify: `packages/api-client/src/index.ts`
- Create: `packages/api-client/src/__tests__/his.spec.ts`

**Interfaces:**
- Consumes: `AdmissionQueueClient` (`getJson`/`postJson`), schemas from `@aq/shared-types`
- Produces (exported from `@aq/api-client`): `createHisApi(client)` → `HisApi` with `getBusinessDate`, `searchBooking(tglBerobat, keyword)`, `getBookingDetail(bookingId)`, `listPolis(pasienId)`, `searchPasien(keyword)`, `listPoli(businessDate)`, `listDokter(businessDate, poliId)`, `listJadwal(businessDate, ppaId)`, `registerByBookingDirect(body)`, `registerWalkInDirect(body)`, `bookingAssistance(body)`; `createJetliApi(client)` → `JetliApi` with `getGroupJaminanMap(tipeJaminanId)`

- [ ] **Step 1: Write the failing test**

Create `packages/api-client/src/__tests__/his.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createHisApi, createJetliApi } from '../his'
import { AdmissionQueueClient } from '../http'
import type { IAuthTokenProvider } from '@aq/auth'

function createAuth(token = 't'): IAuthTokenProvider {
  return { getToken: () => token }
}

describe('createHisApi', () => {
  it('searches booking with tglBerobat + keyword in path', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: [
            {
              bookingId: 'BK1',
              bookingDate: '2026-08-03',
              reg: { regId: 'R0', pasienId: 'PT1', pasienName: 'Andi' },
              layanan: { layananId: 'LY1', layananName: 'Poli Jantung' },
              dokter: { ppaId: 'DP1', ppaName: 'Dr. X', isDefault: true },
              tglBerobat: '2026-08-03',
              jamPraktek: '08:00',
              noAntrian: 3,
              extAppRef: { extAppName: 'APP', reffId: 'REF1', checkInQr: 'QR1' },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const items = await createHisApi(client).searchBooking('2026-08-03', 'BK1')
    expect(items).toHaveLength(1)
    expect(items[0]?.bookingId).toBe('BK1')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'Booking/search/2026-08-03/BK1',
    )
  })

  it('posts booking-assistance and parses queue ticket', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: { antrianId: 'B1', noUrut: 1, queueLabel: 'B-001', createdAt: '2026-08-03T08:00:00' },
        }),
        { status: 200 },
      ),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:5000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const ticket = await createHisApi(client).bookingAssistance({
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
    expect(ticket.queueLabel).toBe('B-001')
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('v1/admission-queue/booking-assistance')
  })
})

describe('createJetliApi', () => {
  it('fetches nullable group jaminan map', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 'success',
          data: { tipeJaminanId: 'BPJS', groupJaminanId: 'G1', groupJaminanName: 'BPJS' },
        }),
        { status: 200 },
      ),
    )
    const client = new AdmissionQueueClient({
      baseUrl: 'http://localhost:6000/api',
      auth: createAuth(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const map = await createJetliApi(client).getGroupJaminanMap('BPJS')
    expect(map?.groupJaminanId).toBe('G1')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('tipeJaminanId=BPJS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`
Expected: FAIL — cannot find module `../his`.

- [ ] **Step 3: Create `his.ts`**

Create `packages/api-client/src/his.ts`:

```ts
import { z } from 'zod'
import {
  admissionQueueIntakeResponseSchema,
  bookingAssistanceBodySchema,
  bookingDetailSchema,
  bookingSearchItemSchema,
  businessDateSchema,
  groupJaminanMapSchema,
  jadwalItemSchema,
  pasienSearchItemSchema,
  polisSchema,
  returnCreateWalkInSchema,
  serviceItemSchema,
  type AdmissionQueueIntakeResponse,
  type BookingAssistanceBody,
  type BookingDetail,
  type BookingSearchItem,
  type BusinessDate,
  type GroupJaminanMap,
  type JadwalItem,
  type PasienSearchItem,
  type Polis,
  type ReturnCreateWalkIn,
  type ServiceItem,
} from '@aq/shared-types'
import type { AdmissionQueueClient } from './http'

const bookingSearchArraySchema = z.array(bookingSearchItemSchema)
const polisArraySchema = z.array(polisSchema)
const pasienArraySchema = z.array(pasienSearchItemSchema)
const serviceItemsSchema = z.array(serviceItemSchema)
const jadwalItemsSchema = z.array(jadwalItemSchema)
const nullableGroupJaminanSchema = groupJaminanMapSchema.nullable()

/**
 * HIS registration endpoints. Service-catalog paths and /direct payloads are
 * assumed shapes (ADR-006 / ADR-002 open items) — confirm against the HIS API.
 */
export function createHisApi(client: AdmissionQueueClient) {
  return {
    getBusinessDate(): Promise<BusinessDate> {
      return client.getJson('system/business-date', businessDateSchema)
    },

    searchBooking(tglBerobat: string, keyword: string): Promise<BookingSearchItem[]> {
      return client.getJson(
        `Booking/search/${encodeURIComponent(tglBerobat)}/${encodeURIComponent(keyword)}`,
        bookingSearchArraySchema,
      )
    },

    getBookingDetail(bookingId: string): Promise<BookingDetail> {
      return client.getJson(`Booking/${encodeURIComponent(bookingId)}`, bookingDetailSchema)
    },

    listPolis(pasienId: string): Promise<Polis[]> {
      return client.getJson(`polis/list/${encodeURIComponent(pasienId)}`, polisArraySchema)
    },

    searchPasien(keyword: string): Promise<PasienSearchItem[]> {
      return client.getJson(`Pasien/search/${encodeURIComponent(keyword)}`, pasienArraySchema)
    },

    listPoli(businessDate: string): Promise<ServiceItem[]> {
      return client.getJson('Poli', serviceItemsSchema, { tglBerobat: businessDate })
    },

    listDokter(businessDate: string, poliId: string): Promise<ServiceItem[]> {
      return client.getJson('Poli/dokter', serviceItemsSchema, {
        tglBerobat: businessDate,
        poliId,
      })
    },

    listJadwal(businessDate: string, ppaId: string): Promise<JadwalItem[]> {
      return client.getJson('Dokter/jadwal', jadwalItemsSchema, {
        tglBerobat: businessDate,
        ppaId,
      })
    },

    registerByBookingDirect(body: Record<string, unknown>): Promise<ReturnCreateWalkIn> {
      return client.postJson('Reg/rajalByBooking/direct', body, returnCreateWalkInSchema)
    },

    registerWalkInDirect(body: Record<string, unknown>): Promise<ReturnCreateWalkIn> {
      return client.postJson('Reg/rajalWalkIn/direct', body, returnCreateWalkInSchema)
    },

    bookingAssistance(body: BookingAssistanceBody): Promise<AdmissionQueueIntakeResponse> {
      const parsed = bookingAssistanceBodySchema.parse(body)
      return client.postJson(
        'v1/admission-queue/booking-assistance',
        parsed,
        admissionQueueIntakeResponseSchema,
      )
    },
  }
}

export function createJetliApi(client: AdmissionQueueClient) {
  return {
    getGroupJaminanMap(tipeJaminanId: string): Promise<GroupJaminanMap | null> {
      return client.getJson('grupJaminan/map', nullableGroupJaminanSchema, { tipeJaminanId })
    },
  }
}

export type HisApi = ReturnType<typeof createHisApi>
export type JetliApi = ReturnType<typeof createJetliApi>
```

- [ ] **Step 4: Export from `index.ts`**

Add to `packages/api-client/src/index.ts`:

```ts
export {
  createHisApi,
  createJetliApi,
  type HisApi,
  type JetliApi,
} from './his'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @aq/api-client exec vitest run src/__tests__/his.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api-client
git commit -m "feat(api-client): HIS and JETLI registration clients"
```

---

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

---

### Task 5: `lib/failureCode.ts` (client-side diagnostics)

**Files:**
- Create: `apps/kiosk-web/src/lib/failureCode.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts`

**Interfaces:**
- Consumes: `ApiClientError`, `isSequenceExhausted` from `@aq/api-client`
- Produces: `FAILURE_CODES`, `FailureCode`, `mapErrorToFailureCode(error): FailureCode`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { FAILURE_CODES, mapErrorToFailureCode } from '../failureCode'

describe('mapErrorToFailureCode', () => {
  it('maps network errors to BACKEND_ERROR', () => {
    expect(mapErrorToFailureCode(new ApiClientError('Failed to fetch', 0))).toBe(
      FAILURE_CODES.BACKEND_ERROR,
    )
  })

  it('maps DUPLICATE_REGISTRATION code', () => {
    const err = new ApiClientError('Already registered', 409, 'DUPLICATE_REGISTRATION')
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.DUPLICATE_REGISTRATION)
  })

  it('maps sequence-exhausted to SCHEDULE_FULL', () => {
    const err = new ApiClientError('Full', 503)
    expect(mapErrorToFailureCode(err)).toBe(FAILURE_CODES.SCHEDULE_FULL)
  })

  it('falls back to UNKNOWN_ERROR', () => {
    expect(mapErrorToFailureCode(new Error('boom'))).toBe(FAILURE_CODES.UNKNOWN_ERROR)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/failureCode.spec.ts`
Expected: FAIL — cannot find module `../failureCode`.

- [ ] **Step 3: Create `failureCode.ts`**

Create `apps/kiosk-web/src/lib/failureCode.ts`:

```ts
import { ApiClientError, isSequenceExhausted } from '@aq/api-client'

export const FAILURE_CODES = {
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',
  BIOMETRIC_TIMEOUT: 'BIOMETRIC_TIMEOUT',
  BPJS_VALIDATION_FAILED: 'BPJS_VALIDATION_FAILED',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  SCHEDULE_FULL: 'SCHEDULE_FULL',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  BACKEND_ERROR: 'BACKEND_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type FailureCode = (typeof FAILURE_CODES)[keyof typeof FAILURE_CODES]

export function mapErrorToFailureCode(error: unknown): FailureCode {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return FAILURE_CODES.BACKEND_ERROR
    if (error.code === 'DUPLICATE_REGISTRATION') return FAILURE_CODES.DUPLICATE_REGISTRATION
  }
  if (isSequenceExhausted(error)) return FAILURE_CODES.SCHEDULE_FULL
  return FAILURE_CODES.UNKNOWN_ERROR
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/failureCode.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/failureCode.ts apps/kiosk-web/src/lib/__tests__/failureCode.spec.ts
git commit -m "feat(kiosk-web): client-side failure code mapping"
```

---

### Task 6: `lib/flow.ts` (extended state machine, ADR-005)

**Files:**
- Create: `apps/kiosk-web/src/lib/flow.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/flow.spec.ts`

**Interfaces:**
- Produces: `KioskFlow` union, `FLOW_TRANSITIONS: Record<KioskFlow, readonly KioskFlow[]>`, `canTransition(from, to): boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/flow.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { canTransition } from '../flow'

describe('canTransition', () => {
  it('allows home → booking search', () => {
    expect(canTransition('HOME', 'BOOKING_SEARCH')).toBe(true)
  })

  it('allows booking confirm → biometric verify', () => {
    expect(canTransition('BOOKING_CONFIRM', 'BIOMETRIC_VERIFY')).toBe(true)
  })

  it('allows walk-in confirm → registration success', () => {
    expect(canTransition('WALKIN_CONFIRM', 'REGISTRATION_SUCCESS')).toBe(true)
  })

  it('allows failure → assistance queue only', () => {
    expect(canTransition('FAILURE', 'ASSISTANCE_QUEUE')).toBe(true)
    expect(canTransition('FAILURE', 'HOME')).toBe(false)
  })

  it('rejects skipping steps', () => {
    expect(canTransition('HOME', 'REGISTRATION_SUCCESS')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts`
Expected: FAIL — cannot find module `../flow`.

- [ ] **Step 3: Create `flow.ts`**

Create `apps/kiosk-web/src/lib/flow.ts`:

```ts
export type KioskFlow =
  | 'HOME'
  | 'BOOKING_SEARCH'
  | 'BOOKING_CONFIRM'
  | 'BIOMETRIC_VERIFY'
  | 'WALKIN_SEARCH'
  | 'WALKIN_SELECT_PATIENT'
  | 'WALKIN_SELECT_SERVICE'
  | 'WALKIN_CONFIRM'
  | 'REGISTRATION_SUCCESS'
  | 'FAILURE'
  | 'ASSISTANCE_QUEUE'

export const FLOW_TRANSITIONS: Record<KioskFlow, readonly KioskFlow[]> = {
  HOME: ['BOOKING_SEARCH', 'WALKIN_SEARCH'],
  BOOKING_SEARCH: ['BOOKING_CONFIRM', 'FAILURE'],
  BOOKING_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  BIOMETRIC_VERIFY: ['REGISTRATION_SUCCESS', 'FAILURE'],
  WALKIN_SEARCH: ['WALKIN_SELECT_PATIENT', 'FAILURE'],
  WALKIN_SELECT_PATIENT: ['WALKIN_SELECT_SERVICE', 'FAILURE'],
  WALKIN_SELECT_SERVICE: ['WALKIN_CONFIRM', 'FAILURE'],
  WALKIN_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  REGISTRATION_SUCCESS: ['HOME'],
  FAILURE: ['ASSISTANCE_QUEUE'],
  ASSISTANCE_QUEUE: ['HOME'],
}

export function canTransition(from: KioskFlow, to: KioskFlow): boolean {
  return FLOW_TRANSITIONS[from].includes(to)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/flow.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/flow.ts apps/kiosk-web/src/lib/__tests__/flow.spec.ts
git commit -m "feat(kiosk-web): extended kiosk flow state machine (ADR-005)"
```

---

### Task 7: `lib/biometric.ts` (local-service seam, ADR-003)

**Files:**
- Create: `apps/kiosk-web/src/lib/biometric.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/biometric.spec.ts`

**Interfaces:**
- Consumes: `ApiClientError` from `@aq/api-client`
- Produces: `BiometricVerdict` union, `resolveBiometricBaseUrl(port?): string`, `createBiometricClient(options): { baseUrl, verify(): Promise<BiometricVerdict> }`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/biometric.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@aq/api-client'
import { createBiometricClient, resolveBiometricBaseUrl } from '../biometric'

describe('resolveBiometricBaseUrl', () => {
  it('defaults to port 5050', () => {
    expect(resolveBiometricBaseUrl()).toBe('http://localhost:5050/biometrik')
  })

  it('uses configured port', () => {
    expect(resolveBiometricBaseUrl(5800)).toBe('http://localhost:5800/biometrik')
  })
})

describe('createBiometricClient', () => {
  it('returns a SUCCESS verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ outcome: 'SUCCESS' }), { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify()
    expect(verdict).toEqual({ outcome: 'SUCCESS' })
  })

  it('returns a FAILED verdict', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ outcome: 'FAILED' }), { status: 200 }),
    ) as unknown as typeof fetch
    const verdict = await createBiometricClient({ fetchImpl }).verify()
    expect(verdict).toEqual({ outcome: 'FAILED' })
  })

  it('throws ApiClientError on network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(createBiometricClient({ fetchImpl }).verify()).rejects.toBeInstanceOf(
      ApiClientError,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/biometric.spec.ts`
Expected: FAIL — cannot find module `../biometric`.

- [ ] **Step 3: Create `biometric.ts`**

Create `apps/kiosk-web/src/lib/biometric.ts`:

```ts
import { ApiClientError } from '@aq/api-client'

export type BiometricVerdict =
  | { outcome: 'READY' }
  | { outcome: 'SUCCESS' }
  | { outcome: 'FAILED' | 'CANCELLED' | 'TIMEOUT' }

export type BiometricClientOptions = {
  port?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_PORT = 5050
const DEFAULT_TIMEOUT_MS = 30_000

export function resolveBiometricBaseUrl(port?: number): string {
  const resolved = port && port > 0 ? port : DEFAULT_PORT
  return `http://localhost:${resolved}/biometrik`
}

const VERDICT_OUTCOMES = ['READY', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'] as const

export function createBiometricClient(options: BiometricClientOptions = {}) {
  const baseUrl = resolveBiometricBaseUrl(options.port)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)

  async function verify(): Promise<BiometricVerdict> {
    let response: Response
    try {
      response = await fetchImpl(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Biometric request failed',
        0,
      )
    }
    const body = (await response.json().catch(() => null)) as { outcome?: string } | null
    if (
      response.ok &&
      body &&
      VERDICT_OUTCOMES.includes(body.outcome as (typeof VERDICT_OUTCOMES)[number])
    ) {
      return { outcome: body.outcome } as BiometricVerdict
    }
    throw new ApiClientError(
      body?.outcome ?? `Biometric request failed with status ${response.status}`,
      response.status,
    )
  }

  return { baseUrl, verify }
}

export type BiometricClient = ReturnType<typeof createBiometricClient>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/biometric.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/biometric.ts apps/kiosk-web/src/lib/__tests__/biometric.spec.ts
git commit -m "feat(kiosk-web): biometric local-service client seam (ADR-003)"
```

---

### Task 8: `lib/registrationReceipt.ts` (Bukti Registrasi layout)

**Files:**
- Create: `apps/kiosk-web/src/lib/registrationReceipt.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts`

**Interfaces:**
- Consumes: canvas 2D (same pattern as `lib/queueTicket.ts`)
- Produces: `RegistrationReceiptData`, `renderRegistrationReceiptPng(data): Promise<Blob>`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRegistrationReceiptPng } from '../registrationReceipt'

describe('renderRegistrationReceiptPng', () => {
  const ctx = {
    fillStyle: '',
    textAlign: '',
    font: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }

  beforeEach(() => {
    ctx.fillRect.mockClear()
    ctx.fillText.mockClear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
  })

  it('renders a PNG blob with receipt fields', async () => {
    const blob = await renderRegistrationReceiptPng({
      noAntrian: 7,
      regId: 'R1',
      pasienName: 'Andi',
      serviceName: 'Poli Jantung',
      stationId: 'K01',
    })
    expect(blob.type).toBe('image/png')
    expect(ctx.fillText).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/registrationReceipt.spec.ts`
Expected: FAIL — cannot find module `../registrationReceipt`.

- [ ] **Step 3: Create `registrationReceipt.ts`**

Create `apps/kiosk-web/src/lib/registrationReceipt.ts`:

```ts
export type RegistrationReceiptData = {
  noAntrian: number
  regId: string
  pasienName: string
  serviceName?: string
  dokterName?: string
  stationId?: string
  printedAt?: Date
}

/** ~80mm thermal width, taller than the queue ticket to fit the summary. */
const RECEIPT_WIDTH = 576
const RECEIPT_HEIGHT = 560

export async function renderRegistrationReceiptPng(data: RegistrationReceiptData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = RECEIPT_WIDTH
  canvas.height = RECEIPT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const printedAt = data.printedAt ?? new Date()
  const timeLabel = printedAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, RECEIPT_WIDTH, RECEIPT_HEIGHT)
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'

  ctx.font = '600 28px sans-serif'
  ctx.fillText('Bukti Registrasi', RECEIPT_WIDTH / 2, 56)

  ctx.font = '800 96px sans-serif'
  ctx.fillText(`Antrian ${data.noAntrian}`, RECEIPT_WIDTH / 2, 190)

  ctx.font = '600 30px sans-serif'
  ctx.fillText(data.pasienName, RECEIPT_WIDTH / 2, 250)
  ctx.font = '500 24px sans-serif'
  ctx.fillText(`Reg ID ${data.regId}`, RECEIPT_WIDTH / 2, 300)
  if (data.serviceName) ctx.fillText(data.serviceName, RECEIPT_WIDTH / 2, 340)
  if (data.dokterName) ctx.fillText(data.dokterName, RECEIPT_WIDTH / 2, 380)
  ctx.fillText(timeLabel, RECEIPT_WIDTH / 2, 440)
  if (data.stationId) ctx.fillText(`Station ${data.stationId}`, RECEIPT_WIDTH / 2, 480)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/registrationReceipt.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/lib/registrationReceipt.ts apps/kiosk-web/src/lib/__tests__/registrationReceipt.spec.ts
git commit -m "feat(kiosk-web): Bukti Registrasi PNG layout"
```

---

### Task 9: `lib/qrScanner.ts` + `lib/serviceCatalog.ts` (QR + catalog seams)

**Files:**
- Create: `apps/kiosk-web/src/lib/qrScanner.ts`
- Create: `apps/kiosk-web/src/lib/serviceCatalog.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/qrScanner.spec.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/serviceCatalog.spec.ts`

**Interfaces:**
- Produces: `QrScanResult`, `scanQrFromCamera(): Promise<QrScanResult>`; `ServiceCatalog` type, `createServiceCatalog(queries): ServiceCatalog`

- [ ] **Step 1: Write the failing tests**

Create `apps/kiosk-web/src/lib/__tests__/qrScanner.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scanQrFromCamera } from '../qrScanner'

describe('scanQrFromCamera', () => {
  it('returns a clear error when BarcodeDetector is unsupported', async () => {
    const result = await scanQrFromCamera()
    expect('error' in result).toBe(true)
  })
})
```

Create `apps/kiosk-web/src/lib/__tests__/serviceCatalog.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createServiceCatalog } from '../serviceCatalog'

describe('createServiceCatalog', () => {
  it('passes the active business date to each query', async () => {
    const listPoli = vi.fn(async () => [{ id: 'PO1', name: 'Poli Jantung' }])
    const listDokter = vi.fn(async () => [{ id: 'DP1', name: 'Dr. X' }])
    const listJadwal = vi.fn(async () => [
      { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    ])
    const catalog = createServiceCatalog({
      getBusinessDate: async () => '2026-08-03',
      listPoli,
      listDokter,
      listJadwal,
    })

    expect(await catalog.listPoli()).toHaveLength(1)
    expect(await catalog.listDokter('PO1')).toHaveLength(1)
    expect(await catalog.listJadwal('DP1')).toHaveLength(1)

    expect(listPoli).toHaveBeenCalledWith('2026-08-03')
    expect(listDokter).toHaveBeenCalledWith('2026-08-03', 'PO1')
    expect(listJadwal).toHaveBeenCalledWith('2026-08-03', 'DP1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/qrScanner.spec.ts src/lib/__tests__/serviceCatalog.spec.ts`
Expected: FAIL — cannot find modules `../qrScanner` and `../serviceCatalog`.

- [ ] **Step 3: Create `qrScanner.ts`**

Create `apps/kiosk-web/src/lib/qrScanner.ts`:

```ts
export type QrScanResult = { detected: string } | { error: string }

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

const MAX_ATTEMPTS = 50
const ATTEMPT_DELAY_MS = 200

export async function scanQrFromCamera(): Promise<QrScanResult> {
  const DetectorCtor = (
    window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  ).BarcodeDetector
  if (!DetectorCtor) {
    return { error: 'Pemindai QR tidak didukung oleh browser ini.' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { error: 'Kamera tidak tersedia pada perangkat ini.' }
  }
  try {
    const detector = new DetectorCtor({ formats: ['qr_code'] })
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('muted', 'true')
    video.setAttribute('playsinline', 'true')
    await video.play()
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const codes = await detector.detect(video)
        if (codes.length > 0) {
          return { detected: codes[0].rawValue }
        }
        await new Promise((resolve) => setTimeout(resolve, ATTEMPT_DELAY_MS))
      }
      return { error: 'Tidak ada QR terdeteksi. Silakan coba lagi.' }
    } finally {
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Pemindaian QR gagal.' }
  }
}
```

- [ ] **Step 4: Create `serviceCatalog.ts`**

Create `apps/kiosk-web/src/lib/serviceCatalog.ts`:

```ts
import type { JadwalItem, ServiceItem } from '@aq/shared-types'

export type ServiceCatalog = {
  listPoli: () => Promise<ServiceItem[]>
  listDokter: (poliId: string) => Promise<ServiceItem[]>
  listJadwal: (ppaId: string) => Promise<JadwalItem[]>
}

export function createServiceCatalog(queries: {
  getBusinessDate: () => Promise<string>
  listPoli: (businessDate: string) => Promise<ServiceItem[]>
  listDokter: (businessDate: string, poliId: string) => Promise<ServiceItem[]>
  listJadwal: (businessDate: string, ppaId: string) => Promise<JadwalItem[]>
}): ServiceCatalog {
  return {
    listPoli: async () => queries.listPoli(await queries.getBusinessDate()),
    listDokter: async (poliId) => queries.listDokter(await queries.getBusinessDate(), poliId),
    listJadwal: async (ppaId) => queries.listJadwal(await queries.getBusinessDate(), ppaId),
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/qrScanner.spec.ts src/lib/__tests__/serviceCatalog.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/lib/qrScanner.ts apps/kiosk-web/src/lib/serviceCatalog.ts apps/kiosk-web/src/lib/__tests__/qrScanner.spec.ts apps/kiosk-web/src/lib/__tests__/serviceCatalog.spec.ts
git commit -m "feat(kiosk-web): QR scan and walk-in service catalog seams"
```

---

### Task 10: `composables/useKioskSelfPrint.ts` (registration + queue-ticket printing)

**Files:**
- Create: `apps/kiosk-web/src/composables/useKioskSelfPrint.ts`
- Create: `apps/kiosk-web/src/composables/__tests__/useKioskSelfPrint.spec.ts`

**Interfaces:**
- Consumes: `createPrintProxyClient`/`PrintProxyClient` from `lib/printProxy`, `renderQueueTicketPng` from `lib/queueTicket`, `renderRegistrationReceiptPng` from `lib/registrationReceipt`, `RegistrationPrintContext`/`RegistrationPrintResult` from `useKioskRegistration` (defined in Task 11 — declare the two types here and re-export)
- Produces: `useKioskSelfPrint(options)` → `{ printPending, printError, printSucceeded, printRegistration(ctx), printQueueTicket(ticket, servicePointName?), resetPrintState }`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/composables/__tests__/useKioskSelfPrint.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'
import { useKioskSelfPrint } from '../useKioskSelfPrint'
import type { PrintProxyClient, PrintProxyResult } from '../../lib/printProxy'

function makeTicket(label = 'B-001'): AdmissionQueueIntakeResponse {
  return { antrianId: 'B1', noUrut: 1, queueLabel: label, createdAt: '2026-08-03T08:00:00' }
}

describe('useKioskSelfPrint', () => {
  it('prints a registration receipt with doctype registrasi', async () => {
    const urls: string[] = []
    const printPng = vi.fn(async (_blob: Blob, doctype: string): Promise<PrintProxyResult> => {
      urls.push(doctype)
      return { success: true, jobId: 'j1', isNetworkError: false }
    })
    const createClient = (): PrintProxyClient =>
      ({ baseUrl: 'http://localhost:5050/print', checkHealth: async () => null, printPng }) as unknown as PrintProxyClient

    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient,
      renderRegistration: async () => new Blob(['png'], { type: 'image/png' }),
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const result = await print.printRegistration({
      result: { regId: 'R1', noAntrian: 12 },
      pasienName: 'Andi',
    })
    expect(result.printed).toBe(true)
    expect(urls).toEqual(['registrasi'])
    expect(print.printSucceeded.value).toBe(true)
  })

  it('prints a queue ticket with doctype antrian', async () => {
    const urls: string[] = []
    const printPng = vi.fn(async (_blob: Blob, doctype: string): Promise<PrintProxyResult> => {
      urls.push(doctype)
      return { success: true, jobId: 'j2', isNetworkError: false }
    })
    const createClient = (): PrintProxyClient =>
      ({ baseUrl: 'http://localhost:5050/print', checkHealth: async () => null, printPng }) as unknown as PrintProxyClient

    const print = useKioskSelfPrint({
      stationId: ref('K01'),
      createClient,
      renderRegistration: async () => new Blob(['png'], { type: 'image/png' }),
      renderTicket: async () => new Blob(['png'], { type: 'image/png' }),
    })

    const result = await print.printQueueTicket(makeTicket())
    expect(result.printed).toBe(true)
    expect(urls).toEqual(['antrian'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskSelfPrint.spec.ts`
Expected: FAIL — cannot find module `../useKioskSelfPrint`.

- [ ] **Step 3: Create `useKioskSelfPrint.ts`**

Create `apps/kiosk-web/src/composables/useKioskSelfPrint.ts`:

```ts
import { ref, type Ref } from 'vue'
import type { AdmissionQueueIntakeResponse, ReturnCreateWalkIn } from '@aq/shared-types'
import { createPrintProxyClient, type PrintProxyClient } from '../lib/printProxy'
import { renderQueueTicketPng } from '../lib/queueTicket'
import { renderRegistrationReceiptPng } from '../lib/registrationReceipt'

export type RegistrationPrintResult = { printed: boolean; error?: string }

export type RegistrationPrintContext = {
  result: ReturnCreateWalkIn
  pasienName: string
  serviceName?: string
  dokterName?: string
}

export type UseKioskSelfPrintOptions = {
  stationId: Ref<string>
  printerProxyPort?: Ref<number | undefined>
  createClient?: (port?: number) => PrintProxyClient
  renderRegistration?: typeof renderRegistrationReceiptPng
  renderTicket?: typeof renderQueueTicketPng
}

export function useKioskSelfPrint(options: UseKioskSelfPrintOptions) {
  const printPending = ref(false)
  const printError = ref<string | null>(null)
  const printSucceeded = ref(false)

  const createClient =
    options.createClient ?? ((port?: number) => createPrintProxyClient({ port }))
  const renderRegistration = options.renderRegistration ?? renderRegistrationReceiptPng
  const renderTicket = options.renderTicket ?? renderQueueTicketPng

  async function printRegistration(
    ctx: RegistrationPrintContext,
  ): Promise<RegistrationPrintResult> {
    if (printPending.value) return { printed: false, error: 'Cetak sedang berlangsung.' }
    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const blob = await renderRegistration({
        noAntrian: ctx.result.noAntrian,
        regId: ctx.result.regId,
        pasienName: ctx.pasienName,
        serviceName: ctx.serviceName,
        dokterName: ctx.dokterName,
        stationId: options.stationId.value,
      })
      const proxyResult = await client.printPng(blob, 'registrasi')
      if (!proxyResult.success) {
        printError.value = proxyResult.error ?? 'Cetak gagal'
        printSucceeded.value = false
        return { printed: false, error: printError.value }
      }
      printSucceeded.value = true
      return { printed: true }
    } catch (error) {
      printError.value = error instanceof Error ? error.message : 'Cetak gagal'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    } finally {
      printPending.value = false
    }
  }

  async function printQueueTicket(
    ticket: AdmissionQueueIntakeResponse,
    servicePointName?: string,
  ): Promise<RegistrationPrintResult> {
    if (!ticket.queueLabel) {
      printError.value = 'Tidak ada nomor antrian untuk dicetak.'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    }
    if (printPending.value) return { printed: false, error: 'Cetak sedang berlangsung.' }
    printPending.value = true
    printError.value = null
    try {
      const client = createClient(options.printerProxyPort?.value)
      const blob = await renderTicket({
        queueLabel: ticket.queueLabel,
        servicePointName,
        stationId: options.stationId.value,
      })
      const proxyResult = await client.printPng(blob, 'antrian')
      if (!proxyResult.success) {
        printError.value = proxyResult.error ?? 'Cetak gagal'
        printSucceeded.value = false
        return { printed: false, error: printError.value }
      }
      printSucceeded.value = true
      return { printed: true }
    } catch (error) {
      printError.value = error instanceof Error ? error.message : 'Cetak gagal'
      printSucceeded.value = false
      return { printed: false, error: printError.value }
    } finally {
      printPending.value = false
    }
  }

  function resetPrintState() {
    printPending.value = false
    printError.value = null
    printSucceeded.value = false
  }

  return {
    printPending,
    printError,
    printSucceeded,
    printRegistration,
    printQueueTicket,
    resetPrintState,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskSelfPrint.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskSelfPrint.ts apps/kiosk-web/src/composables/__tests__/useKioskSelfPrint.spec.ts
git commit -m "feat(kiosk-web): self-registration print composable"
```

---

### Task 11: `composables/useKioskRegistration.ts` (orchestrator)

**Files:**
- Create: `apps/kiosk-web/src/composables/useKioskRegistration.ts`
- Create: `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`

**Interfaces:**
- Consumes: types from `@aq/shared-types`, `canTransition`/`KioskFlow` from `lib/flow`, eligibility helpers from `lib/eligibility`, `mapErrorToFailureCode`/`FailureCode` from `lib/failureCode`, `KIOSK_USER_ID`/reset constants from `lib/constants`, `BiometricVerdict` from `lib/biometric`, `RegistrationPrintContext`/`RegistrationPrintResult` from `useKioskSelfPrint`
- Produces: `useKioskRegistration(deps)` → `{ flow, mode, submitting, businessDate, bookingKeyword, selectedBooking, bookingDetail, bookingEligibility, patientMatches, selectedPatient, walkinEligibility, walkinNoPeserta, selectedService, registrationResult, assistanceTicket, assistanceServicePointId, errorContext, biometricVerdict, startBookingFlow, startWalkinFlow, goHome, dispose, submitBookingKeyword, confirmBooking, searchWalkinPatient, selectPatient, selectService, setWalkinNoPeserta, confirmWalkin, confirmAssistance, reprintRegistration, reprintQueueTicket, startIdleReset, stopIdleReset }` plus exported types `EligibilityStatus`, `FailureContext`, `BookingRegContext`, `WalkinRegContext`, `KioskRegistrationDeps`

- [ ] **Step 1: Write the failing test**

Create `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type {
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  PasienSearchItem,
  Polis,
} from '@aq/shared-types'
import { useKioskRegistration, type KioskRegistrationDeps } from '../useKioskRegistration'

const bookingItem: BookingSearchItem = {
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

const bpjsDetail: BookingDetail = {
  ...bookingItem,
  coverageInfo: { asuransiName: 'BPJS', noPeserta: '000123456', noRujukan: 'REF1' },
}

const umumDetail: BookingDetail = {
  ...bookingItem,
  coverageInfo: { asuransiName: '', noPeserta: '', noRujukan: '' },
}

const bpjsPolis: Polis = {
  polisId: 'P1',
  noPolis: '000123456',
  atasName: 'Andi',
  pasien: { pasienId: 'PT1' },
  tipeJaminan: { tipeJaminanId: 'BPJS', tipeJaminanName: 'BPJS' },
  tglExpired: null,
}

const group: GroupJaminanMap = { tipeJaminanId: 'BPJS', groupJaminanId: 'G1', groupJaminanName: 'BPJS' }
const pasien: PasienSearchItem = { pasienId: 'PT1', pasienName: 'Andi' }

function makeDeps(overrides: Partial<KioskRegistrationDeps> = {}): KioskRegistrationDeps {
  return {
    stationId: ref('K01'),
    getBusinessDate: vi.fn(async () => '2026-08-03'),
    searchBooking: vi.fn(async () => [bookingItem]),
    getBookingDetail: vi.fn(async () => bpjsDetail),
    listPolis: vi.fn(async () => [bpjsPolis]),
    getGroupJaminanMap: vi.fn(async () => group),
    searchPasien: vi.fn(async () => [pasien]),
    verifyBiometric: vi.fn(async () => ({ outcome: 'SUCCESS' })),
    registerBooking: vi.fn(async () => ({ regId: 'R1', noAntrian: 12 })),
    registerWalkin: vi.fn(async () => ({ regId: 'R2', noAntrian: 13 })),
    bookingAssistance: vi.fn(async () => ({
      antrianId: 'B1',
      noUrut: 1,
      queueLabel: 'B-001',
      createdAt: '2026-08-03T08:00:00',
    })),
    intake: vi.fn(async () => ({
      antrianId: 'Q1',
      noUrut: 2,
      queueLabel: 'A0002',
      createdAt: '2026-08-03T08:00:00',
    })),
    printRegistration: vi.fn(async () => ({ printed: true })),
    printQueueTicket: vi.fn(async () => ({ printed: true })),
    offeringsName: (id) => id,
    now: () => 1000,
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useKioskRegistration booking flow', () => {
  it('routes booking-not-found straight to failure', async () => {
    const reg = useKioskRegistration(makeDeps({ searchBooking: vi.fn(async () => []) }))
    reg.startBookingFlow()
    await reg.submitBookingKeyword('NOPE')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BOOKING_NOT_FOUND')
  })

  it('shows confirm with needsEligibility for BPJS booking', async () => {
    const reg = useKioskRegistration(makeDeps())
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    expect(reg.flow.value).toBe('BOOKING_CONFIRM')
    expect(reg.bookingEligibility.value?.needsEligibility).toBe(true)
  })

  it('registers a non-BPJS booking to success', async () => {
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(reg.registrationResult.value?.noAntrian).toBe(12)
    expect(deps.registerBooking).toHaveBeenCalledWith({
      bookingId: 'BK1',
      pasienId: 'PT1',
      tipeJaminanId: '00000',
      noPeserta: null,
      userId: 'hidokkiosk',
    })
  })

  it('runs biometric before registering a BPJS booking', async () => {
    const deps = makeDeps({
      verifyBiometric: vi.fn(async () => {
        expect(reg.flow.value).toBe('BIOMETRIC_VERIFY')
        return { outcome: 'SUCCESS' }
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(deps.verifyBiometric).toHaveBeenCalledTimes(1)
    expect(deps.registerBooking).toHaveBeenCalledTimes(1)
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
  })

  it('maps biometric timeout to failure', async () => {
    const deps = makeDeps({ verifyBiometric: vi.fn(async () => ({ outcome: 'TIMEOUT' })) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BIOMETRIC_TIMEOUT')
  })

  it('falls back to booking-assistance on registration failure', async () => {
    const deps = makeDeps({
      getBookingDetail: vi.fn(async () => umumDetail),
      registerBooking: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('FAILURE')
    await reg.confirmAssistance('REG')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(reg.assistanceTicket.value?.queueLabel).toBe('B-001')
    expect(deps.bookingAssistance).toHaveBeenCalledWith({
      bookingId: 'BK1',
      servicePointId: 'REG',
      kioskId: 'K01',
      userId: 'hidokkiosk',
    })
  })
})

describe('useKioskRegistration walk-in flow', () => {
  it('always shows the patient picker even for a single match', async () => {
    const reg = useKioskRegistration(makeDeps())
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    expect(reg.flow.value).toBe('WALKIN_SELECT_PATIENT')
    expect(reg.patientMatches.value).toHaveLength(1)
  })

  it('walks through patient → service → confirm → register', async () => {
    const deps = makeDeps()
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(true)
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    expect(reg.flow.value).toBe('WALKIN_CONFIRM')
    await reg.confirmWalkin()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    expect(deps.registerWalkin).toHaveBeenCalledWith({
      pasienId: 'PT1',
      poliId: 'PO1',
      ppaId: 'DP1',
      jadwalId: 'J1',
      tglBerobat: '2026-08-03',
      tipeJaminanId: 'BPJS',
      noPeserta: '000123456',
      userId: 'hidokkiosk',
    })
  })

  it('falls back to intake on walk-in failure', async () => {
    const deps = makeDeps({
      listPolis: vi.fn(async () => []),
      registerWalkin: vi.fn(async () => {
        throw new Error('full')
      }),
    })
    const reg = useKioskRegistration(deps)
    reg.startWalkinFlow()
    await reg.searchWalkinPatient('ANDI')
    await reg.selectPatient(pasien)
    expect(reg.walkinEligibility.value?.needsEligibility).toBe(false)
    reg.selectService({
      poli: { id: 'PO1', name: 'Poli Jantung' },
      dokter: { id: 'DP1', name: 'Dr. X' },
      jadwal: { jadwalId: 'J1', ppaId: 'DP1', jamPraktek: '08:00', sisaKuota: 5 },
    })
    await reg.confirmWalkin()
    expect(reg.flow.value).toBe('FAILURE')
    await reg.confirmAssistance('REG')
    expect(reg.flow.value).toBe('ASSISTANCE_QUEUE')
    expect(reg.assistanceTicket.value?.queueLabel).toBe('A0002')
    expect(deps.intake).toHaveBeenCalledWith('REG')
  })
})

describe('useKioskRegistration guards and reset', () => {
  it('ignores a second submit while pending', async () => {
    let resolveSearch!: (v: BookingSearchItem[]) => void
    const pendingSearch = new Promise<BookingSearchItem[]>((resolve) => {
      resolveSearch = resolve
    })
    const deps = makeDeps({ searchBooking: vi.fn(() => pendingSearch) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    const first = reg.submitBookingKeyword('BK1')
    const second = reg.submitBookingKeyword('BK1')
    resolveSearch([bookingItem])
    await Promise.all([first, second])
    expect(deps.searchBooking).toHaveBeenCalledTimes(1)
  })

  it('returns to HOME after 60s idle while on a flow', async () => {
    let nowMs = 1000
    vi.useFakeTimers()
    const reg = useKioskRegistration(makeDeps({ now: () => nowMs }))
    reg.startIdleReset()
    reg.startBookingFlow()
    expect(reg.flow.value).toBe('BOOKING_SEARCH')
    nowMs = 2000 + 60_000
    await vi.advanceTimersByTimeAsync(1100)
    expect(reg.flow.value).toBe('HOME')
  })

  it('returns to HOME 10s after a successful registration print', async () => {
    vi.useFakeTimers()
    const deps = makeDeps({ getBookingDetail: vi.fn(async () => umumDetail) })
    const reg = useKioskRegistration(deps)
    reg.startBookingFlow()
    await reg.submitBookingKeyword('BK1')
    await reg.confirmBooking()
    expect(reg.flow.value).toBe('REGISTRATION_SUCCESS')
    await vi.advanceTimersByTimeAsync(10_100)
    expect(reg.flow.value).toBe('HOME')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`
Expected: FAIL — cannot find module `../useKioskRegistration`.

- [ ] **Step 3: Create `useKioskRegistration.ts`**

Create `apps/kiosk-web/src/composables/useKioskRegistration.ts`:

```ts
import { ref, type Ref } from 'vue'
import type {
  AdmissionQueueIntakeResponse,
  BookingAssistanceBody,
  BookingDetail,
  BookingSearchItem,
  GroupJaminanMap,
  PasienSearchItem,
  Polis,
  ReturnCreateWalkIn,
  ServiceSelection,
} from '@aq/shared-types'
import { canTransition, type KioskFlow } from '../lib/flow'
import {
  computeNeedsEligibility,
  deriveBookingJaminan,
  deriveWalkinJaminan,
} from '../lib/eligibility'
import {
  ASSISTANCE_RESET_MS,
  IDLE_RESET_MS,
  KIOSK_USER_ID,
  SUCCESS_RESET_MS,
} from '../lib/constants'
import { mapErrorToFailureCode, type FailureCode } from '../lib/failureCode'
import type { BiometricVerdict } from '../lib/biometric'
import type { RegistrationPrintContext, RegistrationPrintResult } from './useKioskSelfPrint'

export type FlowMode = 'booking' | 'walkin'

export type EligibilityStatus = {
  tipeJaminanId: string
  tipeJaminanName: string
  noPeserta: string | null
  needsEligibility: boolean
}

export type FailureContext = { code: FailureCode; message: string }

export type BookingRegContext = {
  bookingId: string
  pasienId: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}

export type WalkinRegContext = {
  pasienId: string
  poliId: string
  ppaId: string
  jadwalId: string
  tglBerobat: string
  tipeJaminanId: string
  noPeserta: string | null
  userId: string
}

export type KioskRegistrationDeps = {
  stationId: Ref<string>
  getBusinessDate: () => Promise<string>
  searchBooking: (tglBerobat: string, keyword: string) => Promise<BookingSearchItem[]>
  getBookingDetail: (bookingId: string) => Promise<BookingDetail>
  listPolis: (pasienId: string) => Promise<Polis[]>
  getGroupJaminanMap: (tipeJaminanId: string) => Promise<GroupJaminanMap | null>
  searchPasien: (keyword: string) => Promise<PasienSearchItem[]>
  verifyBiometric: () => Promise<BiometricVerdict>
  registerBooking: (ctx: BookingRegContext) => Promise<ReturnCreateWalkIn>
  registerWalkin: (ctx: WalkinRegContext) => Promise<ReturnCreateWalkIn>
  bookingAssistance: (body: BookingAssistanceBody) => Promise<AdmissionQueueIntakeResponse>
  intake: (servicePointId: string) => Promise<AdmissionQueueIntakeResponse>
  printRegistration: (ctx: RegistrationPrintContext) => Promise<RegistrationPrintResult>
  printQueueTicket: (
    ticket: AdmissionQueueIntakeResponse,
    servicePointName?: string,
  ) => Promise<RegistrationPrintResult>
  offeringsName?: (servicePointId: string) => string | undefined
  now?: () => number
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.'
}

export function useKioskRegistration(deps: KioskRegistrationDeps) {
  const flow = ref<KioskFlow>('HOME')
  const mode = ref<FlowMode | null>(null)
  const submitting = ref(false)
  const businessDate = ref<string | null>(null)

  const bookingKeyword = ref('')
  const selectedBooking = ref<BookingSearchItem | null>(null)
  const bookingDetail = ref<BookingDetail | null>(null)
  const bookingEligibility = ref<EligibilityStatus | null>(null)

  const patientMatches = ref<PasienSearchItem[]>([])
  const selectedPatient = ref<PasienSearchItem | null>(null)
  const walkinEligibility = ref<EligibilityStatus | null>(null)
  const walkinNoPeserta = ref('')
  const selectedService = ref<ServiceSelection | null>(null)

  const registrationResult = ref<ReturnCreateWalkIn | null>(null)
  const assistanceTicket = ref<AdmissionQueueIntakeResponse | null>(null)
  const assistanceServicePointId = ref<string | null>(null)
  const errorContext = ref<FailureContext | null>(null)
  const biometricVerdict = ref<BiometricVerdict | null>(null)

  const lastActivity = ref(deps.now ? deps.now() : Date.now())
  let idleTimer: number | null = null
  let autoHomeTimer: number | null = null

  function touch() {
    lastActivity.value = deps.now ? deps.now() : Date.now()
  }

  function transition(to: KioskFlow) {
    if (!canTransition(flow.value, to)) {
      throw new Error(`Illegal transition ${flow.value} -> ${to}`)
    }
    flow.value = to
  }

  function setFailure(code: FailureCode, message: string) {
    errorContext.value = { code, message }
    transition('FAILURE')
  }

  function clearAutoHome() {
    if (autoHomeTimer !== null) {
      window.clearTimeout(autoHomeTimer)
      autoHomeTimer = null
    }
  }

  function scheduleAutoHome(ms: number) {
    clearAutoHome()
    autoHomeTimer = window.setTimeout(() => {
      goHome()
    }, ms)
  }

  function goHome() {
    clearAutoHome()
    flow.value = 'HOME'
    mode.value = null
    businessDate.value = null
    bookingKeyword.value = ''
    selectedBooking.value = null
    bookingDetail.value = null
    bookingEligibility.value = null
    patientMatches.value = []
    selectedPatient.value = null
    walkinEligibility.value = null
    walkinNoPeserta.value = ''
    selectedService.value = null
    registrationResult.value = null
    assistanceTicket.value = null
    assistanceServicePointId.value = null
    errorContext.value = null
    biometricVerdict.value = null
    submitting.value = false
    touch()
  }

  async function ensureBusinessDate(): Promise<string> {
    if (businessDate.value) return businessDate.value
    const date = await deps.getBusinessDate()
    businessDate.value = date
    return date
  }

  async function withSubmit(fn: () => Promise<void>): Promise<void> {
    if (submitting.value) return
    submitting.value = true
    try {
      await fn()
    } finally {
      submitting.value = false
    }
  }

  function startBookingFlow() {
    touch()
    mode.value = 'booking'
    errorContext.value = null
    transition('BOOKING_SEARCH')
  }

  function startWalkinFlow() {
    touch()
    mode.value = 'walkin'
    errorContext.value = null
    transition('WALKIN_SEARCH')
  }

  function submitBookingKeyword(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    return withSubmit(async () => {
      const tgl = await ensureBusinessDate()
      const matches = await deps.searchBooking(tgl, trimmed)
      if (matches.length === 0) {
        setFailure('BOOKING_NOT_FOUND', 'Booking tidak ditemukan untuk kode tersebut.')
        return
      }
      if (matches.length > 1) {
        setFailure('UNKNOWN_ERROR', 'Ditemukan lebih dari satu booking. Hubungi petugas.')
        return
      }
      const booking = matches[0]
      selectedBooking.value = booking
      const detail = await deps.getBookingDetail(booking.bookingId)
      const polisList = await deps.listPolis(detail.reg.pasienId)
      const jaminan = deriveBookingJaminan(detail, polisList)
      const group = await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
      bookingDetail.value = detail
      bookingEligibility.value = {
        tipeJaminanId: jaminan.tipeJaminanId,
        tipeJaminanName: jaminan.tipeJaminanName,
        noPeserta: jaminan.noPeserta,
        needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
      }
      transition('BOOKING_CONFIRM')
    })
  }

  function confirmBooking(): Promise<void> {
    touch()
    if (submitting.value) return Promise.resolve()
    if (bookingEligibility.value?.needsEligibility) {
      transition('BIOMETRIC_VERIFY')
      return withSubmit(() => runBiometric('booking'))
    }
    return withSubmit(() => register('booking'))
  }

  async function runBiometric(currentMode: FlowMode): Promise<void> {
    biometricVerdict.value = null
    try {
      const verdict = await deps.verifyBiometric()
      biometricVerdict.value = verdict
      if (verdict.outcome === 'SUCCESS' || verdict.outcome === 'READY') {
        await register(currentMode)
      } else if (verdict.outcome === 'TIMEOUT') {
        setFailure('BIOMETRIC_TIMEOUT', 'Verifikasi biometrik melewati batas waktu.')
      } else {
        setFailure('BIOMETRIC_FAILED', 'Verifikasi biometrik gagal.')
      }
    } catch (error) {
      setFailure('BACKEND_ERROR', messageFromError(error))
    }
  }

  async function register(currentMode: FlowMode): Promise<void> {
    try {
      const result =
        currentMode === 'booking'
          ? await registerBookingCommit()
          : await registerWalkinCommit()
      registrationResult.value = result
      transition('REGISTRATION_SUCCESS')
      const printed = await deps.printRegistration(buildPrintContext(currentMode))
      if (printed.printed) scheduleAutoHome(SUCCESS_RESET_MS)
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }

  async function registerBookingCommit(): Promise<ReturnCreateWalkIn> {
    const detail = bookingDetail.value
    if (!detail) throw new Error('Booking detail missing')
    return deps.registerBooking({
      bookingId: detail.bookingId,
      pasienId: detail.reg.pasienId,
      tipeJaminanId: bookingEligibility.value?.tipeJaminanId ?? '00000',
      noPeserta: bookingEligibility.value?.noPeserta ?? null,
      userId: KIOSK_USER_ID,
    })
  }

  async function registerWalkinCommit(): Promise<ReturnCreateWalkIn> {
    const patient = selectedPatient.value
    const service = selectedService.value
    if (!patient || !service) throw new Error('Walk-in selection incomplete')
    return deps.registerWalkin({
      pasienId: patient.pasienId,
      poliId: service.poli.id,
      ppaId: service.dokter.id,
      jadwalId: service.jadwal.jadwalId,
      tglBerobat: businessDate.value ?? '',
      tipeJaminanId: walkinEligibility.value?.tipeJaminanId ?? '00000',
      noPeserta: walkinNoPeserta.value || walkinEligibility.value?.noPeserta || null,
      userId: KIOSK_USER_ID,
    })
  }

  function buildPrintContext(currentMode: FlowMode): RegistrationPrintContext {
    const result = registrationResult.value
    if (!result) throw new Error('Registration result missing')
    return {
      result,
      pasienName:
        currentMode === 'booking'
          ? bookingDetail.value?.reg.pasienName ?? ''
          : selectedPatient.value?.pasienName ?? '',
      serviceName:
        currentMode === 'booking'
          ? bookingDetail.value?.layanan.layananName
          : selectedService.value?.poli.name,
      dokterName:
        currentMode === 'booking'
          ? bookingDetail.value?.dokter.ppaName
          : selectedService.value?.dokter.name,
    }
  }

  function searchWalkinPatient(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    return withSubmit(async () => {
      const matches = await deps.searchPasien(trimmed)
      if (matches.length === 0) {
        setFailure('BOOKING_NOT_FOUND', 'Pasien tidak ditemukan untuk keyword tersebut.')
        return
      }
      patientMatches.value = matches
      transition('WALKIN_SELECT_PATIENT')
    })
  }

  function selectPatient(patient: PasienSearchItem): Promise<void> {
    touch()
    return withSubmit(async () => {
      const polisList = await deps.listPolis(patient.pasienId)
      const jaminan = deriveWalkinJaminan(polisList)
      const group = await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
      selectedPatient.value = patient
      walkinEligibility.value = {
        tipeJaminanId: jaminan.tipeJaminanId,
        tipeJaminanName: jaminan.tipeJaminanName,
        noPeserta: jaminan.noPeserta,
        needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
      }
      walkinNoPeserta.value = ''
      transition('WALKIN_SELECT_SERVICE')
    })
  }

  function selectService(service: ServiceSelection) {
    touch()
    selectedService.value = service
    transition('WALKIN_CONFIRM')
  }

  function setWalkinNoPeserta(value: string) {
    walkinNoPeserta.value = value.trim()
  }

  function confirmWalkin(): Promise<void> {
    touch()
    if (submitting.value) return Promise.resolve()
    if (walkinEligibility.value?.needsEligibility) {
      transition('BIOMETRIC_VERIFY')
      return withSubmit(() => runBiometric('walkin'))
    }
    return withSubmit(() => register('walkin'))
  }

  function confirmAssistance(servicePointId: string): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        const ticket =
          mode.value === 'booking'
            ? await deps.bookingAssistance({
                bookingId: selectedBooking.value?.bookingId,
                servicePointId,
                kioskId: deps.stationId.value,
                userId: KIOSK_USER_ID,
              })
            : await deps.intake(servicePointId)
        assistanceTicket.value = ticket
        assistanceServicePointId.value = servicePointId
        transition('ASSISTANCE_QUEUE')
        const printed = await deps.printQueueTicket(
          ticket,
          deps.offeringsName?.(servicePointId),
        )
        if (printed.printed) scheduleAutoHome(ASSISTANCE_RESET_MS)
      } catch (error) {
        errorContext.value = {
          code: mapErrorToFailureCode(error),
          message: messageFromError(error),
        }
      }
    })
  }

  async function reprintRegistration() {
    if (!registrationResult.value) return
    await deps.printRegistration(buildPrintContext(mode.value ?? 'booking'))
  }

  async function reprintQueueTicket() {
    if (!assistanceTicket.value) return
    await deps.printQueueTicket(
      assistanceTicket.value,
      deps.offeringsName?.(assistanceServicePointId.value ?? ''),
    )
  }

  function startIdleReset() {
    stopIdleReset()
    idleTimer = window.setInterval(() => {
      const now = deps.now ? deps.now() : Date.now()
      if (flow.value !== 'HOME' && now - lastActivity.value > IDLE_RESET_MS) {
        goHome()
      }
    }, 1000)
  }

  function stopIdleReset() {
    if (idleTimer !== null) {
      window.clearInterval(idleTimer)
      idleTimer = null
    }
  }

  function dispose() {
    stopIdleReset()
    clearAutoHome()
  }

  return {
    flow,
    mode,
    submitting,
    businessDate,
    bookingKeyword,
    selectedBooking,
    bookingDetail,
    bookingEligibility,
    patientMatches,
    selectedPatient,
    walkinEligibility,
    walkinNoPeserta,
    selectedService,
    registrationResult,
    assistanceTicket,
    assistanceServicePointId,
    errorContext,
    biometricVerdict,
    startBookingFlow,
    startWalkinFlow,
    goHome,
    dispose,
    submitBookingKeyword,
    confirmBooking,
    searchWalkinPatient,
    selectPatient,
    selectService,
    setWalkinNoPeserta,
    confirmWalkin,
    confirmAssistance,
    reprintRegistration,
    reprintQueueTicket,
    startIdleReset,
    stopIdleReset,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskRegistration.spec.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts
git commit -m "feat(kiosk-web): self-registration orchestrator with state machine and guards"
```

---

### Task 12: Step components — home, booking, biometric

**Files:**
- Create: `apps/kiosk-web/src/views/KioskHome.vue`
- Create: `apps/kiosk-web/src/views/steps/BookingSearchStep.vue`
- Create: `apps/kiosk-web/src/views/steps/BookingConfirmStep.vue`
- Create: `apps/kiosk-web/src/views/steps/BiometricStep.vue`
- Modify: `apps/kiosk-web/src/styles.css`
- Create: `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`

**Interfaces:**
- Consumes: `BookingDetail` from `@aq/shared-types`, `EligibilityStatus` from `composables/useKioskRegistration`
- Produces: `KioskHome` (emits `startBooking`/`startWalkin`/`startIntake`), `BookingSearchStep` (emits `submit(keyword)`/`scan`/`back`), `BookingConfirmStep` (emits `confirm`/`back`), `BiometricStep` (presentational)

- [ ] **Step 1: Write the failing component test**

Create `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskHome from '../KioskHome.vue'

describe('KioskHome', () => {
  it('renders the three entry buttons', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    expect(wrapper.get('[data-testid="start-booking"]').text()).toContain('Booking')
    expect(wrapper.get('[data-testid="start-walkin"]').text()).toContain('Tanpa Booking')
    expect(wrapper.get('[data-testid="start-intake"]').text()).toContain('Antrian Pendaftaran')
  })

  it('disables intake when no offerings', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: false } })
    expect((wrapper.get('[data-testid="start-intake"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskHome.spec.ts`
Expected: FAIL — cannot find module `../KioskHome.vue`.

- [ ] **Step 3: Create `KioskHome.vue`**

Create `apps/kiosk-web/src/views/KioskHome.vue`:

```vue
<script setup lang="ts">
defineProps<{ intakeAvailable: boolean }>()
defineEmits<{
  startBooking: []
  startWalkin: []
  startIntake: []
}>()
</script>

<template>
  <section class="panel">
    <h1>Pendaftaran Rawat Jalan</h1>
    <p>Pilih layanan pendaftaran mandiri.</p>
    <div class="sp-grid">
      <button type="button" class="sp-btn" data-testid="start-booking" @click="$emit('startBooking')">
        Check-in Booking
        <small>Pasien dengan booking</small>
      </button>
      <button type="button" class="sp-btn" data-testid="start-walkin" @click="$emit('startWalkin')">
        Daftar Tanpa Booking
        <small>Go-show / walk-in</small>
      </button>
      <button
        type="button"
        class="sp-btn"
        :disabled="!intakeAvailable"
        data-testid="start-intake"
        @click="$emit('startIntake')"
      >
        Ambil Antrian Pendaftaran
        <small>Antrian loket pendaftaran</small>
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Create `BookingSearchStep.vue`**

Create `apps/kiosk-web/src/views/steps/BookingSearchStep.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ pending: boolean; errorMessage: string | null }>()
const emit = defineEmits<{ submit: [keyword: string]; scan: []; back: [] }>()
const keyword = ref('')

function submit() {
  if (!keyword.value.trim()) return
  emit('submit', keyword.value)
}
</script>

<template>
  <section class="panel">
    <h1>Check-in Booking</h1>
    <p>Masukkan kode booking, atau scan QR dari kartu booking Anda.</p>
    <input
      v-model="keyword"
      class="big-input"
      placeholder="Kode booking"
      data-testid="booking-keyword"
      @keyup.enter="submit"
    />
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="booking-submit" @click="submit">
        Lanjutkan
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" data-testid="booking-scan" @click="$emit('scan')">
        Scan QR
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mencari booking…</p>
    <p v-if="errorMessage" class="status error" data-testid="booking-error">{{ errorMessage }}</p>
  </section>
</template>
```

- [ ] **Step 5: Create `BookingConfirmStep.vue`**

Create `apps/kiosk-web/src/views/steps/BookingConfirmStep.vue`:

```vue
<script setup lang="ts">
import type { BookingDetail } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

defineProps<{
  booking: BookingDetail
  eligibility: EligibilityStatus
  pending: boolean
  errorMessage: string | null
}>()
defineEmits<{ confirm: []; back: [] }>()
</script>

<template>
  <section class="panel">
    <h1>Konfirmasi Booking</h1>
    <dl class="detail-list">
      <dt>Pasien</dt>
      <dd>{{ booking.reg.pasienName }}</dd>
      <dt>Poli</dt>
      <dd>{{ booking.layanan.layananName }}</dd>
      <dt>Dokter</dt>
      <dd>{{ booking.dokter.ppaName }}</dd>
      <dt>Tanggal</dt>
      <dd>{{ booking.tglBerobat }}</dd>
      <dt>Jam</dt>
      <dd>{{ booking.jamPraktek }}</dd>
      <dt>Jaminan</dt>
      <dd>
        {{ eligibility.tipeJaminanName }}
        <span v-if="eligibility.needsEligibility">· verifikasi BPJS</span>
      </dd>
    </dl>
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="booking-confirm" @click="$emit('confirm')">
        Konfirmasi
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mendaftarkan…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
```

- [ ] **Step 6: Create `BiometricStep.vue`**

Create `apps/kiosk-web/src/views/steps/BiometricStep.vue`:

```vue
<script setup lang="ts">
defineProps<{ pending: boolean; errorMessage: string | null }>()
</script>

<template>
  <section class="panel">
    <h1>Verifikasi Biometrik</h1>
    <p v-if="pending">Menghubungkan layanan biometrik… Menunggu verifikasi sidik jari.</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
```

- [ ] **Step 7: Add supporting CSS**

Append to `apps/kiosk-web/src/styles.css`:

```css
.big-input {
  margin-top: 1.5rem;
  width: 100%;
  font-size: 1.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 2px solid #c9d8e6;
}

.panel h2 {
  margin: 1.5rem 0 0.5rem;
  font-size: 1.2rem;
}

.detail-list {
  margin: 1.5rem 0 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
}

.detail-list dt {
  font-weight: 700;
  color: var(--text);
}

.detail-list dd {
  margin: 0;
  color: var(--muted);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskHome.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/kiosk-web/src/views/KioskHome.vue apps/kiosk-web/src/views/steps apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts apps/kiosk-web/src/styles.css
git commit -m "feat(kiosk-web): home, booking and biometric step components"
```

---

### Task 13: Step components — walk-in

**Files:**
- Create: `apps/kiosk-web/src/views/steps/WalkinSearchStep.vue`
- Create: `apps/kiosk-web/src/views/steps/WalkinPatientStep.vue`
- Create: `apps/kiosk-web/src/views/steps/WalkinServiceStep.vue`
- Create: `apps/kiosk-web/src/views/steps/WalkinConfirmStep.vue`
- Create: `apps/kiosk-web/src/views/__tests__/WalkinPatientStep.spec.ts`

**Interfaces:**
- Consumes: `PasienSearchItem`, `ServiceSelection` from `@aq/shared-types`, `ServiceCatalog` from `lib/serviceCatalog`, `EligibilityStatus` from `composables/useKioskRegistration`
- Produces: `WalkinSearchStep` (emits `submit(keyword)`/`back`), `WalkinPatientStep` (emits `select(patient)`/`back`), `WalkinServiceStep` (emits `select(selection)`/`back`), `WalkinConfirmStep` (emits `confirm`/`back`/`updateNoPeserta(value)`)

- [ ] **Step 1: Write the failing component test**

Create `apps/kiosk-web/src/views/__tests__/WalkinPatientStep.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PasienSearchItem } from '@aq/shared-types'
import WalkinPatientStep from '../steps/WalkinPatientStep.vue'

const patients: PasienSearchItem[] = [{ pasienId: 'PT1', pasienName: 'Andi' }]

describe('WalkinPatientStep', () => {
  it('always renders the picker list, even for a single result', () => {
    const wrapper = mount(WalkinPatientStep, { props: { patients, pending: false } })
    expect(wrapper.findAll('button[data-testid^="patient-"]')).toHaveLength(1)
  })

  it('emits select with the patient', async () => {
    const wrapper = mount(WalkinPatientStep, { props: { patients, pending: false } })
    await wrapper.get('[data-testid="patient-PT1"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([patients[0]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/WalkinPatientStep.spec.ts`
Expected: FAIL — cannot find module `../steps/WalkinPatientStep.vue`.

- [ ] **Step 3: Create `WalkinSearchStep.vue`**

Create `apps/kiosk-web/src/views/steps/WalkinSearchStep.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ pending: boolean; errorMessage: string | null }>()
const emit = defineEmits<{ submit: [keyword: string]; back: [] }>()
const keyword = ref('')

function submit() {
  if (!keyword.value.trim()) return
  emit('submit', keyword.value)
}
</script>

<template>
  <section class="panel">
    <h1>Daftar Tanpa Booking</h1>
    <p>Masukkan salah satu identitas: NIK, nomor MR, nomor peserta BPJS, atau nomor rujukan.</p>
    <input
      v-model="keyword"
      class="big-input"
      placeholder="NIK / No. MR / BPJS / Rujukan"
      data-testid="walkin-keyword"
      @keyup.enter="submit"
    />
    <div class="actions">
      <button type="button" class="sp-btn" :disabled="pending" data-testid="walkin-submit" @click="submit">
        Cari Pasien
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mencari pasien…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
```

- [ ] **Step 4: Create `WalkinPatientStep.vue`**

Create `apps/kiosk-web/src/views/steps/WalkinPatientStep.vue`:

```vue
<script setup lang="ts">
import type { PasienSearchItem } from '@aq/shared-types'

defineProps<{ patients: PasienSearchItem[]; pending: boolean }>()
const emit = defineEmits<{ select: [patient: PasienSearchItem]; back: [] }>()

function disambiguator(patient: PasienSearchItem): string {
  return patient.noMR ?? patient.nik ?? patient.tglLahir ?? patient.pasienId
}
</script>

<template>
  <section class="panel">
    <h1>Pilih Pasien</h1>
    <p>Pilih data pasien yang sesuai. Hasil pencarian tidak dipilih otomatis.</p>
    <div class="sp-grid">
      <button
        v-for="patient in patients"
        :key="patient.pasienId"
        type="button"
        class="sp-btn"
        :disabled="pending"
        :data-testid="`patient-${patient.pasienId}`"
        @click="emit('select', patient)"
      >
        {{ patient.pasienName }}
        <small>{{ disambiguator(patient) }}</small>
      </button>
    </div>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 5: Create `WalkinServiceStep.vue`**

Create `apps/kiosk-web/src/views/steps/WalkinServiceStep.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JadwalItem, ServiceItem, ServiceSelection } from '@aq/shared-types'
import type { ServiceCatalog } from '../../lib/serviceCatalog'

const props = defineProps<{ catalog: ServiceCatalog; pending: boolean }>()
const emit = defineEmits<{ select: [selection: ServiceSelection]; back: [] }>()

const polis = ref<ServiceItem[]>([])
const dokterList = ref<ServiceItem[]>([])
const jadwalList = ref<JadwalItem[]>([])
const selectedPoli = ref<ServiceItem | null>(null)
const selectedDokter = ref<ServiceItem | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)

async function loadPolis() {
  loading.value = true
  loadError.value = null
  try {
    polis.value = await props.catalog.listPoli()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat poli.'
  } finally {
    loading.value = false
  }
}
void loadPolis()

async function choosePoli(poli: ServiceItem) {
  selectedPoli.value = poli
  dokterList.value = []
  jadwalList.value = []
  selectedDokter.value = null
  loading.value = true
  loadError.value = null
  try {
    dokterList.value = await props.catalog.listDokter(poli.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat dokter.'
  } finally {
    loading.value = false
  }
}

async function chooseDokter(dokter: ServiceItem) {
  selectedDokter.value = dokter
  jadwalList.value = []
  loading.value = true
  loadError.value = null
  try {
    jadwalList.value = await props.catalog.listJadwal(dokter.id)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Gagal memuat jadwal.'
  } finally {
    loading.value = false
  }
}

function chooseJadwal(jadwal: JadwalItem) {
  if (!selectedPoli.value || !selectedDokter.value) return
  emit('select', { poli: selectedPoli.value, dokter: selectedDokter.value, jadwal })
}
</script>

<template>
  <section class="panel">
    <h1>Pilih Layanan</h1>
    <p v-if="loadError" class="status error">{{ loadError }}</p>
    <p v-if="loading" class="status">Memuat…</p>

    <template v-if="!selectedPoli">
      <h2>Poli</h2>
      <div class="sp-grid">
        <button v-for="poli in polis" :key="poli.id" type="button" class="sp-btn" @click="choosePoli(poli)">
          {{ poli.name }}
        </button>
      </div>
    </template>

    <template v-else-if="!selectedDokter">
      <h2>Dokter — {{ selectedPoli.name }}</h2>
      <div class="sp-grid">
        <button v-for="dokter in dokterList" :key="dokter.id" type="button" class="sp-btn" @click="chooseDokter(dokter)">
          {{ dokter.name }}
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary-btn" @click="selectedPoli = null; dokterList = []; jadwalList = []">
          Kembali ke Poli
        </button>
      </div>
    </template>

    <template v-else>
      <h2>Jadwal — {{ selectedDokter.name }}</h2>
      <div class="sp-grid">
        <button
          v-for="jadwal in jadwalList"
          :key="jadwal.jadwalId"
          type="button"
          class="sp-btn"
          :disabled="jadwal.sisaKuota <= 0"
          @click="chooseJadwal(jadwal)"
        >
          {{ jadwal.jamPraktek }}
          <small>{{ jadwal.sisaKuota }} slot</small>
        </button>
      </div>
      <div class="actions">
        <button type="button" class="secondary-btn" @click="selectedDokter = null; jadwalList = []">
          Kembali ke Dokter
        </button>
      </div>
    </template>

    <div class="actions">
      <button type="button" class="secondary-btn" @click="$emit('back')">
        Batal
      </button>
    </div>
  </section>
</template>
```

Note: `props` is auto-available in `<script setup>`. `selectJadwal` guard covers `selectedPoli`/`selectedDokter` non-null.

- [ ] **Step 6: Create `WalkinConfirmStep.vue`**

Create `apps/kiosk-web/src/views/steps/WalkinConfirmStep.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { PasienSearchItem, ServiceSelection } from '@aq/shared-types'
import type { EligibilityStatus } from '../../composables/useKioskRegistration'

defineProps<{
  patient: PasienSearchItem
  service: ServiceSelection
  eligibility: EligibilityStatus
  pending: boolean
  errorMessage: string | null
}>()
const emit = defineEmits<{
  confirm: []
  back: []
  updateNoPeserta: [value: string]
}>()

const noPesertaInput = ref('')
</script>

<template>
  <section class="panel">
    <h1>Konfirmasi Data</h1>
    <dl class="detail-list">
      <dt>Pasien</dt>
      <dd>{{ patient.pasienName }}</dd>
      <dt>Poli</dt>
      <dd>{{ service.poli.name }}</dd>
      <dt>Dokter</dt>
      <dd>{{ service.dokter.name }}</dd>
      <dt>Jadwal</dt>
      <dd>{{ service.jadwal.jamPraktek }}</dd>
      <dt>Jaminan</dt>
      <dd>
        {{ eligibility.tipeJaminanName }}
        <span v-if="eligibility.needsEligibility">· verifikasi BPJS</span>
      </dd>
    </dl>

    <div v-if="eligibility.needsEligibility" class="noPeserta-block">
      <p>Masukkan Nomor Peserta BPJS (scan QR kartu atau ketik manual).</p>
      <input
        v-model="noPesertaInput"
        class="big-input"
        placeholder="Nomor Peserta BPJS"
        data-testid="no-peserta"
        @input="emit('updateNoPeserta', noPesertaInput)"
      />
    </div>

    <div class="actions">
      <button
        type="button"
        class="sp-btn"
        :disabled="pending || (eligibility.needsEligibility && !noPesertaInput.trim())"
        data-testid="walkin-confirm"
        @click="$emit('confirm')"
      >
        Konfirmasi &amp; Daftar
      </button>
      <button type="button" class="secondary-btn" :disabled="pending" @click="$emit('back')">
        Kembali
      </button>
    </div>
    <p v-if="pending" class="status">Mendaftarkan…</p>
    <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
  </section>
</template>
```

- [ ] **Step 7: Add `.noPeserta-block` CSS**

Append to `apps/kiosk-web/src/styles.css`:

```css
.noPeserta-block {
  margin-top: 1.5rem;
  border-top: 1px solid #c9d8e6;
  padding-top: 1.25rem;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/WalkinPatientStep.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/kiosk-web/src/views/steps/WalkinSearchStep.vue apps/kiosk-web/src/views/steps/WalkinPatientStep.vue apps/kiosk-web/src/views/steps/WalkinServiceStep.vue apps/kiosk-web/src/views/steps/WalkinConfirmStep.vue apps/kiosk-web/src/views/__tests__/WalkinPatientStep.spec.ts apps/kiosk-web/src/styles.css
git commit -m "feat(kiosk-web): walk-in step components"
```

---

### Task 14: Step components — result, failure, assistance

**Files:**
- Create: `apps/kiosk-web/src/views/steps/RegistrationSuccessStep.vue`
- Create: `apps/kiosk-web/src/views/steps/FailureStep.vue`
- Create: `apps/kiosk-web/src/views/steps/AssistanceQueueStep.vue`
- Create: `apps/kiosk-web/src/views/__tests__/FailureStep.spec.ts`

**Interfaces:**
- Consumes: `ReturnCreateWalkIn`, `AdmissionQueueIntakeResponse`, `AdmissionServicePoint` from `@aq/shared-types`, `FailureContext` from `composables/useKioskRegistration`
- Produces: `RegistrationSuccessStep` (emits `reprint`/`finish`), `FailureStep` (emits `selectServicePoint(servicePointId)`), `AssistanceQueueStep` (emits `reprint`/`finish`)

- [ ] **Step 1: Write the failing component test**

Create `apps/kiosk-web/src/views/__tests__/FailureStep.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdmissionServicePoint } from '@aq/shared-types'
import FailureStep from '../steps/FailureStep.vue'

const offerings: AdmissionServicePoint[] = [
  { servicePointId: 'REG', displayName: 'Registrasi', queuePrefix: 'A', status: 'Active' },
]

describe('FailureStep', () => {
  it('shows the failure message and emits the picked service point', async () => {
    const wrapper = mount(FailureStep, {
      props: {
        errorContext: { code: 'DUPLICATE_REGISTRATION', message: 'Sudah terdaftar.' },
        offerings,
        pending: false,
      },
    })
    expect(wrapper.get('[data-testid="failure-message"]').text()).toContain('Sudah terdaftar.')
    await wrapper.get('[data-testid="assist-REG"]').trigger('click')
    expect(wrapper.emitted('selectServicePoint')?.[0]).toEqual(['REG'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/FailureStep.spec.ts`
Expected: FAIL — cannot find module `../steps/FailureStep.vue`.

- [ ] **Step 3: Create `RegistrationSuccessStep.vue`**

Create `apps/kiosk-web/src/views/steps/RegistrationSuccessStep.vue`:

```vue
<script setup lang="ts">
import type { ReturnCreateWalkIn } from '@aq/shared-types'

defineProps<{
  result: ReturnCreateWalkIn
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel">
    <h1>Registrasi Berhasil</h1>
    <div class="queue-label" data-testid="reg-no-antrian">{{ result.noAntrian }}</div>
    <p>Nomor Antrian Poli Anda. Simpan baik-baik dan tunggu panggilan.</p>
    <p class="status">Reg ID {{ result.regId }}</p>
    <p v-if="printPending" class="status">Sedang mencetak…</p>
    <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="reg-print-ok">
      Bukti registrasi berhasil dicetak.
    </p>
    <p v-if="printError" class="status error" data-testid="reg-print-error">{{ printError }}</p>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="reg-reprint" @click="$emit('reprint')">
        Cetak ulang
      </button>
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="reg-finish" @click="$emit('finish')">
        Selesai
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Create `FailureStep.vue`**

Create `apps/kiosk-web/src/views/steps/FailureStep.vue`:

```vue
<script setup lang="ts">
import type { AdmissionServicePoint } from '@aq/shared-types'
import type { FailureContext } from '../../composables/useKioskRegistration'

defineProps<{
  errorContext: FailureContext
  offerings: AdmissionServicePoint[]
  pending: boolean
}>()
defineEmits<{ selectServicePoint: [servicePointId: string] }>()
</script>

<template>
  <section class="panel">
    <h1>Registrasi Tidak Dapat Diproses</h1>
    <p class="status error" data-testid="failure-message">{{ errorContext.message }}</p>
    <p>Silakan pilih loket bantuan pendaftaran untuk mendapatkan nomor antrian.</p>
    <div class="sp-grid">
      <button
        v-for="sp in offerings"
        :key="sp.servicePointId"
        type="button"
        class="sp-btn"
        :disabled="pending"
        :data-testid="`assist-${sp.servicePointId}`"
        @click="$emit('selectServicePoint', sp.servicePointId)"
      >
        {{ sp.displayName }}
        <small>{{ sp.queuePrefix }} · {{ sp.servicePointId }}</small>
      </button>
    </div>
    <p v-if="pending" class="status">Mengambil nomor antrian…</p>
  </section>
</template>
```

- [ ] **Step 5: Create `AssistanceQueueStep.vue`**

Create `apps/kiosk-web/src/views/steps/AssistanceQueueStep.vue`:

```vue
<script setup lang="ts">
import type { AdmissionQueueIntakeResponse } from '@aq/shared-types'

defineProps<{
  ticket: AdmissionQueueIntakeResponse
  title: string
  servicePointName?: string
  printPending: boolean
  printSucceeded: boolean
  printError: string | null
}>()
defineEmits<{ reprint: []; finish: [] }>()
</script>

<template>
  <section class="panel">
    <h1>{{ title }}</h1>
    <div class="queue-label" data-testid="assist-queue-label">{{ ticket.queueLabel }}</div>
    <p v-if="servicePointName" class="status">{{ servicePointName }}</p>
    <p class="status">Antrian ID {{ ticket.antrianId }} · Urut {{ ticket.noUrut }}</p>
    <p v-if="printPending" class="status">Sedang mencetak…</p>
    <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="assist-print-ok">
      Tiket berhasil dicetak.
    </p>
    <p v-if="printError" class="status error" data-testid="assist-print-error">{{ printError }}</p>
    <div class="actions">
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="assist-reprint" @click="$emit('reprint')">
        Cetak ulang
      </button>
      <button type="button" class="secondary-btn" :disabled="printPending" data-testid="assist-finish" @click="$emit('finish')">
        Selesai
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/FailureStep.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add apps/kiosk-web/src/views/steps/RegistrationSuccessStep.vue apps/kiosk-web/src/views/steps/FailureStep.vue apps/kiosk-web/src/views/steps/AssistanceQueueStep.vue apps/kiosk-web/src/views/__tests__/FailureStep.spec.ts
git commit -m "feat(kiosk-web): result, failure and assistance step components"
```

---

### Task 15: Infrastructure wiring + `KioskPage.vue` integration

**Files:**
- Modify: `apps/kiosk-web/src/infrastructure.ts`
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`

**Interfaces:**
- Consumes: `createHisApi`/`createJetliApi` from `@aq/api-client`, `configService` from `@aq/app-config`, `createServiceCatalog` from `lib/serviceCatalog`, `createBiometricClient` from `lib/biometric`, `scanQrFromCamera` from `lib/qrScanner`, all step components, `useKioskRegistration`, `useKioskSelfPrint`
- Produces: `getHisApi()`, `getJetliApi()`, `getServiceCatalog()` exports from `infrastructure.ts`; `KioskPage.vue` renders home / flow steps / existing intake sections

- [ ] **Step 1: Extend `infrastructure.ts`**

Edit `apps/kiosk-web/src/infrastructure.ts` — add imports and factories:

```ts
import { createHisApi, createJetliApi, type HisApi, type JetliApi } from '@aq/api-client'
import { createServiceCatalog, type ServiceCatalog } from './lib/serviceCatalog'

let hisApi: HisApi | null = null
let jetliApi: JetliApi | null = null

export function getHisApi(): HisApi {
  if (hisApi) return hisApi
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  hisApi = createHisApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: () => 'kiosk-no-auth' },
    }),
  )
  return hisApi
}

export function getJetliApi(): JetliApi {
  if (jetliApi) return jetliApi
  const cfg = configService.getConfig()
  const baseUrl = cfg.jetliApiBase ?? cfg.bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured in global_config.json')
  jetliApi = createJetliApi(
    new AdmissionQueueClient({
      baseUrl,
      auth: { getToken: () => 'kiosk-no-auth' },
    }),
  )
  return jetliApi
}

export function getServiceCatalog(): ServiceCatalog {
  const his = getHisApi()
  return createServiceCatalog({
    getBusinessDate: async () => (await his.getBusinessDate()).businessDate,
    listPoli: (businessDate) => his.listPoli(businessDate),
    listDokter: (businessDate, poliId) => his.listDokter(businessDate, poliId),
    listJadwal: (businessDate, ppaId) => his.listJadwal(businessDate, ppaId),
  })
}
```

Also update `__resetInfrastructureForTests` to null the new singletons:

```ts
export function __resetInfrastructureForTests() {
  deviceConfigProvider = null
  admissionQueueApi = null
  hisApi = null
  jetliApi = null
}
```

- [ ] **Step 2: Rewrite the script block of `KioskPage.vue`**

Edit `apps/kiosk-web/src/views/KioskPage.vue` — replace the `<script setup>` block:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { DeviceConfig } from '@aq/shared-types'
import { DeviceConfigInvalidError, DeviceConfigNotFoundError } from '@aq/device-config'
import {
  getAdmissionQueueApi,
  getDeviceConfigProvider,
  getHisApi,
  getJetliApi,
  getServiceCatalog,
} from '../infrastructure'
import { intersectOfferings } from '../lib/offerings'
import { createBiometricClient } from '../lib/biometric'
import { scanQrFromCamera } from '../lib/qrScanner'
import { useKioskIntake } from '../composables/useKioskIntake'
import { useKioskPrint } from '../composables/useKioskPrint'
import { useKioskRegistration } from '../composables/useKioskRegistration'
import { useKioskSelfPrint } from '../composables/useKioskSelfPrint'
import BootErrorPage from './BootErrorPage.vue'
import KioskHome from './KioskHome.vue'
import BookingSearchStep from './steps/BookingSearchStep.vue'
import BookingConfirmStep from './steps/BookingConfirmStep.vue'
import WalkinSearchStep from './steps/WalkinSearchStep.vue'
import WalkinPatientStep from './steps/WalkinPatientStep.vue'
import WalkinServiceStep from './steps/WalkinServiceStep.vue'
import WalkinConfirmStep from './steps/WalkinConfirmStep.vue'
import BiometricStep from './steps/BiometricStep.vue'
import RegistrationSuccessStep from './steps/RegistrationSuccessStep.vue'
import FailureStep from './steps/FailureStep.vue'
import AssistanceQueueStep from './steps/AssistanceQueueStep.vue'

const props = defineProps<{
  stationId: string
}>()

const bootError = ref<string | null>(null)
const deviceConfig = ref<DeviceConfig | null>(null)
const homeMode = ref<'idle' | 'intake'>('idle')
const scanError = ref<string | null>(null)
const stationIdRef = computed(() => props.stationId)
const printerProxyPort = computed(() => deviceConfig.value?.printerProxyPort)

watch(
  () => props.stationId,
  async (rawStationId, _prev, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })

    bootError.value = null
    deviceConfig.value = null
    const stationId = rawStationId?.trim()
    if (!stationId) {
      bootError.value = 'Station ID kosong.'
      return
    }

    try {
      const provider = await getDeviceConfigProvider()
      const config = await provider.getConfig(stationId)
      if (cancelled) return
      if (config.role !== 'kiosk') {
        bootError.value = `Device '${stationId}' bukan role kiosk.`
        return
      }
      deviceConfig.value = config
    } catch (error) {
      if (cancelled) return
      if (error instanceof DeviceConfigNotFoundError) {
        bootError.value = `Konfigurasi tidak ditemukan untuk station '${error.deviceId}'.`
        return
      }
      if (error instanceof DeviceConfigInvalidError) {
        bootError.value = `Konfigurasi tidak valid untuk '${error.deviceId}'.`
        return
      }
      bootError.value = error instanceof Error ? error.message : 'Boot gagal.'
    }
  },
  { immediate: true },
)

const servicePointsQuery = useQuery({
  queryKey: computed(() => ['service-points', props.stationId] as const),
  enabled: computed(() => !!deviceConfig.value && !bootError.value),
  queryFn: async () => getAdmissionQueueApi().listServicePoints(true),
})

const offerings = computed(() => {
  if (!deviceConfig.value || !servicePointsQuery.data.value) return []
  return intersectOfferings(deviceConfig.value, servicePointsQuery.data.value)
})

const {
  pending,
  errorMessage,
  errorUncertain,
  result,
  lastAttemptServicePointId,
  canSubmit,
  submitIntake,
  retryLast,
  resetToSelection,
} = useKioskIntake(offerings)

const {
  printPending,
  printError,
  printSucceeded,
  printCommittedLabel,
  resetPrintState,
} = useKioskPrint({
  stationId: stationIdRef,
  result,
  offerings,
  printerProxyPort,
})

const catalog = getServiceCatalog()

const selfPrint = useKioskSelfPrint({
  stationId: stationIdRef,
  printerProxyPort,
})

const registration = useKioskRegistration({
  stationId: stationIdRef,
  getBusinessDate: () => getHisApi().getBusinessDate().then((d) => d.businessDate),
  searchBooking: (tglBerobat, keyword) => getHisApi().searchBooking(tglBerobat, keyword),
  getBookingDetail: (bookingId) => getHisApi().getBookingDetail(bookingId),
  listPolis: (pasienId) => getHisApi().listPolis(pasienId),
  getGroupJaminanMap: (tipeJaminanId) => getJetliApi().getGroupJaminanMap(tipeJaminanId),
  searchPasien: (keyword) => getHisApi().searchPasien(keyword),
  verifyBiometric: () => createBiometricClient({ port: printerProxyPort.value }).verify(),
  registerBooking: (ctx) => getHisApi().registerByBookingDirect(ctx),
  registerWalkin: (ctx) => getHisApi().registerWalkInDirect(ctx),
  bookingAssistance: (body) => getHisApi().bookingAssistance(body),
  intake: (servicePointId) => getAdmissionQueueApi().intake({ servicePointId }),
  printRegistration: selfPrint.printRegistration,
  printQueueTicket: selfPrint.printQueueTicket,
  offeringsName: (servicePointId) =>
    offerings.value.find((sp) => sp.servicePointId === servicePointId)?.displayName,
})

watch(result, (next, prev) => {
  if (next && next !== prev) {
    void printCommittedLabel(lastAttemptServicePointId.value ?? undefined)
  }
})

const assistanceTitle = computed(() =>
  registration.mode.value === 'booking'
    ? 'Nomor Antrian Bantuan'
    : 'Nomor Antrian Pendaftaran',
)

const assistanceServicePointName = computed(() => {
  const id = registration.assistanceServicePointId.value
  if (!id) return undefined
  return offerings.value.find((sp) => sp.servicePointId === id)?.displayName
})

function onHome() {
  scanError.value = null
  resetToSelection()
  resetPrintState()
  selfPrint.resetPrintState()
  homeMode.value = 'idle'
  registration.goHome()
}

function onStartBooking() {
  onHome()
  registration.startBookingFlow()
}

function onStartWalkin() {
  onHome()
  registration.startWalkinFlow()
}

function onStartIntake() {
  onHome()
  homeMode.value = 'intake'
}

async function onScanBooking() {
  scanError.value = null
  const result = await scanQrFromCamera()
  if ('detected' in result) {
    void registration.submitBookingKeyword(result.detected)
  } else {
    scanError.value = result.error
  }
}

function onReprintRegistration() {
  void registration.reprintRegistration()
}

function onReprintAssistance() {
  void registration.reprintQueueTicket()
}

onMounted(() => {
  registration.startIdleReset()
})

onUnmounted(() => {
  registration.dispose()
})

const loadingMessage = computed(() => {
  if (bootError.value) return null
  if (!deviceConfig.value) return 'Memuat konfigurasi perangkat…'
  if (servicePointsQuery.isPending.value) return 'Memuat Service Point aktif…'
  if (servicePointsQuery.isError.value) {
    return servicePointsQuery.error.value instanceof Error
      ? servicePointsQuery.error.value.message
      : 'Gagal memuat Service Point.'
  }
  if (offerings.value.length === 0) {
    return 'Tidak ada Service Point aktif yang cocok dengan konfigurasi station ini.'
  }
  return null
})
</script>
```

- [ ] **Step 3: Rewrite the template of `KioskPage.vue`**

Replace the `<template>` block:

```vue
<template>
  <BootErrorPage
    v-if="bootError"
    title="Kiosk tidak dapat dimulai"
    :message="bootError"
  />

  <section v-else-if="result" class="panel">
    <h1>Nomor Antrian Anda</h1>
    <p>Simpan Queue Label berikut. Cetak memakai print proxy lokal.</p>
    <div class="queue-label" data-testid="queue-label">{{ result.queueLabel }}</div>
    <p class="status ok">Antrian ID {{ result.antrianId }} · Urut {{ result.noUrut }}</p>

    <p v-if="printPending" class="status" data-testid="print-pending">Sedang mencetak…</p>
    <p v-else-if="printSucceeded && !printError" class="status ok" data-testid="print-ok">
      Tiket berhasil dicetak.
    </p>
    <p v-if="printError" class="status error" data-testid="print-error">{{ printError }}</p>

    <div class="actions">
      <button
        type="button"
        class="secondary-btn"
        :disabled="printPending"
        data-testid="reprint"
        @click="onReprint"
      >
        Cetak ulang
      </button>
      <button type="button" class="secondary-btn" :disabled="printPending" @click="onResetToSelection">
        Ambil nomor lain
      </button>
      <button type="button" class="secondary-btn" @click="onHome">
        Kembali ke menu
      </button>
    </div>
  </section>

  <template v-else-if="registration.flow.value !== 'HOME'">
    <BookingSearchStep
      v-if="registration.flow.value === 'BOOKING_SEARCH'"
      :pending="registration.submitting.value"
      :error-message="scanError"
      @submit="registration.submitBookingKeyword"
      @scan="onScanBooking"
      @back="onHome"
    />
    <BookingConfirmStep
      v-else-if="registration.flow.value === 'BOOKING_CONFIRM'"
      :booking="registration.bookingDetail.value!"
      :eligibility="registration.bookingEligibility.value!"
      :pending="registration.submitting.value"
      :error-message="null"
      @confirm="registration.confirmBooking"
      @back="onHome"
    />
    <BiometricStep
      v-else-if="registration.flow.value === 'BIOMETRIC_VERIFY'"
      :pending="registration.submitting.value"
      :error-message="null"
    />
    <WalkinSearchStep
      v-else-if="registration.flow.value === 'WALKIN_SEARCH'"
      :pending="registration.submitting.value"
      :error-message="null"
      @submit="registration.searchWalkinPatient"
      @back="onHome"
    />
    <WalkinPatientStep
      v-else-if="registration.flow.value === 'WALKIN_SELECT_PATIENT'"
      :patients="registration.patientMatches.value"
      :pending="registration.submitting.value"
      @select="registration.selectPatient"
      @back="registration.startWalkinFlow"
    />
    <WalkinServiceStep
      v-else-if="registration.flow.value === 'WALKIN_SELECT_SERVICE'"
      :catalog="catalog"
      :pending="registration.submitting.value"
      @select="registration.selectService"
      @back="registration.startWalkinFlow"
    />
    <WalkinConfirmStep
      v-else-if="registration.flow.value === 'WALKIN_CONFIRM'"
      :patient="registration.selectedPatient.value!"
      :service="registration.selectedService.value!"
      :eligibility="registration.walkinEligibility.value!"
      :pending="registration.submitting.value"
      :error-message="null"
      @confirm="registration.confirmWalkin"
      @update-no-peserta="registration.setWalkinNoPeserta"
      @back="registration.startWalkinFlow"
    />
    <RegistrationSuccessStep
      v-else-if="registration.flow.value === 'REGISTRATION_SUCCESS'"
      :result="registration.registrationResult.value!"
      :print-pending="selfPrint.printPending.value"
      :print-succeeded="selfPrint.printSucceeded.value"
      :print-error="selfPrint.printError.value"
      @reprint="onReprintRegistration"
      @finish="onHome"
    />
    <FailureStep
      v-else-if="registration.flow.value === 'FAILURE'"
      :error-context="registration.errorContext.value!"
      :offerings="offerings"
      :pending="registration.submitting.value"
      @select-service-point="registration.confirmAssistance"
    />
    <AssistanceQueueStep
      v-else-if="registration.flow.value === 'ASSISTANCE_QUEUE'"
      :ticket="registration.assistanceTicket.value!"
      :title="assistanceTitle"
      :service-point-name="assistanceServicePointName"
      :print-pending="selfPrint.printPending.value"
      :print-succeeded="selfPrint.printSucceeded.value"
      :print-error="selfPrint.printError.value"
      @reprint="onReprintAssistance"
      @finish="onHome"
    />
  </template>

  <KioskHome
    v-else-if="homeMode === 'idle'"
    :intake-available="offerings.length > 0"
    @start-booking="onStartBooking"
    @start-walkin="onStartWalkin"
    @start-intake="onStartIntake"
  />

  <section v-else class="panel">
    <h1>Ambil Nomor Antrian</h1>
    <p>Station <strong>{{ stationId }}</strong> — pilih Service Point.</p>

    <p v-if="loadingMessage" class="status" :class="{ error: !!servicePointsQuery.isError.value }">
      {{ loadingMessage }}
    </p>

    <p
      v-if="errorMessage"
      class="status error"
      :class="{ uncertain: errorUncertain }"
      data-testid="intake-error"
    >
      {{ errorMessage }}
    </p>

    <div v-if="offerings.length" class="sp-grid">
      <button
        v-for="sp in offerings"
        :key="sp.servicePointId"
        type="button"
        class="sp-btn"
        :disabled="!canSubmit"
        :data-testid="`sp-${sp.servicePointId}`"
        @click="submitIntake(sp.servicePointId)"
      >
        {{ sp.displayName }}
        <small>{{ sp.queuePrefix }} · {{ sp.servicePointId }}</small>
      </button>
    </div>

    <div v-if="errorMessage" class="actions">
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="retry-intake"
        @click="retryLast"
      >
        Coba lagi
      </button>
    </div>

    <div class="actions">
      <button type="button" class="secondary-btn" @click="onHome">
        Kembali ke menu
      </button>
    </div>

    <p v-if="pending" class="status">Sedang mengambil nomor…</p>
  </section>
</template>
```

- [ ] **Step 4: Run full kiosk test suite**

Run: `pnpm --filter kiosk-web test`
Expected: PASS — all existing + new tests.

- [ ] **Step 5: Run full repo typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS across all packages (app-config, shared-types, api-client, kiosk-web, display-web, config-web).

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/infrastructure.ts apps/kiosk-web/src/views/KioskPage.vue
git commit -m "feat(kiosk-web): wire self-registration into kiosk page with home menu"
```

---

## Open Integration Items (confirm before production enablement)

These are the four items flagged in ADR-001/002/003/006. The plan implements them behind typed seams with documented assumed shapes; enabling the real wire contracts only requires updating the marked functions, not the flow logic.

1. **Walk-in patient item schema** — `pasienSearchItemSchema` in `@aq/shared-types` (assumed `pasienId`/`pasienName`/`noMR?`/`nik?`/`tglLahir?`).
2. **Service catalog paths + schemas** — `createHisApi.listPoli/listDokter/listJadwal` in `packages/api-client/src/his.ts` (assumed `/Poli`, `/Poli/dokter`, `/Dokter/jadwal`).
3. **`/direct` request payload** — `registerByBookingDirect`/`registerWalkInDirect` bodies (assumed `BookingRegContext`/`WalkinRegContext`).
4. **Biometric local-service JSON** — `lib/biometric.ts` (assumed `{ outcome }` response; verdict union is the fixed seam).
