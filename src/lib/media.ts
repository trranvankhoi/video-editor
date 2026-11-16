import type { Asset, AssetType, Clip } from './types'
import { clamp, uid } from './utils'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'ogv', 'mkv']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'opus']
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']

export const MEDIA_ACCEPT =
  'video/*,audio/*,image/*,.mp4,.mov,.webm,.m4v,.mp3,.wav,.m4a,.aac,.ogg,.flac,.png,.jpg,.jpeg,.webp,.gif,.svg'

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function getAssetType(file: File): AssetType | null {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  const ext = extensionOf(file.name)
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return null
}

let sharedAudioContext: AudioContext | null = null

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) sharedAudioContext = new AudioContext()
  return sharedAudioContext
}

const decodedAudioCache = new Map<string, AudioBuffer>()

export async function decodeAssetAudio(asset: Asset): Promise<AudioBuffer | null> {
  if (decodedAudioCache.has(asset.id)) return decodedAudioCache.get(asset.id) ?? null
  try {
    const response = await fetch(asset.url)
    const data = await response.arrayBuffer()
    const ctx = getSharedAudioContext()
    const buffer = await ctx.decodeAudioData(data)
    decodedAudioCache.set(asset.id, buffer)
    return buffer
  } catch {
    return null
  }
}

export function releaseAssetAudioCache(assetId: string) {
  decodedAudioCache.delete(assetId)
}

export function computeWaveform(buffer: AudioBuffer, buckets = 700): number[] {
  const channel = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(channel.length / buckets))
  const peaks: number[] = []
  let max = 0
  for (let i = 0; i < buckets; i++) {
    let peak = 0
    const start = i * step
    const end = Math.min(channel.length, start + step)
    for (let j = start; j < end; j += 1) {
      const value = Math.abs(channel[j])
      if (value > peak) peak = value
    }
    peaks.push(peak)
    if (peak > max) max = peak
  }
  if (max > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i] / max
  }
  return peaks
}

function waitForEvent(
  target: HTMLMediaElement | HTMLImageElement,
  event: string,
  timeout = 8000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    const cleanup = () => {
      target.removeEventListener(event, onEvent)
      target.removeEventListener('error', onError)
      clearTimeout(timer)
    }
    const onEvent = () => {
      if (done) return
      done = true
      cleanup()
      resolve()
    }
    const onError = () => {
      if (done) return
      done = true
      cleanup()
      reject(new Error('The browser could not decode this file. Try MP4 (H.264) or WebM.'))
    }
    const timer = setTimeout(() => {
      if (done) return
      done = true
      cleanup()
      reject(new Error('Timed out while loading media.'))
    }, timeout)
    target.addEventListener(event, onEvent, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(video.duration)) return
  const target = clamp(time, 0, Math.max(0, video.duration - 0.001))
  if (Math.abs(video.currentTime - target) < 1 / 240 && video.readyState >= 2) return
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', onSeeked)
      clearTimeout(timer)
      resolve()
    }
    const onSeeked = () => {
      if (video.readyState >= 2) finish()
      else video.addEventListener('canplay', finish, { once: true })
    }
    const timer = setTimeout(finish, 2000)
    video.addEventListener('seeked', onSeeked, { once: true })
    try {
      video.currentTime = target
    } catch {
      finish()
    }
  })
}

function frameToDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  width: number,
  height: number,
  quality = 0.72,
): string {
  const canvas = document.createElement('canvas')
  const ratio = width / height
  canvas.width = Math.max(2, Math.round(width))
  canvas.height = Math.max(2, Math.round(width / ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}

export async function extractVideoPoster(
  url: string,
  duration: number,
): Promise<{ thumbnail: string; filmstrip: string[]; width: number; height: number; hasAudio: boolean }> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await waitForEvent(video, 'loadeddata')
  } catch (error) {
    video.removeAttribute('src')
    video.load()
    throw error
  }
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  let hasAudio = true
  try {
    const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
    if (stream) hasAudio = stream.getAudioTracks().length > 0
    stream?.getTracks().forEach((track) => track.stop())
  } catch {
    hasAudio = true
  }

  const thumbTime = clamp(duration > 0 ? Math.min(duration * 0.15, 1.2) : 0, 0, Math.max(0, duration - 0.05))
  await seekVideo(video, thumbTime)
  const thumbnail = frameToDataUrl(video, 480, 270, 0.76)

  const filmstrip: string[] = []
  const count = 8
  if (duration > 0.2) {
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count
      await seekVideo(video, Math.min(t, duration - 0.03))
      filmstrip.push(frameToDataUrl(video, 160, 90, 0.55))
    }
  }
  video.pause()
  video.removeAttribute('src')
  video.load()
  return { thumbnail, filmstrip, width, height, hasAudio }
}

export interface ImportProgress {
  name: string
  index: number
  total: number
}

export async function createAssetFromFile(
  file: File,
  onProgress?: (info: ImportProgress) => void,
  index = 0,
  total = 1,
): Promise<Asset> {
  const type = getAssetType(file)
  if (!type) {
    throw new Error(`"${file.name}" is not a supported media file.`)
  }
  onProgress?.({ name: file.name, index, total })
  const url = URL.createObjectURL(file)
  const asset: Asset = {
    id: uid('ast'),
    name: file.name,
    type,
    mimeType: file.type || `${type}/${extensionOf(file.name)}`,
    size: file.size,
    duration: 0,
    width: 0,
    height: 0,
    hasAudio: type === 'audio',
    createdAt: Date.now(),
    url,
  }

  try {
    if (type === 'image') {
      const image = await loadImageElement(url)
      asset.width = image.naturalWidth
      asset.height = image.naturalHeight
      asset.duration = 0
      asset.thumbnail = frameToDataUrl(image, 480, 270, 0.78)
    } else if (type === 'video') {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      video.src = url
      await waitForEvent(video, 'loadedmetadata')
      asset.duration = Number.isFinite(video.duration) ? video.duration : 0
      asset.width = video.videoWidth
      asset.height = video.videoHeight
      video.removeAttribute('src')
      video.load()
      const poster = await extractVideoPoster(url, asset.duration)
      asset.thumbnail = poster.thumbnail
      asset.filmstrip = poster.filmstrip
      asset.hasAudio = poster.hasAudio
      if (asset.width === 0) asset.width = poster.width
      if (asset.height === 0) asset.height = poster.height
    } else {
      const buffer = await decodeAssetAudio(asset)
      if (!buffer) throw new Error(`Could not decode the audio in "${file.name}".`)
      asset.duration = buffer.duration
      asset.waveform = computeWaveform(buffer)
      asset.hasAudio = true
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }

  if (asset.duration === 0 && type !== 'image') {
    // Some browsers report Infinity for streaming containers; fall back to a usable default.
    asset.duration = 4
  }
  return asset
}

/* ------------------------------------------------------------------ */
/* Realtime preview media pool                                         */
/* ------------------------------------------------------------------ */

export interface MediaSyncItem {
  clipId: string
  asset: Asset
  sourceTime: number
  volume: number
  muted: boolean
  speed: number
  playing: boolean
}

let mediaHost: HTMLDivElement | null = null

function getMediaHost(): HTMLDivElement {
  if (!mediaHost) {
    mediaHost = document.createElement('div')
    mediaHost.className = 'clippro-media-host'
    mediaHost.setAttribute('aria-hidden', 'true')
    document.body.appendChild(mediaHost)
  }
  return mediaHost
}

interface PoolEntry {
  element: HTMLVideoElement | HTMLAudioElement
  assetId: string
  lastUsed: number
}

/**
 * Keeps HTMLMediaElements in sync with the timeline. Video frames are painted
 * onto the preview canvas; their audio is played natively by the browser.
 */
export class ClipMediaPool {
  private entries = new Map<string, PoolEntry>()
  private host: HTMLDivElement
  private lastPlaying = false

  constructor() {
    this.host = getMediaHost()
  }

  private createElement(asset: Asset): HTMLMediaElement {
    const el = document.createElement(asset.type === 'video' ? 'video' : 'audio') as
      | HTMLVideoElement
      | HTMLAudioElement
    el.preload = 'auto'
    el.volume = 0
    el.muted = true
    el.setAttribute('playsinline', '')
    if (el instanceof HTMLVideoElement) {
      el.playsInline = true
      el.disablePictureInPicture = true
    }
    this.host.appendChild(el)
    return el
  }

  getFrame(clipId: string): HTMLVideoElement | null {
    const entry = this.entries.get(clipId)
    if (!entry) return null
    const el = entry.element
    if (el instanceof HTMLVideoElement && el.readyState >= 2) return el
    return null
  }

  sync(items: MediaSyncItem[], playing: boolean, forceSeek = false) {
    const now = performance.now()
    const active = new Set<string>()
    for (const item of items) {
      active.add(item.clipId)
      let entry = this.entries.get(item.clipId)
      if (!entry || entry.assetId !== item.asset.id) {
        if (entry) this.destroyEntry(item.clipId)
        const element = this.createElement(item.asset)
        element.src = item.asset.url
        element.load()
        entry = { element, assetId: item.asset.id, lastUsed: now }
        this.entries.set(item.clipId, entry)
      }
      entry.lastUsed = now
      const el = entry.element
      const wantVolume = clamp(item.volume, 0, 1)
      const muted = item.muted || wantVolume <= 0.001
      if (el.volume !== wantVolume) el.volume = wantVolume
      if (el.muted !== muted) el.muted = muted
      const rate = clamp(item.speed, 0.0625, 16)
      if (el.playbackRate !== rate) el.playbackRate = rate
      const target = Math.max(0, item.sourceTime)
      const drift = Math.abs(el.currentTime - target)
      const seek = forceSeek || !playing || drift > (playing ? 0.32 : 0.04)
      if (seek && Number.isFinite(target)) {
        try {
          el.currentTime = target
        } catch {
          // Seek can throw before metadata is available; the next tick retries.
        }
      }
      if (playing && item.playing) {
        if (el.paused) void el.play().catch(() => undefined)
      } else if (!el.paused) {
        el.pause()
      }
    }

    for (const [clipId, entry] of this.entries) {
      if (active.has(clipId)) continue
      if (now - entry.lastUsed > 1200) this.destroyEntry(clipId)
      else if (!entry.element.paused) entry.element.pause()
    }
    this.lastPlaying = playing
  }

  private destroyEntry(clipId: string) {
    const entry = this.entries.get(clipId)
    if (!entry) return
    entry.element.pause()
    entry.element.removeAttribute('src')
    entry.element.load()
    entry.element.remove()
    this.entries.delete(clipId)
  }

  destroy() {
    for (const clipId of [...this.entries.keys()]) this.destroyEntry(clipId)
  }

  get isPlaying() {
    return this.lastPlaying
  }
}

/* ------------------------------------------------------------------ */
/* Export media pool (deterministic seek-based decoding)               */
/* ------------------------------------------------------------------ */

export class ExportMediaPool {
  private entries = new Map<string, { element: HTMLVideoElement; assetId: string }>()
  private host: HTMLDivElement

  constructor() {
    this.host = document.createElement('div')
    this.host.className = 'clippro-media-host clippro-export-host'
    this.host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(this.host)
  }

  private async getVideo(clipId: string, asset: Asset): Promise<HTMLVideoElement> {
    const existing = this.entries.get(clipId)
    if (existing && existing.assetId === asset.id) return existing.element
    if (existing) {
      existing.element.removeAttribute('src')
      existing.element.load()
      existing.element.remove()
      this.entries.delete(clipId)
    }
    const element = document.createElement('video')
    element.muted = true
    element.playsInline = true
    element.preload = 'auto'
    element.src = asset.url
    this.host.appendChild(element)
    await waitForEvent(element, 'loadeddata')
    this.entries.set(clipId, { element, assetId: asset.id })
    return element
  }

  async prepare(needs: Array<{ clipId: string; asset: Asset; time: number }>): Promise<void> {
    for (const need of needs) {
      const video = await this.getVideo(need.clipId, need.asset)
      await seekVideo(video, need.time)
    }
  }

  getFrame(clipId: string): HTMLVideoElement | null {
    const entry = this.entries.get(clipId)
    if (!entry) return null
    return entry.element.readyState >= 2 ? entry.element : null
  }

  destroy() {
    for (const entry of this.entries.values()) {
      entry.element.pause()
      entry.element.removeAttribute('src')
      entry.element.load()
      entry.element.remove()
    }
    this.entries.clear()
    this.host.remove()
  }
}

/* ------------------------------------------------------------------ */
/* Image cache                                                         */
/* ------------------------------------------------------------------ */

const imageCache = new Map<string, HTMLImageElement>()
const imagePromises = new Map<string, Promise<HTMLImageElement>>()

export function getCachedImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null
}

export function loadCachedImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return Promise.resolve(cached)
  const pending = imagePromises.get(src)
  if (pending) return pending
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      imageCache.set(src, image)
      imagePromises.delete(src)
      resolve(image)
    }
    image.onerror = () => {
      imagePromises.delete(src)
      reject(new Error('Could not load image'))
    }
    image.src = src
  })
  imagePromises.set(src, promise)
  return promise
}

export async function preloadImages(sources: string[]): Promise<void> {
  await Promise.allSettled(sources.map((src) => loadCachedImage(src)))
}

export async function preloadExportMedia(project: { tracks: Array<{ clips: Clip[] }> }, assets: Record<string, Asset>) {
  const sources = new Set<string>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === 'image' && 'assetId' in clip) {
        const asset = assets[clip.assetId]
        if (asset) sources.add(asset.url)
      }
      if (clip.kind === 'sticker') sources.add(clip.sticker.src)
    }
  }
  await preloadImages([...sources])
}
