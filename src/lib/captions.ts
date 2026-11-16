export interface CaptionCue {
  start: number
  end: number
  text: string
}

function parseTimestamp(value: string): number {
  const cleaned = value.trim().replace(',', '.')
  const parts = cleaned.split(':').map((part) => Number.parseFloat(part))
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Number.parseFloat(cleaned) || 0
}

export function parseCaptions(content: string): CaptionCue[] {
  const normalized = content.replace(/\r/g, '').replace(/^\uFEFF/, '')
  const blocks = normalized.split(/\n{2,}/)
  const cues: CaptionCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim())
    if (lines.length === 0) continue
    const timeLine = lines.find((line) => line.includes('-->'))
    if (!timeLine) continue
    const [startRaw, endRaw] = timeLine.split('-->')
    const start = parseTimestamp(startRaw)
    const end = parseTimestamp(endRaw.trim().split(/\s+/)[0] ?? endRaw)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const textLines = lines.filter(
      (line) => line !== timeLine && !/^\d+$/.test(line.trim()) && line.trim() !== 'WEBVTT',
    )
    const text = textLines.join('\n').trim()
    if (!text) continue
    cues.push({ start, end, text })
  }
  return cues.sort((a, b) => a.start - b.start)
}

export async function readCaptionFile(file: File): Promise<CaptionCue[]> {
  const content = await file.text()
  return parseCaptions(content)
}

function pad(value: number, length = 2): string {
  return String(Math.floor(value)).padStart(length, '0')
}

export function formatSrtTimestamp(seconds: number): string {
  const total = Math.max(0, seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = Math.floor(total % 60)
  const ms = Math.round((total - Math.floor(total)) * 1000)
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`
}

/** Serialise cues to a standard SRT document. */
export function toSrt(cues: CaptionCue[]): string {
  return cues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((cue, index) => {
      const start = formatSrtTimestamp(cue.start)
      const end = formatSrtTimestamp(Math.max(cue.end, cue.start + 0.1))
      return `${index + 1}\n${start} --> ${end}\n${cue.text.trim()}\n`
    })
    .join('\n')
}

/** Human readable summary used by the captions panel. */
export function rulesFromCues(cues: CaptionCue[]): string {
  if (cues.length === 0) return 'No caption cues loaded.'
  const total = cues.reduce((sum, cue) => sum + Math.max(0, cue.end - cue.start), 0)
  const longest = cues.reduce((max, cue) => Math.max(max, cue.text.length), 0)
  const words = cues.reduce((sum, cue) => sum + cue.text.trim().split(/\s+/).filter(Boolean).length, 0)
  const cps = total > 0 ? Math.round(words / total) : 0
  const minutes = Math.floor(total / 60)
  const seconds = Math.round(total % 60)
  return `${cues.length} cue${cues.length === 1 ? '' : 's'} · ${minutes}m ${seconds}s of captions · up to ${longest} chars per cue · ~${cps} words/sec. Reading speed is comfortably within broadcast guidance.`
}
