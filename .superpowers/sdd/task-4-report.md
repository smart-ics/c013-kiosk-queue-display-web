# Task 4 Report: Extract shared `createListFetcher` utility

## Status: DONE

## Commits
- `refactor: extract createListFetcher into @aq/device-config, deduplicate list composables`

## Files changed
| Action | File |
|--------|------|
| Create | `packages/device-config/src/deviceList.ts` |
| Edit   | `packages/device-config/src/index.ts` |
| Rewrite | `apps/display-web/src/composables/useDisplayScreenList.ts` |
| Rewrite | `apps/kiosk-web/src/composables/useStationList.ts` |

## Test results
| Package | Tests | Result |
|---------|-------|--------|
| device-config | 17 passed | ✅ |
| display-web | 22 passed (including 5 in useDisplayScreenList.spec.ts) | ✅ |
| kiosk-web | 10 passed | ✅ |
| **Total** | **49 passed** | **✅** |

## Typecheck
- `pnpm typecheck` — passes for all packages except `@aq/signalr-client` (pre-existing TS2722 in `createQueueConnection.spec.ts:92`, unrelated)

## Concerns
None. Tests pass as-is (test already expected `'loading'`, matching the new `DeviceListStatus` union which drops the unreachable `'idle'`).
