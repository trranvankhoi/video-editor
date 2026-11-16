/**
 * ClipPro domain model.
 *
 * All times are expressed in seconds on the project timeline. Media offsets
 * (`mediaStart`) refer to seconds inside the source asset.
 */

export type AssetType = 'video' | 'audio' | 'image'
export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'sticker'
export type TrackKind = 'main' | 'overlay' | 'text' | 'sticker' | 'audio'

export interface Asset {
  id: string
  name: string
  type: AssetType
  mimeType: string
  size: number
  /** Source duration in seconds (0 for images). */
  duration: number
  width: number
  height: number
  hasAudio: boolean
  thumbnail?: string
  /** Extracted source frames for the timeline filmstrip. */
  filmstrip?: string[]
  /** Normalised audio peaks, 0..1. */
  waveform?: number[]
  createdAt: number
  /** Runtime-only object URL. Not persisted. */
  url: string
}

export interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  flipH: boolean
  flipV: boolean
}

export interface ColorWheel {
  /** -100..100 per channel. */
  r: number
  g: number
  b: number
}

export interface ColorGrade {
  shadows: ColorWheel
  midtones: ColorWheel
  highlights: ColorWheel
  /** -180..180 hue rotation, applied after the wheels. */
  hue: number
  /** -100..100 vibrance. */
  vibrance: number
  /** Loaded .cube LUT id, or null. */
  lut: string | null
  /** 0..100 blend amount for the LUT. */
  lutIntensity: number
}

export interface Adjustments {
  brightness: number
  contrast: number
  saturation: number
  exposure: number
  temperature: number
  tint: number
  vignette: number
  grade: ColorGrade
}

export type MaskShape =
  | 'none'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'heart'
  | 'line'
  | 'pen'

export interface MaskPoint {
  /** Normalised 0..1 inside the mask bounds. */
  x: number
  y: number
}

export interface Mask {
  shape: MaskShape
  /** Centre offset as a fraction of the project size. */
  x: number
  y: number
  /** Size as a fraction of the project size. */
  width: number
  height: number
  rotation: number
  /** 0..100 soft edge. */
  feather: number
  invert: boolean
  /** 0..1 mask strength. */
  opacity: number
  /** Custom pen points, normalised inside the mask bounds. */
  points: MaskPoint[]
}

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'back'

export type KeyframeProperty =
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'volume'
  | 'maskX'
  | 'maskY'
  | 'maskScale'
  | 'maskRotation'

export interface Keyframe {
  id: string
  /** Timeline-local seconds from the start of the clip. */
  time: number
  property: KeyframeProperty
  value: number
  easing: Easing
}

export interface Marker {
  id: string
  time: number
  label: string
  color: string
}

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'lighten'
  | 'darken'

export type FitMode = 'contain' | 'cover' | 'stretch'

export const TRANSITION_TYPES = [
  'fade',
  'fade-black',
  'fade-white',
  'dissolve',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'push-left',
  'push-right',
  'push-up',
  'push-down',
  'zoom-in',
  'zoom-out',
  'zoom-punch',
  'zoom-spin',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
  'wipe-diagonal',
  'iris',
  'iris-out',
  'clock',
  'blinds-h',
  'blinds-v',
  'checker',
  'split-h',
  'split-v',
  'blur',
  'blur-in',
  'whip-left',
  'whip-right',
  'whip-up',
  'whip-down',
  'spin',
  'flip-h',
  'flip-v',
  'glitch',
  'light-leak',
  'roll-left',
  'roll-right',
  'mosaic',
  'diamond',
] as const

export type TransitionType = (typeof TRANSITION_TYPES)[number]

export const ANIMATION_TYPES = [
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'slide-up-far',
  'slide-down-far',
  'pop',
  'zoom-in',
  'zoom-out',
  'rotate',
  'rotate-right',
  'spin-in',
  'typewriter',
  'blur-in',
  'blur-out',
  'bounce',
  'elastic',
  'flip-h',
  'flip-v',
  'swing',
  'drop',
  'rise',
  'expand',
  'contract',
  'wipe-left',
  'wipe-right',
  'pulse',
  'glitch',
  'shake',
  'drift',
  'float',
  'tumble',
  'unfold',
  'roll',
  'drop-fade',
  'zoom-pulse',
] as const

export type AnimationType = (typeof ANIMATION_TYPES)[number]

export const EFFECT_IDS = [
  'vignette',
  'grain',
  'light-leak',
  'scanlines',
  'glitch',
  'shake',
  'bloom',
  'warm-glow',
  'cool-mist',
  'teal-orange',
  'sepia',
  'noir',
  'dream',
  'vhs',
  'crt',
  'old-film',
  'projector',
  'neon',
  'cyberpunk',
  'infrared',
  'thermal',
  'night-vision',
  'bleach',
  'matte',
  'pastel',
  'candy',
  'sunset',
  'ocean',
  'forest',
  'lavender',
  'rose',
  'amber',
  'arctic',
  'ember',
  'chrome',
  'duotone',
  'monochrome',
  'halftone',
  'dot-screen',
  'grid',
  'crosshatch',
  'stripes',
  'noise',
  'paper',
  'watercolor',
  'sketch',
  'emboss',
  'edge-glow',
  'chromatic',
  'mirror',
  'kaleido',
  'pixelate',
  'mosaic',
  'zoom-blur',
  'echo',
  'snow',
  'rain',
  'sparkle',
  'bokeh',
  'confetti',
  'embers',
  'lens-flare',
  'sun-rays',
  'spotlight',
  'letterbox',
  'film-frame',
  'polaroid',
  'film-strip',
  'soft-focus',
  'lomo',
] as const

export type EffectId = (typeof EFFECT_IDS)[number]

export interface Transition {
  type: TransitionType
  duration: number
}

export interface Animation {
  type: AnimationType
  duration: number
}

export interface ClipEffect {
  id: EffectId
  intensity: number
}

export interface TextData {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  italic: boolean
  underline: boolean
  color: string
  /** Optional two-stop gradient fill. When set it wins over `color`. */
  gradient: { from: string; to: string } | null
  backgroundColor: string | null
  backgroundOpacity: number
  backgroundRadius: number
  paddingX: number
  paddingY: number
  align: 'left' | 'center' | 'right'
  strokeColor: string
  strokeWidth: number
  shadowColor: string
  shadowBlur: number
  shadowOffsetY: number
  letterSpacing: number
  lineHeight: number
  /** Maximum text block width, as a fraction of the project width. */
  maxWidth: number
}

export interface StickerData {
  src: string
  label: string
  /** Height as a fraction of the project's shorter side. */
  size: number
}

export interface BaseClip {
  id: string
  kind: ClipKind
  name: string
  /** Timeline start time. */
  start: number
  /** Timeline duration. */
  duration: number
  /** Offset inside the source media. */
  mediaStart: number
  speed: number
  volume: number
  muted: boolean
  opacity: number
  transform: Transform
  fit: FitMode
  blend: BlendMode
  adjustments: Adjustments
  effects: ClipEffect[]
  transitionIn: Transition | null
  animationIn: Animation | null
  animationOut: Animation | null
  /** Per-parameter keyframes, local to the clip. */
  keyframes: Keyframe[]
  /** Geometric or pen mask. `null` means the clip is unmasked. */
  mask: Mask | null
  /** Audio fades, in seconds. */
  fadeIn: number
  fadeOut: number
  reversed: boolean
}

export interface MediaClip extends BaseClip {
  kind: 'video' | 'image' | 'audio'
  assetId: string
  /** Audio detached from a video clip. */
  detached?: boolean
}

export interface TextClip extends BaseClip {
  kind: 'text'
  text: TextData
}

export interface StickerClip extends BaseClip {
  kind: 'sticker'
  sticker: StickerData
}

export type Clip = MediaClip | TextClip | StickerClip

export interface Track {
  id: string
  kind: TrackKind
  name: string
  muted: boolean
  hidden: boolean
  locked: boolean
  clips: Clip[]
}

export interface Project {
  id: string
  name: string
  width: number
  height: number
  fps: number
  background: string
  tracks: Track[]
  assetIds: string[]
  /** Timeline markers. */
  markers: Marker[]
  createdAt: number
  updatedAt: number
}

export interface ProjectRecord {
  project: Project
  thumbnail?: string
}

export interface MediaNeed {
  clipId: string
  assetId: string
  time: number
}

export interface ExportOptions {
  width: number
  height: number
  fps: number
  format: 'mp4' | 'webm'
  quality: 'standard' | 'high' | 'ultra'
  includeAudio: boolean
}

export interface ExportProgress {
  phase: 'preparing' | 'video' | 'audio' | 'muxing' | 'done' | 'error'
  progress: number
  message: string
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
}

export const DEFAULT_COLOR_WHEEL: ColorWheel = { r: 0, g: 0, b: 0 }

export const DEFAULT_COLOR_GRADE: ColorGrade = {
  shadows: { ...DEFAULT_COLOR_WHEEL },
  midtones: { ...DEFAULT_COLOR_WHEEL },
  highlights: { ...DEFAULT_COLOR_WHEEL },
  hue: 0,
  vibrance: 0,
  lut: null,
  lutIntensity: 65,
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  grade: DEFAULT_COLOR_GRADE,
}

export const DEFAULT_MASK: Mask = {
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 0.62,
  height: 0.62,
  rotation: 0,
  feather: 0,
  invert: false,
  opacity: 1,
  points: [],
}

export const MARKER_COLORS = ['#22d3ee', '#a78bfa', '#ff5d73', '#f59e0b', '#34d399', '#f472b6'] as const

export const DEFAULT_TEXT: TextData = {
  content: 'Your text',
  fontFamily: 'Inter',
  fontSize: 84,
  fontWeight: 600,
  italic: false,
  underline: false,
  color: '#ffffff',
  gradient: null,
  backgroundColor: null,
  backgroundOpacity: 0.75,
  backgroundRadius: 18,
  paddingX: 28,
  paddingY: 16,
  align: 'center',
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 24,
  shadowOffsetY: 8,
  letterSpacing: 0,
  lineHeight: 1.2,
  maxWidth: 0.82,
}

export const TRACK_LABELS: Record<TrackKind, string> = {
  main: 'Video',
  overlay: 'Overlay',
  text: 'Text',
  sticker: 'Stickers',
  audio: 'Audio',
}
