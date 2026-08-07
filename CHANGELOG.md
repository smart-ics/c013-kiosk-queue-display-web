# Changelog

## [0.2.0] - 2026-08-07

### Added

- **Kiosk self-registration**: Added booking check-in, go-show walk-in, and booking-assistance fallback flows.
- **BPJS biometric verification**: Conditional BPJS biometric check during registration flows.
- **Self-print composable**: Support for printing registration receipts and queue tickets via local print proxy.
- **HIS/JETLI API clients**: Implemented `createHisApi` and `createJetliApi` in `@aq/api-client`.
- **Jetli config**: Added `jetliApiBase` in `@aq/app-config`.

## [0.1.0] - 2026-07-30

### Added

- **Configuration app**: Manage workstations, queue displays, and kiosks in a single dashboard
- **API URL**: API address can now be changed on the server without rebuilding the app
- **Login page**: Operators can log in from the display screen
- **Display screen picker**: When no screen is assigned, display shows a screen list to pick from
- **Display auto-login**: Display screens log in automatically using device credentials

### Changed

- **Kiosk config**: Kiosk setup moved from config files to the database (managed via configuration app)

### Fixed

- **Session persistence**: Login session survives page refresh within the same browser tab
- **Inactive devices**: Inactive displays and kiosks no longer appear in boot config
- **Login URL**: Corrected login endpoint configuration
- **Env security**: Removed hardcoded tokens from environment files
