/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { app, nativeImage } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'

let resvgInit = false

export function debounce(fn: (...args: unknown[]) => void, milliseconds: number) {
  let timerId: NodeJS.Timeout

  return function (...args: unknown[]) {
    if (timerId) {
      clearTimeout(timerId)
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    timerId = setTimeout(() => fn.apply(this, args), milliseconds)
  }
}

async function ensureResvgWasm() {
  if (!resvgInit) {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')
    const wasmBytes = await readFile(wasmPath)
    const wasmModule = await WebAssembly.compile(wasmBytes)
    await initWasm(wasmModule)
    resvgInit = true
  }
}

export function getUnreadCountFromFavicon(faviconUrl: string) {
  const match = faviconUrl.match(/https:\/\/web\.whatsapp\.com\/favicon\/1x\/f(\d+)\/v4\//)
  return match ? match[1] : null
}

function getFontPath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'fonts', 'Inter-Bold.ttf')
  }
  return join(app.getAppPath(), 'resources', 'fonts', 'Inter-Bold.ttf')
}

async function convertSVGToNativeImage(svg: string) {
  await ensureResvgWasm()
  const fontBuffer = await readFile(getFontPath())

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 32
    },
    font: {
      fontBuffers: [new Uint8Array(fontBuffer)],
      defaultFontFamily: 'Inter'
    }
  })
    .render()
    .asPng()
  return nativeImage.createFromBuffer(Buffer.from(resvg))
}

export async function getTrayFavicon(count: string) {
  let svg: string
  if (count === '00') {
    svg = getTrayIcon('99+')
  } else {
    svg = getTrayIcon(Number(parseInt(count)).toString())
  }
  return await convertSVGToNativeImage(svg)
}

export async function getDefaultTrayIcon() {
  const svg = getTrayIcon()
  return await convertSVGToNativeImage(svg)
}

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function getTrayIcon(count?: string) {
  const safeCount = count ? escapeSvgText(count.slice(0, 2)) : '···'
  const hasCount = safeCount.length > 0
  const isSingleDigit = safeCount.length === 1

  const fontSize = isSingleDigit ? 500 : 370
  const textY = isSingleDigit ? 525 : 480

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="1024"
    height="1024"
    viewBox="175 18 674 674"
    role="img"
    aria-label="${safeCount ? `${safeCount} unread messages` : 'Chat icon'}"
  >
    <defs>
      <radialGradient id="bubbleFill" cx="50%" cy="32%" r="72%">
        <stop offset="100%" stop-color="#2A70E8"/>
      </radialGradient>
    </defs>

    <!-- Tail stays inside the circle's horizontal footprint -->
    <path
      d="
        M 355 548
        L 286 680
        C 281 690 293 698 304 692
        L 451 606
        Z
      "
      fill="url(#bubbleFill)"
      stroke="#0054D8"
      stroke-width="22"
      stroke-linejoin="round"
    />

    <!-- Nearly fills the complete square viewBox -->
    <circle
      cx="512"
      cy="342"
      r="312"
      fill="url(#bubbleFill)"
      stroke="#0054D8"
      stroke-width="22"
    />

    ${
      hasCount
        ? `<text
            x="512"
            y="${textY}"
            fill="#FFFFFF"
            font-family="Inter"
            font-size="${fontSize}"
            font-weight="700"
            text-anchor="middle"
            font-variant-numeric="lining-nums tabular-nums"
          >${safeCount}</text>`
        : ''
    }
  </svg>`
}
