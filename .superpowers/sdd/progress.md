# display-web Auto-Login Auth Token Provider — Progress Ledger

Branch: `feat/display-missing-screen-picker`
Plan: `docs/superpowers/plans/2026-07-25-display-web-auto-login-token-provider.md`
Spec: `docs/superpowers/specs/2026-07-25-display-web-auto-login-token-provider-design.md`

Tasks:
- [x] Task 1: Create `AutoLoginAuthTokenProvider` class (commits 3ec8402..a1a6e60, review clean after fix)
- [x] Task 2: Comprehensive unit tests
- [x] Task 3: Re-export from `@aq/auth` index
- [x] Task 4: Wire provider in `infrastructure.ts`
- [ ] Task 5: Create `LoginView.vue`
- [ ] Task 6: Add `/login` route and guard
- [ ] Task 7: Update `RootView.vue` loading state
- [ ] Task 8: Update `DisplayPage.vue` with `awaitAuthenticated()`
- [ ] Task 9: Remove `VITE_BILREG_TOKEN` from env/types/README
- [ ] Task 10: Manual smoke verification
- [ ] Task 11: Final verification
