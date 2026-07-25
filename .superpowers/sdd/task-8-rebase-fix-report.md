# Task 8 — Rebase fix: add `listDisplayScreenIds` stub to `ApiDeviceConfigurationProvider`

## What changed

`packages/device-config/src/apiProvider.ts` — added the `listDisplayScreenIds()` stub method to `ApiDeviceConfigurationProvider`. The Bilreg API does not yet expose a list endpoint, so the stub returns `[]` (matching the spec's documented fallback for providers that cannot enumerate, mirroring what `JsonDeviceConfigurationProvider` does in this codebase).

### Before (class body)

```ts
export class ApiDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  constructor(private readonly options: ApiDeviceConfigurationProviderOptions) {}

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    // ... existing body unchanged ...
  }
}
```

### After (class body)

```ts
export class ApiDeviceConfigurationProvider implements IDeviceConfigurationProvider {
  constructor(private readonly options: ApiDeviceConfigurationProviderOptions) {}

  async getConfig(deviceId: string): Promise<DeviceConfig> {
    // ... existing body unchanged ...
  }

  async listDisplayScreenIds(): Promise<string[]> {
    return []
  }
}
```

The stub is placed at the bottom of the class (per the brief's recommendation) so the eventual real implementation, which will call into the future list endpoint, lives alongside `getConfig` where the rest of the API-mode logic already lives.

No other code was touched. No comments added. No unrelated changes.

## Verification

### `pnpm --filter display-web typecheck`

Exit 0, no output.

```
> display-web@0.1.0 typecheck E:\PROJECT\ICS\FE\c013-kiosk-queue-display-web\apps\display-web
> vue-tsc -p tsconfig.app.json --noEmit
```

### `pnpm --filter @aq/device-config typecheck`

Exit 0, no output.

```
> @aq/device-config@0.0.0 typecheck E:\PROJECT\ICS\FE\c013-kiosk-queue-display-web\packages/device-config
> tsc -p tsconfig.json --noEmit
```

### `pnpm --filter display-web test`

6 test files, 22 tests, all passing (matches pre-existing baseline of 22/22):

```
✓ src/lib/__tests__/boot.spec.ts                                  (3 tests)
✓ src/lib/__tests__/announcementGate.spec.ts                      (5 tests)
✓ src/lib/__tests__/snapshot.spec.ts                              (4 tests)
✓ src/composables/__tests__/useVersionAutoRefresh.spec.ts         (2 tests)
✓ src/__tests__/infrastructure.spec.ts                            (3 tests)
✓ src/composables/__tests__/useDisplayScreenList.spec.ts           (5 tests)

Test Files  6 passed (6)
     Tests  22 passed (22)
```

`useDisplayScreenList.spec.ts` (the consumer that calls `listDisplayScreenIds` via the boot path) passed cleanly with the stub in place.

## Commit

- SHA: `5f8e878787e6da622f5fee0f2104e7accb5cc68f`
- Subject: `fix(device-config): add listDisplayScreenIds stub to api provider`
- One file changed, 4 insertions, 0 deletions.

## Self-review

- File shape matched the brief exactly: `ApiDeviceConfigurationProvider` had only `getConfig` after the constructor, with no `listDisplayScreenIds` — straightforward insertion.
- Stub placement at the bottom of the class keeps the diff minimal (single method addition) and matches the eventual position for a real implementation.
- No comments added (per repo convention: "Don't add comments unless explaining non-obvious intent").
- No unrelated changes; the diff is exactly 4 lines.
- All 3 verification commands produced clean output.
- Pre-existing test count (22) preserved; no test was modified or skipped.

## Concerns

None. The fix is minimal, fully verified, and the user-visible behavior ("no display screens configured" in the picker when the API provider is active) matches the spec's documented fallback for un-enumerable providers.
