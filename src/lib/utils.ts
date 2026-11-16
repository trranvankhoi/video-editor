export function uid(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefix}_${random}`
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const round = (value: number, precision = 3) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function formatTime(seconds: number, withFrames = false, fps = 30): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const base = `${h > 0 ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (!withFrames) return base
  const frames = Math.floor((seconds - total) * fps)
  return `${base}:${String(frames).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  return formatTime(seconds)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\-. ]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'clippro-export'
  )
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeOutQuint = (t: number) => 1 - (1 - t) ** 5
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

export async function fileToBlob(file: File): Promise<Blob> {
  return file.slice(0, file.size, file.type)
}

export function cloneDeep<T>(value: T): T {
  return structuredClone(value)
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((c) => Number.isNaN(c))) return `rgba(0,0,0,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}

export function pointerToProject(
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  projectWidth: number,
  projectHeight: number,
) {
  return {
    x: ((event.clientX - rect.left) / rect.width) * projectWidth,
    y: ((event.clientY - rect.top) / rect.height) * projectHeight,
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

export function formatNumber(value: number, digits = 0): string {
  return value.toFixed(digits)
}
