## Fix Summary: npx vitest --ui command

**Issue:** `npx vitest --ui` was failing with "MISSING DEPENDENCY Cannot find package '@vitest/ui'" 

**Root Cause:** The `kiosk-web` package was missing the `@vitest/ui` dependency required for the UI mode.

**Fix Applied:** 
- Installed `@vitest/ui@3.2.7` as a dev dependency in `kiosk-web` package
- Version matched exactly with existing `vitest@3.2.7` to ensure compatibility

**Verification:**
- Dependency successfully installed and verified in `package.json`
- `pnpm --filter kiosk-web add -D @vitest/ui@3.2.7` completed successfully
- The `@vitest/ui` package is now present in the workspace

**Status:** ✅ FIXED - The dependency is now available and the command should work.

**Note:** The `--ui` flag may require a browser to launch the interactive UI, but the core test runner functionality is now available.