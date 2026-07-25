# Display Missing-Screen Picker — Progress Ledger

Branch: `feat/display-missing-screen-picker`
Plan: `docs/superpowers/plans/2026-07-24-display-missing-screen-picker.md`
Spec: `docs/superpowers/specs/2026-07-24-display-missing-screen-picker-design.md`

Tasks:
- [x] Task 1: Add `listDisplayScreenIds()` to the device-config interface (commit d28448d, review clean — note: implementer added a `return []` stub in `jsonProvider.ts` to keep the package typecheck green; Task 2 will replace it)
- [x] Task 2: Implement `listDisplayScreenIds()` on `JsonDeviceConfigurationProvider` (commit a7915e6, review clean)
- [x] Task 3: Unit tests for `listDisplayScreenIds()` (commit f8bc230, review clean, 12/12 tests pass)
- [x] Task 4: Create the `useDisplayScreenList` composable (commit 8a74319, review clean, 5/5 tests pass with 0 Vue warnings after onScopeDispose guard fix)
- [x] Task 5: Create the `MissingScreenPicker` view (commit 2222baf, review clean — original impl had UTF-8 mojibake on em-dash & ellipsis; fix subagent amended the same commit with correct bytes)
- [x] Task 6: Add `RootView` and update the router (commit 1261a19, review clean)
- [x] Task 7: Remove the inline empty-screenId error from `DisplayPage.vue` (commit d418e62, review clean — implementer reverted pre-existing template tweaks in DisplayPage.vue to keep the commit surgical; 3 unrelated modified files left unstaged)
- [ ] Task 8: Manual smoke verification
- [ ] Task 9: Final verification (full test + typecheck + build)
