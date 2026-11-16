import { FONT_OPTIONS } from './constants'
import { ANIMATION_SPECS, type AnimationEase, type AnimationSpec } from './animations'
import { EFFECT_SPECS, type EffectOp, type ParticleKind, type PatternKind } from './effects'
import { TRANSITION_SPECS, type TransitionSpec } from './transitions'
import { clipEnd, previousClip, sampleKeyframe, VISUAL_RANK } from './project'
import { applyLutToContext, getLut } from './lut'
import type {
  Adjustments,
  Asset,
  BaseClip,
  Clip,
  ClipEffect,
  Mask,
  Project,
  TextData,
  Track,
} from './types'
import { clamp, easeOutBack, easeOutCubic, easeOutQuint, hexToRgba } from './utils'
import { getCachedImage, preloadImages } from './media'

export interface RenderOptions {
  assets: Record<string, Asset>
  getVideoFrame: (clipId: string) => CanvasImageSource | null
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

let fontsPromise: Promise<void> | null = null

export function ensureFonts(): Promise<void> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        await document.fonts.ready
        const loads: Promise<FontFace[]>[] = []
        for (const font of FONT_OPTIONS) {
          for (const weight of font.weights) {
            loads.push(document.fonts.load(`${weight} 48px "${font.family}"`))
          }
        }
        await Promise.all(loads)
      } catch {
        // Font loading failure should never block editing.
      }
    })()
  }
  return fontsPromise
}

/* ------------------------------------------------------------------ */
/* Text layout                                                         */
/* ------------------------------------------------------------------ */

let measureContext: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    measureContext = canvas.getContext('2d')!
  }
  return measureContext
}

export function textFont(text: TextData): string {
  return `${text.italic ? 'italic ' : ''}${text.fontWeight} ${text.fontSize}px "${text.fontFamily}", Inter, sans-serif`
}

export interface TextLayout {
  lines: string[]
  width: number
  height: number
  lineHeight: number
  blockWidth: number
  blockHeight: number
  font: string
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in target) target.letterSpacing = `${px}px`
}

export function measureTextBlock(
  text: TextData,
  projectWidth: number,
  overrideContent?: string,
): TextLayout {
  const ctx = getMeasureContext()
  const font = textFont(text)
  ctx.font = font
  setLetterSpacing(ctx, text.letterSpacing)
  const content = overrideContent ?? text.content
  const available = Math.max(
    40,
    text.maxWidth * projectWidth - text.paddingX * 2,
  )
  const paragraphs = content.split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (ctx.measureText(candidate).width > available && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  if (lines.length === 0) lines.push('')
  let width = 0
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line).width)
  }
  const lineHeight = text.fontSize * text.lineHeight
  const blockWidth = Math.max(text.fontSize * 0.5, width) + text.paddingX * 2
  const blockHeight = lines.length * lineHeight + text.paddingY * 2
  const layout: TextLayout = {
    lines,
    width,
    height: lines.length * lineHeight,
    lineHeight,
    blockWidth,
    blockHeight,
    font,
  }
  setLetterSpacing(ctx, 0)
  return layout
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: TextData,
  projectWidth: number,
  reveal = 1,
) {
  let content = text.content
  if (reveal < 1) {
    const characters = Math.max(0, Math.floor(text.content.length * clamp(reveal, 0, 1)))
    content = text.content.slice(0, characters)
  }
  const layout = measureTextBlock(text, projectWidth, content)
  const x0 = -layout.blockWidth / 2
  const y0 = -layout.blockHeight / 2

  if (text.backgroundColor) {
    ctx.save()
    ctx.globalAlpha *= text.backgroundOpacity
    ctx.fillStyle = text.backgroundColor
    ctx.shadowColor = 'transparent'
    roundedRect(ctx, x0, y0, layout.blockWidth, layout.blockHeight, text.backgroundRadius)
    ctx.fill()
    ctx.restore()
  }

  ctx.font = layout.font
  setLetterSpacing(ctx, text.letterSpacing)
  ctx.textBaseline = 'middle'
  ctx.textAlign = text.align === 'center' ? 'center' : text.align === 'right' ? 'right' : 'left'
  const anchorX =
    text.align === 'center'
      ? 0
      : text.align === 'right'
        ? layout.blockWidth / 2 - text.paddingX
        : -layout.blockWidth / 2 + text.paddingX

  let fillStyle: string | CanvasGradient = text.color
  if (text.gradient && text.color !== 'transparent') {
    const gradient = ctx.createLinearGradient(-layout.blockWidth / 2, 0, layout.blockWidth / 2, 0)
    gradient.addColorStop(0, text.gradient.from)
    gradient.addColorStop(1, text.gradient.to)
    fillStyle = gradient
  }

  const baseY = -layout.blockHeight / 2 + text.paddingY + layout.lineHeight / 2
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i]
    if (!line) continue
    const y = baseY + i * layout.lineHeight
    ctx.save()
    ctx.shadowColor = text.shadowColor
    ctx.shadowBlur = text.shadowBlur
    ctx.shadowOffsetY = text.shadowOffsetY
    if (text.strokeWidth > 0) {
      ctx.strokeStyle = text.strokeColor
      ctx.lineWidth = text.strokeWidth * 2
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(line, anchorX, y)
    }
    if (text.color !== 'transparent' || text.gradient) {
      ctx.fillStyle = fillStyle
      ctx.fillText(line, anchorX, y)
    }
    if (text.underline) {
      const metrics = ctx.measureText(line)
      const underlineY = y + text.fontSize * 0.42
      const thickness = Math.max(2, text.fontSize * 0.045)
      let ux = anchorX
      if (text.align === 'center') ux -= metrics.width / 2
      if (text.align === 'right') ux -= metrics.width
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = typeof fillStyle === 'string' ? fillStyle : text.color
      ctx.fillRect(ux, underlineY, metrics.width, thickness)
    }
    ctx.restore()
  }
  setLetterSpacing(ctx, 0)
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function fitSize(
  asset: Pick<Asset, 'width' | 'height'>,
  projectWidth: number,
  projectHeight: number,
  fit: BaseClip['fit'],
): { width: number; height: number } {
  const aw = asset.width || projectWidth
  const ah = asset.height || projectHeight
  if (fit === 'stretch') return { width: projectWidth, height: projectHeight }
  const scale =
    fit === 'cover'
      ? Math.max(projectWidth / aw, projectHeight / ah)
      : Math.min(projectWidth / aw, projectHeight / ah)
  return { width: aw * scale, height: ah * scale }
}

export function stickerSize(clip: Clip, projectWidth: number, projectHeight: number) {
  if (clip.kind !== 'sticker') return { width: 0, height: 0 }
  const base = Math.min(projectWidth, projectHeight) * clip.sticker.size
  return { width: base, height: base }
}

export function getClipBaseSize(
  clip: Clip,
  project: Project,
  asset: Asset | undefined,
): { width: number; height: number } {
  if (clip.kind === 'text') {
    const layout = measureTextBlock(clip.text, project.width)
    return { width: layout.blockWidth, height: layout.blockHeight }
  }
  if (clip.kind === 'sticker') {
    return stickerSize(clip, project.width, project.height)
  }
  if (asset) return fitSize(asset, project.width, project.height, clip.fit)
  return { width: project.width, height: project.height }
}

export function getClipRect(
  clip: Clip,
  project: Project,
  asset: Asset | undefined,
): { x: number; y: number; width: number; height: number; rotation: number } {
  const base = getClipBaseSize(clip, project, asset)
  return {
    x: project.width / 2 + clip.transform.x,
    y: project.height / 2 + clip.transform.y,
    width: base.width * clip.transform.scale,
    height: base.height * clip.transform.scale,
    rotation: clip.transform.rotation,
  }
}

function filterString(adjustments: Adjustments, extraBlur = 0): string {
  const grade = adjustments.grade
  const brightness = clamp(1 + (adjustments.brightness + adjustments.exposure * 0.6) / 100, 0.1, 3)
  const contrast = clamp(1 + adjustments.contrast / 100, 0.1, 2.5)
  const vibrance = grade ? grade.vibrance / 100 : 0
  const saturation = clamp((1 + adjustments.saturation / 100) * (1 + vibrance * 0.6), 0, 3)
  const hue = clamp(adjustments.tint * 0.35 + (grade?.hue ?? 0), -180, 180)
  const parts = [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturation.toFixed(3)})`,
  ]
  if (Math.abs(hue) > 0.5) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`)
  if (extraBlur > 0.2) parts.push(`blur(${extraBlur.toFixed(1)}px)`)
  return parts.join(' ')
}

let noiseCanvas: HTMLCanvasElement | null = null
let scratchCanvas: HTMLCanvasElement | null = null

function getNoiseCanvas(): HTMLCanvasElement {
  if (noiseCanvas) return noiseCanvas
  const canvas = document.createElement('canvas')
  canvas.width = 180
  canvas.height = 180
  const ctx = canvas.getContext('2d')!
  const data = ctx.createImageData(canvas.width, canvas.height)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255
    data.data[i] = v
    data.data[i + 1] = v
    data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  noiseCanvas = canvas
  return canvas
}

function getScratchCanvas(): HTMLCanvasElement {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas')
  return scratchCanvas
}

let compositeCanvas: HTMLCanvasElement | null = null

function getCompositeCanvas(width: number, height: number): HTMLCanvasElement {
  if (!compositeCanvas) compositeCanvas = document.createElement('canvas')
  if (compositeCanvas.width !== width) compositeCanvas.width = width
  if (compositeCanvas.height !== height) compositeCanvas.height = height
  return compositeCanvas
}

export function maskPath(
  ctx: CanvasRenderingContext2D,
  mask: Mask,
  projectWidth: number,
  projectHeight: number,
) {
  const cx = projectWidth / 2 + mask.x * projectWidth
  const cy = projectHeight / 2 + mask.y * projectHeight
  const w = Math.max(2, mask.width * projectWidth)
  const h = Math.max(2, mask.height * projectHeight)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((mask.rotation * Math.PI) / 180)
  ctx.beginPath()
  if (mask.shape === 'pen' && mask.points.length >= 3) {
    mask.points.forEach((point, index) => {
      const px = (point.x - 0.5) * w
      const py = (point.y - 0.5) * h
      if (index === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.restore()
    return
  }
  switch (mask.shape) {
    case 'ellipse':
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
      break
    case 'triangle':
      ctx.moveTo(0, -h / 2)
      ctx.lineTo(w / 2, h / 2)
      ctx.lineTo(-w / 2, h / 2)
      ctx.closePath()
      break
    case 'diamond':
      ctx.moveTo(0, -h / 2)
      ctx.lineTo(w / 2, 0)
      ctx.lineTo(0, h / 2)
      ctx.lineTo(-w / 2, 0)
      ctx.closePath()
      break
    case 'star': {
      const points = 5
      const outer = Math.min(w, h) / 2
      const inner = outer * 0.45
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outer : inner
        const angle = (Math.PI / points) * i - Math.PI / 2
        const px = Math.cos(angle) * radius * (w / Math.min(w, h))
        const py = Math.sin(angle) * radius * (h / Math.min(w, h))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      break
    }
    case 'heart': {
      const top = -h / 2
      ctx.moveTo(0, h / 2)
      ctx.bezierCurveTo(-w * 0.62, h * 0.02, -w * 0.5, top, 0, top + h * 0.18)
      ctx.bezierCurveTo(w * 0.5, top, w * 0.62, h * 0.02, 0, h / 2)
      ctx.closePath()
      break
    }
    case 'line': {
      const thickness = Math.max(2, h * 0.12)
      ctx.rect(-w / 2, -thickness / 2, w, thickness)
      break
    }
    case 'rectangle':
    default:
      ctx.rect(-w / 2, -h / 2, w, h)
      break
  }
  ctx.restore()
}

function applyMaskToCanvas(
  canvas: HTMLCanvasElement,
  mask: Mask,
  projectWidth: number,
  projectHeight: number,
  scaleX: number,
  scaleY: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in'
  ctx.filter = mask.feather > 0.2 ? `blur(${mask.feather.toFixed(1)}px)` : 'none'
  ctx.fillStyle = '#ffffff'
  maskPath(ctx, mask, projectWidth, projectHeight)
  ctx.fill()
  ctx.restore()
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
}

interface LocalRect {
  x: number
  y: number
  width: number
  height: number
  source: CanvasImageSource | null
}

function hash(n: number, salt = 0): number {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453
  return v - Math.floor(v)
}

function gradientForRect(
  ctx: CanvasRenderingContext2D,
  rect: LocalRect,
  from: string,
  to: string,
  angle = 135,
): CanvasGradient {
  const rad = (angle * Math.PI) / 180
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const len = Math.hypot(rect.width, rect.height) / 2
  const dx = Math.cos(rad) * len
  const dy = Math.sin(rad) * len
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  return gradient
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: PatternKind,
  rect: LocalRect,
  color: string,
  alpha: number,
  scale: number,
  time: number,
) {
  const { x, y, width: w, height: h } = rect
  if (pattern === 'noise') {
    const source = getNoiseCanvas()
    const canvasPattern = ctx.createPattern(source, 'repeat')
    if (canvasPattern) {
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = alpha
      ctx.translate(Math.sin(time * 8.1) * 20, Math.cos(time * 6.3) * 20)
      ctx.fillStyle = canvasPattern
      ctx.fillRect(x - 24, y - 24, w + 48, h + 48)
      ctx.restore()
    }
    return
  }
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.strokeStyle = color
  if (pattern === 'dots' || pattern === 'halftone') {
    const step = Math.max(3, scale)
    const radius = pattern === 'halftone' ? step * 0.28 : step * 0.2
    for (let py = y; py < y + h; py += step) {
      for (let px = x; px < x + w; px += step) {
        const wobble = pattern === 'halftone' ? 0.55 + 0.45 * Math.sin(px * 0.09 + py * 0.07) : 1
        ctx.beginPath()
        ctx.arc(px, py, Math.max(0.5, radius * wobble), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (pattern === 'grid') {
    const step = Math.max(6, scale)
    ctx.lineWidth = 1
    for (let px = x; px <= x + w; px += step) {
      ctx.beginPath()
      ctx.moveTo(px, y)
      ctx.lineTo(px, y + h)
      ctx.stroke()
    }
    for (let py = y; py <= y + h; py += step) {
      ctx.beginPath()
      ctx.moveTo(x, py)
      ctx.lineTo(x + w, py)
      ctx.stroke()
    }
  } else if (pattern === 'cross') {
    const step = Math.max(4, scale)
    ctx.lineWidth = 1
    for (let i = -h; i < w + h; i += step) {
      ctx.beginPath()
      ctx.moveTo(x + i, y)
      ctx.lineTo(x + i + h, y + h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + i + h, y)
      ctx.lineTo(x + i, y + h)
      ctx.stroke()
    }
  } else if (pattern === 'stripes') {
    const step = Math.max(4, scale)
    ctx.lineWidth = Math.max(1, step * 0.28)
    for (let i = -h; i < w + h; i += step) {
      ctx.beginPath()
      ctx.moveTo(x + i, y + h)
      ctx.lineTo(x + i + h, y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  kind: ParticleKind,
  rect: LocalRect,
  color: string,
  count: number,
  alpha: number,
  time: number,
) {
  const { x, y, width: w, height: h } = rect
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.strokeStyle = color
  const total = Math.max(6, Math.min(220, Math.round(count)))
  for (let i = 0; i < total; i++) {
    const seed = hash(i, 1)
    const seed2 = hash(i, 2)
    const seed3 = hash(i, 3)
    if (kind === 'snow') {
      const px = x + seed * w
      const py = y + ((seed2 + time * (0.02 + seed3 * 0.03)) % 1) * h
      ctx.beginPath()
      ctx.arc(px, py, 0.8 + seed3 * 3.4, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'rain') {
      const px = x + seed * w
      const py = y + ((seed2 + time * (0.35 + seed3 * 0.25)) % 1) * h
      ctx.lineWidth = 0.7 + seed3 * 1.4
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - 2, py + 10 + seed3 * 18)
      ctx.stroke()
    } else if (kind === 'sparkle') {
      const px = x + seed * w
      const py = y + seed2 * h
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 2.4 + i * 1.7))
      const size = (2 + seed3 * 7) * twinkle
      ctx.globalAlpha = alpha * twinkle
      ctx.beginPath()
      ctx.moveTo(px, py - size)
      ctx.lineTo(px + size * 0.28, py)
      ctx.lineTo(px, py + size)
      ctx.lineTo(px - size * 0.28, py)
      ctx.closePath()
      ctx.moveTo(px - size, py)
      ctx.lineTo(px, py + size * 0.28)
      ctx.lineTo(px + size, py)
      ctx.lineTo(px, py - size * 0.28)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'bokeh') {
      const px = x + seed * w
      const py = y + ((seed2 + Math.sin(time * 0.4 + i) * 0.02) % 1) * h
      const radius = 4 + seed3 * 16
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius)
      gradient.addColorStop(0, color)
      gradient.addColorStop(0.65, color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = alpha * 0.55
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.globalCompositeOperation = 'source-over'
    } else if (kind === 'confetti') {
      const px = x + seed * w
      const py = y + ((seed2 + time * (0.05 + seed3 * 0.05)) % 1) * h
      const size = 2 + seed3 * 6
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(time * (1 + seed) + i)
      ctx.globalAlpha = alpha * 0.9
      ctx.fillRect(-size / 2, -size / 4, size, size / 2)
      ctx.restore()
    } else {
      const px = x + seed * w
      const py = y + h - ((seed2 + time * (0.04 + seed3 * 0.05)) % 1) * h
      const radius = 0.8 + seed3 * 2.6
      const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 4)
      glow.addColorStop(0, color)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = alpha * 0.9
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, radius * 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }
  }
  ctx.restore()
}

function drawEffectOp(
  ctx: CanvasRenderingContext2D,
  op: EffectOp,
  rect: LocalRect,
  time: number,
  project: Project,
  k: number,
) {
  const { x, y, width: w, height: h, source } = rect
  const sourceRect = (): boolean => Boolean(source && w > 1 && h > 1)

  switch (op.kind) {
    case 'tint': {
      ctx.save()
      ctx.globalCompositeOperation = op.blend ?? 'soft-light'
      ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k, 0, 1)
      ctx.fillStyle = op.color
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
    case 'gradient': {
      ctx.save()
      ctx.globalCompositeOperation = op.blend ?? 'soft-light'
      ctx.globalAlpha = clamp((op.alpha ?? 0.6) * k, 0, 1)
      ctx.fillStyle = gradientForRect(ctx, rect, op.from, op.to, op.angle)
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
    case 'vignette': {
      const strength = clamp((op.strength ?? 1) * k, 0, 2)
      const gradient = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        Math.min(w, h) * 0.24,
        x + w / 2,
        y + h / 2,
        Math.max(w, h) * 0.74,
      )
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, `rgba(0,0,0,${clamp(0.78 * strength, 0, 0.96)})`)
      ctx.save()
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
    case 'grain': {
      const pattern = ctx.createPattern(getNoiseCanvas(), 'repeat')
      if (!pattern) return
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = clamp((op.alpha ?? 0.4) * k, 0, 0.85)
      ctx.translate(Math.sin(time * 7.13) * 28, Math.cos(time * 5.71) * 28)
      ctx.fillStyle = pattern
      ctx.fillRect(x - 32, y - 32, w + 64, h + 64)
      ctx.restore()
      return
    }
    case 'scanlines': {
      const gap = Math.max(2, op.gap ?? 4)
      ctx.save()
      ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k, 0, 1)
      ctx.fillStyle = '#000000'
      for (let py = y; py < y + h; py += gap) ctx.fillRect(x, py, w, 1)
      ctx.restore()
      return
    }
    case 'leak': {
      const corner = op.corner ?? 'tr'
      const cx = corner === 'tl' || corner === 'bl' ? x : x + w
      const cy = corner === 'tl' || corner === 'tr' ? y : y + h
      const radius = Math.max(w, h) * 0.95
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, op.from)
      gradient.addColorStop(0.45, op.to)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = clamp((op.alpha ?? 0.6) * k, 0, 1)
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
    case 'soften': {
      if (!sourceRect()) return
      ctx.save()
      ctx.filter = `blur(${((op.px ?? 4) * (0.4 + k)).toFixed(2)}px)`
      ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k, 0, 1)
      ctx.drawImage(source!, x, y, w, h)
      ctx.restore()
      return
    }
    case 'bloom': {
      if (!sourceRect()) return
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = clamp((op.alpha ?? 0.4) * k, 0, 1)
      ctx.filter = `blur(${(op.px ?? 16).toFixed(1)}px) brightness(1.25)`
      ctx.drawImage(source!, x - 8, y - 8, w + 16, h + 16)
      ctx.restore()
      return
    }
    case 'glitch': {
      if (!sourceRect()) return
      const amount = (op.amount ?? 1) * k
      ctx.save()
      for (let i = 0; i < 8; i++) {
        const rnd = hash(i, 7)
        const sliceY = y + rnd * h
        const sliceH = Math.max(2, (0.015 + rnd * 0.07) * h * amount)
        const offset = (Math.sin(time * 23 + i * 5) * 26 + 6) * amount
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, sliceY, w, sliceH)
        ctx.clip()
        ctx.globalAlpha = 0.7
        ctx.drawImage(source!, x + offset, y, w, h)
        ctx.globalAlpha = 0.25
        ctx.drawImage(source!, x - offset, y, w, h)
        ctx.restore()
      }
      ctx.restore()
      return
    }
    case 'mirror': {
      if (!sourceRect()) return
      ctx.save()
      ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k, 0, 1)
      if ((op.axis ?? 'x') === 'x') {
        ctx.translate(x + w, y)
        ctx.scale(-1, 1)
      } else {
        ctx.translate(x, y + h)
        ctx.scale(1, -1)
      }
      ctx.drawImage(source!, 0, 0, w, h)
      ctx.restore()
      return
    }
    case 'pixelate': {
      if (!sourceRect()) return
      const pixel = Math.max(2, (op.size ?? 10) * (0.5 + k))
      const smallW = Math.max(2, Math.round(w / pixel))
      const smallH = Math.max(2, Math.round(h / pixel))
      const scratch = getScratchCanvas()
      scratch.width = smallW
      scratch.height = smallH
      const sctx = scratch.getContext('2d')
      if (!sctx) return
      sctx.clearRect(0, 0, smallW, smallH)
      sctx.drawImage(source!, 0, 0, smallW, smallH)
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(scratch, x, y, w, h)
      ctx.restore()
      return
    }
    case 'pattern': {
      drawPattern(
        ctx,
        op.pattern,
        rect,
        op.color,
        clamp((op.alpha ?? 0.3) * k, 0, 1),
        op.scale ?? 8,
        time,
      )
      return
    }
    case 'particles': {
      drawParticles(
        ctx,
        op.particle,
        rect,
        op.color ?? '#ffffff',
        op.count ?? 40,
        clamp((op.alpha ?? 0.6) * k, 0, 1),
        time,
      )
      return
    }
    case 'flare': {
      const cx = x + w * 0.78
      const cy = y + h * 0.2
      const radius = Math.max(w, h) * 0.55
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      glow.addColorStop(0, op.color ?? '#9ad8ff')
      glow.addColorStop(0.3, 'rgba(255,255,255,0.45)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = clamp((op.alpha ?? 0.6) * k, 0, 1)
      ctx.fillStyle = glow
      ctx.fillRect(x, y, w, h)
      const streak = ctx.createLinearGradient(x, cy, x + w, cy)
      streak.addColorStop(0, 'rgba(0,0,0,0)')
      streak.addColorStop(0.5, op.color ?? '#9ad8ff')
      streak.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = clamp((op.alpha ?? 0.6) * k * 0.55, 0, 1)
      ctx.fillStyle = streak
      ctx.fillRect(x, cy - Math.max(1, h * 0.006), w, Math.max(2, h * 0.012))
      ctx.restore()
      return
    }
    case 'rays': {
      const cx = x + w / 2
      const cy = y + h * 0.18
      const radius = Math.hypot(w, h)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k, 0, 1)
      ctx.translate(cx, cy)
      ctx.rotate(time * 0.04)
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const width = 0.04 + hash(i, 4) * 0.05
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(angle - width) * radius, Math.sin(angle - width) * radius)
        ctx.lineTo(Math.cos(angle + width) * radius, Math.sin(angle + width) * radius)
        ctx.closePath()
        ctx.fillStyle = op.color ?? '#ffe6a8'
        ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k * (0.25 + hash(i, 5) * 0.5), 0, 1)
        ctx.fill()
      }
      ctx.restore()
      return
    }
    case 'channels': {
      if (!sourceRect()) return
      const offset = Math.max(0.5, (op.offset ?? 3) * k)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = clamp((op.alpha ?? 0.6) * k * 0.55, 0, 1)
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(-45deg)'
      ctx.drawImage(source!, x - offset, y, w, h)
      ctx.filter = 'sepia(1) saturate(7) hue-rotate(130deg)'
      ctx.drawImage(source!, x + offset, y, w, h)
      ctx.restore()
      return
    }
    case 'zoomblur': {
      if (!sourceRect()) return
      const amount = (op.amount ?? 0.12) * (0.5 + k)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      for (let i = 0; i < 7; i++) {
        const scale = 1 + (amount * i) / 6
        ctx.globalAlpha = clamp((op.alpha ?? 0.5) * k * (1 - i / 8) * 0.4, 0, 1)
        ctx.drawImage(
          source!,
          x + (w - w * scale) / 2,
          y + (h - h * scale) / 2,
          w * scale,
          h * scale,
        )
      }
      ctx.restore()
      return
    }
    case 'frame': {
      const inset = Math.max(1, (op.inset ?? 0.04) * Math.min(w, h))
      ctx.save()
      ctx.globalAlpha = clamp((op.alpha ?? 0.9) * k, 0, 1)
      ctx.strokeStyle = op.color ?? '#0a0a0a'
      ctx.lineWidth = inset
      ctx.strokeRect(x + inset / 2, y + inset / 2, w - inset, h - inset)
      if (op.sprockets) {
        ctx.fillStyle = op.color ?? '#08080a'
        const holeW = inset * 0.42
        const holeH = inset * 0.3
        const step = holeW * 2.2
        for (let px = x + inset * 1.4; px < x + w - inset * 1.4; px += step) {
          ctx.fillRect(px, y + inset * 0.28, holeW, holeH)
          ctx.fillRect(px, y + h - inset * 0.58, holeW, holeH)
        }
      }
      ctx.restore()
      return
    }
    case 'letterbox': {
      const ratio = op.ratio ?? 2.39
      ctx.save()
      ctx.fillStyle = '#000000'
      if (w / h < ratio) {
        const bar = (h - w / ratio) / 2
        ctx.fillRect(x, y, w, bar)
        ctx.fillRect(x, y + h - bar, w, bar)
      } else {
        const bar = (w - h * ratio) / 2
        ctx.fillRect(x, y, bar, h)
        ctx.fillRect(x + w - bar, y, bar, h)
      }
      ctx.restore()
      return
    }
    case 'spotlight': {
      const gradient = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        Math.min(w, h) * 0.08,
        x + w / 2,
        y + h / 2,
        Math.max(w, h) * 0.68,
      )
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.45, 'rgba(0,0,0,0.12)')
      gradient.addColorStop(1, `rgba(0,0,0,${clamp(0.88 * k, 0, 0.95)})`)
      ctx.save()
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      return
    }
  }
  void project
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: ClipEffect[],
  rect: LocalRect,
  time: number,
  project: Project,
) {
  if (effects.length === 0) return
  const { x, y, width: w, height: h } = rect
  if (w <= 1 || h <= 1) return
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.filter = 'none'
  for (const effect of effects) {
    const ops = EFFECT_SPECS[effect.id]
    if (!ops || ops.length === 0) continue
    const k = clamp(effect.intensity / 100, 0, 1)
    if (k <= 0) continue
    for (const op of ops) drawEffectOp(ctx, op, rect, time, project, k)
  }
  ctx.restore()
}

function drawAdjustmentOverlays(
  ctx: CanvasRenderingContext2D,
  adjustments: Adjustments,
  rect: LocalRect,
) {
  const { x, y, width: w, height: h } = rect
  ctx.save()
  roundedRect(ctx, x, y, w, h, 0)
  ctx.clip()
  ctx.filter = 'none'
  if (Math.abs(adjustments.temperature) > 1) {
    const warm = adjustments.temperature > 0
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = Math.min(0.5, Math.abs(adjustments.temperature) / 220)
    ctx.fillStyle = warm ? '#ff9a3c' : '#4c8dff'
    ctx.fillRect(x, y, w, h)
  }
  if (Math.abs(adjustments.tint) > 1) {
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = Math.min(0.35, Math.abs(adjustments.tint) / 260)
    ctx.fillStyle = adjustments.tint > 0 ? '#ff4fd8' : '#4cff9d'
    ctx.fillRect(x, y, w, h)
  }
  const grade = adjustments.grade
  if (grade) {
    ctx.globalCompositeOperation = 'soft-light'
    const wheelColor = (wheel: { r: number; g: number; b: number }) =>
      `rgb(${clamp(128 + wheel.r, 0, 255)},${clamp(128 + wheel.g, 0, 255)},${clamp(128 + wheel.b, 0, 255)})`
    const strength = (wheel: { r: number; g: number; b: number }) =>
      Math.min(1, Math.max(Math.abs(wheel.r), Math.abs(wheel.g), Math.abs(wheel.b)) / 100)
    const shadows = strength(grade.shadows)
    if (shadows > 0.01) {
      const gradient = ctx.createLinearGradient(0, y + h, 0, y + h * 0.45)
      gradient.addColorStop(0, wheelColor(grade.shadows))
      gradient.addColorStop(1, 'rgba(128,128,128,0)')
      ctx.globalAlpha = shadows * 0.7
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
    }
    const midtones = strength(grade.midtones)
    if (midtones > 0.01) {
      const gradient = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        0,
        x + w / 2,
        y + h / 2,
        Math.max(w, h) * 0.7,
      )
      gradient.addColorStop(0, wheelColor(grade.midtones))
      gradient.addColorStop(1, 'rgba(128,128,128,0)')
      ctx.globalAlpha = midtones * 0.55
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
    }
    const highlights = strength(grade.highlights)
    if (highlights > 0.01) {
      const gradient = ctx.createLinearGradient(0, y, 0, y + h * 0.55)
      gradient.addColorStop(0, wheelColor(grade.highlights))
      gradient.addColorStop(1, 'rgba(128,128,128,0)')
      ctx.globalAlpha = highlights * 0.7
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, w, h)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  if (adjustments.vignette > 0) {
    const gradient = ctx.createRadialGradient(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.3,
      x + w / 2,
      y + h / 2,
      Math.max(w, h) * 0.72,
    )
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${0.7 * (adjustments.vignette / 100)})`)
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}

interface AnimationState {
  alpha: number
  dx: number
  dy: number
  scale: number
  scaleX: number
  scaleY: number
  rotation: number
  blur: number
  reveal: number
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) {
    const u = t - 1.5 / d1
    return n1 * u * u + 0.75
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1
    return n1 * u * u + 0.9375
  }
  const u = t - 2.625 / d1
  return n1 * u * u + 0.984375
}

function easeOutElastic(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const c4 = (2 * Math.PI) / 3
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

function easeAnimation(ease: AnimationEase | undefined, t: number): number {
  switch (ease) {
    case 'back':
      return clamp(easeOutBack(t), 0, 1.6)
    case 'quint':
      return easeOutQuint(t)
    case 'bounce':
      return easeOutBounce(t)
    case 'elastic':
      return easeOutElastic(t)
    case 'linear':
      return t
    default:
      return easeOutCubic(t)
  }
}

function applyAnimationSpec(
  state: AnimationState,
  spec: AnimationSpec,
  t: number,
  project: Project,
) {
  const away = 1 - t
  const alphaFrom = spec.alphaFrom ?? 0
  state.alpha *= alphaFrom + (1 - alphaFrom) * t
  state.dx += (spec.dx ?? 0) * project.width * away
  state.dy += (spec.dy ?? 0) * project.height * away
  const scaleFrom = spec.scaleFrom ?? 1
  state.scale *= scaleFrom + (1 - scaleFrom) * t
  const scaleXFrom = spec.scaleXFrom ?? 1
  state.scaleX *= scaleXFrom + (1 - scaleXFrom) * t
  const scaleYFrom = spec.scaleYFrom ?? 1
  state.scaleY *= scaleYFrom + (1 - scaleYFrom) * t
  state.rotation += (spec.rotFrom ?? 0) * away
  state.blur += (spec.blurFrom ?? 0) * away
}

function animateClip(clip: Clip, local: number, project: Project): AnimationState {
  const state: AnimationState = {
    alpha: 1,
    dx: 0,
    dy: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    blur: 0,
    reveal: 1,
  }
  const inAnim = clip.animationIn
  if (inAnim && inAnim.type !== 'none' && inAnim.duration > 0.01 && local < inAnim.duration) {
    const spec = ANIMATION_SPECS[inAnim.type]
    const p = clamp(local / inAnim.duration, 0, 1)
    const q = easeAnimation(spec.ease, p)
    applyAnimationSpec(state, spec, q, project)
    if (spec.reveal) state.reveal = Math.min(state.reveal, q)
  }
  const outAnim = clip.animationOut
  if (outAnim && outAnim.type !== 'none' && outAnim.duration > 0.01) {
    const outStart = clip.duration - outAnim.duration
    if (local > outStart) {
      const spec = ANIMATION_SPECS[outAnim.type]
      const p = clamp((clip.duration - local) / outAnim.duration, 0, 1)
      const q = easeAnimation(spec.ease, p)
      applyAnimationSpec(state, spec, q, project)
      if (spec.reveal) state.reveal = Math.min(state.reveal, q)
    }
  }
  if (clip.fadeIn > 0.001) state.alpha *= clamp(local / clip.fadeIn, 0, 1)
  if (clip.fadeOut > 0.001) {
    state.alpha *= clamp((clip.duration - local) / clip.fadeOut, 0, 1)
  }
  return state
}

interface DrawExtra {
  dx?: number
  dy?: number
  scale?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
  alpha?: number
  blur?: number
  ignoreAnim?: boolean
}

function paintClipContent(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  project: Project,
  time: number,
  opts: RenderOptions,
  anim: AnimationState,
  blur: number,
  asset: Asset | undefined,
) {
  if (clip.kind === 'text') {
    ctx.filter = filterString(clip.adjustments, blur)
    drawText(ctx, clip.text, project.width, anim.reveal)
    const layout = measureTextBlock(clip.text, project.width)
    const rect: LocalRect = {
      x: -layout.blockWidth / 2,
      y: -layout.blockHeight / 2,
      width: layout.blockWidth,
      height: layout.blockHeight,
      source: null,
    }
    drawAdjustmentOverlays(ctx, clip.adjustments, rect)
    drawEffects(ctx, clip.effects, rect, time, project)
  } else if (clip.kind === 'sticker') {
    const size = stickerSize(clip, project.width, project.height)
    const source = getCachedImage(clip.sticker.src)
    const rect: LocalRect = {
      x: -size.width / 2,
      y: -size.height / 2,
      width: size.width,
      height: size.height,
      source: null,
    }
    ctx.filter = filterString(clip.adjustments, blur)
    if (source) {
      ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 16)
      ctx.fill()
    }
    drawAdjustmentOverlays(ctx, clip.adjustments, rect)
    drawEffects(ctx, clip.effects, rect, time, project)
  } else if (asset) {
    const size = fitSize(asset, project.width, project.height, clip.fit)
    let source: CanvasImageSource | null = null
    if (clip.kind === 'video') {
      source = opts.getVideoFrame(clip.id)
      if (!source && asset.thumbnail) source = getCachedImage(asset.thumbnail)
    } else {
      source = getCachedImage(asset.url)
    }
    const rect: LocalRect = {
      x: -size.width / 2,
      y: -size.height / 2,
      width: size.width,
      height: size.height,
      source,
    }
    ctx.filter = filterString(clip.adjustments, blur)
    if (source) {
      ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height)
    } else {
      ctx.fillStyle = '#15151f'
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
      ctx.filter = 'none'
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.font = `500 ${Math.round(project.width * 0.018)}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Loading frame…', 0, 0)
    }
    drawAdjustmentOverlays(ctx, clip.adjustments, rect)
    drawEffects(ctx, clip.effects, rect, time, project)
  }
}

function drawClipLayer(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  project: Project,
  time: number,
  opts: RenderOptions,
  extra: DrawExtra = {},
) {
  const local = clamp(time - clip.start, 0, clip.duration)
  const anim: AnimationState = extra.ignoreAnim
    ? { alpha: 1, dx: 0, dy: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, blur: 0, reveal: 1 }
    : animateClip(clip, local, project)
  const blur = (extra.blur ?? 0) + anim.blur
  const keyedOpacity = sampleKeyframe(clip, 'opacity', local)
  const alpha = (extra.alpha ?? 1) * anim.alpha * (keyedOpacity ?? clip.opacity)
  if (alpha <= 0.001) return
  const asset = 'assetId' in clip ? opts.assets[clip.assetId] : undefined
  const shake = clip.effects.find((e) => e.id === 'shake')
  let shakeX = 0
  let shakeY = 0
  if (shake) {
    const amount = shake.intensity / 100
    shakeX = Math.sin(time * 31.4) * 5 * amount + Math.sin(time * 12.7) * 2 * amount
    shakeY = Math.cos(time * 26.3) * 4 * amount + Math.cos(time * 9.1) * 2 * amount
  }

  const keyedX = sampleKeyframe(clip, 'x', local)
  const keyedY = sampleKeyframe(clip, 'y', local)
  const keyedScale = sampleKeyframe(clip, 'scale', local)
  const keyedRotation = sampleKeyframe(clip, 'rotation', local)

  const translateX =
    project.width / 2 +
    (keyedX ?? clip.transform.x) +
    anim.dx +
    (extra.dx ?? 0) +
    shakeX
  const translateY =
    project.height / 2 +
    (keyedY ?? clip.transform.y) +
    anim.dy +
    (extra.dy ?? 0) +
    shakeY
  const rotation =
    ((keyedRotation ?? clip.transform.rotation) + anim.rotation + (extra.rotation ?? 0)) *
    (Math.PI / 180)
  const scale = (keyedScale ?? clip.transform.scale) * anim.scale * (extra.scale ?? 1)

  const grade = clip.adjustments.grade
  const lut = grade?.lut ? getLut(grade.lut) : null
  const mask = clip.mask && clip.mask.shape !== 'none' ? clip.mask : null
  const offscreen = Boolean(mask || lut)
  const pixelScaleX = ctx.canvas.width / project.width || 1
  const pixelScaleY = ctx.canvas.height / project.height || 1
  const buffer = offscreen
    ? getCompositeCanvas(
        Math.max(1, Math.round(project.width * pixelScaleX)),
        Math.max(1, Math.round(project.height * pixelScaleY)),
      )
    : null
  const target = buffer ? buffer.getContext('2d') : ctx
  if (!target) return

  if (buffer && target !== ctx) {
    target.setTransform(1, 0, 0, 1, 0, 0)
    target.clearRect(0, 0, buffer.width, buffer.height)
    target.save()
    target.scale(pixelScaleX, pixelScaleY)
  }

  target.save()
  target.translate(translateX, translateY)
  target.rotate(rotation)
  target.scale(
    scale * anim.scaleX * (extra.scaleX ?? 1) * (clip.transform.flipH ? -1 : 1),
    scale * anim.scaleY * (extra.scaleY ?? 1) * (clip.transform.flipV ? -1 : 1),
  )
  target.globalAlpha = buffer ? 1 : alpha
  target.globalCompositeOperation = buffer
    ? 'source-over'
    : clip.blend === 'normal'
      ? 'source-over'
      : clip.blend

  paintClipContent(target, clip, project, time, opts, anim, blur, asset)
  target.restore()

  if (buffer) {
    target.restore()
    if (lut && grade) applyLutToContext(target, lut, grade.lutIntensity)
    if (mask) {
      const resolved: Mask = { ...mask }
      const maskScale = sampleKeyframe(clip, 'maskScale', local)
      const maskX = sampleKeyframe(clip, 'maskX', local)
      const maskY = sampleKeyframe(clip, 'maskY', local)
      const maskRotation = sampleKeyframe(clip, 'maskRotation', local)
      if (maskScale !== null) {
        resolved.width *= maskScale
        resolved.height *= maskScale
      }
      if (maskX !== null) resolved.x = maskX
      if (maskY !== null) resolved.y = maskY
      if (maskRotation !== null) resolved.rotation = maskRotation
      applyMaskToCanvas(buffer, resolved, project.width, project.height, pixelScaleX, pixelScaleY)
    }
    ctx.save()
    ctx.globalAlpha = alpha * (mask ? mask.opacity : 1)
    ctx.globalCompositeOperation = clip.blend === 'normal' ? 'source-over' : clip.blend
    ctx.drawImage(buffer, 0, 0, project.width, project.height)
    ctx.restore()
  }
}

function drawTrackClip(
  ctx: CanvasRenderingContext2D,
  track: Track,
  clip: Clip,
  project: Project,
  time: number,
  opts: RenderOptions,
) {
  const local = time - clip.start
  const transition = clip.transitionIn
  if (transition && transition.duration > 0.02 && local >= 0 && local < transition.duration) {
    const p = clamp(local / transition.duration, 0, 1)
    const prev = previousClip(track, clip)
    const hasPrev = Boolean(prev && Math.abs(clipEnd(prev) - clip.start) < 0.12)
    const prevTime = prev ? Math.max(prev.start, clipEnd(prev) - 0.001) : 0
    const prevExtras: DrawExtra = { ignoreAnim: true }
    const incoming: DrawExtra = {}
    const spec: TransitionSpec = TRANSITION_SPECS[transition.type]
    const w = project.width
    const h = project.height
    const drawPrev = () => {
      if (hasPrev && prev) drawClipLayer(ctx, prev, project, prevTime, opts, prevExtras)
    }
    const drawIncoming = () => drawClipLayer(ctx, clip, project, time, opts, incoming)

    const slide = (
      direction: TransitionSpec['direction'],
      distance = 1,
      blurAmount = 0,
    ) => {
      switch (direction) {
        case 'left':
          prevExtras.dx = -w * p * distance
          incoming.dx = w * (1 - p) * distance
          break
        case 'right':
          prevExtras.dx = w * p * distance
          incoming.dx = -w * (1 - p) * distance
          break
        case 'up':
          prevExtras.dy = -h * p * distance
          incoming.dy = h * (1 - p) * distance
          break
        case 'down':
          prevExtras.dy = h * p * distance
          incoming.dy = -h * (1 - p) * distance
          break
      }
      if (blurAmount > 0) {
        prevExtras.blur = blurAmount * p
        incoming.blur = blurAmount * (1 - p)
      }
    }

    switch (spec.kind) {
      case 'fade': {
        if (spec.color) {
          prevExtras.alpha = clamp(1 - p * 2, 0, 1)
          incoming.alpha = clamp(p * 2 - 1, 0, 1)
          drawPrev()
          drawIncoming()
          ctx.save()
          ctx.globalAlpha = clamp(1 - Math.abs(p - 0.5) * 2, 0, 1)
          ctx.fillStyle = spec.color
          ctx.fillRect(0, 0, w, h)
          ctx.restore()
          return
        }
        const softness = spec.amount ?? 0
        if (softness > 0) {
          prevExtras.blur = 8 * softness * p
          incoming.blur = 8 * softness * (1 - p)
        }
        incoming.alpha = p
        break
      }
      case 'slide': {
        slide(spec.direction, spec.amount ?? 1)
        break
      }
      case 'zoom': {
        const amount = spec.amount ?? 1
        if (amount >= 0) {
          prevExtras.scale = 1 + 0.2 * amount * p
          incoming.scale = 1 - 0.22 * Math.min(1, amount) * (1 - p)
        } else {
          prevExtras.scale = 1 - 0.18 * p
          incoming.scale = 1 + 0.25 * (1 - p)
        }
        incoming.alpha = p
        if (spec.spin) {
          prevExtras.rotation = 8 * p
          incoming.rotation = -24 * (1 - p)
        }
        break
      }
      case 'blur': {
        prevExtras.alpha = 1 - p * 0.5
        prevExtras.blur = 20 * p
        incoming.alpha = p
        incoming.blur = 20 * (1 - p)
        break
      }
      case 'whip': {
        slide(spec.direction, 1, 18)
        break
      }
      case 'spin': {
        prevExtras.rotation = 16 * p
        prevExtras.scale = 1 - 0.12 * p
        incoming.rotation = -32 * (1 - p)
        incoming.scale = 0.78 + 0.22 * p
        incoming.alpha = p
        break
      }
      case 'flip': {
        if (spec.direction === 'up') {
          prevExtras.scaleY = Math.max(0.01, 1 - p * 2)
          incoming.scaleY = Math.max(0.01, p * 2 - 1)
        } else {
          prevExtras.scaleX = Math.max(0.01, 1 - p * 2)
          incoming.scaleX = Math.max(0.01, p * 2 - 1)
        }
        incoming.alpha = 1
        break
      }
      case 'glitch': {
        prevExtras.alpha = 1 - p
        incoming.alpha = p
        incoming.dx = Math.sin(p * 60) * w * 0.03 * (1 - p)
        incoming.blur = 2 * (1 - p)
        break
      }
      case 'light': {
        incoming.alpha = p
        break
      }
      case 'roll': {
        slide(spec.direction, 1, 0)
        prevExtras.rotation = spec.direction === 'right' ? 18 * p : -18 * p
        incoming.rotation = spec.direction === 'right' ? -18 * (1 - p) : 18 * (1 - p)
        break
      }
      case 'mosaic': {
        prevExtras.alpha = 1 - p
        incoming.alpha = p
        incoming.blur = 18 * (1 - p)
        break
      }
      case 'wipe': {
        drawPrev()
        ctx.save()
        ctx.beginPath()
        if (spec.amount) {
          const q = Math.min(1, p * 1.6)
          ctx.moveTo(0, 0)
          ctx.lineTo(w * q, 0)
          ctx.lineTo(0, h * q)
          ctx.closePath()
        } else if (spec.direction === 'right') {
          ctx.rect(w * (1 - p), 0, w * p, h)
        } else if (spec.direction === 'up') {
          ctx.rect(0, h * (1 - p), w, h * p)
        } else if (spec.direction === 'down') {
          ctx.rect(0, 0, w, h * p)
        } else {
          ctx.rect(0, 0, w * p, h)
        }
        ctx.clip()
        drawIncoming()
        ctx.restore()
        return
      }
      case 'iris': {
        const radius = Math.hypot(w, h) * 0.55
        const cx = w / 2
        const cy = h / 2
        if ((spec.amount ?? 1) >= 0) {
          drawPrev()
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, radius * p, 0, Math.PI * 2)
          ctx.clip()
          drawIncoming()
          ctx.restore()
        } else {
          drawIncoming()
          ctx.save()
          ctx.beginPath()
          ctx.arc(cx, cy, radius * (1 - p), 0, Math.PI * 2)
          ctx.clip()
          drawPrev()
          ctx.restore()
        }
        return
      }
      case 'clock': {
        drawPrev()
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(w / 2, h / 2)
        ctx.arc(w / 2, h / 2, Math.hypot(w, h), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p)
        ctx.closePath()
        ctx.clip()
        drawIncoming()
        ctx.restore()
        return
      }
      case 'blinds': {
        drawPrev()
        ctx.save()
        ctx.beginPath()
        const count = 14
        if (spec.direction === 'left') {
          const stripe = w / count
          for (let i = 0; i < count; i++) {
            ctx.rect(i * stripe, 0, stripe * p, h)
          }
        } else {
          const stripe = h / count
          for (let i = 0; i < count; i++) {
            ctx.rect(0, i * stripe, w, stripe * p)
          }
        }
        ctx.clip()
        drawIncoming()
        ctx.restore()
        return
      }
      case 'checker': {
        drawPrev()
        ctx.save()
        ctx.beginPath()
        const count = 8
        const cellW = w / count
        const cellH = h / count
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (hash(row * count + col, 9) <= p) {
              ctx.rect(col * cellW, row * cellH, cellW, cellH)
            }
          }
        }
        ctx.clip()
        drawIncoming()
        ctx.restore()
        return
      }
      case 'split': {
        drawPrev()
        if (spec.direction === 'up') {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, w, h / 2)
          ctx.clip()
          incoming.dy = -h * (1 - p)
          drawIncoming()
          ctx.restore()
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, h / 2, w, h / 2)
          ctx.clip()
          incoming.dy = h * (1 - p)
          drawIncoming()
          ctx.restore()
        } else {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, w / 2, h)
          ctx.clip()
          incoming.dx = -w * (1 - p)
          drawIncoming()
          ctx.restore()
          ctx.save()
          ctx.beginPath()
          ctx.rect(w / 2, 0, w / 2, h)
          ctx.clip()
          incoming.dx = w * (1 - p)
          drawIncoming()
          ctx.restore()
        }
        return
      }
      case 'diamond': {
        drawPrev()
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(w / 2, h / 2 - (h / 2) * p)
        ctx.lineTo(w / 2 + (w / 2) * p, h / 2)
        ctx.lineTo(w / 2, h / 2 + (h / 2) * p)
        ctx.lineTo(w / 2 - (w / 2) * p, h / 2)
        ctx.closePath()
        ctx.clip()
        drawIncoming()
        ctx.restore()
        return
      }
    }

    drawPrev()
    drawIncoming()

    if (spec.kind === 'light') {
      const strength = Math.sin(Math.PI * p)
      const gradient = ctx.createLinearGradient(w, 0, 0, h)
      gradient.addColorStop(0, 'rgba(255,210,140,0)')
      gradient.addColorStop(0.5, `rgba(255,210,140,${0.55 * strength})`)
      gradient.addColorStop(1, 'rgba(255,90,150,0)')
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
    if (spec.kind === 'glitch' && p > 0.08 && p < 0.92) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.16 * (1 - Math.abs(p - 0.5) * 2)
      for (let i = 0; i < 5; i++) {
        const sy = hash(i, 11) * h
        ctx.fillStyle = i % 2 === 0 ? '#ff2d95' : '#22d3ee'
        ctx.fillRect(0, sy, w, Math.max(2, h * 0.01))
      }
      ctx.restore()
    }
    return
  }
  drawClipLayer(ctx, clip, project, time, opts)
}

/* ------------------------------------------------------------------ */
/* Public renderer                                                     */
/* ------------------------------------------------------------------ */

export function renderProject(
  canvas: HTMLCanvasElement,
  project: Project,
  time: number,
  opts: RenderOptions,
) {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  ctx.fillStyle = project.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const scaleX = canvas.width / project.width
  const scaleY = canvas.height / project.height
  ctx.save()
  ctx.scale(scaleX, scaleY)

  const tracks = project.tracks
    .filter((track) => track.kind !== 'audio' && !track.hidden)
    .slice()
    .sort((a, b) => VISUAL_RANK[a.kind] - VISUAL_RANK[b.kind])

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (time >= clip.start && time < clip.start + clip.duration) {
        drawTrackClip(ctx, track, clip, project, time, opts)
      }
    }
  }

  ctx.restore()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
}

export function renderLoadingBackdrop(canvas: HTMLCanvasElement, background = '#08080c') {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

export async function preloadProjectImages(project: Project) {
  const sources: string[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === 'sticker') sources.push(clip.sticker.src)
    }
  }
  await preloadImages(sources)
}

export function intensity(effects: ClipEffect[], id: ClipEffect['id']): number {
  return effects.find((e) => e.id === id)?.intensity ?? 0
}

export function tintColor(value: number): string {
  return value > 0 ? hexToRgba('#ff4fd8', 0.3) : hexToRgba('#4cff9d', 0.3)
}
