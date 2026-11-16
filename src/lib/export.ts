import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer'
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer'
import { mixProjectAudio } from './audio'
import { EXPORT_HEIGHTS } from './constants'
import { ExportMediaPool, preloadExportMedia } from './media'
import { collectMediaNeeds, projectDuration } from './project'
import { ensureFonts, renderProject } from './render'
import type { Asset, ExportOptions, ExportProgress, Project } from './types'
import { clamp, safeFilename } from './utils'

export interface ExportFormat {
  id: 'mp4' | 'webm'
  label: string
  extension: string
  mimeType: string
  supported: boolean
  videoCodec: string | null
  videoMuxerCodec: 'avc' | 'vp9' | 'vp8' | null
  audioCodec: string | null
  audioMuxerCodec: 'aac' | 'opus' | null
  audioSupported: boolean
  note: string
}

let cachedFormats: ExportFormat[] | null = null

async function supportsVideo(codec: string, avc = false): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false
  try {
    const config: VideoEncoderConfig = {
      codec,
      width: 1280,
      height: 720,
      bitrate: 5_000_000,
      framerate: 30,
    }
    if (avc) config.avc = { format: 'avc' }
    const result = await VideoEncoder.isConfigSupported(config)
    return Boolean(result.supported)
  } catch {
    return false
  }
}

async function supportsAudio(codec: string, opus = false): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return false
  try {
    const config: AudioEncoderConfig = {
      codec,
      sampleRate: 48_000,
      numberOfChannels: 2,
      bitrate: 192_000,
    }
    if (opus) config.opus = { format: 'opus' }
    const result = await AudioEncoder.isConfigSupported(config)
    return Boolean(result.supported)
  } catch {
    return false
  }
}

export async function getExportFormats(force = false): Promise<ExportFormat[]> {
  if (cachedFormats && !force) return cachedFormats
  const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
  if (!hasWebCodecs) {
    cachedFormats = [
      {
        id: 'mp4',
        label: 'MP4 · H.264',
        extension: 'mp4',
        mimeType: 'video/mp4',
        supported: false,
        videoCodec: null,
        videoMuxerCodec: null,
        audioCodec: null,
        audioMuxerCodec: null,
        audioSupported: false,
        note: 'This browser does not support WebCodecs. Use a recent Chrome, Edge or Safari.',
      },
    ]
    return cachedFormats
  }

  let h264: string | null = null
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
    if (await supportsVideo(codec, true)) {
      h264 = codec
      break
    }
  }
  let vp9: string | null = null
  let vp8: string | null = null
  if (await supportsVideo('vp09.00.10.08')) vp9 = 'vp09.00.10.08'
  if (await supportsVideo('vp8')) vp8 = 'vp8'
  const aac = await supportsAudio('mp4a.40.2')
  const opus = await supportsAudio('opus', true)

  const formats: ExportFormat[] = [
    {
      id: 'mp4',
      label: 'MP4 · H.264',
      extension: 'mp4',
      mimeType: 'video/mp4',
      supported: Boolean(h264),
      videoCodec: h264,
      videoMuxerCodec: h264 ? 'avc' : null,
      audioCodec: aac ? 'mp4a.40.2' : null,
      audioMuxerCodec: aac ? 'aac' : null,
      audioSupported: aac,
      note: h264
        ? aac
          ? 'Best compatibility · H.264 video + AAC audio'
          : 'H.264 video supported · audio encoder unavailable in this browser'
        : 'H.264 encoding is not available in this browser',
    },
    {
      id: 'webm',
      label: 'WebM · VP9',
      extension: 'webm',
      mimeType: 'video/webm',
      supported: Boolean(vp9 || vp8),
      videoCodec: vp9 ?? vp8,
      videoMuxerCodec: vp9 ? 'vp9' : vp8 ? 'vp8' : null,
      audioCodec: opus ? 'opus' : null,
      audioMuxerCodec: opus ? 'opus' : null,
      audioSupported: opus,
      note: vp9 || vp8
        ? opus
          ? 'Open codec · VP9 video + Opus audio'
          : 'VP9 video supported · audio encoder unavailable'
        : 'VP9 encoding is not available in this browser',
    },
  ]
  cachedFormats = formats
  return formats
}

export function bitrateFor(width: number, height: number, fps: number, quality: ExportOptions['quality']) {
  const factor = quality === 'ultra' ? 0.2 : quality === 'high' ? 0.12 : 0.065
  return Math.min(45_000_000, Math.max(1_500_000, Math.round(width * height * fps * factor)))
}

export interface ExportResult {
  blob: Blob
  filename: string
  width: number
  height: number
  duration: number
  hasAudio: boolean
}

interface MuxerLike {
  addVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void
  addAudioChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void
  finalize: () => void
  target: { buffer?: ArrayBuffer }
}

function createMuxer(
  format: ExportFormat,
  width: number,
  height: number,
  fps: number,
  includeAudio: boolean,
  audioFormat: { codec: 'aac' | 'opus'; sampleRate: number; channels: number },
): MuxerLike {
  if (format.id === 'mp4') {
    const muxer = new Mp4Muxer({
      target: new Mp4Target(),
      video: {
        codec: 'avc',
        width,
        height,
        frameRate: fps,
      },
      audio: includeAudio
        ? {
            codec: audioFormat.codec,
            numberOfChannels: audioFormat.channels,
            sampleRate: audioFormat.sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    })
    return muxer as unknown as MuxerLike
  }
  const muxer = new WebmMuxer({
    target: new WebmTarget(),
    video: {
      codec: format.videoMuxerCodec === 'vp8' ? 'V_VP8' : 'V_VP9',
      width,
      height,
      frameRate: fps,
    },
    audio: includeAudio
      ? {
          codec: 'A_OPUS',
          numberOfChannels: audioFormat.channels,
          sampleRate: audioFormat.sampleRate,
        }
      : undefined,
    firstTimestampBehavior: 'offset',
  })
  return muxer as unknown as MuxerLike
}

async function waitForQueue(queueSize: () => number, limit: number, signal?: AbortSignal) {
  let guard = 0
  while (queueSize() > limit) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
    await new Promise((resolve) => setTimeout(resolve, 8))
    guard++
    if (guard > 4000) break
  }
}

async function encodeAudioTrack(
  buffer: AudioBuffer,
  format: ExportFormat,
  includeAudio: boolean,
  muxer: MuxerLike,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<boolean> {
  if (!includeAudio || !format.audioCodec || !format.audioMuxerCodec) return false
  if (typeof AudioEncoder === 'undefined') return false
  const config: AudioEncoderConfig = {
    codec: format.audioCodec,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    bitrate: 192_000,
  }
  if (format.audioMuxerCodec === 'opus') config.opus = { format: 'opus' }
  if (format.audioMuxerCodec === 'aac') config.aac = { format: 'aac' }
  try {
    const support = await AudioEncoder.isConfigSupported(config)
    if (!support.supported) return false
    const encoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: () => undefined,
    })
    encoder.configure(config)
    const channels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const chunkFrames = Math.round(sampleRate * 0.5)
    const total = buffer.length
    const channelData: Float32Array[] = []
    for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c))
    for (let start = 0; start < total; start += chunkFrames) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      const frames = Math.min(chunkFrames, total - start)
      const planar = new Float32Array(frames * channels)
      for (let c = 0; c < channels; c++) {
        planar.set(channelData[c].subarray(start, start + frames), c * frames)
      }
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: Math.round((start / sampleRate) * 1_000_000),
        data: planar,
      })
      encoder.encode(audioData)
      audioData.close()
      await waitForQueue(() => encoder.encodeQueueSize, 12, signal)
      onProgress?.(Math.min(1, (start + frames) / total))
    }
    await encoder.flush()
    encoder.close()
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return false
  }
}

export async function exportProject(
  project: Project,
  assets: Record<string, Asset>,
  options: ExportOptions,
  format: ExportFormat,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  if (!format.supported) throw new Error(format.note || 'This format is not supported.')
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs is not available. Please use a recent Chrome, Edge or Safari.')
  }
  const duration = projectDuration(project)
  if (duration < 0.05) throw new Error('Add at least one clip before exporting.')

  const width = Math.max(2, options.width)
  const height = Math.max(2, options.height)
  const fps = options.fps
  const totalFrames = Math.max(1, Math.round(duration * fps))
  onProgress({ phase: 'preparing', progress: 0.01, message: 'Loading fonts and media…' })
  await ensureFonts()
  await preloadExportMedia(project, assets)

  const wantsAudio =
    options.includeAudio &&
    format.audioSupported &&
    Object.values(assets).some((asset) => asset.hasAudio)

  onProgress({ phase: 'audio', progress: 0.03, message: 'Mixing the soundtrack…' })
  const audioBuffer = wantsAudio ? await mixProjectAudio(project, assets) : null
  const includeAudio = Boolean(audioBuffer && wantsAudio)

  const muxer = createMuxer(format, width, height, fps, includeAudio, {
    codec: format.audioMuxerCodec === 'opus' ? 'opus' : 'aac',
    sampleRate: 48_000,
    channels: 2,
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const pool = new ExportMediaPool()
  let actuallyHasAudio = false
  const errorState = { error: null as Error | null }

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      errorState.error = error
    },
  })
  try {
    const config: VideoEncoderConfig = {
      codec: format.videoCodec!,
      width,
      height,
      bitrate: bitrateFor(width, height, fps, options.quality),
      framerate: fps,
      latencyMode: 'quality',
    }
    if (format.videoMuxerCodec === 'avc') config.avc = { format: 'avc' }
    encoder.configure(config)
    const keyFrameInterval = Math.max(1, Math.round(fps * 2))

    const videoStart = performance.now()
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (errorState.error) throw errorState.error
      const time = Math.min(duration - 1e-4, frame / fps)
      const needs = collectMediaNeeds(project, time)
        .map((need) => {
          const asset = assets[need.assetId]
          if (!asset || asset.type !== 'video') return null
          return { clipId: need.clipId, asset, time: need.time }
        })
        .filter((need): need is { clipId: string; asset: Asset; time: number } => Boolean(need))
      await pool.prepare(needs)
      renderProject(canvas, project, time, {
        assets,
        getVideoFrame: (clipId) => pool.getFrame(clipId),
      })
      const videoFrame = new VideoFrame(canvas, {
        timestamp: Math.round((frame * 1_000_000) / fps),
        duration: Math.round(1_000_000 / fps),
      })
      encoder.encode(videoFrame, { keyFrame: frame % keyFrameInterval === 0 })
      videoFrame.close()
      await waitForQueue(() => encoder.encodeQueueSize, 6, signal)
      if (frame % 2 === 0 || frame === totalFrames - 1) {
        const elapsed = (performance.now() - videoStart) / 1000
        const rate = (frame + 1) / Math.max(0.001, elapsed)
        const eta = Math.max(0, (totalFrames - frame - 1) / Math.max(0.001, rate))
        onProgress({
          phase: 'video',
          progress: 0.04 + (frame / totalFrames) * 0.72,
          message: `Rendering frame ${frame + 1} / ${totalFrames}${eta > 1 ? ` · ~${Math.ceil(eta)}s left` : ''}`,
        })
      }
    }
    await encoder.flush()
    if (errorState.error) throw errorState.error

    if (audioBuffer && includeAudio) {
      onProgress({ phase: 'audio', progress: 0.8, message: 'Encoding audio…' })
      actuallyHasAudio = await encodeAudioTrack(
        audioBuffer,
        format,
        includeAudio,
        muxer,
        signal,
        (fraction) =>
          onProgress({
            phase: 'audio',
            progress: 0.8 + fraction * 0.11,
            message: 'Encoding audio…',
          }),
      )
    }

    onProgress({ phase: 'muxing', progress: 0.93, message: 'Finalising the file…' })
    muxer.finalize()
    const buffer = muxer.target.buffer
    if (!buffer) throw new Error('The encoder did not produce any data.')
    const blob = new Blob([buffer], { type: format.mimeType })
    onProgress({ phase: 'done', progress: 1, message: 'Export complete' })
    return {
      blob,
      filename: `${safeFilename(project.name)}.${format.extension}`,
      width,
      height,
      duration,
      hasAudio: actuallyHasAudio,
    }
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close()
    } catch {
      // Encoder is already closed.
    }
    pool.destroy()
  }
}

export function exportHeightOptions(project: Project) {
  return EXPORT_HEIGHTS.map((option) => {
    const ratio = project.width / project.height
    const width = ratio >= 1 ? Math.round(option.height * ratio) : option.height
    const height = ratio >= 1 ? option.height : Math.round(option.height / ratio)
    return {
      ...option,
      width: width + (width % 2),
      height: height + (height % 2),
      hint:
        ratio >= 1
          ? `${width} × ${height}`
          : `${width} × ${height}`,
    }
  })
}

export function estimateFileSize(
  project: Project,
  options: ExportOptions,
  fps: number,
): string {
  const duration = projectDuration(project)
  const bitrate = bitrateFor(options.width, options.height, fps, options.quality)
  const bytes = (bitrate / 8) * duration + (options.includeAudio ? 24_000 * duration : 0)
  return bytes > 1024 * 1024 * 1024
    ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    : `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`
}

export function defaultExportOptions(project: Project): ExportOptions {
  const ratio = project.width / project.height
  const height = clamp(project.height <= 1080 ? project.height : 1080, 480, 2160)
  return {
    width: Math.round(ratio >= 1 ? height * ratio : height),
    height: Math.round(ratio >= 1 ? height : height / ratio),
    fps: project.fps,
    format: 'mp4',
    quality: 'high',
    includeAudio: true,
  }
}
