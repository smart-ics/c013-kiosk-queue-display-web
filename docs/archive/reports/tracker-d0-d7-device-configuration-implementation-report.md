# Device Configuration Implementation Report (D0–D7)

**Date:** 24 July 2026  
**Status:** Implemented locally; not pushed; production migrations not applied

## Phases completed

| Phase | Status |
|---|---|
| D0 Contract + Auth | Done |
| D1 DB + Configuration API | Done |
| D2 config-web shell | Done |
| D3 Workstation UI | Done |
| D4 Display + Segmentation UI | Done |
| D5 Officer + server resolver | Done |
| D6 Display API provider | Done |
| D7 Docs / verification / report | Done (local) |

## Assumptions recorded

1. `AdmissionQueueConfiguration` granted via JWT role claims + `AdmissionQueueApi:ConfigurationAllowedRoles` (default `ADM-SPV`).
2. Usman roles are embedded into JWT at `POST /login`.
3. Configuration audit uses `BILRG_AuditLog` with `OriginalDataJson = {"before":...,"after":...}`.
4. Call/Recall/Start response envelope remains the operation DTO (not wrapped) for c012 compatibility; Loket is still server-resolved.
5. Legacy `X-Loket-Key` / body `loketKey` accepted during compatibility window; mismatch → error; usage logged.
6. Display provider defaults to `api`; set `VITE_DEVICE_CONFIG_PROVIDER=json` for emergency/tests.
7. Audit list endpoint currently returns an empty page until a dedicated audit query DAL is added (writes already persist to `BILRG_AuditLog`).

## Files / migrations changed (high level)

### b09-bilreg-api
- Auth: `PermissionRequirement`, `PermissionAuthorizationHandler`, `AdmissionQueueConfigurationPolicies`, JWT role claims
- SQL: `BILRG_AdmWorkstation`, `BILRG_AdmQueueDisplay`, `BILRG_AdmDisplayLoket` + seed example + manifest
- Domain/repos/use cases for device configuration
- Controllers: configuration management + runtime device endpoints + workstation resolver on mutations

### c013-kiosk-queue-display-web
- `@aq/auth` SessionAuthTokenProvider
- `@aq/shared-types` / `@aq/api-client` configuration contracts
- `apps/config-web` at `/queue-config/`
- `@aq/device-config` ApiDeviceConfigurationProvider
- display-web API provider selection, 60s config refresh, preview mode

### c012_myhospital_web
- Workstation localStorage adapter (`WorkstationKey` only)
- Officer setup dialog + Ganti Workstation
- Mutations send `X-Workstation-Key` (legacy loket header only if still in config)

## API contracts added

- `GET/POST/PUT .../configuration/*` (policy-gated)
- `GET .../workstations/available`
- `GET .../workstations/{key}/context`
- `GET .../devices/displays/{displayId}`
- Mutation Loket resolution via `X-Workstation-Key` (+ optional legacy fields)

## Test / build results (local)

- b09: AdmissionQueueConfigurationAuthorizationTest, domain tests, migration manifest — passed; Api build succeeded
- c013 packages/apps: auth/shared-types/api-client/device-config/config-web tests passed; config-web build succeeded; display typecheck passed
- c012: workstation storage + related unit tests and `pnpm tc:app` passed

## Compatibility behavior

- Appsettings Workstations still used as fallback when DB row missing
- Legacy loket header/body validated against server-resolved Loket
- Display JSON provider retained behind explicit env flag
- Legacy field removal deferred until measured zero usage

## Deployment / migration steps (manual)

1. Backup DB; apply new `BILRG_Adm*` scripts via migration manifest order
2. Seed workstations/displays (example seed script; Ops-approved values)
3. Deploy Bilreg API (backward compatible)
4. Deploy `queue-config/` IIS app; configure `VITE_BILREG_API_BASE` (no write JWT)
5. Assign Usman role(s) listed in `ConfigurationAllowedRoles`
6. Deploy c012 Officer build; migrate PCs via setup UI
7. Deploy display-web with `VITE_DEVICE_CONFIG_PROVIDER=api`
8. Observe legacy loket usage logs; later remove legacy fields and production `devices.json` authority

## Remaining external / manual actions

- Apply SQL migrations on target environments
- Configure Usman roles / allowlist for hospital
- IIS packaging for `/queue-config/`
- Staging E2E of Call across two displays
- Implement audit list DAL read (writes already occur)
- Push/PR/production cutover intentionally not performed

## Unmet acceptance criteria (implementable gaps)

- Audit history UI may show empty until audit query DAL is completed (AC19 partial: writes audited, list read incomplete)
- Full cross-repo automated E2E scenario suite not executed against a live SQL + IIS stack in this session
- Legacy contract removal (AC20) intentionally deferred post-cutover measurement
