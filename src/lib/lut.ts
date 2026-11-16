/**
 * 3D LUT support for ClipPro.
 *
 * Built-in looks are generated procedurally so the app ships without binary
 * assets. Users can import standard `.cube` files; those are parsed once and
 * cached in localStorage so a project keeps its look after a reload.
 */

export interface Lut3D {
  id: string
  name: string
  size: number
  /** RGB triples in 0..1, ordered R fastest then G then B. */
  data: Float32Array
  builtin?: boolean
}

export interface LutInfo {
  id: string
  name: string
  size: number
  builtin?: boolean
}

const STORAGE_KEY = 'clippro:luts'
const cache = new Map<string, Lut3D>()

type LutTransform = (r: number, g: number, b: number) => [number, number, number]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function buildLut(id: string, name: string, size: number, transform: LutTransform): Lut3D {
  const data = new Float32Array(size * size * size * 3)
  let offset = 0
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        const r = ri / (size - 1)
        const g = gi / (size - 1)
        const b = bi / (size - 1)
        const out = transform(r, g, b)
        data[offset++] = clamp01(out[0])
        data[offset++] = clamp01(out[1])
        data[offset++] = clamp01(out[2])
      }
    }
  }
  return { id, name, size, data, builtin: true }
}

const BUILTIN_DEFS: Array<{ id: string; name: string; transform: LutTransform }> = [
  {
    id: 'builtin-cinema',
    name: 'Cinema · Teal & Orange',
    transform: (r, g, b) => {
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722
      const shadow = 1 - luma
      return [
        clamp01(r + 0.09 * shadow - 0.02 * luma),
        clamp01(g + 0.03 * shadow),
        clamp01(b + 0.12 * shadow - 0.02 * luma),
      ]
    },
  },
  {
    id: 'builtin-warm-film',
    name: 'Warm Film',
    transform: (r, g, b) => [
      clamp01(r ** 0.94 * 1.04),
      clamp01(g ** 0.98 * 1.01),
      clamp01(b ** 1.05 * 0.96),
    ],
  },
  {
    id: 'builtin-bleach',
    name: 'Bleach Bypass',
    transform: (r, g, b) => {
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722
      const mix = 0.55
      return [
        clamp01(r * (1 - mix) + luma * mix),
        clamp01(g * (1 - mix) + luma * mix),
        clamp01(b * (1 - mix) + luma * mix),
      ]
    },
  },
  {
    id: 'builtin-noir',
    name: 'Noir',
    transform: (r, g, b) => {
      const luma = clamp01((r * 0.2126 + g * 0.7152 + b * 0.0722 - 0.5) * 1.35 + 0.5)
      return [luma, luma, luma]
    },
  },
  {
    id: 'builtin-faded',
    name: 'Faded Print',
    transform: (r, g, b) => [
      clamp01(0.12 + r * 0.78),
      clamp01(0.1 + g * 0.8),
      clamp01(0.14 + b * 0.74),
    ],
  },
  {
    id: 'builtin-neon',
    name: 'Neon Nights',
    transform: (r, g, b) => {
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722
      return [
        clamp01(r * 1.08 + luma * 0.08),
        clamp01(g * 0.92 + luma * 0.05),
        clamp01(b * 1.18),
      ]
    },
  },
]

const builtins: Lut3D[] = BUILTIN_DEFS.map((def) =>
  buildLut(def.id, def.name, 17, def.transform),
)
for (const lut of builtins) cache.set(lut.id, lut)

interface StoredLut {
  id: string
  name: string
  text: string
}

function readStored(): StoredLut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredLut[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStored(items: StoredLut[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage may be full or blocked; the in-memory copy still works.
  }
}

export function parseCube(text: string, id: string, name: string): Lut3D | null {
  const lines = text.split(/\r?\n/)
  let size = 0
  const values: number[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('TITLE')) continue
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = Number(trimmed.split(/\s+/)[1])
      continue
    }
    if (/^[A-Z_]/.test(trimmed)) continue
    const parts = trimmed.split(/\s+/).map(Number)
    if (parts.length >= 3 && parts.every((value) => Number.isFinite(value))) {
      values.push(parts[0], parts[1], parts[2])
    }
  }
  if (size < 2 || values.length < size * size * size * 3) return null
  const data = new Float32Array(values.slice(0, size * size * size * 3))
  return { id, name, size, data }
}

export function listLuts(): LutInfo[] {
  const custom = readStored().map((item) => ({
    id: item.id,
    name: item.name,
    size: parseCube(item.text, item.id, item.name)?.size ?? 0,
  }))
  return [
    ...builtins.map(({ id, name, size }) => ({ id, name, size, builtin: true })),
    ...custom,
  ]
}

export function getLut(id: string | null): Lut3D | null {
  if (!id) return null
  const cached = cache.get(id)
  if (cached) return cached
  const stored = readStored().find((item) => item.id === id)
  if (!stored) return null
  const parsed = parseCube(stored.text, stored.id, stored.name)
  if (parsed) cache.set(id, parsed)
  return parsed
}

export function importLut(fileName: string, text: string): Lut3D | null {
  const id = `lut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const name = fileName.replace(/\.cube$/i, '')
  const parsed = parseCube(text, id, name)
  if (!parsed) return null
  const items = readStored()
  items.push({ id, name, text })
  writeStored(items.slice(-12))
  cache.set(id, parsed)
  return parsed
}

export function removeLut(id: string): void {
  cache.delete(id)
  writeStored(readStored().filter((item) => item.id !== id))
}

function sampleChannel(lut: Lut3D, r: number, g: number, b: number, channel: number): number {
  const size = lut.size
  const max = size - 1
  const fr = clamp01(r) * max
  const fg = clamp01(g) * max
  const fb = clamp01(b) * max
  const r0 = Math.floor(fr)
  const g0 = Math.floor(fg)
  const b0 = Math.floor(fb)
  const r1 = Math.min(max, r0 + 1)
  const g1 = Math.min(max, g0 + 1)
  const b1 = Math.min(max, b0 + 1)
  const tr = fr - r0
  const tg = fg - g0
  const tb = fb - b0

  const at = (ri: number, gi: number, bi: number) =>
    lut.data[((bi * size + gi) * size + ri) * 3 + channel]

  const c00 = at(r0, g0, b0) * (1 - tr) + at(r1, g0, b0) * tr
  const c10 = at(r0, g1, b0) * (1 - tr) + at(r1, g1, b0) * tr
  const c01 = at(r0, g0, b1) * (1 - tr) + at(r1, g0, b1) * tr
  const c11 = at(r0, g1, b1) * (1 - tr) + at(r1, g1, b1) * tr
  const c0 = c00 * (1 - tg) + c10 * tg
  const c1 = c01 * (1 - tg) + c11 * tg
  return c0 * (1 - tb) + c1 * tb
}

/**
 * Applies a LUT to the pixels of a canvas context. Only call this on an
 * offscreen canvas — reading the main preview canvas is slow.
 */
export function applyLutToContext(
  ctx: CanvasRenderingContext2D,
  lut: Lut3D,
  intensity: number,
): void {
  const amount = Math.min(1, Math.max(0, intensity / 100))
  if (amount <= 0.001) return
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  if (width === 0 || height === 0) return
  let image: ImageData
  try {
    image = ctx.getImageData(0, 0, width, height)
  } catch {
    return
  }
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const nr = sampleChannel(lut, r, g, b, 0)
    const ng = sampleChannel(lut, r, g, b, 1)
    const nb = sampleChannel(lut, r, g, b, 2)
    data[i] = Math.round((r * (1 - amount) + nr * amount) * 255)
    data[i + 1] = Math.round((g * (1 - amount) + ng * amount) * 255)
    data[i + 2] = Math.round((b * (1 - amount) + nb * amount) * 255)
  }
  ctx.putImageData(image, 0, 0)
}

export function hasLut(id: string | null): boolean {
  return Boolean(getLut(id))
}
