# Kiosk Media Info Layanan RS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a looping video feed of hospital information in the `KioskHome.vue` media panel, sourced from every video in a configured server directory (with a bundled single-video fallback).

**Architecture:** The browser fetches the configured directory's HTML listing (`python -m http.server` and IIS Directory Browsing both emit `<a href="…">` links), parses out video file URLs into a playlist, and advances a `<video>` element through the playlist on each `ended`/`error` event. A configurable `mediaInfoDir` in `global_config.json` points at the folder; when unset/unreachable/empty, the panel falls back to the bundled `adv-video.mp4`.

**Tech Stack:** Vue 3.5 (`<script setup>`, Composition API), TypeScript, Zod (`@aq/app-config`), Vitest + jsdom + @vue/test-utils, DOMParser.

## Global Constraints

- Package manager is pnpm v10. Use `pnpm --filter <name> run <script>` / `pnpm --filter <name> exec <bin>`; never raw `turbo`/`vitest`/`vue-tsc` on Windows.
- `lint` is a noop everywhere — never use it as a gate. The verification gate is `pnpm turbo run typecheck test`.
- Vue 3 Composition API with `<script setup>` and TypeScript. No code comments unless explaining non-obvious intent.
- Format modified files only: `npx prettier --write <file...>` (config: `semi:false`, `singleQuote:true`, `printWidth:100`).
- Shared config schema lives in `packages/app-config/src/index.ts` (`appConfigSchema`, Zod).
- Kiosk app Vite `base` is `/kiosk/`; `configService.initialize(import.meta.env.BASE_URL)` runs in `main.ts` before mount, so `configService.getConfig()` is safe in components at runtime.
- Tests: kiosk-web uses Vitest jsdom, glob `src/**/*.spec.ts`. App-config test script is `vitest run --passWithNoTests`.
- Commit style (from `git log`): `feat(kiosk): <short description>`.

---

### Task 1: Add `mediaInfoDir` to app-config schema

**Files:**
- Modify: `packages/app-config/src/index.ts`
- Test: `packages/app-config/src/index.spec.ts`

**Interfaces:**
- Produces: `AppConfig` gains optional `mediaInfoDir?: string`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/app-config/src/index.spec.ts`:

```ts
  it('accepts mediaInfoDir when provided', () => {
    const parsed = appConfigSchema.parse({
      bilregApiBase: 'http://localhost:5000/api',
      mediaInfoDir: 'media',
    })
    expect(parsed.mediaInfoDir).toBe('media')
  })

  it('leaves mediaInfoDir undefined when omitted', () => {
    const parsed = appConfigSchema.parse({ bilregApiBase: 'http://localhost:5000/api' })
    expect(parsed.mediaInfoDir).toBeUndefined()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aq/app-config run test`
Expected: FAIL — `Property 'mediaInfoDir' does not exist on type '{ bilregApiBase: string; jetliApiBase?: ... }'`.

- [ ] **Step 3: Add the field to the schema**

In `packages/app-config/src/index.ts`, change the schema to:

```ts
export const appConfigSchema = z.object({
  bilregApiBase: z.string().min(1, 'bilregApiBase must not be empty'),
  jetliApiBase: z.string().optional(),
  mediaInfoDir: z.string().optional(),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aq/app-config run test`
Expected: PASS (4 tests).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write packages/app-config/src/index.ts packages/app-config/src/index.spec.ts
git add packages/app-config/src/index.ts packages/app-config/src/index.spec.ts
git commit -m "feat(kiosk): add optional mediaInfoDir to app config"
```

---

### Task 2: Directory listing loader

**Files:**
- Create: `apps/kiosk-web/src/lib/mediaDirectory.ts`
- Test: `apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts`

**Interfaces:**
- Consumes: nothing (standalone).
- Produces:
  - `resolveMediaDirUrl(baseUrl: string, dir: string): string`
  - `extractVideoUrls(html: string, baseUrl: string): string[]`
  - `listMediaFromDirectory(dirUrl: string): Promise<string[]>`

- [ ] **Step 1: Write the failing tests**

Create `apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { extractVideoUrls, listMediaFromDirectory, resolveMediaDirUrl } from '../mediaDirectory'

describe('resolveMediaDirUrl', () => {
  it('joins base and dir with a trailing slash', () => {
    expect(resolveMediaDirUrl('/kiosk/', 'media')).toBe('/kiosk/media/')
    expect(resolveMediaDirUrl('/kiosk', 'media')).toBe('/kiosk/media/')
    expect(resolveMediaDirUrl('/', 'media/')).toBe('/media/')
  })
})

describe('extractVideoUrls', () => {
  const listing = `
    <html><head><title>Directory listing for /kiosk/media/</title></head>
    <body>
      <a href="../">../</a>
      <a href="adv-video.mp4">adv-video.mp4</a>
      <a href="promo%20one.webm">promo one.webm</a>
      <a href="poster.png">poster.png</a>
      <a href="subfolder/">subfolder/</a>
      <a href="adv-video.mp4">adv-video.mp4 (dup)</a>
    </body></html>`

  it('extracts mp4/webm hrefs, skipping ../, subdirectories, and non-video files', () => {
    const urls = extractVideoUrls(listing, '/kiosk/media/')
    expect(urls).toEqual([
      '/kiosk/media/adv-video.mp4',
      '/kiosk/media/promo%20one.webm',
    ])
  })

  it('dedupes identical URLs preserving first occurrence order', () => {
    const urls = extractVideoUrls(listing, '/kiosk/media/')
    expect(urls.filter((u) => u.endsWith('adv-video.mp4'))).toHaveLength(1)
  })

  it('returns an empty array for a listing without videos', () => {
    const urls = extractVideoUrls('<a href="x.txt">x.txt</a>', '/kiosk/media/')
    expect(urls).toEqual([])
  })
})

describe('listMediaFromDirectory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed video URLs on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<a href="a.mp4">a.mp4</a>', { status: 200 })),
    )
    const urls = await listMediaFromDirectory('/kiosk/media/')
    expect(urls).toEqual(['/kiosk/media/a.mp4'])
  })

  it('returns an empty array on a non-OK response (e.g. IIS directory browsing disabled)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Forbidden', { status: 403 })))
    const urls = await listMediaFromDirectory('/kiosk/media/')
    expect(urls).toEqual([])
  })

  it('returns an empty array on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const urls = await listMediaFromDirectory('/kiosk/media/')
    expect(urls).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/mediaDirectory.spec.ts`
Expected: FAIL — cannot find module `../mediaDirectory`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/kiosk-web/src/lib/mediaDirectory.ts`:

```ts
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogv']

export function resolveMediaDirUrl(baseUrl: string, dir: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const clean = dir.replace(/^\/+|\/+$/g, '')
  return `${base}${clean}/`
}

export function extractVideoUrls(html: string, baseUrl: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []
  for (const anchor of doc.querySelectorAll('a[href]')) {
    const href = (anchor.getAttribute('href') ?? '').trim()
    if (!href || href.endsWith('/')) continue
    const lower = href.toLowerCase()
    if (!VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue
    const resolved = new URL(href, baseUrl).toString()
    if (!urls.includes(resolved)) urls.push(resolved)
  }
  return urls
}

export async function listMediaFromDirectory(dirUrl: string): Promise<string[]> {
  let response: Response
  try {
    response = await fetch(dirUrl)
  } catch {
    return []
  }
  if (!response.ok) return []
  const html = await response.text()
  return extractVideoUrls(html, dirUrl)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/lib/__tests__/mediaDirectory.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write apps/kiosk-web/src/lib/mediaDirectory.ts apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts
git add apps/kiosk-web/src/lib/mediaDirectory.ts apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts
git commit -m "feat(kiosk): add media directory listing loader"
```

---

### Task 3: `useKioskMediaInfo` composable

**Files:**
- Create: `apps/kiosk-web/src/composables/useKioskMediaInfo.ts`
- Test: `apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts`

**Interfaces:**
- Consumes:
  - `listMediaFromDirectory(dirUrl: string): Promise<string[]>` from `../lib/mediaDirectory` (Task 2).
- Produces:
  - `useKioskMediaInfo(options: KioskMediaInfoOptions)` returning `{ videoUrls, currentVideoUrl, videoError, pending, onVideoEnded, onVideoError }`
  - `KioskMediaInfoOptions = { directoryUrl: MaybeRefOrGetter<string | null>, fallbackVideoUrl: string, loadList?: (dirUrl: string) => Promise<string[]> }`

- [ ] **Step 1: Write the failing tests**

Create `apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useKioskMediaInfo } from '../useKioskMediaInfo'

describe('useKioskMediaInfo', () => {
  it('uses the playlist from the directory and starts at index 0', async () => {
    const loadList = vi.fn(async () => ['/kiosk/media/a.mp4', '/kiosk/media/b.mp4'])
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList,
    })
    await flushPromises()

    expect(loadList).toHaveBeenCalledWith('/kiosk/media/')
    expect(media.videoUrls.value).toEqual(['/kiosk/media/a.mp4', '/kiosk/media/b.mp4'])
    expect(media.currentVideoUrl.value).toBe('/kiosk/media/a.mp4')
    expect(media.videoError.value).toBe(false)
  })

  it('falls back to the single video when the directory fetch returns empty', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList: async () => [],
    })
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
    expect(media.currentVideoUrl.value).toBe('/kiosk/adv-video.mp4')
  })

  it('falls back to the single video when the directory fetch rejects', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: '/kiosk/media/',
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
  })

  it('uses the single fallback video immediately when directoryUrl is null', async () => {
    const loadList = vi.fn()
    const media = useKioskMediaInfo({
      directoryUrl: null,
      fallbackVideoUrl: '/kiosk/adv-video.mp4',
      loadList,
    })

    expect(media.videoUrls.value).toEqual(['/kiosk/adv-video.mp4'])
    expect(loadList).not.toHaveBeenCalled()
    expect(media.pending.value).toBe(false)
  })

  it('advances through the playlist and wraps from last to first on ended', async () => {
    const media = useKioskMediaInfo({
      directoryUrl: null,
      fallbackVideoUrl: '/x.mp4',
    })
    media.videoUrls.value = ['/a.mp4', '/b.mp4', '/c.mp4']

    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/b.mp4')
    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/c.mp4')
    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/a.mp4')
  })

  it('sets videoError and does not advance when a single video errors', () => {
    const media = useKioskMediaInfo({ directoryUrl: null, fallbackVideoUrl: '/x.mp4' })

    media.onVideoError()
    expect(media.videoError.value).toBe(true)
    expect(media.currentVideoUrl.value).toBe('/x.mp4')
  })

  it('skips to the next video when one of several videos errors', () => {
    const media = useKioskMediaInfo({ directoryUrl: null, fallbackVideoUrl: '/x.mp4' })
    media.videoUrls.value = ['/a.mp4', '/b.mp4']

    media.onVideoError()
    expect(media.videoError.value).toBe(false)
    expect(media.currentVideoUrl.value).toBe('/b.mp4')
  })

  it('resets to index 0 when the playlist is replaced', async () => {
    const directoryUrl = ref('/dir/')
    const playlist = ref(['/a.mp4', '/b.mp4'])
    const loadList = vi.fn(async () => playlist.value)
    const media = useKioskMediaInfo({
      directoryUrl,
      fallbackVideoUrl: '/x.mp4',
      loadList,
    })
    await flushPromises()

    media.onVideoEnded()
    expect(media.currentVideoUrl.value).toBe('/b.mp4')

    playlist.value = ['/c.mp4']
    directoryUrl.value = '/dir-2/'
    await flushPromises()

    expect(media.videoUrls.value).toEqual(['/c.mp4'])
    expect(media.currentVideoUrl.value).toBe('/c.mp4')
  })
})
```

Note on the last test: mutating `media.videoUrls.value` directly in the advance/wrap tests is intentional — the `watch(videoUrls, …)` reset does not fire because the array reference stays the same (we replace it in the final test only, where the new playlist reference triggers the reset watcher).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskMediaInfo.spec.ts`
Expected: FAIL — cannot find module `../useKioskMediaInfo`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/kiosk-web/src/composables/useKioskMediaInfo.ts`:

```ts
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { listMediaFromDirectory } from '../lib/mediaDirectory'

export type LoadMediaListFn = (dirUrl: string) => Promise<string[]>

export interface KioskMediaInfoOptions {
  directoryUrl: MaybeRefOrGetter<string | null>
  fallbackVideoUrl: string
  loadList?: LoadMediaListFn
}

export function useKioskMediaInfo(options: KioskMediaInfoOptions) {
  const loadList = options.loadList ?? listMediaFromDirectory
  const videoUrls = ref<string[]>([])
  const currentIndex = ref(0)
  const videoError = ref(false)
  const pending = ref(true)

  const currentVideoUrl = computed(() => videoUrls.value[currentIndex.value] ?? null)

  async function load() {
    const directoryUrl = toValue(options.directoryUrl)
    pending.value = true
    videoError.value = false
    let urls: string[] = []
    if (directoryUrl) {
      try {
        urls = await loadList(directoryUrl)
      } catch {
        urls = []
      }
    }
    videoUrls.value = urls.length > 0 ? urls : [options.fallbackVideoUrl]
    pending.value = false
  }

  watch(() => toValue(options.directoryUrl), load, { immediate: true })

  watch(videoUrls, () => {
    currentIndex.value = 0
  })

  function onVideoEnded() {
    if (videoUrls.value.length === 0) return
    currentIndex.value = (currentIndex.value + 1) % videoUrls.value.length
  }

  function onVideoError() {
    if (videoUrls.value.length <= 1) {
      videoError.value = true
      return
    }
    currentIndex.value = (currentIndex.value + 1) % videoUrls.value.length
  }

  return {
    videoUrls,
    currentVideoUrl,
    videoError,
    pending,
    onVideoEnded,
    onVideoError,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/composables/__tests__/useKioskMediaInfo.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write apps/kiosk-web/src/composables/useKioskMediaInfo.ts apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts
git add apps/kiosk-web/src/composables/useKioskMediaInfo.ts apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts
git commit -m "feat(kiosk): add media info playlist composable"
```

---

### Task 4: Wire the media panel into `KioskHome.vue`

**Files:**
- Modify: `apps/kiosk-web/src/views/KioskHome.vue`
- Modify: `apps/kiosk-web/src/styles.css`
- Test: `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts`

**Interfaces:**
- Consumes:
  - `useKioskMediaInfo(options)` (Task 3), `resolveMediaDirUrl(baseUrl, dir)` (Task 2).
  - `configService` from `@aq/app-config`.
- Produces: `KioskHome.vue` renders a `<video data-testid="media-video">` with the fallback source when no media directory is configured.

- [ ] **Step 1: Write the failing tests**

Replace the whole contents of `apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts` (the existing tests must also be updated because `KioskHome.vue` now calls `configService.getConfig()` in setup, which throws if uninitialized):

```ts
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import KioskHome from '../KioskHome.vue'

vi.mock('@aq/app-config', () => ({
  configService: {
    getConfig: () => ({ bilregApiBase: 'http://localhost:5000/api' }),
  },
}))

describe('KioskHome', () => {
  it('renders search input with placeholder', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    expect(input.element.placeholder).toContain('Kode booking')
  })

  it('emits startSearch when form is submitted', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('does not emit startSearch with empty input', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await wrapper.get('[data-testid="search-submit"]').trigger('click')
    expect(wrapper.emitted('startSearch')).toBeUndefined()
  })

  it('emits startSearch on enter key', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="search-keyword"]')
    await input.setValue('BK001')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('startSearch')).toEqual([['BK001']])
  })

  it('emits startIntake from ambil antrian admisi button', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await wrapper.get('[data-testid="start-intake"]').trigger('click')
    expect(wrapper.emitted('startIntake')).toHaveLength(1)
  })

  it('renders split layout with ad panel', () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    expect(wrapper.find('[data-testid="kiosk-ad-panel"]').exists()).toBe(true)
  })

  it('renders the fallback video source when no media directory is configured', async () => {
    const wrapper = mount(KioskHome, { props: { intakeAvailable: true, businessDate: null } })
    await nextTick()
    const video = wrapper.get<HTMLVideoElement>('[data-testid="media-video"]')
    expect(video.attributes('src')).toBe('/adv-video.mp4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskHome.spec.ts`
Expected: FAIL — no `[data-testid="media-video"]` element.

- [ ] **Step 3: Implement the script wiring**

In `apps/kiosk-web/src/views/KioskHome.vue`, change the imports to:

```ts
import { onMounted, onUnmounted, ref } from 'vue'
import { configService } from '@aq/app-config'
import KioskHeader from '../components/KioskHeader.vue'
import VirtualKeyboard from '../components/VirtualKeyboard.vue'
import { useKioskMediaInfo } from '../composables/useKioskMediaInfo'
import { resolveMediaDirUrl } from '../lib/mediaDirectory'
```

Add after `const lang = ref<'id' | 'en'>('id')`:

```ts
const mediaInfoDir = configService.getConfig().mediaInfoDir
const directoryUrl = mediaInfoDir?.trim()
  ? resolveMediaDirUrl(import.meta.env.BASE_URL, mediaInfoDir.trim())
  : null
const fallbackVideoUrl = `${import.meta.env.BASE_URL}adv-video.mp4`
const { videoUrls, currentVideoUrl, videoError, onVideoEnded, onVideoError } = useKioskMediaInfo({
  directoryUrl,
  fallbackVideoUrl,
})
```

- [ ] **Step 4: Implement the template**

Replace the entire `<aside class="kiosk-ad" …>` block (currently the `.kiosk-ad-media` div with the SVG placeholder) with:

```html
      <aside class="kiosk-ad" data-testid="kiosk-ad-panel">
        <template v-if="!videoError && currentVideoUrl">
          <video
            :src="currentVideoUrl"
            :loop="videoUrls.length === 1"
            class="kiosk-ad-video"
            autoplay
            muted
            playsinline
            data-testid="media-video"
            @ended="onVideoEnded"
            @error="onVideoError"
          />
          <p class="kiosk-ad-caption">Media &amp; Informasi Layanan RS</p>
        </template>
        <div v-else class="kiosk-ad-media">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          <p>Media &amp; Informasi Layanan RS</p>
        </div>
      </aside>
```

- [ ] **Step 5: Add the styles**

In `apps/kiosk-web/src/styles.css`, after the `.kiosk-ad-media p` rule (around line 461), add:

```css
.kiosk-ad-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.kiosk-ad-caption {
  position: absolute;
  left: 16px;
  bottom: 14px;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #e2e8f0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}
```

(`.kiosk-ad` is already `position: relative; overflow: hidden`, so the absolute caption anchors to the panel.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter kiosk-web exec vitest run src/views/__tests__/KioskHome.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write apps/kiosk-web/src/views/KioskHome.vue apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts apps/kiosk-web/src/styles.css
git add apps/kiosk-web/src/views/KioskHome.vue apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts apps/kiosk-web/src/styles.css
git commit -m "feat(kiosk): play media info video panel on home screen"
```

---

### Task 5: Example media directory + config wiring

**Files:**
- Create: `apps/kiosk-web/public/media/adv-video.mp4` (binary copy of `apps/kiosk-web/public/adv-video.mp4`)
- Modify: `apps/kiosk-web/public/global_config.json`

**Interfaces:**
- Consumes: `mediaInfoDir` config field (Task 1).
- Produces: a deployed `/kiosk/media/` folder that IIS Directory Browsing / `python -m http.server` can list.

- [ ] **Step 1: Copy the example video into the media folder**

Run (PowerShell):

```bash
New-Item -ItemType Directory -Path "apps\kiosk-web\public\media" -Force | Out-Null
Copy-Item -LiteralPath "apps\kiosk-web\public\adv-video.mp4" -Destination "apps\kiosk-web\public\media\adv-video.mp4"
```

Verify: `Get-Item -LiteralPath "apps\kiosk-web\public\media\adv-video.mp4" | Select-Object Name, Length` shows the ~14.5 MB file.

- [ ] **Step 2: Wire the config**

Replace the contents of `apps/kiosk-web/public/global_config.json` with:

```json
{
  "bilregApiBase": "http://dev.smart-ics.com:8888/bilregapi/api",
  "jetliApiBase": "http://dev.smart-ics.com:8089/JetliAPi/api",
  "mediaInfoDir": "media"
}
```

- [ ] **Step 3: Manual smoke check (optional, no backend needed for the media panel path only)**

```bash
pnpm --filter kiosk-web build
# From a folder where the built dist is under a `kiosk/` subfolder:
python -m http.server 8002
# Browse http://localhost:8002/kiosk/media/  ->  directory listing shows adv-video.mp4
```

Note: a full boot of the kiosk page still requires the bilreg API; the smoke check above only verifies the directory listing is served.

- [ ] **Step 4: Commit**

```bash
git add apps/kiosk-web/public/media/adv-video.mp4 apps/kiosk-web/public/global_config.json
git commit -m "feat(kiosk): seed example media directory and wire mediaInfoDir"
```

---

### Task 6: Full verification gate

**Files:**
- None (verification only).

- [ ] **Step 1: Run the canonical gate**

Run: `pnpm turbo run typecheck test`
Expected: PASS across all packages. If any test regressed from the new `configService` mock or schema change, fix and re-run before committing.

- [ ] **Step 2: Format all touched files and commit any stragglers**

```bash
npx prettier --write apps/kiosk-web/src/composables/useKioskMediaInfo.ts apps/kiosk-web/src/lib/mediaDirectory.ts apps/kiosk-web/src/views/KioskHome.vue apps/kiosk-web/src/views/__tests__/KioskHome.spec.ts apps/kiosk-web/src/composables/__tests__/useKioskMediaInfo.spec.ts apps/kiosk-web/src/lib/__tests__/mediaDirectory.spec.ts packages/app-config/src/index.ts packages/app-config/src/index.spec.ts
git add -A
git commit -m "chore(kiosk): final media info polish"   # only if there are uncommitted changes
```

---

## Notes for the implementer

- `python -m http.server` and IIS Directory Browsing both emit `<a href="…">` entries, so `extractVideoUrls` serves both. IIS additionally needs **Directory Browsing** enabled on the `media` folder (web.config rewrite already passes real directories through).
- On IIS, if Directory Browsing is off, the fetch returns 403 → `listMediaFromDirectory` returns `[]` → the panel falls back to the bundled `/kiosk/adv-video.mp4`; the panel never appears broken.
- Video autoplay requires `muted` + `playsinline` (kiosk browsers block audible autoplay).
