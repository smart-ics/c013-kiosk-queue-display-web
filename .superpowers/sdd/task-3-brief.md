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
