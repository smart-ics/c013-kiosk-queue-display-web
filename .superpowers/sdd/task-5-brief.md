### Task 5: Remaining trivial fixes

**Files:**
- Modify: `apps/display-web/src/views/MissingScreenPicker.vue:15` — remove `??`
- Modify: `apps/kiosk-web/src/views/MissingStationPicker.vue:15` — remove `??`
- Modify: `packages/device-config/src/apiProvider.ts:56-70` — throw instead of silent `[]`

- [ ] **Step 1: Remove redundant `??` in MissingScreenPicker**

Change `:message="error ?? 'Gagal memuat daftar screen.'"` to `:message="error"`

- [ ] **Step 2: Remove redundant `??` in MissingStationPicker**

Change `:message="error ?? 'Gagal memuat daftar station.'"` to `:message="error"`

- [ ] **Step 3: `ApiDeviceConfigurationProvider` — throw when option not configured**

In `listDisplayScreenIds()`:
```ts
async listDisplayScreenIds(): Promise<string[]> {
  if (!this.options.listDisplays) {
    throw new DeviceConfigInvalidError(
      '*',
      'listDisplayScreenIds requires listDisplays option to be configured',
    )
  }
  const displays = await this.options.listDisplays()
  return displays.map((d) => d.deviceId)
}
```

In `listKioskStationIds()`:
```ts
async listKioskStationIds(): Promise<string[]> {
  if (!this.options.listKiosks) {
    throw new DeviceConfigInvalidError(
      '*',
      'listKioskStationIds requires listKiosks option to be configured',
    )
  }
  const kiosks = await this.options.listKiosks()
  return kiosks.map((k) => k.deviceId)
}
```

- [ ] **Step 4: Run typecheck + tests**

`pnpm typecheck && pnpm test`

- [ ] **Step 5: Commit**
