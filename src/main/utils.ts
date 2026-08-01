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
    svg = getFaviconSvg('99+')
  } else {
    svg = getFaviconSvg(parseInt(count).toString())
  }
  return await convertSVGToNativeImage(svg)
}

export async function getDefaultTrayIcon() {
  const svg = getDefaultTraySvg()
  return await convertSVGToNativeImage(svg)
}

export function getFaviconSvg(count: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <path
    fill="#25D366"
    d="
      M60 8
      H145
      C172 8 192 28 192 55
      V108
      C192 134 174 152 148 154
      H92
      L26 188
      L48 150
      C24 143 8 126 8 102
      V58
      C8 28 30 8 60 8
      Z
    "
  />

  <text
    x="106"
    y="87"
    text-anchor="middle"
    dominant-baseline="middle"
    fill="black"
    font-size="118"
    font-family="Arial, sans-serif"
    font-weight="bold"
  >
    ${count}
  </text>
</svg>`.trim()
}

export function getDefaultTraySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <path
    fill="#25D366"
    d="
      M60 8
      H145
      C172 8 192 28 192 55
      V108
      C192 134 174 152 148 154
      H92
      L26 188
      L48 150
      C24 143 8 126 8 102
      V58
      C8 28 30 8 60 8
      Z
    "
  />

  <circle cx="72" cy="88" r="10" fill="black" />
  <circle cx="104" cy="88" r="10" fill="black" />
  <circle cx="136" cy="88" r="10" fill="black" />
</svg>`
}
