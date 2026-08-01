/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { nativeImage } from 'electron'
import { readFile } from 'fs/promises'

let resvgInit = false

export function debounce(fn: (...args: any[]) => void, milliseconds: number) {
  let timerId: NodeJS.Timeout

  return function (...args: any[]) {
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

async function convertSVGToNativeImage(svg: string) {
  await ensureResvgWasm()
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 32
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
    svg = getTrayIcon(parseInt(count).toString())
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
  const safeCount = count ? escapeSvgText(count) : ''
  const fontSize = !count
    ? 0
    : count.length <= 1
      ? 200
      : count.length === 2
        ? 175
        : count.length === 3
          ? 145
          : 120

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="1024"
    height="1024"
    viewBox="215 215 595 505"
    role="img"
    aria-label="${safeCount ? `${safeCount} unread messages` : 'Chat icon'}"
  >
    <defs>
      <radialGradient id="bubbleFill" cx="50%" cy="32%" r="72%">
        <stop offset="0%" stop-color="#4A94FF"/>
        <stop offset="58%" stop-color="#347FF2"/>
        <stop offset="100%" stop-color="#2A70E8"/>
      </radialGradient>
    </defs>

    <path
      d="
        M 512 226
        C 347 226 226 305 226 446
        C 226 522 260 574 309 610
        L 278 692
        C 273 705 286 717 299 711
        L 410 653
        C 445 669 479 678 519 678
        C 681 678 798 590 798 447
        C 798 305 677 226 512 226
        Z"
      fill="url(#bubbleFill)"
      stroke="#0054D8"
      stroke-width="22"
      stroke-linejoin="round"
    />

    ${
      count
        ? `<text
            x="512"
            y="458"
            fill="#FFFFFF"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="700"
            text-anchor="middle"
            dominant-baseline="middle"
          >${safeCount}</text>`
        : ''
    }
  </svg>`
}
