import { useMemo } from 'react'

/**
 * Renders a compact, symmetrical waveform from normalised peaks. A slice of
 * the source waveform can be selected so trimmed clips keep the right section.
 */
export function Waveform({
  peaks,
  from = 0,
  to = 1,
  className = 'clip-waveform',
  buckets = 64,
}: {
  peaks: number[] | undefined
  from?: number
  to?: number
  className?: string
  buckets?: number
}) {
  const path = useMemo(() => {
    if (!peaks || peaks.length === 0) return ''
    const start = Math.max(0, Math.min(0.999, from))
    const end = Math.max(start + 0.001, Math.min(1, to))
    const count = Math.max(8, buckets)
    const points: Array<{ x: number; amp: number }> = []
    for (let i = 0; i < count; i++) {
      const pos = start + ((i + 0.5) / count) * (end - start)
      const index = Math.min(peaks.length - 1, Math.floor(pos * peaks.length))
      const next = Math.min(peaks.length - 1, index + 1)
      const blend = pos * peaks.length - Math.floor(pos * peaks.length)
      const value = peaks[index] * (1 - blend) + peaks[next] * blend
      points.push({ x: (i + 0.5) / count, amp: Math.max(0.035, value) })
    }
    let top = ''
    for (const point of points) {
      top += `${top ? 'L' : 'M'}${(point.x * 100).toFixed(2)} ${(15 - point.amp * 14).toFixed(2)}`
    }
    let bottom = ''
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]
      bottom += `L${(point.x * 100).toFixed(2)} ${(15 + point.amp * 14).toFixed(2)}`
    }
    return `${top}${bottom.replace(/^L/, 'L')}Z`
  }, [peaks, from, to, buckets])

  if (!path) return null

  return (
    <svg
      className={className}
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}
