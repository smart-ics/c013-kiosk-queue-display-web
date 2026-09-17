# Implementation Plan: Premium Kiosk Verification Card Refactor

- **Target Components:**
  - Implemented: `c013-kiosk-queue-display-web/apps/kiosk-web/src/views/steps/BookingConfirmStep.vue`
  - Proposed extension: `c013-kiosk-queue-display-web/apps/kiosk-web/src/views/steps/WalkinConfirmStep.vue`
- **Shared styling source:** `c013-kiosk-queue-display-web/apps/kiosk-web/src/styles.css`
- **Date:** 2026-09-17
- **Plan updated:** 2026-09-18
- **Status:** Approved — Walk-in extension
- **User Decisions (2026-09-17):**
  1. Keep global CSS (not scoped) — for design consistency across sibling step components.
  2. Size card considering parent layout constraints (see §1.3 and §5).
  3. Use the existing kiosk theme tokens rather than introducing hardcoded card colors.
  4. Make the insurance/guarantee badge shrink to its content instead of stretching full width.
  5. Use `.smart-identity-seal` on the left instead of `.smart-avatar`.
- **User Request (2026-09-18):**
  1. Extend the completed booking-card treatment to the other confirm-step cards that use `.smart-card`.

---

## 1. Parent Context & Layout Verification

### 1.1 Where It Is Called (`KioskPage.vue:529`)
```vue
<BookingConfirmStep
  v-else-if="registration.flow.value === 'BOOKING_CONFIRM'"
  :booking="registration.bookingDetail.value!"
  :eligibility="registration.bookingEligibility.value!"
  :pending="registration.submitting.value"
  :error-message="null"
  @confirm="registration.confirmBooking"
  @back="onHome"
/>
```
- **Parent container:** `<div class="kiosk-step-wrapper">` (line 516 of KioskPage.vue)
- **Grandparent layout chain:**
  - `.kiosk-flow-shell` → `height: 100dvh; display: flex; flex-direction: column; overflow: hidden`
  - `.kiosk-flow-body` → `flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 48px; overflow: hidden`
  - `.kiosk-step-wrapper` → `flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden`
- **Key constraint:** `kiosk-step-wrapper` has `width: 100%` and centers children via flexbox. No explicit max-width is enforced by the parent — the child component's internal width decides the card size.

### 1.2 Existing Layout & Size Constraints
- **Current component uses `.smart-card`** from global `styles.css:1483-1522` which sets:
  ```css
  .smart-card {
    background: var(--color-surface-card);    /* #fff */
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    margin: 24px auto;
    max-width: 600px;           /* ← current limit */
    border: 1px solid var(--border-soft);
  }
  ```
- **Panel class** (also in global styles) constrains to `max-width: min(920px, calc(100% - 2rem))` — but the current BookingConfirmStep component does NOT use `.panel`'s structural styles; it only uses inline styles `style="background: transparent; border: none; box-shadow: none; padding-top: 0;"` on the `<section>`, relying entirely on `.smart-card` inside.

### 1.3 Size Decision for the Refactored Card
- **Prompt requirement:** "large, highly legible kiosk-oriented information card designed for quick scanning from a short distance"
- **Old card:** 600px max-width — too narrow for the "large" requirement, causes long doctor names to break layout
- **New card width:** `width: min(100%, 880px)` with `margin: 0 auto`
  - Large enough for bold, scannable hierarchy at 1–2m viewing distance
  - Fits comfortably within the `.panel`'s 920px max-width constraint
  - **Parent-safe:** at any viewport width, `min(100%, 880px)` guarantees the card never exceeds available horizontal space in `.kiosk-flow-body` (which has `padding: 24px 48px`, leaving `100vw - 96px`). At 768px viewport the card shrinks to 672px rather than overflowing.
  - Centred in `kiosk-step-wrapper` which has `width: 100%` — the card will naturally be centered with room on sides
  - Replaces the old `.smart-card`'s fixed `max-width: 600px` in the global stylesheet

### 1.4 Current Confirm-Step Inventory

Only two confirm steps currently use the `.smart-card` container:

- `BookingConfirmStep.vue:28-125`
  - Uses the completed premium structure:
    - `.smart-card-header`
    - `.smart-identity`
    - `.smart-identity-seal`
    - `.smart-identity-info`
    - `.context-card-badge`
    - `.smart-card-body`
    - `.smart-info-row`
    - `.smart-icon-tile`
    - `.smart-info-main`
- `WalkinConfirmStep.vue:23-48`
  - Uses the same outer `.smart-card`, `.smart-card-header`, and `.smart-card-body` containers.
  - Still uses the older inner markup:
    - Header contains only an `h3` and an inline badge; it has no `.smart-identity`, `.smart-identity-seal`, or `.smart-identity-info`.
    - Body rows contain `.smart-info-row`, `.smart-info-label`, and `.smart-info-value`, but have no `.smart-icon-tile` or `.smart-info-main`.
  - This markup difference—not the shared `.smart-card` shell—is why “Konfirmasi Data Layanan” does not yet look like “Konfirmasi Data Booking.”

`PatientContextConfirmStep.vue` uses `.context-card-badge` for its “Paling Cocok” marker, but does not use `.smart-card`. It therefore remains outside the card-markup extension. The existing shared `.context-card-badge` behavior must still be regression-checked there.

### 1.5 Layout Pattern to Follow

Both `.smart-card` confirm components keep the existing integration pattern:
1. Outer `<section class="panel">` with neutral inline styles
2. Inner `<div class="smart-card">` carrying the actual card styling and content
3. **Completed for booking:** Upgraded the global `.smart-card` CSS and template/classes in the SFC (per user decision #1 — keep global CSS for design consistency across sibling steps), while keeping the same parent integration pattern.
4. **Proposed for walk-in:** Retain the same outer and container pattern, but replace WalkinConfirmStep’s legacy header/body markup with the completed booking-card markup pattern.

---

## 2. Shared Card Architecture and Confirm-Step Parity

### 2.1 Completed Booking Baseline

The booking card is the visual reference for all other `.smart-card` confirm steps:

- Card shell uses theme tokens:
  - `background: var(--color-surface-card)`
  - `border: 1px solid var(--border-soft)`
  - `border-radius: 28px`
  - Elevation shadows plus a theme-derived outline via `color-mix(... var(--brand-strong) 4% ...)`.
- Decorative `::before` and `::after` healthcare motifs remain at `opacity: 0.04`, `pointer-events: none`, and behind the card content.
- Header uses:
  - `.smart-identity`
  - `.smart-identity-seal` on the left
  - `.smart-identity-info`
  - Patient name in `h3`
  - Insurance/guarantee `.context-card-badge`
- `.smart-identity-seal` replaces the former avatar:
  - Same left-hand circular identity position
  - `width`/`height: clamp(56px, 6vw, 68px)`
  - `border-radius: 50%`
  - `background: var(--brand-soft)`
  - `color: var(--brand-strong)`
- The badge is content-width:
  - `display: inline-block`
  - `align-self: flex-start`
  - No `.badge-dot`
- Body rows use:
  - `.smart-info-row`
  - `.smart-icon-tile`
  - `.smart-info-main`
  - `.smart-info-label`
  - `.smart-info-value`
- The doctor value uses `.smart-value-clamp` to contain long specialist names.
- Typography remains fluid with `clamp()`.

### 2.2 Walk-in Parity Requirements

`WalkinConfirmStep.vue` must preserve its props, emits, `data-testid="walkin-confirm"`, four data rows, actions, and eligibility behavior, while adopting booking’s inner structure:

- Header:
  - `.smart-identity`
  - `.smart-identity-seal` with the existing shield SVG
  - `.smart-identity-info`
  - `patient.pasienName` in `h3`
  - Content-width `.context-card-badge`
- Badge behavior:
  - Keep `eligibility.tipeJaminanName`
  - Keep ` (Perlu Verifikasi)` when `eligibility.needsEligibility` is true
  - Use the same brand/OK background treatment as booking
- Body rows, in the existing order:
  1. `No. Rekam Medis`: `patient.noMR ?? patient.pasienId`
  2. `Poli Tujuan`: `service.poli.name`
  3. `Dokter`: `service.dokter.name`, including `.smart-value-clamp`
  4. `Jam Praktik`: `service.jadwal.jamPraktek`
- Every body row must use:
  - `.smart-info-row`
  - `.smart-icon-tile`
  - `.smart-info-main`
  - `.smart-info-label`
  - `.smart-info-value`
- Use the existing global CSS wherever possible; do not add walk-in-scoped card styles.

### 2.3 Responsive and Kiosk Safety

- Keep fluid `clamp()` typography.
- Preserve `min-width: 0` and wrapping/clamping behavior for long names.
- Below 640px, the identity header stacks while information rows retain the left-icon/right-text arrangement.
- Retain `width: min(100%, 880px)` so the extended walk-in card also remains parent-safe.

---

## 3. Implementation Steps

### 3.1 Completed Booking Work

1. Updated the shared `.smart-card` architecture in `apps/kiosk-web/src/styles.css`.
2. Reworked `BookingConfirmStep.vue` to use the shared identity, badge, icon-tile, and information-row structure.
3. Replaced `.smart-avatar` and `.badge-dot` with the left-hand `.smart-identity-seal` and content-width badge.
4. Updated `BookingConfirmStep.spec.ts` for the badge and seal behavior.
5. Ran the repository verification gate before completing that phase.

### 3.2 Walk-in Extension (approved)

1. Refactor `WalkinConfirmStep.vue`:
   - Preserve the exact props: `patient`, `service`, `eligibility`, `pending`, and `errorMessage`.
   - Preserve the exact emits: `confirm` and `back`.
   - Preserve `data-testid="walkin-confirm"`.
   - Keep the existing outer `<section class="panel">` wrapper and actions unchanged.
   - Replace the legacy header with `.smart-identity`, `.smart-identity-seal`, `.smart-identity-info`, patient `h3`, and content-width `.context-card-badge`.
   - Convert the existing four rows to `.smart-info-row`, `.smart-icon-tile`, `.smart-info-main`, `.smart-info-label`, and `.smart-info-value`.
   - Apply `.smart-value-clamp` to the doctor value.
   - Keep walk-in’s eligibility badge text and background behavior, without reintroducing `.smart-avatar` or `.badge-dot`.
2. Update or create `WalkinConfirmStep.spec.ts`:
   - Seal is present.
   - Insurance text renders.
   - The verification suffix appears only when `needsEligibility` is true.
   - All four walk-in labels render with their values.
3. Reuse the existing global CSS rather than introducing walk-in-specific card styles.
4. Check `PatientContextConfirmStep.vue` only for regressions in its shared `.context-card-badge`; do not convert its radio-card selection layout to `.smart-card`.
5. Verification and gates:
   - Execute TypeScript check: `pnpm --filter kiosk-web exec vue-tsc -p tsconfig.app.json --noEmit`
   - Run Vitest suite: `pnpm --filter kiosk-web exec vitest run`
   - Manual: `pnpm --filter kiosk-web dev` → `/kiosk/{stationId}` walk-in flow, including long doctor name, both `needsEligibility` states, and 720p/small-width behavior.

---

## 4. Risks & Mitigations

- **Long doctor names overpowering card** → use `-webkit-line-clamp: 2`, `overflow-wrap: anywhere`, and `min-width: 0` on both booking and walk-in doctor values; test with synthetic long names.
- **Decorative geometry competing with text** → cap opacity 0.04, confine motifs to header corners (`top-right`, `bottom-left`), use `z-index: 0` and `position: absolute` behind card content.
- **Parent layout regression** → retain the existing outer `<section class="panel">` wrappers in both confirm steps, so parent `kiosk-step-wrapper` flex-centering is unaffected.
- **Width too large for some kiosk screens** → `width: min(100%, 880px)` guarantees the card never exceeds available horizontal space in `.kiosk-flow-body` (padding 24px 48px leaves `100vw - 96px`); at 768px viewport the card shrinks to 672px rather than overflowing.
- **Walk-in behavior accidentally changing** → preserve props, emits, action buttons, ordering, value fallbacks, and eligibility text; limit that refactor to markup and shared-class adoption.
- **Shared badge regression in patient context** → retain the content-width badge styling and check the unaffected `PatientContextConfirmStep` badge during verification.

---

## 5. Decisions Log

### 5.1 User Decisions (resolved 2026-09-17)
1. **CSS scope:** Keep global CSS (not scoped) — for design consistency across sibling step components (WalkinConfirmStep, PatientContextConfirmStep). Updated `.smart-card` global class instead of adding scoped styles.
2. **Card width:** `width: min(100%, 880px)` with `margin: 0 auto` — parent-safe, never overflows `.kiosk-flow-body` padding (100vw - 96px), respects `.panel`'s 920px envelope, and is larger than the old 600px for kiosk legibility.

### 5.2 Walk-in Extension (Approved 2026-09-18)

1. **Scope:** Extend only `.smart-card` confirm steps. `WalkinConfirmStep.vue` is included; the `PatientContextConfirmStep.vue` radio-card selection layout is excluded.
2. **Visual reference:** Use the completed booking implementation as the standard.
3. **CSS policy:** Reuse the shared `.smart-card` system; no confirm-step-scoped card CSS.
4. **Removed elements:** Do not reintroduce `.smart-avatar` or `.badge-dot` in walk-in.
5. **Behavior preservation:** Walk-in props, emits, action flow, test ID, row order, value fallbacks, and eligibility logic remain unchanged.