const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogv']

export function resolveMediaDirUrl(baseUrl: string, dir: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const clean = dir.replace(/^\/+|\/+$/g, '')
  return `${base}${clean}/`
}

function resolveHref(href: string, baseUrl: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(baseUrl)) {
    return new URL(href, baseUrl).toString()
  }
  // `new URL` throws on an origin-relative base (e.g. `/kiosk/media/`), which is
  // what resolveMediaDirUrl produces; fall back to path joining.
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return href.startsWith('/') ? href : `${base}${href}`
}

export function extractVideoUrls(html: string, baseUrl: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const urls: string[] = []
  for (const anchor of doc.querySelectorAll('a[href]')) {
    const href = (anchor.getAttribute('href') ?? '').trim()
    if (!href || href.endsWith('/')) continue
    const lower = href.toLowerCase()
    if (!VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue
    const resolved = resolveHref(href, baseUrl)
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
