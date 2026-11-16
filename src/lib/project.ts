import type {
  Adjustments,
  Animation,
  Asset,
  BaseClip,
  Clip,
  ClipKind,
  Easing,
  Keyframe,
  KeyframeProperty,
  MediaClip,
  MediaNeed,
  Project,
  StickerClip,
  StickerData,
  TextClip,
  TextData,
  Track,
  TrackKind,
  Transform,
} from './types'
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_COLOR_GRADE,
  DEFAULT_MASK,
  DEFAULT_TEXT,
  DEFAULT_TRANSFORM,
  MARKER_COLORS,
  TRACK_LABELS,
} from './types'
import { clamp, round, uid } from './utils'

export const TRACK_RANK: Record<TrackKind, number> = {
  main: 0,
  overlay: 1,
  text: 2,
  sticker: 3,
  audio: 4,
}

export const VISUAL_RANK: Record<TrackKind, number> = {
  main: 0,
  overlay: 1,
  sticker: 2,
  text: 3,
  audio: 4,
}

export function createProject(options: {
  name?: string
  width: number
  height: number
  fps: number
}): Project {
  const now = Date.now()
  return {
    id: uid('prj'),
    name: options.name?.trim() || 'Untitled project',
    width: options.width,
    height: options.height,
    fps: options.fps,
    background: '#000000',
    tracks: [createTrack('main', 1)],
    assetIds: [],
    markers: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createTrack(kind: TrackKind, index = 1): Track {
  return {
    id: uid('trk'),
    kind,
    name: `${TRACK_LABELS[kind]} ${index}`,
    muted: false,
    hidden: false,
    locked: false,
    clips: [],
  }
}

export function insertTrack(project: Project, track: Track): Track {
  const rank = TRACK_RANK[track.kind]
  let insertAt = project.tracks.length
  for (let i = 0; i < project.tracks.length; i++) {
    if (TRACK_RANK[project.tracks[i].kind] > rank) {
      insertAt = i
      break
    }
  }
  project.tracks.splice(insertAt, 0, track)
  return track
}

export function ensureTrack(project: Project, kind: TrackKind): Track {
  const existing = project.tracks.find((t) => t.kind === kind)
  if (existing) return existing
  const count = project.tracks.filter((t) => t.kind === kind).length + 1
  return insertTrack(project, createTrack(kind, count))
}

export function findClip(project: Project, clipId: string) {
  for (const track of project.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId)
    if (index >= 0) {
      return { track, clip: track.clips[index], index }
    }
  }
  return null
}

export function getAssetClips(project: Project, assetId: string): Clip[] {
  const out: Clip[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if ('assetId' in clip && clip.assetId === assetId) out.push(clip)
    }
  }
  return out
}

export function projectDuration(project: Project): number {
  let end = 0
  for (const track of project.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration)
  }
  return end
}

export function trackEnd(track: Track): number {
  return track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0)
}

export function visualTracks(project: Project): Track[] {
  return project.tracks
    .filter((t) => t.kind !== 'audio' && !t.hidden)
    .slice()
    .sort((a, b) => VISUAL_RANK[a.kind] - VISUAL_RANK[b.kind])
}

export function clipsAtTime(project: Project, time: number): Clip[] {
  const clips: Clip[] = []
  for (const track of visualTracks(project)) {
    for (const clip of track.clips) {
      if (time >= clip.start && time < clip.start + clip.duration) clips.push(clip)
    }
  }
  return clips
}

export function kindToTrack(kind: ClipKind): TrackKind {
  switch (kind) {
    case 'audio':
      return 'audio'
    case 'text':
      return 'text'
    case 'sticker':
      return 'sticker'
    default:
      return 'main'
  }
}

export function baseClipDefaults(kind: ClipKind, duration: number): BaseClip {
  return {
    id: uid('clip'),
    kind,
    name: 'Clip',
    start: 0,
    duration: round(duration),
    mediaStart: 0,
    speed: 1,
    volume: 1,
    muted: false,
    opacity: 1,
    transform: { ...DEFAULT_TRANSFORM },
    fit: 'contain',
    blend: 'normal',
    adjustments: cloneAdjustments(),
    effects: [],
    transitionIn: null,
    animationIn: null,
    animationOut: null,
    keyframes: [],
    mask: null,
    fadeIn: 0,
    fadeOut: 0,
    reversed: false,
  }
}

/**
 * Repairs projects persisted by older ClipPro builds. Missing optional data is
 * filled in place so the renderer can assume every field exists.
 */
export function normalizeProject(project: Project): Project {
  if (!Array.isArray(project.markers)) project.markers = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (!Array.isArray(clip.keyframes)) clip.keyframes = []
      if (clip.mask === undefined) clip.mask = null
      const adjustments = clip.adjustments as typeof clip.adjustments | undefined
      clip.adjustments = cloneAdjustments(adjustments)
    }
  }
  return project
}

export function createMask(shape: typeof DEFAULT_MASK.shape = 'rectangle'): typeof DEFAULT_MASK {
  return { ...DEFAULT_MASK, shape, points: [] }
}

/** Deep-clones adjustments so clips never share colour wheel objects. */
export function cloneAdjustments(adjustments: Partial<Adjustments> = DEFAULT_ADJUSTMENTS): Adjustments {
  const grade = adjustments.grade ?? DEFAULT_COLOR_GRADE
  return {
    ...DEFAULT_ADJUSTMENTS,
    ...adjustments,
    grade: {
      ...DEFAULT_COLOR_GRADE,
      ...grade,
      shadows: { ...DEFAULT_COLOR_GRADE.shadows, ...grade.shadows },
      midtones: { ...DEFAULT_COLOR_GRADE.midtones, ...grade.midtones },
      highlights: { ...DEFAULT_COLOR_GRADE.highlights, ...grade.highlights },
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Keyframes                                                                   */
/* -------------------------------------------------------------------------- */

export const KEYFRAME_PROPERTIES: Array<{
  id: KeyframeProperty
  label: string
  min: number
  max: number
  step: number
  unit?: string
}> = [
  { id: 'x', label: 'Position X', min: -4000, max: 4000, step: 1, unit: 'px' },
  { id: 'y', label: 'Position Y', min: -4000, max: 4000, step: 1, unit: 'px' },
  { id: 'scale', label: 'Scale', min: 0.02, max: 12, step: 0.01, unit: '×' },
  { id: 'rotation', label: 'Rotation', min: -720, max: 720, step: 0.5, unit: '°' },
  { id: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 },
  { id: 'volume', label: 'Volume', min: 0, max: 2, step: 0.01 },
  { id: 'maskX', label: 'Mask X', min: -1, max: 1, step: 0.01 },
  { id: 'maskY', label: 'Mask Y', min: -1, max: 1, step: 0.01 },
  { id: 'maskScale', label: 'Mask scale', min: 0.02, max: 4, step: 0.01, unit: '×' },
  { id: 'maskRotation', label: 'Mask rotation', min: -180, max: 180, step: 0.5, unit: '°' },
]

export const EASING_OPTIONS: Array<{ id: Easing; label: string }> = [
  { id: 'linear', label: 'Linear' },
  { id: 'ease-in', label: 'Ease in' },
  { id: 'ease-out', label: 'Ease out' },
  { id: 'ease-in-out', label: 'Ease in/out' },
  { id: 'back', label: 'Back' },
]

export function easingValue(easing: Easing, t: number): number {
  const p = clamp(t, 0, 1)
  switch (easing) {
    case 'ease-in':
      return p * p
    case 'ease-out':
      return 1 - (1 - p) * (1 - p)
    case 'ease-in-out':
      return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
    case 'back': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2
    }
    default:
      return p
  }
}

export function keyframesFor(clip: Clip, property: KeyframeProperty): Keyframe[] {
  return clip.keyframes
    .filter((keyframe) => keyframe.property === property)
    .sort((a, b) => a.time - b.time)
}

/**
 * Samples a keyframed property at a clip-local time. Returns `null` when the
 * property has no keyframes so callers can fall back to the static value.
 */
export function sampleKeyframe(
  clip: Clip,
  property: KeyframeProperty,
  local: number,
): number | null {
  const frames = keyframesFor(clip, property)
  if (frames.length === 0) return null
  if (frames.length === 1) return frames[0].value
  if (local <= frames[0].time) return frames[0].value
  const last = frames[frames.length - 1]
  if (local >= last.time) return last.value
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i]
    const b = frames[i + 1]
    if (local >= a.time && local <= b.time) {
      const span = Math.max(0.0001, b.time - a.time)
      const t = (local - a.time) / span
      return a.value + (b.value - a.value) * easingValue(b.easing, t)
    }
  }
  return last.value
}

export function defaultKeyframeValue(
  clip: Clip,
  property: KeyframeProperty,
): number {
  switch (property) {
    case 'x':
      return clip.transform.x
    case 'y':
      return clip.transform.y
    case 'scale':
      return clip.transform.scale
    case 'rotation':
      return clip.transform.rotation
    case 'opacity':
      return clip.opacity
    case 'volume':
      return clip.volume
    case 'maskX':
      return clip.mask?.x ?? 0
    case 'maskY':
      return clip.mask?.y ?? 0
    case 'maskScale':
      return 1
    case 'maskRotation':
      return clip.mask?.rotation ?? 0
    default:
      return 0
  }
}

export function nextMarkerColor(project: Project): string {
  const index = project.markers.length % MARKER_COLORS.length
  return MARKER_COLORS[index]
}

export function sortMarkers(project: Project) {
  project.markers.sort((a, b) => a.time - b.time)
}

export function createMediaClip(
  asset: Asset,
  options: { start?: number; trackKind?: TrackKind; duration?: number } = {},
): MediaClip {
  const kind: ClipKind =
    asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image'
  const sourceDuration = asset.duration > 0 ? asset.duration : 4
  const duration = options.duration ?? (asset.type === 'image' ? 4 : sourceDuration)
  const base = baseClipDefaults(kind, duration)
  const clip: MediaClip = {
    ...base,
    kind: kind as MediaClip['kind'],
    name: asset.name,
    start: options.start ?? 0,
    assetId: asset.id,
    mediaStart: 0,
    volume: kind === 'video' ? 0.9 : 1,
  }
  if (kind === 'video') clip.fit = 'contain'
  if (kind === 'image') clip.fit = 'contain'
  return clip
}

export function createTextClip(
  text: Partial<TextData> = {},
  options: { start?: number; duration?: number; name?: string } = {},
): TextClip {
  const duration = options.duration ?? 3
  const base = baseClipDefaults('text', duration)
  return {
    ...base,
    kind: 'text',
    name: options.name ?? (text.content?.split('\n')[0] || 'Text'),
    start: options.start ?? 0,
    text: { ...DEFAULT_TEXT, ...text },
    animationIn: { type: 'fade', duration: 0.35 },
  }
}

export function createStickerClip(
  sticker: StickerData,
  options: { start?: number; duration?: number } = {},
): StickerClip {
  const duration = options.duration ?? 3
  const base = baseClipDefaults('sticker', duration)
  return {
    ...base,
    kind: 'sticker',
    name: sticker.label,
    start: options.start ?? 0,
    sticker,
    animationIn: { type: 'pop', duration: 0.45 },
  }
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration
}

export function sourceTimeAt(clip: Clip, time: number): number {
  const local = Math.max(0, time - clip.start)
  return clip.mediaStart + local * clip.speed
}

export function sortClips(track: Track) {
  track.clips.sort((a, b) => a.start - b.start)
}

export function previousClip(track: Track, clip: Clip): Clip | null {
  let best: Clip | null = null
  for (const other of track.clips) {
    if (other.id === clip.id) continue
    if (other.start + other.duration <= clip.start + 1e-4) {
      if (!best || other.start > best.start) best = other
    }
  }
  return best
}

export function nextClip(track: Track, clip: Clip): Clip | null {
  let best: Clip | null = null
  for (const other of track.clips) {
    if (other.id === clip.id) continue
    if (other.start >= clip.start + clip.duration - 1e-4) {
      if (!best || other.start < best.start) best = other
    }
  }
  return best
}

/**
 * Clips whose frames must be decoded for a given timeline time, including the
 * outgoing clip of a crossfade transition.
 */
export function collectMediaNeeds(project: Project, time: number): MediaNeed[] {
  const needs = new Map<string, MediaNeed>()
  for (const track of visualTracks(project)) {
    if (track.kind === 'text' || track.kind === 'sticker') continue
    for (const clip of track.clips) {
      if (clip.kind !== 'video' && clip.kind !== 'image') continue
      if (!('assetId' in clip)) continue
      const end = clip.start + clip.duration
      if (time >= clip.start && time < end) {
        needs.set(clip.id, {
          clipId: clip.id,
          assetId: clip.assetId,
          time: sourceTimeAt(clip, time),
        })
      }
      const transition = clip.transitionIn
      if (
        transition &&
        time >= clip.start &&
        time < clip.start + transition.duration
      ) {
        const prev = previousClip(track, clip)
        if (prev && 'assetId' in prev) {
          needs.set(prev.id, {
            clipId: prev.id,
            assetId: prev.assetId,
            time: Math.max(prev.mediaStart, sourceTimeAt(prev, prev.start + prev.duration - 0.0001)),
          })
        }
      }
    }
  }
  return [...needs.values()]
}

export interface SnapPoint {
  time: number
  kind: 'clip' | 'playhead' | 'zero' | 'marker'
}

export function snapPoints(
  project: Project,
  playhead: number,
  excludeClipId?: string,
): SnapPoint[] {
  const points: SnapPoint[] = [
    { time: 0, kind: 'zero' },
    { time: playhead, kind: 'playhead' },
  ]
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue
      points.push({ time: clip.start, kind: 'clip' })
      points.push({ time: clip.start + clip.duration, kind: 'clip' })
    }
  }
  for (const marker of project.markers) {
    points.push({ time: marker.time, kind: 'marker' })
  }
  return points
}

export function snapTime(
  time: number,
  points: SnapPoint[],
  threshold: number,
): { time: number; snapped: SnapPoint | null } {
  let best: SnapPoint | null = null
  let delta = threshold
  for (const point of points) {
    const d = Math.abs(point.time - time)
    if (d <= delta) {
      delta = d
      best = point
    }
  }
  return { time: best ? best.time : time, snapped: best }
}

/** Resolve a clip start so clips on the same track never overlap. */
export function resolveStart(
  track: Track,
  clipId: string | null,
  desired: number,
  duration: number,
): number {
  const others = track.clips
    .filter((c) => c.id !== clipId)
    .slice()
    .sort((a, b) => a.start - b.start)
  let start = Math.max(0, desired)
  for (let pass = 0; pass < 3; pass++) {
    let collided = false
    for (const other of others) {
      const oStart = other.start
      const oEnd = other.start + other.duration
      if (start < oEnd - 1e-4 && start + duration > oStart + 1e-4) {
        const before = oStart - duration
        const after = oEnd
        if (before >= -1e-4 && (after > desired || Math.abs(desired - before) <= Math.abs(after - desired))) {
          start = Math.max(0, before)
        } else {
          start = after
        }
        collided = true
      }
    }
    if (!collided) break
  }
  return round(Math.max(0, start), 4)
}

export function nextFreeStart(track: Track, desired: number, duration: number): number {
  return resolveStart(track, null, desired, duration)
}

export function makeAnimation(type: Animation['type'], duration = 0.5): Animation {
  return { type, duration }
}

export function trackKindForClip(clip: Clip): TrackKind {
  return kindToTrack(clip.kind)
}

export function cloneClip(clip: Clip, overrides: Partial<BaseClip> = {}): Clip {
  return structuredClone({
    ...clip,
    ...overrides,
    id: uid('clip'),
    transform: { ...clip.transform },
  }) as Clip
}

export function applyTransformDefaults(): Transform {
  return { ...DEFAULT_TRANSFORM }
}

/** Even dimensions are required by most video encoders. */
export function evenDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2)
}

export function exportDimensions(
  project: Project,
  targetHeight: number,
): { width: number; height: number } {
  const ratio = project.width / project.height
  if (ratio >= 1) {
    return {
      width: evenDimension(targetHeight * ratio),
      height: evenDimension(targetHeight),
    }
  }
  return {
    width: evenDimension(targetHeight),
    height: evenDimension(targetHeight / ratio),
  }
}

export function clampClipVolume(clip: Clip) {
  clip.volume = clamp(clip.volume, 0, 2)
}
