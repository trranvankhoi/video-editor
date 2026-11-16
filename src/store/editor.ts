import { create } from 'zustand'
import { MAX_HISTORY } from '../lib/constants'
import type { FilterPreset, TextPreset } from '../lib/constants'
import { TEXT_PRESETS } from '../lib/constants'
import { analyzeCuts } from '../lib/contentAware'
import { saveProjectRecord } from '../lib/db'
import type {
  Asset,
  Clip,
  Easing,
  Keyframe,
  KeyframeProperty,
  Marker,
  Project,
  Track,
  TrackKind,
  TransitionType,
} from '../lib/types'
import { DEFAULT_TEXT } from '../lib/types'
import {
  clipEnd,
  cloneAdjustments,
  cloneClip,
  createMediaClip,
  createStickerClip,
  createTextClip,
  createTrack,
  defaultKeyframeValue,
  ensureTrack,
  findClip,
  insertTrack,
  nextMarkerColor,
  normalizeProject,
  projectDuration,
  resolveStart,
  sampleKeyframe,
  sortClips,
  sortMarkers,
} from '../lib/project'
import type { TemplateDef } from '../lib/templates'
import { clamp, round, uid } from '../lib/utils'
import type { StickerPreset } from '../lib/constants'
import { useUI } from './ui'

interface HistoryState {
  past: Project[]
  future: Project[]
  mergeKey: string | null
  mergeAt: number
}

export interface EditorState extends HistoryState {
  project: Project | null
  assets: Record<string, Asset>
  selectedClipId: string | null
  playhead: number
  playing: boolean
  playbackRate: number
  masterVolume: number
  snap: boolean
  zoom: number
  dirty: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: number | null
  clipboard: Clip | null

  loadProject: (project: Project, assets: Asset[]) => void
  closeProject: () => void
  addAssets: (assets: Asset[]) => void
  removeAsset: (assetId: string) => void
  addMediaAsset: (
    assetId: string,
    options?: { trackId?: string; start?: number },
  ) => string | null
  addText: (preset?: TextPreset, start?: number) => string | null
  addSticker: (sticker: StickerPreset, start?: number) => string | null
  applyTemplate: (template: TemplateDef) => void
  addCaptions: (cues: Array<{ start: number; end: number; text: string }>) => number
  addVoiceover: (items: Array<{ assetId: string; start: number; volume?: number }>) => number
  updateClip: (clipId: string, updater: (clip: Clip) => void, mergeKey?: string) => void
  removeClip: (clipId: string) => void
  removeSelected: () => void
  duplicateClip: (clipId?: string) => void
  splitAtPlayhead: () => void
  copySelected: () => void
  pasteClip: () => void
  moveClip: (
    clipId: string,
    targetTrackId: string,
    start: number,
    mergeKey?: string,
  ) => void
  trimClip: (
    clipId: string,
    edge: 'start' | 'end',
    time: number,
    mergeKey?: string,
  ) => void
  setSpeed: (clipId: string, speed: number) => void
  detachAudio: (clipId: string) => void
  setTransition: (clipId: string, type: import('../lib/types').TransitionType | null, duration?: number) => void
  addEffect: (clipId: string, effect: import('../lib/types').EffectId) => void
  updateEffect: (clipId: string, effect: import('../lib/types').EffectId, intensity: number) => void
  removeEffect: (clipId: string, effect: import('../lib/types').EffectId) => void
  applyFilterPreset: (clipId: string, preset: FilterPreset) => void
  resetAdjustments: (clipId: string) => void
  setKeyframe: (
    clipId: string,
    property: KeyframeProperty,
    time: number,
    value?: number,
    easing?: Easing,
  ) => void
  removeKeyframe: (clipId: string, keyframeId: string) => void
  updateKeyframe: (clipId: string, keyframeId: string, patch: Partial<Keyframe>) => void
  clearKeyframes: (clipId: string, property?: KeyframeProperty) => void
  toggleKeyframe: (clipId: string, property: KeyframeProperty) => void
  addMarker: (time?: number, label?: string, color?: string) => string | null
  removeMarker: (markerId: string) => void
  updateMarker: (markerId: string, patch: Partial<Omit<Marker, 'id'>>) => void
  rippleDelete: (clipId?: string) => void
  closeGaps: () => void
  mergeWithNext: (clipId?: string) => void
  deleteRange: (start: number, end: number) => void
  autoTransitions: (overwrite?: boolean) => Promise<number>
  updateProjectSettings: (patch: Partial<Pick<Project, 'name' | 'width' | 'height' | 'fps' | 'background'>>) => void
  addTrack: (kind: TrackKind) => string | null
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, patch: Partial<Pick<Track, 'muted' | 'hidden' | 'locked' | 'name'>>) => void
  selectClip: (clipId: string | null) => void
  setPlayhead: (time: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  setPlaybackRate: (rate: number) => void
  setMasterVolume: (volume: number) => void
  setSnap: (snap: boolean) => void
  setZoom: (zoom: number) => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  save: (thumbnail?: string) => Promise<void>
  setSaveState: (state: EditorState['saveState']) => void
  markSaved: () => void
}

function scaleTextStyle(style: Partial<typeof DEFAULT_TEXT>, factor: number): Partial<typeof DEFAULT_TEXT> {
  const scaled: Partial<typeof DEFAULT_TEXT> = { ...style }
  if (style.fontSize) scaled.fontSize = Math.round(style.fontSize * factor)
  if (style.paddingX) scaled.paddingX = Math.round(style.paddingX * factor)
  if (style.paddingY) scaled.paddingY = Math.round(style.paddingY * factor)
  if (style.backgroundRadius) scaled.backgroundRadius = Math.round(style.backgroundRadius * factor)
  if (style.strokeWidth) scaled.strokeWidth = round(style.strokeWidth * factor, 2)
  if (style.shadowBlur) scaled.shadowBlur = Math.round(style.shadowBlur * factor)
  if (style.shadowOffsetY) scaled.shadowOffsetY = Math.round(style.shadowOffsetY * factor)
  if (style.letterSpacing) scaled.letterSpacing = round(style.letterSpacing * factor, 2)
  return scaled
}

export const useEditor = create<EditorState>()((set, get) => {
  const mutate = (
    recipe: (project: Project) => void,
    mergeKey?: string,
    history = true,
  ): Project | null => {
    const state = get()
    if (!state.project) return null
    const previous = state.project
    const next = structuredClone(previous)
    recipe(next)
    next.updatedAt = Date.now()
    const now = Date.now()
    let past = state.past
    let future = state.future
    const canMerge =
      Boolean(mergeKey) &&
      state.mergeKey === mergeKey &&
      now - state.mergeAt < 1200
    if (history) {
      if (canMerge) {
        future = state.future
      } else {
        past = [...state.past, structuredClone(previous)].slice(-MAX_HISTORY)
        future = []
      }
    }
    set({
      project: next,
      past,
      future,
      dirty: true,
      saveState: 'idle',
      mergeKey: history ? (mergeKey ?? null) : state.mergeKey,
      mergeAt: history ? now : state.mergeAt,
    })
    return next
  }

  const selectedValid = (project: Project, id: string | null) =>
    id && findClip(project, id) ? id : null

  return {
    project: null,
    assets: {},
    selectedClipId: null,
    playhead: 0,
    playing: false,
    playbackRate: 1,
    masterVolume: 1,
    snap: true,
    zoom: 1,
    dirty: false,
    saveState: 'idle',
    lastSavedAt: null,
    clipboard: null,
    past: [],
    future: [],
    mergeKey: null,
    mergeAt: 0,

    loadProject: (project, assets) => {
      const current = get()
      if (current.project && current.project.id !== project.id) {
        Object.values(current.assets).forEach((asset) => {
          if (asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url)
        })
      }
      const normalized = normalizeProject(project)
      const map: Record<string, Asset> = {}
      for (const asset of assets) map[asset.id] = asset
      set({
        project: normalized,
        assets: map,
        selectedClipId: null,
        playhead: 0,
        playing: false,
        playbackRate: 1,
        dirty: false,
        saveState: 'saved',
        lastSavedAt: Date.now(),
        past: [],
        future: [],
        mergeKey: null,
        mergeAt: 0,
        clipboard: null,
        zoom: 1,
      })
    },

    closeProject: () => {
      const state = get()
      Object.values(state.assets).forEach((asset) => {
        if (asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url)
      })
      set({
        project: null,
        assets: {},
        selectedClipId: null,
        playhead: 0,
        playing: false,
        past: [],
        future: [],
        dirty: false,
        clipboard: null,
        mergeKey: null,
      })
    },

    addAssets: (newAssets) => {
      const state = get()
      if (!state.project || newAssets.length === 0) return
      const assets = { ...state.assets }
      for (const asset of newAssets) assets[asset.id] = asset
      const assetIds = [...new Set([...state.project.assetIds, ...newAssets.map((a) => a.id)])]
      set({
        assets,
        project: { ...state.project, assetIds, updatedAt: Date.now() },
        dirty: true,
        saveState: 'idle',
      })
    },

    removeAsset: (assetId) => {
      const state = get()
      if (!state.project) return
      mutate((project) => {
        for (const track of project.tracks) {
          track.clips = track.clips.filter((clip) => !('assetId' in clip) || clip.assetId !== assetId)
        }
        project.assetIds = project.assetIds.filter((id) => id !== assetId)
      })
      const asset = state.assets[assetId]
      if (asset?.url.startsWith('blob:')) URL.revokeObjectURL(asset.url)
      const assets = { ...get().assets }
      delete assets[assetId]
      const nextProject = get().project
      set({
        assets,
        selectedClipId: nextProject ? selectedValid(nextProject, get().selectedClipId) : null,
      })
    },

    addMediaAsset: (assetId, options = {}) => {
      const state = get()
      if (!state.project) return null
      const asset = state.assets[assetId]
      if (!asset) return null
      const clip = createMediaClip(asset, { start: options.start ?? state.playhead })
      const allowedKinds: TrackKind[] = asset.type === 'audio' ? ['audio'] : ['main', 'overlay']
      mutate((project) => {
        let target: Track | undefined
        if (options.trackId) {
          const requested = project.tracks.find((t) => t.id === options.trackId)
          if (requested && allowedKinds.includes(requested.kind) && !requested.locked) {
            target = requested
          }
        }
        if (!target) {
          target = project.tracks.find(
            (t) => allowedKinds.includes(t.kind) && !t.locked,
          )
        }
        if (!target) {
          target = ensureTrack(project, asset.type === 'audio' ? 'audio' : 'main')
        }
        clip.start = resolveStart(target, null, clip.start, clip.duration)
        target.clips.push(clip)
        sortClips(target)
      })
      const project = get().project
      if (project) {
        const start = findClip(project, clip.id)?.clip.start ?? clip.start
        set({ selectedClipId: clip.id, playhead: start })
      }
      return clip.id
    },

    addText: (preset, start) => {
      const state = get()
      if (!state.project) return null
      const factor = state.project.height / 1080
      const chosen = preset ?? TEXT_PRESETS[0]
      const style = scaleTextStyle({ ...DEFAULT_TEXT, ...chosen.style }, factor)
      const clip = createTextClip(style, {
        start: start ?? state.playhead,
        name: (chosen.style.content ?? style.content ?? 'Text').split('\n')[0],
      })
      clip.animationIn = { type: 'fade', duration: 0.4 }
      const id = clip.id
      mutate((project) => {
        const track = ensureTrack(project, 'text')
        clip.start = resolveStart(track, null, clip.start, clip.duration)
        track.clips.push(clip)
        sortClips(track)
      })
      set({ selectedClipId: id })
      useUI.getState().setLibraryTab('text')
      return id
    },

    addSticker: (sticker, start) => {
      const state = get()
      if (!state.project) return null
      const clip = createStickerClip(
        { src: sticker.src, label: sticker.label, size: 0.2 },
        { start: start ?? state.playhead },
      )
      const id = clip.id
      mutate((project) => {
        const track = ensureTrack(project, 'sticker')
        clip.start = resolveStart(track, null, clip.start, clip.duration)
        track.clips.push(clip)
        sortClips(track)
      })
      set({ selectedClipId: id })
      return id
    },

    applyTemplate: (template) => {
      const state = get()
      if (!state.project) return
      const { clips } = template.build(state.project)
      const ids: string[] = []
      mutate((project) => {
        for (const item of clips) {
          const track = ensureTrack(project, item.track)
          const clip = item.clip
          clip.start = resolveStart(track, null, clip.start, clip.duration)
          track.clips.push(clip)
          sortClips(track)
          ids.push(clip.id)
        }
      })
      set({
        selectedClipId: ids[0] ?? null,
        playhead: 0,
        zoom: 1,
      })
      useUI.getState().toast(`Added “${template.name}” to the timeline`, 'success')
    },

    addCaptions: (cues) => {
      const state = get()
      if (!state.project || cues.length === 0) return 0
      const factor = state.project.height / 1080
      const preset = TEXT_PRESETS.find((p) => p.id === 'caption') ?? TEXT_PRESETS[0]
      const style = scaleTextStyle({ ...DEFAULT_TEXT, ...preset.style }, factor)
      mutate((project) => {
        const track = ensureTrack(project, 'text')
        for (const cue of cues) {
          const duration = clamp(cue.end - cue.start, 0.3, 60)
          const clip = createTextClip(
            { ...style, content: cue.text, fontSize: Math.round(36 * factor) },
            { start: cue.start, duration, name: cue.text.slice(0, 40) },
          )
          clip.animationIn = { type: 'fade', duration: 0.2 }
          clip.transform.y = project.height * 0.32
          track.clips.push(clip)
        }
        sortClips(track)
      })
      return cues.length
    },

    addVoiceover: (items) => {
      const state = get()
      if (!state.project || items.length === 0) return 0
      const clipIds: string[] = []
      mutate((project) => {
        let track = project.tracks.find(
          (candidate) => candidate.kind === 'audio' && /voice\s*over/i.test(candidate.name),
        )
        if (!track) {
          const count = project.tracks.filter((candidate) => candidate.kind === 'audio').length + 1
          track = insertTrack(project, { ...createTrack('audio', count), name: 'Voiceover' })
        }
        for (const item of items) {
          const asset = state.assets[item.assetId]
          if (!asset || asset.type !== 'audio') continue
          const clip = createMediaClip(asset, { start: item.start })
          clip.start = resolveStart(track, null, item.start, clip.duration)
          clip.name = asset.name
          if (typeof item.volume === 'number') {
            clip.volume = Math.min(1, Math.max(0, item.volume))
          }
          track.clips.push(clip)
          clipIds.push(clip.id)
        }
        sortClips(track)
      })
      if (clipIds.length > 0) {
        const project = get().project
        const first = project ? findClip(project, clipIds[0])?.clip : null
        set({ selectedClipId: clipIds[0], playhead: first?.start ?? 0 })
      }
      return clipIds.length
    },

    updateClip: (clipId, updater, mergeKey) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        updater(found.clip)
        found.clip.duration = Math.max(0.05, found.clip.duration)
        found.clip.start = Math.max(0, found.clip.start)
        if (found.clip.transitionIn) {
          found.clip.transitionIn.duration = clamp(
            found.clip.transitionIn.duration,
            0.1,
            found.clip.duration,
          )
        }
      }, mergeKey)
    },

    removeClip: (clipId) => {
      mutate((project) => {
        for (const track of project.tracks) {
          const index = track.clips.findIndex((clip) => clip.id === clipId)
          if (index >= 0) {
            track.clips.splice(index, 1)
            return
          }
        }
      })
      const project = get().project
      set({
        selectedClipId: project ? selectedValid(project, get().selectedClipId) : null,
      })
    },

    removeSelected: () => {
      const id = get().selectedClipId
      if (!id) return
      get().removeClip(id)
    },

    duplicateClip: (clipId) => {
      const state = get()
      if (!state.project) return
      const id = clipId ?? state.selectedClipId
      if (!id) return
      const found = findClip(state.project, id)
      if (!found) return
      const copy = cloneClip(found.clip)
      const trackId = found.track.id
      const desired = found.clip.start + found.clip.duration
      mutate((project) => {
        const track = project.tracks.find((t) => t.id === trackId)
        if (!track) return
        copy.start = resolveStart(track, null, desired, copy.duration)
        track.clips.push(copy)
        sortClips(track)
      })
      set({ selectedClipId: copy.id })
    },

    splitAtPlayhead: () => {
      const state = get()
      if (!state.project) return
      const time = state.playhead
      const selected = state.selectedClipId
      let createdId: string | null = null
      let foundAny = false
      mutate((project) => {
        const splitOne = (track: Track, clip: Clip): boolean => {
          if (track.locked || track.hidden) return false
          if (time <= clip.start + 0.04 || time >= clip.start + clip.duration - 0.04) return false
          const leftDuration = time - clip.start
          const right = structuredClone(clip)
          right.id = uid('clip')
          right.start = time
          right.duration = clip.duration - leftDuration
          right.mediaStart = clip.mediaStart + leftDuration * clip.speed
          right.transitionIn = null
          right.animationIn = null
          right.fadeIn = 0
          clip.duration = leftDuration
          clip.animationOut = null
          clip.fadeOut = 0
          if (clip.transitionIn) {
            clip.transitionIn.duration = Math.min(clip.transitionIn.duration, clip.duration)
          }
          track.clips.push(right)
          sortClips(track)
          createdId = right.id
          return true
        }

        if (selected) {
          const found = findClip(project, selected)
          if (found && splitOne(found.track, found.clip)) {
            foundAny = true
          }
        } else {
          for (const track of project.tracks) {
            if (track.locked || track.hidden) continue
            const candidates = track.clips.filter(
              (clip) => time > clip.start + 0.04 && time < clip.start + clip.duration - 0.04,
            )
            for (const clip of candidates) {
              if (splitOne(track, clip)) foundAny = true
            }
          }
        }
      })
      if (!foundAny) {
        useUI.getState().toast('Move the playhead inside a clip to split it')
        return
      }
      set({ selectedClipId: createdId })
    },

    copySelected: () => {
      const state = get()
      if (!state.project || !state.selectedClipId) return
      const found = findClip(state.project, state.selectedClipId)
      if (!found) return
      set({ clipboard: structuredClone(found.clip) })
      useUI.getState().toast('Clip copied')
    },

    pasteClip: () => {
      const state = get()
      if (!state.project || !state.clipboard) return
      const clip = structuredClone(state.clipboard)
      clip.id = uid('clip')
      const kind = clip.kind
      const trackKind: TrackKind =
        kind === 'text' ? 'text' : kind === 'sticker' ? 'sticker' : kind === 'audio' ? 'audio' : 'main'
      mutate((project) => {
        const track = ensureTrack(project, trackKind)
        clip.start = resolveStart(track, null, state.playhead, clip.duration)
        track.clips.push(clip)
        sortClips(track)
      })
      set({ selectedClipId: clip.id, playhead: clip.start })
    },

    moveClip: (clipId, targetTrackId, start, mergeKey) => {
      const state = get()
      if (!state.project) return
      const found = findClip(state.project, clipId)
      if (!found) return
      if (found.track.locked) return
      const target = state.project.tracks.find((t) => t.id === targetTrackId)
      if (!target || target.locked) return
      const allowed =
        found.clip.kind === 'text'
          ? ['text']
          : found.clip.kind === 'sticker'
            ? ['sticker']
            : found.clip.kind === 'audio'
              ? ['audio']
              : ['main', 'overlay']
      if (!allowed.includes(target.kind)) return
      mutate((project) => {
        const source = findClip(project, clipId)
        if (!source) return
        const dest = project.tracks.find((t) => t.id === targetTrackId)
        if (!dest) return
        const nextStart = resolveStart(dest, source.clip.id, start, source.clip.duration)
        if (source.track.id === dest.id) {
          source.clip.start = round(nextStart, 4)
        } else {
          source.track.clips.splice(source.track.clips.indexOf(source.clip), 1)
          source.clip.start = round(nextStart, 4)
          dest.clips.push(source.clip)
          sortClips(dest)
        }
      }, mergeKey)
    },

    trimClip: (clipId, edge, time, mergeKey) => {
      const state = get()
      if (!state.project) return
      const found = findClip(state.project, clipId)
      if (!found || found.track.locked) return
      const clip = found.clip
      const track = found.track
      const asset = 'assetId' in clip ? state.assets[clip.assetId] : undefined
      const neighbors = track.clips.filter((c) => c.id !== clipId)
      if (edge === 'start') {
        const previousEnd = neighbors
          .filter((c) => c.start + c.duration <= clip.start + 0.01)
          .reduce((max, c) => Math.max(max, c.start + c.duration), 0)
        let minStart = previousEnd
        if (asset && asset.type !== 'image' && clip.kind !== 'text' && clip.kind !== 'sticker') {
          minStart = Math.max(minStart, clip.start - clip.mediaStart / clip.speed)
        }
        const maxStart = clip.start + clip.duration - 0.08
        const nextStart = clamp(time, Math.max(0, minStart), maxStart)
        const delta = nextStart - clip.start
        mutate((project) => {
          const target = findClip(project, clipId)
          if (!target) return
          if (target.clip.kind !== 'text' && target.clip.kind !== 'sticker' && target.clip.kind !== 'image') {
            target.clip.mediaStart = Math.max(0, target.clip.mediaStart + delta * target.clip.speed)
          }
          target.clip.start = round(nextStart, 4)
          target.clip.duration = round(target.clip.duration - delta, 4)
          target.clip.fadeIn = Math.min(target.clip.fadeIn, target.clip.duration)
          if (target.clip.transitionIn) {
            target.clip.transitionIn.duration = Math.min(
              target.clip.transitionIn.duration,
              target.clip.duration,
            )
          }
        }, mergeKey)
      } else {
        const nextStart = neighbors
          .filter((c) => c.start >= clip.start + clip.duration - 0.01)
          .reduce((min, c) => Math.min(min, c.start), Number.POSITIVE_INFINITY)
        let maxEnd = Math.min(nextStart, clip.start + 3600)
        if (asset && asset.type !== 'image' && clip.kind !== 'text' && clip.kind !== 'sticker') {
          const sourceRemaining = (asset.duration - clip.mediaStart) / clip.speed
          maxEnd = Math.min(maxEnd, clip.start + sourceRemaining)
        }
        const nextEnd = clamp(time, clip.start + 0.08, maxEnd)
        mutate((project) => {
          const target = findClip(project, clipId)
          if (!target) return
          target.clip.duration = round(nextEnd - target.clip.start, 4)
          target.clip.fadeOut = Math.min(target.clip.fadeOut, target.clip.duration)
        }, mergeKey)
      }
    },

    setSpeed: (clipId, speed) => {
      const state = get()
      if (!state.project) return
      const found = findClip(state.project, clipId)
      if (!found) return
      const nextSpeed = clamp(speed, 0.1, 8)
      const clip = found.clip
      const asset = 'assetId' in clip ? state.assets[clip.assetId] : undefined
      const sourceRange = clip.duration * clip.speed
      let newDuration = sourceRange / nextSpeed
      if (asset && asset.type !== 'image' && clip.kind !== 'text' && clip.kind !== 'sticker') {
        const available = (asset.duration - clip.mediaStart) / nextSpeed
        newDuration = Math.min(newDuration, available)
      }
      newDuration = Math.max(0.08, newDuration)
      let maxEnd = Number.POSITIVE_INFINITY
      for (const other of found.track.clips) {
        if (other.id === clipId) continue
        if (other.start >= clip.start + clip.duration - 0.01) {
          maxEnd = Math.min(maxEnd, other.start)
        }
      }
      newDuration = Math.min(newDuration, maxEnd - clip.start)
      newDuration = Math.max(0.08, newDuration)
      mutate((project) => {
        const target = findClip(project, clipId)
        if (!target) return
        target.clip.speed = round(nextSpeed, 3)
        target.clip.duration = round(newDuration, 4)
      }, `speed:${clipId}`)
    },

    detachAudio: (clipId) => {
      const state = get()
      if (!state.project) return
      const found = findClip(state.project, clipId)
      if (!found || !('assetId' in found.clip)) return
      const asset = state.assets[found.clip.assetId]
      if (!asset?.hasAudio || asset.type === 'audio') return
      const audio = cloneClip(found.clip, {
        kind: 'audio',
        name: `${found.clip.name} · audio`,
      }) as Clip
      if ('assetId' in audio) audio.detached = true
      audio.volume = found.clip.volume
      audio.transform = { ...found.clip.transform }
      mutate((project) => {
        const source = findClip(project, clipId)
        if (!source) return
        source.clip.muted = true
        let audioTrack = project.tracks.find((t) => t.kind === 'audio')
        if (!audioTrack) audioTrack = ensureTrack(project, 'audio')
        audio.start = source.clip.start
        audio.duration = source.clip.duration
        audio.mediaStart = source.clip.mediaStart
        audio.speed = source.clip.speed
        const occupied = audioTrack.clips.some(
          (c) => audio.start < c.start + c.duration && audio.start + audio.duration > c.start,
        )
        if (occupied) {
          const count = project.tracks.filter((t) => t.kind === 'audio').length + 1
          audioTrack = insertTrack(project, createTrack('audio', count))
        }
        audio.start = resolveStart(audioTrack, null, audio.start, audio.duration)
        audioTrack.clips.push(audio)
        sortClips(audioTrack)
      })
      useUI.getState().toast('Audio detached to its own track', 'success')
    },

    setTransition: (clipId, type, duration = 0.6) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        found.clip.transitionIn = type
          ? { type, duration: clamp(duration, 0.15, Math.min(2, found.clip.duration)) }
          : null
      }, `transition:${clipId}`)
    },

    addEffect: (clipId, effectId) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        if (!found.clip.effects.some((effect) => effect.id === effectId)) {
          found.clip.effects.push({ id: effectId, intensity: 55 })
        }
      })
    },

    updateEffect: (clipId, effectId, value) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        const effect = found.clip.effects.find((item) => item.id === effectId)
        if (effect) effect.intensity = clamp(value, 0, 100)
      }, `effect:${clipId}:${effectId}`)
    },

    removeEffect: (clipId, effectId) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        found.clip.effects = found.clip.effects.filter((effect) => effect.id !== effectId)
      })
    },

    applyFilterPreset: (clipId, preset) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        found.clip.adjustments = cloneAdjustments({ ...preset.adjustments })
      }, `filter:${clipId}`)
    },

    resetAdjustments: (clipId) => {
      mutate((project) => {
        const found = findClip(project, clipId)
        if (!found) return
        found.clip.adjustments = cloneAdjustments()
      })
    },

    setKeyframe: (clipId, property, time, value, easing = 'ease-in-out') => {
      get().updateClip(
        clipId,
        (clip) => {
          const local = clamp(time, 0, clip.duration)
          const existing = clip.keyframes.find(
            (keyframe) =>
              keyframe.property === property && Math.abs(keyframe.time - local) < 0.002,
          )
          const resolved =
            value ?? sampleKeyframe(clip, property, local) ?? defaultKeyframeValue(clip, property)
          if (existing) {
            existing.value = resolved
            existing.easing = easing
          } else {
            clip.keyframes.push({
              id: uid('kf'),
              property,
              time: local,
              value: resolved,
              easing,
            })
          }
        },
        `keyframe:${clipId}:${property}`,
      )
    },

    removeKeyframe: (clipId, keyframeId) => {
      get().updateClip(clipId, (clip) => {
        clip.keyframes = clip.keyframes.filter((keyframe) => keyframe.id !== keyframeId)
      })
    },

    updateKeyframe: (clipId, keyframeId, patch) => {
      get().updateClip(
        clipId,
        (clip) => {
          const keyframe = clip.keyframes.find((item) => item.id === keyframeId)
          if (!keyframe) return
          Object.assign(keyframe, patch)
          keyframe.id = keyframeId
          keyframe.time = clamp(keyframe.time, 0, clip.duration)
        },
        `keyframe:${clipId}:${keyframeId}`,
      )
    },

    clearKeyframes: (clipId, property) => {
      get().updateClip(clipId, (clip) => {
        clip.keyframes = property
          ? clip.keyframes.filter((keyframe) => keyframe.property !== property)
          : []
      })
    },

    toggleKeyframe: (clipId, property) => {
      const state = get()
      if (!state.project) return
      const found = findClip(state.project, clipId)
      if (!found) return
      const local = state.playhead - found.clip.start
      if (local < -0.01 || local > found.clip.duration + 0.01) {
        useUI.getState().toast('Move the playhead over the clip to add a keyframe')
        return
      }
      const tolerance = Math.max(0.02, 0.5 / state.project.fps)
      const existing = found.clip.keyframes.find(
        (keyframe) =>
          keyframe.property === property && Math.abs(keyframe.time - local) <= tolerance,
      )
      if (existing) {
        get().removeKeyframe(clipId, existing.id)
      } else {
        get().setKeyframe(clipId, property, local)
      }
    },

    addMarker: (time, label, color) => {
      const state = get()
      if (!state.project) return null
      const id = uid('mk')
      mutate((project) => {
        const position = clamp(time ?? state.playhead, 0, Math.max(0, projectDuration(project)))
        project.markers.push({
          id,
          time: position,
          label: label?.trim() || `Marker ${project.markers.length + 1}`,
          color: color ?? nextMarkerColor(project),
        })
        sortMarkers(project)
      })
      return id
    },

    removeMarker: (markerId) => {
      mutate((project) => {
        project.markers = project.markers.filter((marker) => marker.id !== markerId)
      })
    },

    updateMarker: (markerId, patch) => {
      mutate((project) => {
        const marker = project.markers.find((item) => item.id === markerId)
        if (!marker) return
        Object.assign(marker, patch)
        marker.id = markerId
        marker.time = Math.max(0, marker.time)
        sortMarkers(project)
      }, `marker:${markerId}`)
    },

    rippleDelete: (clipId) => {
      const id = clipId ?? get().selectedClipId
      if (!id) return
      mutate((project) => {
        for (const track of project.tracks) {
          const index = track.clips.findIndex((clip) => clip.id === id)
          if (index < 0) continue
          const removed = track.clips[index]
          track.clips.splice(index, 1)
          for (const clip of track.clips) {
            if (clip.start >= removed.start - 0.001) {
              clip.start = Math.max(0, clip.start - removed.duration)
            }
          }
          break
        }
      })
      set({ selectedClipId: null })
    },

    closeGaps: () => {
      mutate((project) => {
        for (const track of project.tracks) {
          sortClips(track)
          let cursor = 0
          for (const clip of track.clips) {
            if (clip.start > cursor + 0.001) clip.start = cursor
            cursor = clip.start + clip.duration
          }
        }
      })
      useUI.getState().toast('Closed gaps on every track', 'success')
    },

    mergeWithNext: (clipId) => {
      const id = clipId ?? get().selectedClipId
      if (!id) return
      let merged = false
      mutate((project) => {
        const found = findClip(project, id)
        if (!found) return
        sortClips(found.track)
        const index = found.track.clips.findIndex((clip) => clip.id === id)
        const next = found.track.clips[index + 1]
        if (!next) return
        const contiguous = Math.abs(clipEnd(found.clip) - next.start) < 0.05
        const sameMedia =
          'assetId' in found.clip &&
          'assetId' in next &&
          found.clip.assetId === next.assetId &&
          Math.abs(
            found.clip.mediaStart + found.clip.duration * found.clip.speed - next.mediaStart,
          ) < 0.08
        if (contiguous && sameMedia) {
          found.clip.duration += next.duration
          found.clip.keyframes = found.clip.keyframes.filter(
            (keyframe) => keyframe.time <= found.clip.duration,
          )
          found.track.clips.splice(index + 1, 1)
          merged = true
        }
      })
      useUI
        .getState()
        .toast(
          merged
            ? 'Clips merged into one continuous shot'
            : 'Only adjacent cuts from the same source can be merged',
          merged ? 'success' : 'default',
        )
    },

    deleteRange: (start, end) => {
      const from = Math.max(0, Math.min(start, end))
      const to = Math.max(start, end)
      const span = to - from
      if (span <= 0.001) return
      mutate((project) => {
        for (const track of project.tracks) {
          const kept: Clip[] = []
          for (const clip of track.clips) {
            const clipStart = clip.start
            const clipFinish = clip.start + clip.duration
            if (clipFinish <= from) {
              kept.push(clip)
            } else if (clipStart >= to) {
              clip.start -= span
              kept.push(clip)
            } else if (clipStart < from && clipFinish > to) {
              clip.duration = Math.max(0.05, clip.duration - span)
              kept.push(clip)
            } else if (clipStart < from) {
              clip.duration = Math.max(0.05, from - clipStart)
              kept.push(clip)
            } else if (clipFinish > to) {
              const consumed = to - clipStart
              if ('mediaStart' in clip) clip.mediaStart += consumed * clip.speed
              clip.start = from
              clip.duration = Math.max(0.05, clipFinish - to)
              clip.keyframes = clip.keyframes.filter(
                (keyframe) => keyframe.time >= consumed && keyframe.time <= consumed + clip.duration,
              ).map((keyframe) => ({ ...keyframe, time: keyframe.time - consumed }))
              kept.push(clip)
            }
          }
          track.clips = kept
        }
      })
      set({ selectedClipId: null })
      useUI.getState().toast(`Deleted ${span.toFixed(2)}s and closed the gap`, 'success')
    },

    autoTransitions: async (overwrite = false) => {
      const state = get()
      if (!state.project) return 0
      const project = state.project
      const cuts = await analyzeCuts(project, state.assets, {
        includeExisting: overwrite,
        visualOnly: true,
      })
      if (cuts.length === 0) return 0
      const applied: Array<{ clipId: string; type: TransitionType; duration: number }> = []
      mutate((draft) => {
        for (const cut of cuts) {
          const found = findClip(draft, cut.clipId)
          if (!found) continue
          found.clip.transitionIn = {
            type: cut.suggestion.type,
            duration: clamp(cut.suggestion.duration, 0.15, Math.min(2, found.clip.duration)),
          }
          applied.push({
            clipId: cut.clipId,
            type: cut.suggestion.type,
            duration: cut.suggestion.duration,
          })
        }
      })
      return applied.length
    },

    updateProjectSettings: (patch) => {
      mutate((project) => {
        Object.assign(project, patch)
        if (patch.name !== undefined) project.name = patch.name.slice(0, 80) || 'Untitled project'
        project.width = Math.max(64, Math.round(project.width / 2) * 2)
        project.height = Math.max(64, Math.round(project.height / 2) * 2)
        project.fps = clamp(Math.round(project.fps), 12, 120)
      }, 'settings')
    },

    addTrack: (kind) => {
      if (kind === 'main') {
        useUI.getState().toast('A project has one main video track. Add an overlay track instead.')
        return null
      }
      const track = createTrack(
        kind,
        get().project?.tracks.filter((t) => t.kind === kind).length
          ? get().project!.tracks.filter((t) => t.kind === kind).length + 1
          : 1,
      )
      mutate((project) => {
        insertTrack(project, track)
      })
      return track.id
    },

    removeTrack: (trackId) => {
      const state = get()
      if (!state.project) return
      const track = state.project.tracks.find((t) => t.id === trackId)
      if (!track) return
      if (track.kind === 'main') {
        useUI.getState().toast('The main track cannot be removed')
        return
      }
      mutate((project) => {
        project.tracks = project.tracks.filter((t) => t.id !== trackId)
      })
    },

    updateTrack: (trackId, patch) => {
      mutate((project) => {
        const track = project.tracks.find((t) => t.id === trackId)
        if (!track) return
        Object.assign(track, patch)
      }, `track:${trackId}:${Object.keys(patch).join(',')}`)
    },

    selectClip: (clipId) => {
      set({ selectedClipId: clipId })
    },

    setPlayhead: (time) => {
      const state = get()
      const duration = state.project ? projectDuration(state.project) : 0
      const next = clamp(time, 0, Math.max(duration, 0))
      set({ playhead: next })
    },

    play: () => {
      const state = get()
      if (!state.project) return
      const duration = projectDuration(state.project)
      if (duration <= 0.01) return
      if (state.playhead >= duration - 0.02) set({ playhead: 0 })
      set({ playing: true })
    },

    pause: () => set({ playing: false }),
    togglePlay: () => {
      if (get().playing) get().pause()
      else get().play()
    },
    setPlaying: (playing) => set({ playing }),
    setPlaybackRate: (rate) => set({ playbackRate: clamp(rate, 0.25, 4) }),
    setMasterVolume: (volume) => set({ masterVolume: clamp(volume, 0, 1) }),
    setSnap: (snap) => set({ snap }),
    setZoom: (zoom) => set({ zoom: clamp(zoom, 0.2, 8) }),
    endGesture: () => set({ mergeKey: null, mergeAt: 0 }),

    undo: () => {
      const state = get()
      if (state.past.length === 0 || !state.project) return
      const previous = state.past[state.past.length - 1]
      const project = state.project
      set({
        project: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, structuredClone(project)].slice(-MAX_HISTORY),
        playing: false,
        selectedClipId: selectedValid(previous, state.selectedClipId),
        playhead: Math.min(state.playhead, projectDuration(previous)),
        dirty: true,
        saveState: 'idle',
        mergeKey: null,
        mergeAt: 0,
      })
    },

    redo: () => {
      const state = get()
      if (state.future.length === 0 || !state.project) return
      const next = state.future[state.future.length - 1]
      const project = state.project
      set({
        project: next,
        future: state.future.slice(0, -1),
        past: [...state.past, structuredClone(project)].slice(-MAX_HISTORY),
        playing: false,
        selectedClipId: selectedValid(next, state.selectedClipId),
        playhead: Math.min(state.playhead, projectDuration(next)),
        dirty: true,
        saveState: 'idle',
        mergeKey: null,
        mergeAt: 0,
      })
    },

    save: async (thumbnail) => {
      const state = get()
      if (!state.project) return
      const projectToSave = state.project
      const version = projectToSave.updatedAt
      set({ saveState: 'saving' })
      try {
        await saveProjectRecord(projectToSave, thumbnail)
        const current = get()
        if (current.project?.id === projectToSave.id && current.project.updatedAt === version) {
          set({ saveState: 'saved', dirty: false, lastSavedAt: Date.now() })
        } else {
          set({ saveState: 'saved', lastSavedAt: Date.now() })
        }
      } catch (error) {
        console.error(error)
        set({ saveState: 'error' })
        useUI.getState().toast('Could not save the project locally. Storage may be full.', 'error')
      }
    },

    setSaveState: (saveState) => set({ saveState }),
    markSaved: () => set({ saveState: 'saved', dirty: false, lastSavedAt: Date.now() }),
  }
})
