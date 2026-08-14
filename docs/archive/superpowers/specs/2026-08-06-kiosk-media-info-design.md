# Kiosk Media Info Layanan RS — Video Directory Auto-Loop

Date: 2026-08-06

## Problem

The `KioskHome.vue` "Media & Informasi Layanan RS" panel (`apps/kiosk-web/src/views/KioskHome.vue:45-62`)
currently shows a static SVG placeholder. We want it to play a looping video feed of hospital
information. The media is deployed as a folder of files on the server (IIS), and the system should
automatically pick up and loop every video inside that folder.

A browser cannot enumerate a server directory by itself. The web server (IIS Directory Browsing,
or `python -m http.server` for local simulation) must expose an HTML directory listing, which the
frontend fetches and parses.

## Scope

- Home screen only (the `kiosk-ad` aside already lives in `KioskHome.vue`).
- Same-origin media directory, configured with a relative path.
- Loop through all videos in the configured directory; fall back to a single bundled video when the
  directory is unreachable or empty.

## Design

### 1. Config — `packages/app-config/src/index.ts`

Add an optional field to the Zod schema:

```ts
export const appConfigSchema = z.object({
  bilregApiBase: z.string().min(1, 'bilregApiBase must not be empty'),
  jetliApiBase: z.string().optional(),
  mediaInfoDir: z.string().optional(),
})
```

`AppConfig` gains `mediaInfoDir?: string`. Example value in
`apps/kiosk-web/public/global_config.json`:

```json
{
  "bilregApiBase": "http://dev.smart-ics.com:8888/bilregapi/api",
  "jetliApiBase": "http://dev.smart-ics.com:8089/JetliAPi/api",
  "mediaInfoDir": "media"
}
```

Unset/empty → fall back to the single bundled video. Validation error message is not required for an
optional field.

### 2. Directory listing loader — new `apps/kiosk-web/src/lib/mediaDirectory.ts`

- `resolveMediaDirUrl(baseUrl: string, dir: string): string` — join cleanly, ensure trailing slash.
  E.g. `('/kiosk/', 'media')` → `'/kiosk/media/'`.
- `extractVideoUrls(html: string, baseUrl: string): string[]` — pure function. Parse with
  `DOMParser`; collect `href` from `<a>` elements that end with a video extension (`.mp4`, `.webm`,
  `.ogv`); skip `../` and any href ending with `/` (subdirectories); resolve relative hrefs to
  absolute with `new URL(href, baseUrl)`; dedupe preserving order.
- `listMediaFromDirectory(dirUrl: string): Promise<string[]>` — `fetch(dirUrl)`; on non-OK response
  or network error return `[]`. Otherwise parse body with `extractVideoUrls`.

Rationale: `python -m http.server` and IIS Directory Browsing both emit `<a href="file.mp4">`
links, so the same parser serves dev simulation and production.

### 3. Composable — new `apps/kiosk-web/src/composables/useKioskMediaInfo.ts`

- Inputs: `{ directoryUrl: string | null, fallbackVideoUrl: string }`.
- State: `videoUrls` (ref), `currentIndex` (ref), `videoError` (ref), `pending` (ref).
- Lifecycle: playlist fetch is kicked off via `watch(directoryUrl, fetch, { immediate: true })` —
  eager on setup, and re-runs automatically if `directoryUrl` ever changes. If `directoryUrl` is
  `null`, skip the fetch and set `videoUrls = [fallbackVideoUrl]` directly.
- `currentVideoUrl` — computed, `videoUrls[currentIndex]`.
- `onVideoEnded()` — advance index, wrap to 0 when past the end.
- `onVideoError()` — advance index with wraparound; if only one video remains, set `videoError`
  (no further auto-advance) so the SVG placeholder can be shown.
- Reset mechanism: `watch(videoUrls, () => { currentIndex.value = 0 })` — whenever the playlist is
  replaced, playback starts from the first video.

Playback is driven by the browser: the `<video>` element does not set `loop` for multi-video
playlists; advancing on the `ended` event provides the loop across the playlist. For a single-video
playlist (including the fallback video), bind `:loop="videoUrls.length === 1"` — otherwise changing
`src` to the same URL would not restart playback.

### 4. `KioskHome.vue` integration

- Read `mediaInfoDir` from `configService.getConfig()` (type `string | undefined`). Map to the
  composable's `directoryUrl: string | null` input, handling the empty case:

  ```ts
  const mediaInfoDir = configService.getConfig().mediaInfoDir
  const directoryUrl = mediaInfoDir?.trim()
    ? resolveMediaDirUrl(import.meta.env.BASE_URL, mediaInfoDir.trim())
    : null
  ```

- `fallbackVideoUrl = import.meta.env.BASE_URL + 'adv-video.mp4'`.
- Call `useKioskMediaInfo({ directoryUrl, fallbackVideoUrl })`.
- Replace the SVG inside `.kiosk-ad-media` (lines 47-59) with a `<video>` element:

  - `:src="currentVideoUrl"`, `autoplay`, `muted`, `playsinline`, `:loop="videoUrls.length === 1"`
    — do **not** set `controls`
    (omitting the attribute disables controls; `controls="false"` is invalid HTML and would enable
    them).
  - `@ended="onVideoEnded"`, `@error="onVideoError"`,
  - CSS: `width: 100%; height: 100%; object-fit: contain; object-position: center;` filling the
    aside. `contain` is used (not `cover`) because the aside is a tall narrow column (~1:2.5); a
    typical 16:9 video under `cover` would crop content such as text, logos, and phone numbers.
    Letterboxing is acceptable and blends into the aside's existing gradient background. Note for
    content producers: media authored at a portrait/tall aspect ratio fills the panel best.
  - A captioned overlay keeps the "Media & Informasi Layanan RS" label.
- When `videoError` is set (or while `pending` with no playlist yet), render the existing SVG
  placeholder so the panel never looks broken.
- Update `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts` to cover the fallback path.

### 5. Deploy / simulation

- Add `apps/kiosk-web/public/media/adv-video.mp4` — a copy of the existing example at
  `apps/kiosk-web/public/adv-video.mp4` (already present in the repo, ~14.5 MB) — so the deployed
  `media/` folder is real and listable.
- IIS: enable **Directory Browsing** on the `media` folder. The existing
  `apps/kiosk-web/web.config` rewrite rule already passes real directories through
  (`IsDirectory` negate).
- Local simulation: `python -m http.server 8002` from a folder whose tree contains `kiosk/media/…`
  (i.e. the built `dist/` under a `kiosk/` folder), then browse `http://localhost:8002/kiosk/…`.

### 6. Tests and verification gate

- `apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts`:
  - `extractVideoUrls` — extracts `.mp4`/`.webm` links, ignores `../` and subdirectories, resolves
    relative hrefs, dedupes.
  - `listMediaFromDirectory` — with `vi.stubGlobal('fetch', …)`: returns parsed URLs on a 200
    response; returns `[]` on a non-OK response (e.g. 403 when IIS Directory Browsing is disabled);
    returns `[]` on a network error (`fetch` rejects).
  - `resolveMediaDirUrl` — leading/trailing slash handling.
- `apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts`:
  - Directory fetch succeeds → playlist used; `currentVideoUrl` starts at index 0.
  - Directory fetch returns `[]` or rejects → `[fallbackVideoUrl]` used.
  - `directoryUrl === null` → `[fallbackVideoUrl]` without any fetch.
  - `onVideoEnded` advances through the playlist and wraps from last → 0.
  - `onVideoError` with a single video → `videoError` set, no index advance.
  - Playlist replacement (`watch` on `videoUrls`) resets `currentIndex` to 0.
- `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts` — fallback path renders the `<video>` with
  the fallback source when no media directory is configured.
- Run `pnpm turbo run typecheck test` before finishing.

## Non-goals

- No backend/API changes (no listing endpoint).
- No HLS/streaming protocol support — file playback only.
- Media panel stays on the home screen only.
