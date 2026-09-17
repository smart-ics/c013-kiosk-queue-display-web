# Kiosk Patient Label and Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring patient-label printing to the kiosk feature branch, display the kiosk package version on the home page, release the kiosk patch version, and merge the completed branch into `main`.

**Architecture:** Patient-label functionality is brought from commit `2194ca1` onto `feat/kiosk-template-registration-receipt`. The home page imports the static package version from `apps/kiosk-web/package.json` and renders it in the existing footer. Release metadata is updated in the kiosk package and root changelog, then the branch is verified and merged into `main`.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, pnpm, Git.

## Global Constraints

- Use pnpm commands only for package scripts.
- Keep `PRINT_STYLE_PROPS` and `includeStyleProperties` in the HTML-to-image pipeline.
- Do not modify or delete unrelated untracked design/documentation files.
- Verify `pnpm --filter kiosk-web run build` before merging.
- Preserve the existing `/kiosk/` base path.

---

### Task 1: Bring patient-label feature to kiosk branch

**Files:**
- Source: commit `2194ca1` on the current repository

- [ ] Verify the target branch lacks `label_pasien.html` and patient-label source files.
- [ ] Cherry-pick commit `2194ca1` onto `feat/kiosk-template-registration-receipt`.
- [ ] Resolve conflicts by preserving the target branch's existing registration receipt behavior and the patient-label implementation.
- [ ] Verify `apps/kiosk-web/public/templates/label_pasien.html` exists.

### Task 2: Display package version on kiosk home

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskHome.vue`
- Test: `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`

- [ ] Add a test asserting the home page renders the kiosk package version.
- [ ] Run the focused test and confirm it fails because the version is not rendered.
- [ ] Import the `version` field from `../../package.json` and render `Versi kiosk v{{ version }}` in the existing footer.
- [ ] Run the focused test and confirm it passes.

### Task 3: Patch version and changelog

**Files:**
- Modify: `apps/kiosk-web/package.json`
- Modify: `CHANGELOG.md`

- [ ] Change the kiosk package version from `0.2.6` to `0.2.7`.
- [ ] Add a `0.2.7` changelog entry dated `2026-09-07` covering patient-label printing, version display, and the TeamCity build fix.

### Task 4: Verify kiosk branch

- [ ] Run `pnpm --filter kiosk-web test`.
- [ ] Run `pnpm --filter kiosk-web run build`.
- [ ] Verify `apps/kiosk-web/dist/templates/label_pasien.html` exists.
- [ ] Verify the built application contains the package version text.
- [ ] Review `git status` and `git diff` for unintended changes.

### Task 5: Merge completed branch into main

- [ ] Confirm the kiosk branch has no uncommitted tracked changes and all required checks pass.
- [ ] Switch to `main` and fast-forward or merge `feat/kiosk-template-registration-receipt` according to the existing history.
- [ ] Run the relevant kiosk build on `main` after the merge.
- [ ] Report the resulting merge commit and verification output.
