import { afterEach, describe, expect, it, vi } from 'vitest'
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
