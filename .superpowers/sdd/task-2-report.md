## Task 2: Display package version on KioskHome with test

### What was implemented

Added the package version (`v0.2.6`) from `package.json` to the KioskHome footer as a fourth footer item.

**Files modified:**

- `apps/kiosk-web/src/views/KioskHome.vue`
  - Line 10: `import { version } from '../../package.json'`
  - Lines 229-232: Added `<span class="footer-sep">•</span>` and `<span class="footer-item footer-version">v{{ version }}</span>` after the last existing footer item

- `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`
  - Lines 52-55: Added test `'renders package version in the footer'` asserting `wrapper.text()` contains `'v0.2.6'`

### TDD Evidence

**RED (FAIL):**
```
Tests 1 failed | 7 passed (8)
FAIL  src/views/__tests__/KioskHome.spec.ts > KioskHome > renders package version in the footer
AssertionError: expected 'RS Sehat SejahteraMelayani dengan hat…' to contain 'v0.2.6'
```

**GREEN (PASS):**
```
Tests 8 passed (8)
✓ src/views/__tests__/KioskHome.spec.ts (8 tests) 449ms
```

**REFACTOR (full suite):**
```
Test Files 27 passed (27)
Tests 172 passed (172)
```

### Self-review findings

- The version string in `package.json` is `0.2.6` (not `0.2.7` as initially stated in the task description). Test asserts against the actual value.
- `resolveJsonModule: true` is set in `tsconfig.base.json`, so the JSON import works correctly with Vite.
- The footer item uses `footer-version` class for potential styling hooks. No CSS added since the footer already has a consistent `footer-item` style.
- No comments added per repo conventions.
- No regressions: 172/172 tests pass.
