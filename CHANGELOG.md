# Changelog

## [0.2.4] - 2026-08-21

### Added

- **BPJS Multi-Reference Selection (kiosk-web)**: Introduces a step in the BPJS registration flow (`BpjsSelectReferenceStep`) when a patient has multiple active BPJS references (Rujukan or SKDP control letters), allowing them to select the correct reference for registration.
- **Deep Patient Search API (api-client)**: Implements a new `deepSearchPasien` API endpoint to query patient demographic details.

### Changed

- **Optimized Video Asset (kiosk-web)**: Replaced `adv-video.mp4` with a highly compressed and optimized version (reduced from 14.5MB to 2.5MB) to save bandwidth and load faster.

## [0.2.3] - 2026-08-19

### Added

- **BPJS/JKN Walk-in Guarantee step (kiosk-web)**: Introduces a dynamic 5-step stepper wizard (Identifikasi, Jaminan, Layanan, Konfirmasi, Selesai) with card-based touchscreen-optimized selections. Allows patients to choose registered BPJS policies or general payment ("Umum"), and handles redirection for unregistered BPJS cases.
- **Autoplay Audio Unblocker (display-web)**: Interactive banner overlays automatically if the browser blocks audio autoplay, letting users restore voice calling with a single click.
- **Audio Letter Assets (display-web)**: Fully staged and added WAV files for letters A through Z to pronounce queue prefixes.
- **HTML5 Video Player (display-web)**: Replaces simulated controls with a real auto-looping, muted HTML5 video player for medical/educational files.
- **Footer Info Carousel (display-web)**: Added a vertical sliding info carousel at the bottom of the screen to cycle through hospital services loaded dynamically from config.

### Changed

- **Announcement Voice System (display-web)**: Replaced SpeechSynthesis (text-to-speech) with sequential playing of recorded `.wav`/`.m4a` files for custom voice building (chime -> letter -> decomposed digits -> loket numbers).
- **Legibility Updates (display-web)**: Reduced queue number font weights from 900 to 700, and changed formatting to use tabular-nums with increased character spacing.
- **Branding Alignment**: Aligned kiosk and display identity configurations in `global_config.json` and Zod schemas to use standard properties (`name`, `taglineId`, `taglineEn`, `timeZoneLabel`).
- **Success Screen Auto-Home (kiosk-web)**: Removed auto-home timers from the success and assistance screens, allowing users to exit manually at their own pace.

## [0.2.2] - 2026-08-15

### Fixed

- **HIS API schema gaps**: `listPoli`, `listDokter`, `listJadwal`, and `listKarcis` now match the real HIS endpoint shapes (`/Layanan/2/list`, `/JadwalPraktek/layanan/{layananId}`, `/PraktekDokter/dokter`, `/Karcis/{layananId}/list`) and map `ppaId`/`ppaName`, `karcisId`/`karcisName` correctly — fixing validation failures on confirm.
- **BPJS eligibility flow**: Registration now resolves the active rujukan/SKDP before registering, creates/uploads the SEP, and sets data eligibility (`setDataEligibility`) for BPJS patients. Children under 17 bypass biometric verification.

### Added

- **Dynamic Praktek Hari Ini badge**: Doctor listing shows whether the doctor practices today, computed from the schedule API data.
- **Confirmation page details**: No. Rekam Medis row and Jam Praktik time range on the walk-in confirm page.
- **In-place pending state**: Confirm button shows "Mendaftarkan…" while the request is in flight.
- **Patient match grid**: Patient matches render as a 2×2 card grid with gender-coded icons, 4 items per page with pagination.
- **Kiosk branding**: Header uses `logo.jpg`; hospital name is read from `global_config.json` branding.
- **Karcis configuration**: `kioskDefaultKarcisId` and per-layanan/per-jaminan karcis mappings in `global_config.json`.

### Changed

- **Walk-in flow**: Poli/dokter/jadwal selection now paginated with a 2×2 layout and numpad-based manual input on the search step.
- **Idle reset**: Kiosk returns to home after 60s idle (was 30s); registration success screen stays until the patient finishes instead of auto-navigating after 10s.
- **Theme**: Kiosk applies the `theme` value from `global_config.json` (e.g. `clinical-blue`).

## [0.2.1] - 2026-08-13

### Added

- **Display screen redesign**: Queue display now uses a light wellness theme with a latest-call hero card, active-loket grid, live clock/date (from HIS business date), wellness tips slideshow, and statistics.
- **Configurable branding**: Hospital name, tagline, and timezone label can be set per app via `global_config.json` (with sensible defaults) for both kiosk and display.
- **Queue display shortcut script**: New helper script to auto-generate a fullscreen shortcut for the queue display on the Windows Desktop.

### Changed

- **Service point order**: Kiosk service-point listing now follows the order set in the kiosk device configuration instead of the API order.
- **Jetli API config**: Kiosk now requires `jetliApiBase` to be set; it no longer silently falls back to the Bilreg API address.

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
