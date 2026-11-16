import { mixProjectAudio, audioBufferToWav } from './audio'
import { projectDuration } from './project'
import type { CaptionCue } from './captions'
import { DEFAULT_STUDIO_BASE, transcribeStudio } from './studio'
import type { Asset, Project } from './types'
import { clamp } from './utils'

/**
 * Speech-to-text with three execution paths:
 *  - `local`: Transformers.js + Whisper running fully in the browser (WASM/WebGPU).
 *  - `openai` / `groq`: hosted Whisper endpoints, called directly from the browser.
 *  - `studio`: the Vietnamese AI Voice Studio HF Space (`/api/stt`).
 *
 * Keys are stored in localStorage and never leave the device except in the
 * request to the provider the user picked.
 */

export type AiProvider = 'local' | 'openai' | 'groq' | 'studio'

export interface AiSettings {
  provider: AiProvider
  apiKey: string
  model: string
  language: string
  studioBase: string
}

export type TranscribeProgress = (message: string, ratio?: number) => void

const STORAGE_KEY = 'clippro.ai.v1'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'local',
  apiKey: '',
  model: '',
  language: 'auto',
  studioBase: DEFAULT_STUDIO_BASE,
}

export const AI_PROVIDERS: Array<{
  id: AiProvider
  label: string
  hint: string
  model: string
  needsKey: boolean
}> = [
  {
    id: 'local',
    label: 'Local Whisper',
    hint: 'Runs in your browser with Transformers.js. First run downloads the model (~40 MB).',
    model: 'Xenova/whisper-tiny',
    needsKey: false,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'Sends the mixed project audio to api.openai.com. Requires an API key.',
    model: 'whisper-1',
    needsKey: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    hint: 'Fast hosted Whisper via api.groq.com. Requires an API key.',
    model: 'whisper-large-v3-turbo',
    needsKey: true,
  },
  {
    id: 'studio',
    label: 'AI Voice Studio · VN',
    hint: 'Vietnamese speech recognition through the AI Voice Studio HF Space. No key needed.',
    model: '',
    needsKey: false,
  },
]

export const AI_LANGUAGES: Array<{ id: string; label: string }> = [
  { id: 'auto', label: 'Auto detect' },
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Português' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'zh', label: '中文' },
  { id: 'hi', label: 'हिन्दी' },
]

export function defaultModelFor(provider: AiProvider): string {
  return AI_PROVIDERS.find((item) => item.id === provider)?.model ?? ''
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    const provider =
      parsed.provider === 'openai' ||
      parsed.provider === 'groq' ||
      parsed.provider === 'studio' ||
      parsed.provider === 'local'
        ? parsed.provider
        : 'local'
    return {
      provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model:
        typeof parsed.model === 'string' && parsed.model.trim()
          ? parsed.model.trim()
          : defaultModelFor(provider),
      language: typeof parsed.language === 'string' ? parsed.language : 'auto',
      studioBase:
        typeof parsed.studioBase === 'string' && parsed.studioBase.trim()
          ? parsed.studioBase.trim()
          : DEFAULT_STUDIO_BASE,
    }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private mode; transcription still works.
  }
}

export function hasProjectAudio(project: Project, assets: Record<string, Asset>): boolean {
  for (const track of project.tracks) {
    if (track.kind === 'text' || track.kind === 'sticker') continue
    for (const clip of track.clips) {
      if (!('assetId' in clip)) continue
      const asset = assets[clip.assetId]
      if (asset?.hasAudio) return true
    }
  }
  return false
}

export async function transcribeProject(
  project: Project,
  assets: Record<string, Asset>,
  settings: AiSettings,
  onProgress?: TranscribeProgress,
): Promise<CaptionCue[]> {
  if (projectDuration(project) <= 0.05) {
    throw new Error('Add some media to the timeline before generating captions.')
  }
  if (!hasProjectAudio(project, assets)) {
    throw new Error('No audio found. Add a video or audio clip with sound first.')
  }

  onProgress?.('Mixing project audio…', 0.02)
  const mixed = await mixProjectAudio(project, assets)
  if (!mixed || mixed.duration <= 0.05) {
    throw new Error('The project audio is empty. Check clip volumes and mute states.')
  }

  if (settings.provider === 'local') {
    return transcribeLocally(mixed, settings, onProgress)
  }
  if (settings.provider === 'studio') {
    return transcribeWithStudio(mixed, settings, onProgress)
  }
  return transcribeWithApi(mixed, settings, onProgress)
}

/* -------------------------------------------------------------------------- */
/* Local Whisper (Transformers.js)                                             */
/* -------------------------------------------------------------------------- */

const TRANSFORMERS_CDNS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3',
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
]

interface WhisperChunk {
  text: string
  timestamp?: [number | null, number | null] | null
}

interface WhisperOutput {
  text?: string
  chunks?: WhisperChunk[]
}

interface TransformersModule {
  env?: { allowLocalModels?: boolean; useBrowserCache?: boolean }
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<
    (
      audio: Float32Array,
      options?: Record<string, unknown>,
    ) => Promise<WhisperOutput | WhisperOutput[]>
  >
}

let transformersPromise: Promise<TransformersModule> | null = null
let localPipelinePromise: Promise<unknown> | null = null
let localPipelineModel = ''

async function loadTransformers(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = (async () => {
      const errors: string[] = []
      for (const url of TRANSFORMERS_CDNS) {
        try {
          const module = (await import(/* @vite-ignore */ url)) as TransformersModule
          if (typeof module.pipeline === 'function') {
            if (module.env) {
              module.env.allowLocalModels = false
              module.env.useBrowserCache = true
            }
            return module
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
        }
      }
      throw new Error(
        `Could not load Transformers.js from the CDN. Check your connection. ${errors.join(' · ')}`,
      )
    })().catch((error) => {
      transformersPromise = null
      throw error
    })
  }
  return transformersPromise
}

async function getLocalPipeline(model: string, onProgress?: TranscribeProgress) {
  if (localPipelinePromise && localPipelineModel === model) return localPipelinePromise
  localPipelineModel = model
  localPipelinePromise = (async () => {
    onProgress?.('Loading Whisper model…', 0.05)
    const module = await loadTransformers()
    return module.pipeline('automatic-speech-recognition', model, {
      quantized: true,
      progress_callback: (event: { status?: string; progress?: number; file?: string }) => {
        if (event.status === 'progress' && typeof event.progress === 'number') {
          onProgress?.(
            `Downloading ${event.file ?? 'model'}…`,
            0.05 + clamp(event.progress / 100, 0, 1) * 0.45,
          )
        }
      },
    })
  })().catch((error) => {
    localPipelinePromise = null
    throw error
  })
  return localPipelinePromise
}

async function transcribeLocally(
  buffer: AudioBuffer,
  settings: AiSettings,
  onProgress?: TranscribeProgress,
): Promise<CaptionCue[]> {
  const model = settings.model.trim() || defaultModelFor('local')
  const transcriber = (await getLocalPipeline(model, onProgress)) as (
    audio: Float32Array,
    options?: Record<string, unknown>,
  ) => Promise<WhisperOutput | WhisperOutput[]>

  onProgress?.('Preparing 16 kHz audio…', 0.52)
  const audio = resampleToMono(buffer, 16_000)

  onProgress?.('Transcribing speech…', 0.6)
  const options: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    task: 'transcribe',
  }
  if (settings.language !== 'auto') options.language = settings.language

  const result = await transcriber(audio, options)
  const output = Array.isArray(result) ? result[0] : result
  const cues = cuesFromWhisper(output, buffer.duration)
  if (cues.length === 0) {
    throw new Error('Whisper did not detect any speech in this project.')
  }
  onProgress?.('Captions ready', 1)
  return cues
}

function cuesFromWhisper(output: WhisperOutput, duration: number): CaptionCue[] {
  const chunks = output.chunks ?? []
  const cues: CaptionCue[] = []
  let cursor = 0
  for (const chunk of chunks) {
    const text = chunk.text?.trim()
    if (!text) continue
    const start = chunk.timestamp?.[0]
    const end = chunk.timestamp?.[1]
    const from = clamp(typeof start === 'number' ? start : cursor, 0, duration)
    const to = clamp(
      typeof end === 'number' ? end : Math.min(duration, from + Math.max(0.6, text.length * 0.06)),
      from + 0.2,
      duration,
    )
    cues.push({ start: from, end: to, text })
    cursor = to
  }
  if (cues.length === 0 && output.text?.trim()) {
    return splitIntoCues(output.text, 0, duration)
  }
  return cues
}

/* -------------------------------------------------------------------------- */
/* Hosted Whisper APIs                                                         */
/* -------------------------------------------------------------------------- */

interface ApiSegment {
  start?: number
  end?: number
  text?: string
}

async function transcribeWithApi(
  buffer: AudioBuffer,
  settings: AiSettings,
  onProgress?: TranscribeProgress,
): Promise<CaptionCue[]> {
  if (!settings.apiKey.trim()) {
    throw new Error('Add an API key in Settings → AI captions before using a hosted provider.')
  }
  const model = settings.model.trim() || defaultModelFor(settings.provider)
  const endpoint =
    settings.provider === 'groq'
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions'

  onProgress?.('Encoding WAV…', 0.1)
  const wav = audioBufferToWav(buffer)
  const form = new FormData()
  form.append('file', wav, 'project-audio.wav')
  form.append('model', model)
  form.append('response_format', 'verbose_json')
  if (settings.language !== 'auto') form.append('language', settings.language)

  onProgress?.('Uploading audio…', 0.25)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
      body: form,
    })
  } catch {
    throw new Error('Could not reach the provider. Check your connection or CORS settings.')
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const payload = (await response.json()) as { error?: { message?: string } }
      if (payload.error?.message) detail = payload.error.message
    } catch {
      // Response was not JSON.
    }
    throw new Error(`Transcription failed: ${detail}`)
  }

  onProgress?.('Reading transcript…', 0.8)
  const payload = (await response.json()) as {
    text?: string
    segments?: ApiSegment[]
  }
  const cues: CaptionCue[] = []
  for (const segment of payload.segments ?? []) {
    const text = segment.text?.trim()
    if (!text) continue
    const start = clamp(segment.start ?? 0, 0, buffer.duration)
    const end = clamp(segment.end ?? start + 1, start + 0.2, buffer.duration)
    cues.push({ start, end, text })
  }
  if (cues.length === 0 && payload.text?.trim()) {
    onProgress?.('Captions ready', 1)
    return splitIntoCues(payload.text, 0, buffer.duration)
  }
  if (cues.length === 0) {
    throw new Error('The provider returned an empty transcript.')
  }
  onProgress?.('Captions ready', 1)
  return cues
}

/* -------------------------------------------------------------------------- */
/* AI Voice Studio (Vietnamese STT)                                           */
/* -------------------------------------------------------------------------- */

async function transcribeWithStudio(
  buffer: AudioBuffer,
  settings: AiSettings,
  onProgress?: TranscribeProgress,
): Promise<CaptionCue[]> {
  onProgress?.('Encoding WAV…', 0.1)
  const wav = audioBufferToWav(buffer)
  return transcribeStudio(wav, settings.studioBase, buffer.duration, onProgress)
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function resampleToMono(buffer: AudioBuffer, targetRate: number): Float32Array {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const mono = new Float32Array(frames)
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < frames; i++) mono[i] += data[i] / channels
  }
  if (buffer.sampleRate === targetRate) return mono

  const ratio = buffer.sampleRate / targetRate
  const length = Math.max(1, Math.floor(frames / ratio))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const a = mono[index] ?? 0
    const b = mono[Math.min(frames - 1, index + 1)] ?? a
    out[i] = a * (1 - fraction) + b * fraction
  }
  return out
}

function splitIntoCues(text: string, from: number, to: number): CaptionCue[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean)
  const parts = sentences.length > 0 ? sentences : [text.trim()]
  const weights = parts.map((part) => Math.max(1, part.split(' ').length))
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  const span = Math.max(0.4, to - from)
  let cursor = from
  return parts.map((part) => {
    const weight = Math.max(1, part.split(' ').length)
    const duration = Math.max(0.5, (weight / total) * span)
    const start = cursor
    const end = Math.min(to, cursor + duration)
    cursor = end
    return { start, end, text: part }
  })
}
