# Kiosk Unified Search-First Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-card kiosk landing with a single unified search input (autofocus + on-screen keyboard) that searches bookings first, then cascades into patient-context-search on failure, leading to goshow walk-in, intake, or retry.

**Architecture:** The `KioskHome` page becomes the search-first input screen. `useKioskRegistration` cascades `Booking/search` → `patient-context-search` on empty results, exposing a new `PATIENT_CONTEXT_CONFIRM` state that offers goshow walk-in (skipping patient search/selection), intake, or retry. Two new flow states (`PATIENT_CONTEXT_SEARCH`, `PATIENT_CONTEXT_CONFIRM`) are added to `lib/flow.ts`. A `VirtualKeyboard` component provides touch input for the kiosk display.

**Tech Stack:** Vue 3 + Vite + TypeScript + Zod + TanStack Query, `@aq/api-client`, `@aq/shared-types`.

## Global Constraints

- The existing `useKioskIntake` flow and its sections are **preserved** — intake remains accessible via no-results fallback and "Ambil Antrian Pendaftaran" button.
- No client-side queue-label allocation; render `noAntrian`/`queueLabel` verbatim.
- Do not import HIS modules.
- `userId` is the constant `"hidokkiosk"` for all HIS kiosk calls.
- Indonesian UI copy. No comments unless explaining non-obvious intent.
- Format with Prettier on modified files only.
- `pnpm turbo run typecheck test` as verification gate.
- `bestMatch` in the response can be null (no patient found).

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared-types/src/index.ts` | `PatientContextItem`, `PatientContextSearchRequest`, `PatientContextSearchResponse` Zod schemas + types |
| `packages/api-client/src/his.ts` | `patientContextSearch()` POST method on `HisApi` |
| `apps/kiosk-web/src/lib/flow.ts` | Two new flow states + updated transitions |
| `apps/kiosk-web/src/lib/qrCodeDecoder.ts` | MJKN base64 QR decode — extracts `kodeBooking` from long base64 QR payloads |
| `apps/kiosk-web/src/lib/__tests__/qrCodeDecoder.spec.ts` | QR decoder unit tests |
| `apps/kiosk-web/src/composables/useKioskRegistration.ts` | Cascade search logic, patient context confirm, goshow walkin entry |
| `apps/kiosk-web/src/components/VirtualKeyboard.vue` | On-screen QWERTY keyboard |
| `apps/kiosk-web/src/views/KioskHome.vue` | Redesigned as search input + keyboard + Scan QR |
| `apps/kiosk-web/src/views/steps/PatientContextConfirmStep.vue` | Patient context confirmation / picker |
| `apps/kiosk-web/src/views/KioskPage.vue` | Wiring: new emits, new step rendering, intake from confirm |
| `apps/kiosk-web/src/styles.css` | Keyboard grid, search input, patient-context card styles |
| `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts` | Cascade search tests, goshow walkin tests |
| `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts` | Rewrite for search-first UI |
| `apps/kiosk-web/src/views/__tests__/PatientContextConfirmStep.spec.ts` | New test file |
| `apps/kiosk-web/src/components/__tests__/VirtualKeyboard.spec.ts` | New test file |

---

### Task 1: Shared Types — Patient Context Schemas

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Produces: `PatientContextItem` type, `PatientContextSearchRequest` type, `PatientContextSearchResponse` type, `patientContextItemSchema`, `patientContextSearchRequestSchema`, `patientContextSearchResponseSchema`
- All types exported from index.

- [ ] **Step 1: Add schemas after existing exports (before last line)**

Open `packages/shared-types/src/index.ts`. The file ends at line 462 with `export type ServiceSelection = ...`. Append the following schemas immediately after the `serviceSelectionSchema` block (before the final export type line):

```typescript
export const patientContextItemSchema = z.object({
  kind: z.string(),
  id: z.string(),
  patientName: z.string(),
  patientId: z.string(),
  birthDate: z.string(),
  gender: z.string(),
  locality: z.string(),
  maskedNik: z.string(),
  maskedPhone: z.string().nullable(),
  visitDate: z.string().nullable(),
  visitTime: z.string().nullable(),
  serviceName: z.string().nullable(),
  doctorName: z.string().nullable(),
  state: z.string(),
  bookingId: z.string().nullable(),
  registrationId: z.string().nullable(),
  matchType: z.string(),
  isExactMatch: z.boolean(),
  rank: z.number(),
  warnings: z.array(z.unknown()),
})
export type PatientContextItem = z.infer<typeof patientContextItemSchema>

export const patientContextSearchRequestSchema = z.object({
  keyword: z.string(),
  businessDate: z.string(),
  scope: z.string().default('All'),
  limitPerType: z.number().int().default(10),
  suggestedBookingId: z.string().default(''),
  suggestedRegistrationId: z.string().default(''),
  suggestedPatientId: z.string().default(''),
})
export type PatientContextSearchRequest = z.infer<typeof patientContextSearchRequestSchema>

export const patientContextSearchResponseSchema = z.object({
  businessDate: z.string(),
  bookings: z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  registrations: z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  patients: z.object({
    items: z.array(patientContextItemSchema),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  bestMatch: patientContextItemSchema.nullable(),
  canCreatePatient: z.boolean(),
})
export type PatientContextSearchResponse = z.infer<typeof patientContextSearchResponseSchema>
```

- [ ] **Step 2: Run typecheck to verify schema compilation**

```bash
pnpm --filter @aq/shared-types exec tsc -p tsconfig.json --noEmit
```

Expected: PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add PatientContextSearch schemas"
```

---

### Task 2: API Client — `patientContextSearch` Method

**Files:**
- Modify: `packages/api-client/src/his.ts`

**Interfaces:**
- Consumes: `PatientContextSearchRequest`, `PatientContextSearchResponse`, `patientContextSearchRequestSchema`, `patientContextSearchResponseSchema` from `@aq/shared-types`
- Produces: `patientContextSearch(body)` on `HisApi` return type

- [ ] **Step 1: Add import for new schemas**

In `packages/api-client/src/his.ts`, add to the existing import from `@aq/shared-types` (lines 1-25):

```typescript
// Add these imports to the existing import block from '@aq/shared-types'
import {
  // ...existing imports...
  type PatientContextItem,
  type PatientContextSearchRequest,
  type PatientContextSearchResponse,
  patientContextSearchRequestSchema,
  patientContextSearchResponseSchema,
  // ...rest of existing imports...
} from '@aq/shared-types'
```

- [ ] **Step 2: Add method to `createHisApi`**

After the `bookingAssistance` method (before the closing `}` of `createHisApi`), add:

```typescript
    patientContextSearch(body: PatientContextSearchRequest): Promise<PatientContextSearchResponse> {
      const parsed = patientContextSearchRequestSchema.parse(body)
      return client.postJson(
        'api/v1/admisi-rajal/patient-context-search',
        parsed,
        patientContextSearchResponseSchema,
      )
    },
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @aq/api-client exec tsc -p tsconfig.json --noEmit
```

Expected: PASS with no errors (assuming `HisApi` return type auto-infers the new method — no explicit type export to update since `HisApi = ReturnType<typeof createHisApi>`).

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/his.ts
git commit -m "feat(api-client): add patientContextSearch to HisApi"
```

---

### Task 3: Flow State Machine — New States

**Files:**
- Modify: `apps/kiosk-web/src/lib/flow.ts`

**Interfaces:**
- Consumes: existing `KioskFlow`, `FLOW_TRANSITIONS`, `canTransition`
- Produces: expanded `KioskFlow` union, updated transition map

- [ ] **Step 1: Add new states and transitions**

Replace the entire content of `apps/kiosk-web/src/lib/flow.ts`:

```typescript
export type KioskFlow =
  | 'HOME'
  | 'BOOKING_SEARCH'
  | 'BOOKING_CONFIRM'
  | 'PATIENT_CONTEXT_SEARCH'
  | 'PATIENT_CONTEXT_CONFIRM'
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
  BOOKING_SEARCH: ['BOOKING_CONFIRM', 'PATIENT_CONTEXT_SEARCH', 'FAILURE'],
  BOOKING_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'FAILURE'],
  PATIENT_CONTEXT_SEARCH: ['PATIENT_CONTEXT_CONFIRM', 'FAILURE'],
  PATIENT_CONTEXT_CONFIRM: ['WALKIN_SELECT_SERVICE', 'HOME'],
  BIOMETRIC_VERIFY: ['REGISTRATION_SUCCESS', 'FAILURE'],
  WALKIN_SEARCH: ['WALKIN_SELECT_PATIENT', 'FAILURE'],
  WALKIN_SELECT_PATIENT: ['WALKIN_SELECT_SERVICE', 'WALKIN_SEARCH', 'FAILURE'],
  WALKIN_SELECT_SERVICE: ['WALKIN_CONFIRM', 'WALKIN_SEARCH', 'FAILURE'],
  WALKIN_CONFIRM: ['BIOMETRIC_VERIFY', 'REGISTRATION_SUCCESS', 'WALKIN_SEARCH', 'FAILURE'],
  REGISTRATION_SUCCESS: ['HOME'],
  FAILURE: ['ASSISTANCE_QUEUE'],
  ASSISTANCE_QUEUE: ['HOME'],
}

export function canTransition(from: KioskFlow, to: KioskFlow): boolean {
  return FLOW_TRANSITIONS[from].includes(to)
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: FAIL — downstream usages of `KioskFlow` in `useKioskRegistration.ts` and `KioskPage.vue` may need exhaustive checks updated. This is expected; those will be resolved in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/kiosk-web/src/lib/flow.ts
git commit -m "feat(kiosk): add PATIENT_CONTEXT_SEARCH and PATIENT_CONTEXT_CONFIRM flow states"
```

---

### Task 4: QR Code Decoder Library — MJKN Base64 QR

**Files:**
- Create: `apps/kiosk-web/src/lib/qrCodeDecoder.ts`
- Create: `apps/kiosk-web/src/lib/__tests__/qrCodeDecoder.spec.ts`

**Interfaces:**
- Produces: `getKodeBookingMjkn(qrCode: string): string`
- Used by: `useKioskRegistration` (Task 5) to decode QR input before `searchBooking`

- [ ] **Step 1: Create `apps/kiosk-web/src/lib/qrCodeDecoder.ts`**

```typescript
function isBase64String(str: string): boolean {
  if (!str || str.length % 4 !== 0) return false
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str)
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

export function getKodeBookingMjkn(qrCode: string): string {
  if (qrCode.length < 30) {
    return qrCode
  }
  if (!isBase64String(qrCode)) {
    return qrCode
  }
  try {
    const json = base64ToUtf8(qrCode)
    const parsed = JSON.parse(json) as Record<string, unknown>
    const kodeBooking = parsed?.kodeBooking
    if (kodeBooking === undefined || kodeBooking === null) {
      throw new Error('kodeBooking not found')
    }
    return String(kodeBooking)
  } catch {
    return qrCode
  }
}
```

- [ ] **Step 2: Create `apps/kiosk-web/src/lib/__tests__/qrCodeDecoder.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { getKodeBookingMjkn } from '../qrCodeDecoder'

describe('getKodeBookingMjkn', () => {
  it('returns short codes unchanged', () => {
    expect(getKodeBookingMjkn('BK001')).toBe('BK001')
  })

  it('returns non-base64 long strings unchanged', () => {
    const long = 'a'.repeat(32) + '!not-base64'
    expect(getKodeBookingMjkn(long)).toBe(long)
  })

  it('extracts kodeBooking from valid base64 JSON', () => {
    const payload = JSON.stringify({ kodeBooking: 'AN123456' })
    const encoded = btoa(payload)
    expect(getKodeBookingMjkn(encoded)).toBe('AN123456')
  })

  it('returns original when base64 JSON has no kodeBooking field', () => {
    const payload = JSON.stringify({ other: 'value' })
    const encoded = btoa(payload)
    expect(getKodeBookingMjkn(encoded)).toBe(encoded)
  })

  it('returns original when base64 is not valid JSON', () => {
    const encoded = btoa('not-json-data!!!')
    expect(getKodeBookingMjkn(encoded)).toBe(encoded)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter kiosk-web exec vitest run src/lib/__tests__/qrCodeDecoder.spec.ts
```

Expected: 5/5 pass.

- [ ] **Step 4: Commit**

```bash
git add apps/kiosk-web/src/lib/qrCodeDecoder.ts apps/kiosk-web/src/lib/__tests__/qrCodeDecoder.spec.ts
git commit -m "feat(kiosk): add MJKN base64 QR decoder"
```

---

### Task 5: Composable — Cascade Search + Patient Context Confirm

**Files:**
- Modify: `apps/kiosk-web/src/composables/useKioskRegistration.ts`

**Interfaces:**
- Consumes: `getKodeBookingMjkn` from `../lib/qrCodeDecoder`, new `patientContextSearch` dep, new flow states from `flow.ts`
- Produces: `patientContextResult` ref, `searchPatientContext` dep, `confirmPatientContext()` method, `cancelPatientContext()` method

- [ ] **Step 1: Add imports**

At the top of `useKioskRegistration.ts`, add:

```typescript
import { getKodeBookingMjkn } from '../lib/qrCodeDecoder'
import type {
  // ...existing imports...
  type PatientContextItem,
  PatientContextSearchResponse,
} from '@aq/shared-types'
```

Note: if `PatientContextItem` type-only import and `PatientContextSearchResponse` value import conflict, import them separately:

```typescript
import type { PatientContextItem, PatientContextSearchResponse } from '@aq/shared-types'
```

- [ ] **Step 2: Add dep type for `searchPatientContext`**

In the `KioskRegistrationDeps` interface (around line 60-80), after `searchPasien`:

```typescript
  searchPatientContext: (
    body: { keyword: string; businessDate: string },
  ) => Promise<PatientContextSearchResponse>,
```

- [ ] **Step 3: Add new refs**

In the function body (after `assistanceServicePointId`, around line 106):

```typescript
  const patientContextResult = ref<PatientContextSearchResponse | null>(null)
  const selectedContextPatient = ref<PatientContextItem | null>(null)
```

- [ ] **Step 4: Add `clearContextState` helper**

In the `goHome` function (around line 143-164), add the new ref resets after `errorContext.value = null`:

```typescript
    patientContextResult.value = null
    selectedContextPatient.value = null
```

- [ ] **Step 5: Add MJKN QR decode in `submitBookingKeyword`**

In `submitBookingKeyword`, after `const trimmed = keyword.trim()` and before `return withSubmit(...)`, decode the keyword. Also use the decoded value in `searchBooking`:

```typescript
    const decoded = getKodeBookingMjkn(trimmed)
```

Inside the `withSubmit` callback, replace `deps.searchBooking(tgl, trimmed)` with `deps.searchBooking(tgl, decoded)`.

Full modified function (replace existing):

```typescript
  function submitBookingKeyword(keyword: string): Promise<void> {
    touch()
    const trimmed = keyword.trim()
    if (!trimmed) return Promise.resolve()
    const decoded = getKodeBookingMjkn(trimmed)
    return withSubmit(async () => {
      try {
        const tgl = await ensureBusinessDate()
        const matches = await deps.searchBooking(tgl, decoded)
        if (matches.length === 0) {
          await searchPatientContextFor(decoded)
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
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        bookingDetail.value = detail
        bookingEligibility.value = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        transition('BOOKING_CONFIRM')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }
```

- [ ] **Step 6: Add `searchPatientContextFor` method**

Add this new private function after `submitBookingKeyword` (after the closing brace of that function):

```typescript
  async function searchPatientContextFor(keyword: string): Promise<void> {
    transition('PATIENT_CONTEXT_SEARCH')
    try {
      const tgl = await ensureBusinessDate()
      const result = await deps.searchPatientContext({
        keyword,
        businessDate: tgl,
      })
      patientContextResult.value = result
      if (result.bestMatch || result.patients.total > 0) {
        transition('PATIENT_CONTEXT_CONFIRM')
      } else {
        setFailure('BOOKING_NOT_FOUND', 'Data pasien tidak ditemukan. Silakan coba lagi atau ambil antrian pendaftaran.')
      }
    } catch (error) {
      setFailure(mapErrorToFailureCode(error), messageFromError(error))
    }
  }
```

- [ ] **Step 7: Add `confirmPatientContext` method**

This maps a `PatientContextItem` to the goshow walk-in path — sets `selectedPatient`, runs eligibility, transitions to `WALKIN_SELECT_SERVICE`. Add after the `searchPatientContextFor` function:

```typescript
  function confirmPatientContext(item: PatientContextItem): Promise<void> {
    touch()
    return withSubmit(async () => {
      try {
        selectedContextPatient.value = item
        const polisList = await deps.listPolis(item.patientId)
        const jaminan = deriveWalkinJaminan(polisList)
        const group =
          jaminan.tipeJaminanId === UMAT_TIPE_JAMINAN_ID
            ? null
            : await deps.getGroupJaminanMap(jaminan.tipeJaminanId)
        selectedPatient.value = {
          pasienId: item.patientId,
          pasienName: item.patientName,
          nik: item.maskedNik,
          noMR: item.id,
          tglLahir: item.birthDate,
        }
        walkinEligibility.value = {
          tipeJaminanId: jaminan.tipeJaminanId,
          tipeJaminanName: jaminan.tipeJaminanName,
          noPeserta: jaminan.noPeserta,
          needsEligibility: computeNeedsEligibility(jaminan.tipeJaminanId, group),
        }
        walkinNoPeserta.value = ''
        mode.value = 'walkin'
        transition('WALKIN_SELECT_SERVICE')
      } catch (error) {
        setFailure(mapErrorToFailureCode(error), messageFromError(error))
      }
    })
  }
```

- [ ] **Step 8: Add `cancelPatientContext` method**

Add after `confirmPatientContext`:

```typescript
  function cancelPatientContext() {
    touch()
    patientContextResult.value = null
    selectedContextPatient.value = null
    goHome()
  }
```

- [ ] **Step 9: Update return object**

In the return statement at the bottom of the function, add:

```typescript
    patientContextResult,
    selectedContextPatient,
    confirmPatientContext,
    cancelPatientContext,
```

- [ ] **Step 10: Run typecheck**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: FAIL — `KioskPage.vue` may reference old flow states; fixed in Task 8. The composable itself should now compile.

- [ ] **Step 11: Commit**

```bash
git add apps/kiosk-web/src/composables/useKioskRegistration.ts
git commit -m "feat(kiosk): add cascade search to patient context and goshow walkin entry"
```

---

### Task 6: Virtual Keyboard Component

**Files:**
- Create: `apps/kiosk-web/src/components/VirtualKeyboard.vue`

**Interfaces:**
- Props: none (keyboard emits keystrokes via provide/inject or modelValue)
- Emits: `input(char: string)`, `backspace`, `clear`
- Uses `defineExpose` or accepts a writable `Ref<string>` — decide: use `modelValue` + `@update:modelValue` pattern for Vue bindings compatibility.

- [ ] **Step 1: Create `apps/kiosk-web/src/components/VirtualKeyboard.vue`**

```vue
<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

function append(char: string) {
  emit('update:modelValue', props.modelValue + char)
}

function backspace() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}
</script>

<template>
  <div class="virtual-keyboard" data-testid="virtual-keyboard">
    <div v-for="(row, ri) in ROWS" :key="ri" class="kb-row">
      <button
        v-for="key in row"
        :key="key"
        type="button"
        class="kb-key"
        @click="append(key)"
      >
        {{ key }}
      </button>
      <button
        v-if="ri === ROWS.length - 1"
        type="button"
        class="kb-key kb-key--backspace"
        data-testid="kb-backspace"
        @click="backspace"
      >
        &#9003;
      </button>
    </div>
    <div class="kb-row">
      <button
        type="button"
        class="kb-key kb-key--space"
        data-testid="kb-space"
        @click="append(' ')"
      >
        Spasi
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run typecheck to verify component compiles**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: Should pass (standalone component, no external deps beyond Vue).

- [ ] **Step 3: Commit**

```bash
git add apps/kiosk-web/src/components/VirtualKeyboard.vue
git commit -m "feat(kiosk): add VirtualKeyboard component"
```

---

### Task 7: KioskHome — Redesign as Search-First Screen

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskHome.vue`

**Interfaces:**
- Consumes: `KioskHeader`, `VirtualKeyboard`
- Emits: `startSearch(keyword: string)` replaces `startBooking`, `scanBooking`, `startWalkin`, `startIntake`

- [ ] **Step 1: Rewrite `KioskHome.vue`**

Replace the entire content of `apps/kiosk-web/src/views/KioskHome.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import KioskHeader from '../components/KioskHeader.vue'
import VirtualKeyboard from '../components/VirtualKeyboard.vue'

defineProps<{ intakeAvailable: boolean }>()
const emit = defineEmits<{
  startSearch: [keyword: string]
  scanBooking: []
  startWalkin: []
  startIntake: []
}>()

const keyword = ref('')

function submit() {
  if (!keyword.value.trim()) return
  emit('startSearch', keyword.value)
}
</script>

<template>
  <div class="kiosk-home">
    <KioskHeader />

    <main class="kiosk-main">
      <div class="welcome">
        <h1 class="welcome-title">Selamat datang di RS Sehat Sejahtera</h1>
        <p class="welcome-sub">Masukkan data Anda untuk memulai</p>
      </div>

      <div class="search-section">
        <div class="search-input-row">
          <input
            ref="searchInputRef"
            v-model="keyword"
            class="search-input"
            type="text"
            inputmode="none"
            placeholder="Kode booking, nomor rujukan, nomor BPJS, nomor rekam medis, atau nama"
            data-testid="search-keyword"
            autofocus
            @keyup.enter="submit"
          />
          <button
            type="button"
            class="scan-btn"
            data-testid="scan-booking"
            @click="emit('scanBooking')"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
              <path d="M13.5 13.5h3.5v3.5h-3.5Z" />
              <path d="M20.5 17v3.5" />
              <path d="M17 20.5h3.5" />
            </svg>
            Scan QR
          </button>
        </div>

        <VirtualKeyboard v-model="keyword" />

        <button
          type="button"
          class="primary-btn primary-btn--search"
          :disabled="!keyword.trim()"
          data-testid="search-submit"
          @click="submit"
        >
          Lanjutkan
        </button>
      </div>

      <div class="search-alt-links">
        <button
          type="button"
          class="link-btn"
          data-testid="start-walkin"
          @click="emit('startWalkin')"
        >
          Daftar Tanpa Booking
        </button>
      </div>
    </main>

    <footer class="kiosk-footer">
      <span class="footer-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
        Rata-rata tunggu: 25–35 menit
      </span>
      <span class="footer-sep" aria-hidden="true">•</span>
      <span class="footer-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
        </svg>
        Butuh bantuan? Hubungi petugas di dekat kiosk
      </span>
      <span class="footer-sep" aria-hidden="true">•</span>
      <span class="footer-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="16" cy="4" r="1.2" />
          <path d="m18 19 1-7-6 1" />
          <path d="m5 8 3-3 5.5 3-2.36 3.5" />
          <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
          <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
        </svg>
        Ramah difabel · Layar bersih otomatis 30 detik
      </span>
    </footer>
  </div>
</template>
```

Note: `KioskHeader` is used without `lang`/`help` props for now — the header remains the same from the redesign but without the bilingual toggle to keep scope focused on the search flow. If the header requires those props, they stay as-is from the current `KioskHome.vue`.

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: FAIL if `KioskPage.vue` references old `@start-booking` emit. That's fixed in Task 8.

- [ ] **Step 3: Commit**

```bash
git add apps/kiosk-web/src/views/KioskHome.vue
git commit -m "feat(kiosk): redesign KioskHome as search-first screen with virtual keyboard"
```

---

### Task 8: Patient Context Confirmation Step

**Files:**
- Create: `apps/kiosk-web/src/views/steps/PatientContextConfirmStep.vue`

**Interfaces:**
- Consumes: `PatientContextItem` from `@aq/shared-types`
- Props: `bestMatch: PatientContextItem | null`, `patients: PatientContextItem[]`, `pending: boolean`
- Emits: `confirm(item: PatientContextItem)`, `intake`, `retry`

- [ ] **Step 1: Create `apps/kiosk-web/src/views/steps/PatientContextConfirmStep.vue`**

```vue
<script setup lang="ts">
import type { PatientContextItem } from '@aq/shared-types'

defineProps<{
  bestMatch: PatientContextItem | null
  patients: PatientContextItem[]
  pending: boolean
}>()

const emit = defineEmits<{
  confirm: [item: PatientContextItem]
  intake: []
  retry: []
}>()

function disambiguator(item: PatientContextItem): string {
  return item.maskedNik || item.id || item.patientId
}
</script>

<template>
  <section class="panel">
    <h1>Konfirmasi Data Pasien</h1>
    <p>Pilih data pasien yang sesuai dengan Anda.</p>

    <div v-if="bestMatch" class="context-card context-card--best" data-testid="best-match">
      <div class="context-card-head">
        <span class="context-card-badge">Paling Cocok</span>
        <strong class="context-card-name">{{ bestMatch.patientName }}</strong>
      </div>
      <dl class="context-card-detail">
        <div v-if="bestMatch.birthDate">
          <dt>Tgl. Lahir</dt>
          <dd>{{ bestMatch.birthDate }}</dd>
        </div>
        <div v-if="bestMatch.gender">
          <dt>Gender</dt>
          <dd>{{ bestMatch.gender }}</dd>
        </div>
        <div>
          <dt>Lokasi</dt>
          <dd>{{ bestMatch.locality }}</dd>
        </div>
        <div v-if="bestMatch.maskedNik">
          <dt>NIK</dt>
          <dd>{{ bestMatch.maskedNik }}</dd>
        </div>
      </dl>
      <button
        type="button"
        class="sp-btn context-card-action"
        :disabled="pending"
        data-testid="confirm-best-match"
        @click="emit('confirm', bestMatch)"
      >
        Lanjutkan Pendaftaran
      </button>
    </div>

    <div v-if="patients.length > 0" class="context-list-section">
      <h2 v-if="bestMatch">Pilih data lain</h2>
      <div class="sp-grid">
        <button
          v-for="item in patients"
          :key="item.id"
          type="button"
          class="sp-btn context-card"
          :disabled="pending"
          :data-testid="`patient-${item.id}`"
          @click="emit('confirm', item)"
        >
          <strong>{{ item.patientName }}</strong>
          <small>{{ disambiguator(item) }}</small>
          <small v-if="item.birthDate">{{ item.birthDate }}</small>
        </button>
      </div>
    </div>

    <p v-if="!bestMatch && patients.length === 0 && pending" class="status">
      Mencari data pasien…
    </p>

    <div class="actions">
      <button
        type="button"
        class="sp-btn"
        :disabled="pending"
        data-testid="take-intake"
        @click="emit('intake')"
      >
        Ambil Antrian Pendaftaran
      </button>
      <button
        type="button"
        class="secondary-btn"
        :disabled="pending"
        data-testid="retry-search"
        @click="emit('retry')"
      >
        Cari Ulang
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: PASS (new component, no downstream references yet).

- [ ] **Step 3: Commit**

```bash
git add apps/kiosk-web/src/views/steps/PatientContextConfirmStep.vue
git commit -m "feat(kiosk): add PatientContextConfirmStep"
```

---

### Task 9: KioskPage Wiring

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskPage.vue`

**Interfaces:**
- Consumes: `PatientContextConfirmStep`, redesigned `KioskHome`, updated `useKioskRegistration`
- Changes: new emits from `KioskHome`, new step `PATIENT_CONTEXT_CONFIRM`, intake from confirm step

- [ ] **Step 1: Import `PatientContextConfirmStep`**

In the imports at the top of `KioskPage.vue` (around lines 20-31), add:

```typescript
import PatientContextConfirmStep from './steps/PatientContextConfirmStep.vue'
```

- [ ] **Step 2: Add wiring methods**

After `onScanBookingFromHome` (around line 211), add:

```typescript
function onSearchFromHome(keyword: string) {
  onStartBooking()
  void registration.submitBookingKeyword(keyword)
}

function onConfirmPatientContext(item: any) {
  void registration.confirmPatientContext(item)
}

function onCancelPatientContext() {
  registration.cancelPatientContext()
}

function onIntakeFromContext() {
  registration.cancelPatientContext()
  homeMode.value = 'intake'
}
```

- [ ] **Step 3: Replace `KioskHome` event handlers in the template**

Find the `KioskHome` template block (around lines 367-374):

```pug
  <KioskHome
    v-else-if="homeMode === 'idle'"
    :intake-available="offerings.length > 0"
    @start-booking="onStartBooking"
    @start-walkin="onStartWalkin"
    @start-intake="onStartIntake"
    @scan-booking="onScanBookingFromHome"
  />
```

Replace with:

```pug
  <KioskHome
    v-else-if="homeMode === 'idle'"
    :intake-available="offerings.length > 0"
    @start-search="onSearchFromHome"
    @start-walkin="onStartWalkin"
    @start-intake="onStartIntake"
    @scan-booking="onScanBookingFromHome"
  />
```

- [ ] **Step 4: Add `PatientContextConfirmStep` rendering**

After the `BookingConfirmStep` block and before `BiometricStep` (around lines 292-300), add:

```pug
    <PatientContextConfirmStep
      v-else-if="registration.flow.value === 'PATIENT_CONTEXT_CONFIRM'"
      :best-match="registration.patientContextResult.value?.bestMatch ?? null"
      :patients="registration.patientContextResult.value?.patients.items ?? []"
      :pending="registration.submitting.value"
      @confirm="onConfirmPatientContext"
      @intake="onIntakeFromContext"
      @retry="onCancelPatientContext"
    />
```

- [ ] **Step 5: Add loading state for `PATIENT_CONTEXT_SEARCH`**

After `BookingSearchStep` block (around lines 284-291), before `BookingConfirmStep`:

```pug
    <section v-else-if="registration.flow.value === 'PATIENT_CONTEXT_SEARCH'" class="panel">
      <h1>Mencari Data</h1>
      <p class="status">Mencari data pasien…</p>
    </section>
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/kiosk-web/src/views/KioskPage.vue
git commit -m "feat(kiosk): wire unified search flow in KioskPage"
```

---

### Task 10: Styles — Keyboard, Search Input, Context Card

**Files:**
- Modify: `apps/kiosk-web/src/styles.css`

**Interfaces:**
- Produces: CSS classes `.search-section`, `.search-input-row`, `.search-input`, `.scan-btn`, `.primary-btn--search`, `.search-alt-links`, `.link-btn`, `.virtual-keyboard`, `.kb-row`, `.kb-key`, `.kb-key--backspace`, `.kb-key--space`, `.context-card`, `.context-card--best`, `.context-card-badge`, `.context-card-head`, `.context-card-name`, `.context-card-detail`, `.context-card-action`, `.context-list-section`

- [ ] **Step 1: Add new styles**

In `apps/kiosk-web/src/styles.css`, append the following styles before the end of the file:

```css
/* ---- Unified Search ---- */
.search-section {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.search-input-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  font-size: 24px;
  padding: 18px 24px;
  border: 2px solid #d1d5db;
  border-radius: 16px;
  background: #fff;
  color: #1f2937;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #1d6fb8;
}

.search-input::placeholder {
  color: #9ca3af;
}

.scan-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  color: #1d6fb8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.scan-btn:hover {
  background: #eff6ff;
}

.primary-btn--search {
  width: 100%;
  margin-top: 16px;
  padding: 18px;
  font-size: 20px;
}

.search-alt-links {
  text-align: center;
  margin-top: 24px;
}

.link-btn {
  background: none;
  border: none;
  color: #1d6fb8;
  font-size: 16px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.link-btn:hover {
  color: #1e40af;
}

/* ---- Virtual Keyboard ---- */
.virtual-keyboard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #f3f4f6;
  border-radius: 16px;
}

.kb-row {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.kb-key {
  min-width: 48px;
  height: 52px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kb-key:active {
  background: #e5e7eb;
}

.kb-key--backspace {
  min-width: 64px;
  background: #fee2e2;
  border-color: #fca5a5;
  font-size: 22px;
}

.kb-key--backspace:active {
  background: #fecaca;
}

.kb-key--space {
  flex: 1;
  max-width: 320px;
  background: #e5e7eb;
  font-size: 14px;
}

.kb-key--space:active {
  background: #d1d5db;
}

/* ---- Patient Context Cards ---- */
.context-card {
  text-align: left;
  padding: 20px;
  width: 100%;
}

.context-card--best {
  border: 2px solid #16A34A;
  background: #f0fdf4;
  margin-bottom: 24px;
}

.context-card-badge {
  display: inline-block;
  background: #16A34A;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 8px;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.context-card-head {
  margin-bottom: 14px;
}

.context-card-name {
  font-size: 22px;
  color: #1f2937;
}

.context-card-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  font-size: 15px;
}

.context-card-detail dt {
  color: #6b7280;
}

.context-card-detail dd {
  color: #1f2937;
  font-weight: 600;
}

.context-card-action {
  margin-top: 16px;
  width: 100%;
}

.context-list-section {
  margin-bottom: 24px;
}

.context-list-section h2 {
  font-size: 18px;
  color: #6b7280;
  margin-bottom: 12px;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter kiosk-web run typecheck
```

Expected: PASS (CSS changes only).

- [ ] **Step 3: Commit**

```bash
git add apps/kiosk-web/src/styles.css
git commit -m "feat(kiosk): add search input, keyboard, and patient context card styles"
```

---

### Task 11: Tests

**Files:**
- Modify: `apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts`
- Modify: `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`
- Create: `apps/kiosk-web/src/views/__tests__/PatientContextConfirmStep.spec.ts`
- Create: `apps/kiosk-web/src/components/__tests__/VirtualKeyboard.spec.ts`

**Interfaces:**
- Each test file tests its corresponding source file independently.

#### 10a: Registration Composable Tests

- [ ] **Step 1: Add cascade search tests to `useKioskRegistration.spec.ts`**

After the existing booking flow `describe` block and before the walkin block, add:

```typescript
describe('useKioskRegistration patient context cascade', () => {
  const contextItem = {
    kind: 'Patient',
    id: 'P001',
    patientName: 'Budi',
    patientId: 'PT1',
    birthDate: '1990-01-01',
    gender: 'L',
    locality: 'Jakarta',
    maskedNik: '123456****',
    maskedPhone: null,
    visitDate: null,
    visitTime: null,
    serviceName: null,
    doctorName: null,
    state: 'Active',
    bookingId: null,
    registrationId: null,
    matchType: 'Exact',
    isExactMatch: true,
    rank: 1,
    warnings: [],
  }

  const contextResponse = {
    businessDate: '2026-08-03',
    bookings: { items: [], total: 0, hasMore: false },
    registrations: { items: [], total: 0, hasMore: false },
    patients: { items: [contextItem], total: 1, hasMore: false },
    bestMatch: contextItem,
    canCreatePatient: true,
  }

  it('cascades to patient context search when booking search returns empty', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    reg.startBookingFlow()
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    expect(reg.patientContextResult.value).toEqual(contextResponse)
  })

  it('goes to failure when patient context search returns nothing', async () => {
    const emptyContext = {
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [], total: 0, hasMore: false },
      bestMatch: null,
      canCreatePatient: true,
    }
    const searchPatientContext = vi.fn(async () => emptyContext)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    reg.startBookingFlow()
    await reg.submitBookingKeyword('XYZ')
    expect(reg.flow.value).toBe('FAILURE')
    expect(reg.errorContext.value?.code).toBe('BOOKING_NOT_FOUND')
  })

  it('confirmPatientContext maps to goshow walkin flow', async () => {
    const searchPatientContext = vi.fn(async () => contextResponse)
    const reg = useKioskRegistration(
      makeDeps({ searchBooking: vi.fn(async () => []), searchPatientContext }),
    )
    reg.startBookingFlow()
    await reg.submitBookingKeyword('Budi')
    expect(reg.flow.value).toBe('PATIENT_CONTEXT_CONFIRM')
    await reg.confirmPatientContext(contextItem)
    expect(reg.flow.value).toBe('WALKIN_SELECT_SERVICE')
    expect(reg.selectedPatient.value?.pasienId).toBe('PT1')
    expect(reg.selectedPatient.value?.pasienName).toBe('Budi')
  })

  it('cancelPatientContext returns to home', () => {
    const reg = useKioskRegistration(
      makeDeps({ searchPatientContext: vi.fn(async () => contextResponse) }),
    )
    reg.startBookingFlow()
    reg.cancelPatientContext()
    expect(reg.flow.value).toBe('HOME')
    expect(reg.patientContextResult.value).toBeNull()
  })
})

The `searchPatientContext` dep must be added to `makeDeps`. Add to the default deps object (around line 52):

```typescript
    searchPatientContext: vi.fn(async () => ({
      businessDate: '2026-08-03',
      bookings: { items: [], total: 0, hasMore: false },
      registrations: { items: [], total: 0, hasMore: false },
      patients: { items: [{
        kind: 'Patient', id: 'P001', patientName: 'Budi', patientId: 'PT1',
        birthDate: '1990-01-01', gender: 'L', locality: 'Jakarta',
        maskedNik: '123456****', maskedPhone: null, visitDate: null,
        visitTime: null, serviceName: null, doctorName: null, state: 'Active',
        bookingId: null, registrationId: null, matchType: 'Exact',
        isExactMatch: true, rank: 1, warnings: [],
      }], total: 1, hasMore: false },
      bestMatch: null,
      canCreatePatient: true,
    })),
```

#### 10b: KioskHome Tests

- [ ] **Step 2: Rewrite `KioskHome.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskHome from '../KioskHome.vue'

describe('KioskHome (search-first)', () => {
  it('renders search input with placeholder', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    expect(input.element.placeholder).toContain('Kode booking')
  })

  it('emits startSearch when form is submitted', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('does not emit startSearch with empty input', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toBeUndefined()
  })

  it('emits scanBooking when scan button clicked', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="scan-booking"]').trigger('click')
    expect(wrapper.emitted('scanBooking')).toHaveLength(1)
  })

  it('emits startWalkin from daftar tanpa booking link', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true } })
    await wrapper.get('[data-testid="start-walkin"]').trigger('click')
    expect(wrapper.emitted('startWalkin')).toHaveLength(1)
  })
})
```

#### 10c: PatientContextConfirmStep Tests

- [ ] **Step 3: Create `apps/kiosk-web/src/views/__tests__/PatientContextConfirmStep.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatientContextConfirmStep from '../steps/PatientContextConfirmStep.vue'
import type { PatientContextItem } from '@aq/shared-types'

const best: PatientContextItem = {
  kind: 'Patient',
  id: 'P001',
  patientName: 'Budi Santoso',
  patientId: 'PT1',
  birthDate: '1990-05-15',
  gender: 'L',
  locality: 'Jakarta Selatan',
  maskedNik: '317401******',
  maskedPhone: null,
  visitDate: null,
  visitTime: null,
  serviceName: null,
  doctorName: null,
  state: 'Active',
  bookingId: null,
  registrationId: null,
  matchType: 'Exact',
  isExactMatch: true,
  rank: 1,
  warnings: [],
}

const alt: PatientContextItem = {
  ...best,
  id: 'P002',
  patientName: 'Budi Prasetyo',
  maskedNik: '317402******',
  isExactMatch: false,
  rank: 2,
}

describe('PatientContextConfirmStep', () => {
  it('shows bestMatch prominently', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    expect(wrapper.get('[data-testid="best-match"]').text()).toContain('Budi Santoso')
    expect(wrapper.get('[data-testid="best-match"]').text()).toContain('Paling Cocok')
  })

  it('emits confirm with best match item', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="confirm-best-match"]').trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[best]])
  })

  it('shows additional patients in list', () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [alt], pending: false },
    })
    expect(wrapper.get(`[data-testid="patient-${alt.id}"]`).text()).toContain('Budi Prasetyo')
  })

  it('emits intake when ambil antrian clicked', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="take-intake"]').trigger('click')
    expect(wrapper.emitted('intake')).toHaveLength(1)
  })

  it('emits retry when cari ulang clicked', async () => {
    const wrapper = mount(PatientContextConfirmStep, {
      props: { bestMatch: best, patients: [], pending: false },
    })
    await wrapper.get('[data-testid="retry-search"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
```

#### 10d: VirtualKeyboard Tests

- [ ] **Step 4: Create `apps/kiosk-web/src/components/__tests__/VirtualKeyboard.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VirtualKeyboard from '../VirtualKeyboard.vue'

describe('VirtualKeyboard', () => {
  it('emits update:modelValue when a key is pressed', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: '' } })
    await wrapper.get('button:not([data-testid])').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    expect(emitted![0]).toEqual(['1'])
  })

  it('appends character to existing value', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'AB' } })
    const firstKey = wrapper.find('.kb-key:not(.kb-key--backspace):not(.kb-key--space)')
    await firstKey.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['AB1'])
  })

  it('removes last character on backspace', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'ABC' } })
    await wrapper.get('[data-testid="kb-backspace"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['AB'])
  })

  it('adds space when spacebar clicked', async () => {
    const wrapper = mount(VirtualKeyboard, { props: { modelValue: 'Hello' } })
    await wrapper.get('[data-testid="kb-space"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Hello '])
  })
})
```

- [ ] **Step 5: Run all kiosk-web tests**

```bash
pnpm --filter kiosk-web test
```

Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add apps/kiosk-web/src/composables/__tests__/useKioskRegistration.spec.ts apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts apps/kiosk-web/src/views/__tests__/PatientContextConfirmStep.spec.ts apps/kiosk-web/src/components/__tests__/VirtualKeyboard.spec.ts
git commit -m "feat(kiosk): add tests for unified search flow"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run canonical gate**

```bash
pnpm turbo run typecheck test
```

Expected: All tasks pass (13 typecheck + tests across all packages/apps).

- [ ] **Step 2: Fix any failures**

If `PATIENT_CONTEXT_SEARCH` or `PATIENT_CONTEXT_CONFIRM` are not handled in `KioskPage.vue` template exhaustively, Vue may warn. Ensure the v-if/v-else-if chain covers all states.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix(kiosk): address verification issues for unified search flow"
```

---
