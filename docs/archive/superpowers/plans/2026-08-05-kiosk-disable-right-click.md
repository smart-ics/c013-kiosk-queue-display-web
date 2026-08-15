# Kiosk — Disable Browser Right-Click

**Goal:** Prevent browser context menu (right-click) on kiosk-web and display-web to avoid users interacting with browser UI on kiosk terminals.

**Scope:** `apps/kiosk-web`, `apps/display-web`

## Tasks

- [ ] Add `contextmenu` event listener that calls `preventDefault()` in kiosk-web root (e.g. `App.vue` or `main.ts`)
- [ ] Add `contextmenu` event listener that calls `preventDefault()` in display-web root
- [ ] Verify via manual testing on a touch-screen kiosk (long-press also triggers context menu)
