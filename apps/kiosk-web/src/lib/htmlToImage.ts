import { toBlob, getFontEmbedCSS } from 'html-to-image'

type ToBlobOptions = NonNullable<Parameters<typeof toBlob>[1]>

const DEFAULT_OPTIONS = {
  pixelRatio: 2,
  backgroundColor: '#ffffff',
  cacheBust: false,
} as const

const PRINT_STYLE_PROPS = [
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'box-sizing',
  'width',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'height',
  'line-height',
  'font-size',
  'font-weight',
  'font-family',
  'text-transform',
  'text-align',
  'color',
  'border-bottom',
  'display',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'flex-shrink',
  'flex',
  'object-fit',
  'white-space',
  'overflow',
  'position',
  'top',
  'left',
  'visibility',
  'print-color-adjust',
  '-webkit-print-color-adjust',
  'border',
] as const

export const PRINT_CAPTURE_OPTIONS: ToBlobOptions = {
  skipAutoScale: true,
  includeStyleProperties: [...PRINT_STYLE_PROPS],
}

let fontEmbedCSS: string | null = null

export async function warmupFonts(el: HTMLElement): Promise<void> {
  if (typeof document !== 'undefined') {
    await document.fonts.ready
    fontEmbedCSS = await getFontEmbedCSS(el)
  }
}

function buildOptions(override: ToBlobOptions = {}): ToBlobOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    ...override,
  }
}

export async function captureToBlob(
  el: HTMLElement,
  options: ToBlobOptions = {},
): Promise<Blob> {
  const blob = await toBlob(el, buildOptions(options))
  if (!blob) throw new Error('html-to-image: failed to generate blob')
  return blob
}
