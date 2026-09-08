# Task 3 Report: Integrate the Resolver into the Kiosk Failure Flow

## Status: DONE

## What I implemented / finished

Task 3 wires the `resolveFallbackServicePointId` resolver (built in Task 2) into the
booking-failure UI so the kiosk visually recommends one assistance service point while the
user still chooses explicitly (no auto-submit).

The previous interrupted attempt had already applied the two production edits and left the
`__tests__` directory empty. I verified those edits against the brief, created the missing
test file verbatim, ran the gates, and committed. This task touched only `apps/kiosk-web`.

## Files changed

- `apps/kiosk-web/src/views/KioskPage.vue` (modified, staged)
- `apps/kiosk-web/src/views/steps/FailureStep.vue` (modified, staged)
- `apps/kiosk-web/src/views/steps/__tests__/FailureStep.spec.ts` (created, staged)

No other files were staged. `.superpowers/sdd/*`, `docs/design/*.png/jpg`,
`docs/architecture/cetakan/`, and the release plan doc remain untracked/unstaged.

## Verification that production edits match the brief

Compared existing working-tree edits to the brief line-by-line:

- `KioskPage.vue`
  - Import `resolveFallbackServicePointId` from `../lib/fallbackServicePoint` present.
  - `recommendedFallbackServicePointId` computed present verbatim, consuming
    `configService.getConfig().fallbackServicePoints?.bookingFailure` and `offerings.value`
    (no extra Service Point API call).
  - `:recommended-service-point-id="recommendedFallbackServicePointId"` passed to
    `<FailureStep>`.
- `FailureStep.vue`
  - `recommendedServicePointId?: string` added to the `defineProps` block.
  - `:data-recommended="sp.servicePointId === recommendedServicePointId ? 'true' : undefined"`
    on the assistance card button.
  - "Rekomendasi" badge `<span>` present with the brief's exact class/style/markup, shown
    `v-if` the card matches.
  - Card click handler unchanged (`@click="$emit('selectServicePoint', sp.servicePointId')`).

No drift found — no production edits were required. No extra scope was introduced.

## What I tested and results

- Focused new test
  `pnpm --filter kiosk-web exec vitest run src/views/steps/__tests__/FailureStep.spec.ts`
  → PASS (2 tests). The test asserts real behavior: exactly one card carries
  `data-recommended="true"` and it is `assist-SP-B`, and no `selectServicePoint` event is
  auto-emitted; with no recommendation passed, no card is marked.
- Focused resolver test
  `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/fallbackServicePoint.spec.ts`
  → PASS (5 tests).
- Full kiosk-web suite `pnpm --filter kiosk-web exec vitest run`
  → 29 files / 179 tests PASS, output pristine.
- Typecheck `pnpm --filter kiosk-web run typecheck` → clean (no output, exit 0).

## TDD RED/GREEN note

Not applicable / not required: the production code already implemented the behavior when I
started (interrupted prior attempt), so there was no RED phase to produce.

## Commit

- `fa06088` feat(kiosk-web): mark recommended service point on booking failure
  (3 files, 53 insertions; staged explicitly, never `git add -A`).

## Self-review findings

- Code matches brief verbatim for the computed, prop, `data-recommended` binding, and badge.
- Test asserts the marker exists only on the recommended card, is absent when no
  recommendation is given, and that nothing auto-emits — no over-building.
- `:data-recommended` uses `undefined` so non-recommended cards omit the attribute entirely;
  the test's `[data-recommended="true"]` selector is therefore unambiguous.
- All scratch/deleted `.superpowers/sdd` files, `docs/design` images, `docs/architecture/cetakan/`,
  and the release plan stayed out of the commit.

## Concerns

- None blocking. The only behavioral change is visual; click still drives submission.
  Note: pre-existing tracked `.superpowers/sdd/*` files show deletions/modifications in the
  working tree from a separate process — left untouched and unstaged as instructed.
