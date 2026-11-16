import { projectDuration, sampleKeyframe } from './project'
import type { Asset, Clip, Project } from './types'
import { decodeAssetAudio } from './media'
import { clamp } from './utils'

const EXPORT_SAMPLE_RATE = 48_000

export async function mixProjectAudio(
  project: Project,
  assets: Record<string, Asset>,
): Promise<AudioBuffer | null> {
  const duration = projectDuration(project)
  if (duration <= 0.01) return null

  interface Job {
    clip: Clip
    asset: Asset
    start: number
    duration: number
    offset: number
    speed: number
    volume: number
    fadeIn: number
    fadeOut: number
    keyframedVolume: boolean
  }
  const jobs: Job[] = []

  for (const track of project.tracks) {
    if (track.muted || track.kind === 'text' || track.kind === 'sticker') continue
    for (const clip of track.clips) {
      if (!('assetId' in clip) || clip.muted) continue
      const asset = assets[clip.assetId]
      if (!asset || !asset.hasAudio) continue
      if (asset.type === 'image') continue
      const keyframedVolume = clip.keyframes.some(
        (keyframe) => keyframe.property === 'volume',
      )
      if (!keyframedVolume && clip.volume <= 0.001) continue
      jobs.push({
        clip,
        asset,
        start: clip.start,
        duration: clip.duration,
        offset: clip.mediaStart,
        speed: clip.speed,
        volume: clip.volume,
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        keyframedVolume,
      })
    }
  }
  if (jobs.length === 0) return null

  const buffers = new Map<string, AudioBuffer>()
  await Promise.all(
    [...new Set(jobs.map((job) => job.asset.id))].map(async (id) => {
      const asset = assets[id]
      if (!asset) return
      const buffer = await decodeAssetAudio(asset)
      if (buffer) buffers.set(id, buffer)
    }),
  )

  const usable = jobs.filter((job) => buffers.has(job.asset.id))
  if (usable.length === 0) return null

  const frames = Math.max(1, Math.ceil(duration * EXPORT_SAMPLE_RATE))
  const offline = new OfflineAudioContext(2, frames, EXPORT_SAMPLE_RATE)
  const master = offline.createGain()
  master.gain.value = 1
  const limiter = offline.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  master.connect(limiter)
  limiter.connect(offline.destination)

  for (const job of usable) {
    const buffer = buffers.get(job.asset.id)
    if (!buffer) continue
    const maxOffset = Math.max(0, buffer.duration - 0.02)
    const offset = clamp(job.offset, 0, maxOffset)
    const bufferSeconds = Math.min(
      job.duration * job.speed,
      Math.max(0, buffer.duration - offset),
    )
    if (bufferSeconds <= 0.01) continue
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = clamp(job.speed, 0.0625, 16)
    const gain = offline.createGain()
    const volume = clamp(job.volume, 0, 2)
    const when = Math.max(0, job.start)
    const wallEnd = Math.min(duration, job.start + job.duration)
    const playDuration = wallEnd - when
    if (playDuration <= 0.005) continue

    const baseLevel = job.keyframedVolume ? 1 : volume
    gain.gain.setValueAtTime(0, when)
    const fadeIn = Math.min(job.fadeIn, playDuration, 10)
    if (fadeIn > 0.005) {
      gain.gain.linearRampToValueAtTime(baseLevel, when + fadeIn)
    } else {
      gain.gain.setValueAtTime(baseLevel, when)
    }
    const fadeOut = Math.min(job.fadeOut, playDuration, 10)
    if (fadeOut > 0.005) {
      gain.gain.setValueAtTime(baseLevel, Math.max(when + fadeIn, wallEnd - fadeOut))
      gain.gain.linearRampToValueAtTime(0, wallEnd)
    }

    let envelope: GainNode | null = null
    if (job.keyframedVolume) {
      envelope = offline.createGain()
      const steps = Math.max(2, Math.ceil(playDuration * 30))
      const curve = new Float32Array(steps)
      for (let i = 0; i < steps; i++) {
        const local = (i / (steps - 1)) * playDuration
        const value = sampleKeyframe(job.clip, 'volume', local)
        curve[i] = clamp(value ?? job.volume, 0, 2)
      }
      envelope.gain.setValueCurveAtTime(curve, when, Math.max(0.001, playDuration))
    }

    source.connect(gain)
    if (envelope) {
      gain.connect(envelope)
      envelope.connect(master)
    } else {
      gain.connect(master)
    }
    try {
      source.start(when, offset, Math.min(bufferSeconds, playDuration * job.speed))
    } catch {
      // Ignore clips that cannot be scheduled (e.g. offset at EOF).
    }
  }

  try {
    return await offline.startRendering()
  } catch {
    return null
  }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels)
  const length = buffer.length * channels * 2 + 44
  const array = new ArrayBuffer(length)
  const view = new DataView(array)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + buffer.length * channels * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, buffer.length * channels * 2, true)
  let offset = 44
  const channelData: Float32Array[] = []
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c))
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = clamp(channelData[c][i], -1, 1)
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([array], { type: 'audio/wav' })
}
