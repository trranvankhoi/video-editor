import { findClip, nextClip, sortClips, sourceTimeAt } from './project'
import type { Asset, Project, TransitionType } from './types'
import { clamp } from './utils'

/**
 * Content-aware cut analysis.
 *
 * For every hard cut we sample the last frame of the outgoing shot and the
 * first frame of the incoming shot, then estimate brightness/colour contrast
 * and dominant motion direction. The heuristics pick a transition that follows
 * the energy of the footage instead of applying one look everywhere.
 */

export interface TransitionSuggestion {
  type: TransitionType
  duration: number
  confidence: number
  reason: string
}

interface FrameSample {
  width: number
  height: number
  pixels: Uint8ClampedArray
  luma: Float32Array
  r: number
  g: number
  b: number
  brightness: number
}

const SAMPLE_WIDTH = 48
const SAMPLE_HEIGHT = 27

export async function suggestTransition(
  project: Project,
  assets: Record<string, Asset>,
  outgoingClipId: string,
): Promise<TransitionSuggestion | null> {
  const found = findClip(project, outgoingClipId)
  if (!found) return null
  const outgoing = found.clip
  const incoming = nextClip(found.track, outgoing)
  if (!incoming) return null
  const gap = incoming.start - (outgoing.start + outgoing.duration)
  if (Math.abs(gap) > 0.2) return null

  const outgoingAsset = 'assetId' in outgoing ? assets[outgoing.assetId] : undefined
  const incomingAsset = 'assetId' in incoming ? assets[incoming.assetId] : undefined
  if (!outgoingAsset || !incomingAsset) return null

  const outTime = sourceTimeAt(outgoing, outgoing.start + outgoing.duration - 0.06)
  const inTime = sourceTimeAt(incoming, incoming.start + 0.02)
  const [outFrame, inFrame] = await Promise.all([
    sampleAssetFrame(outgoingAsset, outTime),
    sampleAssetFrame(incomingAsset, inTime),
  ])
  if (!outFrame || !inFrame) {
    return {
      type: 'fade',
      duration: 0.5,
      confidence: 0.25,
      reason: 'Frames could not be decoded, so a safe cross fade is used.',
    }
  }

  const contrast = frameContrast(outFrame, inFrame)
  const brightnessDelta = inFrame.brightness - outFrame.brightness
  const motion = estimateMotion(outFrame, inFrame)
  const colorShift =
    (Math.abs(inFrame.r - outFrame.r) +
      Math.abs(inFrame.g - outFrame.g) +
      Math.abs(inFrame.b - outFrame.b)) /
    3

  // Fast movement: carry the momentum through a whip or slide.
  if (motion.amount > 12 && motion.confidence > 0.35) {
    const direction = motion.axis === 'x' ? (motion.dx >= 0 ? 'right' : 'left') : motion.dy >= 0 ? 'down' : 'up'
    if (motion.amount > 24) {
      return {
        type: `whip-${direction}` as TransitionType,
        duration: 0.35,
        confidence: clamp(0.55 + motion.confidence * 0.4, 0, 1),
        reason: `Strong ${direction}ward motion at the cut — matching whip pan.`,
      }
    }
    return {
      type: `slide-${direction}` as TransitionType,
      duration: 0.5,
      confidence: clamp(0.45 + motion.confidence * 0.4, 0, 1),
      reason: `Moderate ${direction}ward motion — directional slide keeps continuity.`,
    }
  }

  // Big exposure change: dip through black or white.
  if (Math.abs(brightnessDelta) > 52) {
    const type: TransitionType = brightnessDelta < 0 ? 'fade-black' : 'fade-white'
    return {
      type,
      duration: 0.65,
      confidence: clamp(Math.abs(brightnessDelta) / 140, 0.35, 0.9),
      reason:
        brightnessDelta < 0
          ? 'The next shot is much darker — dip to black hides the jump.'
          : 'The next shot is much brighter — dip to white softens the jump.',
    }
  }

  // Strong colour/scene change: optical dissolve.
  if (contrast > 32 || colorShift > 38) {
    return {
      type: 'dissolve',
      duration: 0.7,
      confidence: clamp((contrast + colorShift) / 150, 0.35, 0.9),
      reason: 'Large visual change between shots — a dissolve bridges the scenes.',
    }
  }

  // Quiet cuts: soft cross fade.
  return {
    type: 'fade',
    duration: 0.5,
    confidence: clamp(0.55 - contrast / 120, 0.2, 0.6),
    reason: 'Similar framing and exposure — a gentle cross fade feels natural.',
  }
}

export async function analyzeCuts(
  project: Project,
  assets: Record<string, Asset>,
  options: { includeExisting?: boolean; visualOnly?: boolean } = {},
): Promise<Array<{ clipId: string; suggestion: TransitionSuggestion }>> {
  const results: Array<{ clipId: string; suggestion: TransitionSuggestion }> = []
  for (const track of project.tracks) {
    if (options.visualOnly !== false && (track.kind === 'audio' || track.kind === 'text' || track.kind === 'sticker')) {
      continue
    }
    sortClips(track)
    for (let index = 0; index < track.clips.length - 1; index++) {
      const clip = track.clips[index]
      const next = track.clips[index + 1]
      if (!options.includeExisting && next.transitionIn) continue
      if (Math.abs(next.start - (clip.start + clip.duration)) > 0.2) continue
      const suggestion = await suggestTransition(project, assets, clip.id)
      if (suggestion) results.push({ clipId: next.id, suggestion })
    }
  }
  return results
}

/* -------------------------------------------------------------------------- */
/* Frame sampling                                                              */
/* -------------------------------------------------------------------------- */

async function sampleAssetFrame(asset: Asset, time: number): Promise<FrameSample | null> {
  if (asset.type === 'image') {
    const source = asset.thumbnail || asset.url
    return sampleImage(source)
  }
  if (asset.type !== 'video') return null
  return sampleVideo(asset, time)
}

function makeCanvas(): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} | null {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_WIDTH
  canvas.height = SAMPLE_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  return { canvas, ctx }
}

async function sampleImage(src: string): Promise<FrameSample | null> {
  const prepared = makeCanvas()
  if (!prepared) return null
  try {
    const image = await loadImage(src)
    prepared.ctx.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    return toSample(prepared.ctx)
  } catch {
    return null
  }
}

async function sampleVideo(asset: Asset, time: number): Promise<FrameSample | null> {
  const prepared = makeCanvas()
  if (!prepared) return null
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.src = asset.url
  try {
    await waitFor(video, 'loadeddata', 8000)
    const target = clamp(time, 0, Math.max(0, (asset.duration || video.duration || 0) - 0.05))
    if (Math.abs(video.currentTime - target) > 0.02) {
      video.currentTime = target
      await waitFor(video, 'seeked', 8000)
    }
    prepared.ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    return toSample(prepared.ctx)
  } catch {
    return null
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be decoded'))
    image.src = src
  })
}

function waitFor(target: HTMLVideoElement, event: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      target.removeEventListener(event, onEvent)
      target.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    const onEvent = () => finish()
    const onError = () => finish(new Error('Video could not be decoded'))
    const timer = window.setTimeout(() => finish(new Error('Video decode timed out')), timeout)
    target.addEventListener(event, onEvent, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                     */
/* -------------------------------------------------------------------------- */

function toSample(ctx: CanvasRenderingContext2D): FrameSample | null {
  const image = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
  const pixels = image.data
  const luma = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT)
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const red = pixels[i]
    const green = pixels[i + 1]
    const blue = pixels[i + 2]
    r += red
    g += green
    b += blue
    luma[p] = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const count = SAMPLE_WIDTH * SAMPLE_HEIGHT
  const brightness = luma.reduce((sum, value) => sum + value, 0) / count
  return {
    width: SAMPLE_WIDTH,
    height: SAMPLE_HEIGHT,
    pixels,
    luma,
    r: r / count,
    g: g / count,
    b: b / count,
    brightness,
  }
}

function frameContrast(a: FrameSample, b: FrameSample): number {
  let sum = 0
  for (let i = 0; i < a.luma.length; i++) sum += Math.abs(a.luma[i] - b.luma[i])
  return sum / a.luma.length
}

interface MotionEstimate {
  dx: number
  dy: number
  amount: number
  axis: 'x' | 'y'
  confidence: number
}

function estimateMotion(a: FrameSample, b: FrameSample): MotionEstimate {
  const baseline = frameContrast(a, b)
  let bestX = 0
  let bestXError = baseline
  let bestY = 0
  let bestYError = baseline
  const maxShift = 6

  for (let shift = -maxShift; shift <= maxShift; shift += 2) {
    if (shift === 0) continue
    const errorX = shiftedError(a, b, shift, 0)
    if (errorX < bestXError) {
      bestXError = errorX
      bestX = shift
    }
    const errorY = shiftedError(a, b, 0, shift)
    if (errorY < bestYError) {
      bestYError = errorY
      bestY = shift
    }
  }

  const gainX = baseline - bestXError
  const gainY = baseline - bestYError
  const axis: 'x' | 'y' = gainX >= gainY ? 'x' : 'y'
  const gain = Math.max(0, Math.max(gainX, gainY))
  return {
    dx: bestX,
    dy: bestY,
    amount: gain,
    axis,
    confidence: baseline > 1 ? clamp(gain / baseline, 0, 1) : 0,
  }
}

function shiftedError(a: FrameSample, b: FrameSample, dx: number, dy: number): number {
  let sum = 0
  let count = 0
  for (let y = 0; y < a.height; y++) {
    const by = y + dy
    if (by < 0 || by >= b.height) continue
    for (let x = 0; x < a.width; x++) {
      const bx = x + dx
      if (bx < 0 || bx >= b.width) continue
      sum += Math.abs(a.luma[y * a.width + x] - b.luma[by * b.width + bx])
      count++
    }
  }
  return count > 0 ? sum / count : Number.POSITIVE_INFINITY
}
