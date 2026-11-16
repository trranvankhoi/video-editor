/**
 * AI Voice Studio client (Vietnamese TTS + STT).
 *
 * The public Space at https://tony2k-ai-voice-studio.hf.space exposes:
 *  - `GET  /api/status`  → service health and loaded voice count
 *  - `GET  /api/voices`  → the full voice catalogue (127 voices, 22 vi-VN)
 *  - `POST /api/tts`     → `{ text, voice, rate }` → `{ speech_url }`
 *  - `POST /api/stt`     → multipart audio → `{ utterances: [...] }`
 *
 * TTS returns a signed TikTok CDN URL instead of audio bytes. Those URLs are
 * short lived, so the client downloads the MP3 immediately. The CDN sends
 * `Access-Control-Allow-Origin: *`, which makes the direct browser fetch work.
 *
 * The catalogue below mirrors the 22 `vi-VN` records returned by `/api/voices`.
 * `fetchStudioVoices()` refreshes it at runtime if the Space adds new voices.
 */

import type { CaptionCue } from './captions'
import { clamp } from './utils'

export interface StudioVoice {
  /** CapCut voice_type used by the API. */
  id: string
  /** Human friendly Vietnamese name. */
  label: string
  resourceId: string
}

export const STUDIO_VOICES: StudioVoice[] = [
  { id: 'BV421_vivn_streaming', label: 'Nhỏ Ngọt Ngào', resourceId: '7252594014782755330' },
  { id: 'vi_female_huong', label: 'Giọng Nữ Phổ Thông', resourceId: '7264854897953083905' },
  { id: 'BV074_streaming_dsp', label: 'Giọng Bé', resourceId: '7550087831092251920' },
  { id: 'BV074_streaming', label: 'Cô Gái Hoạt Ngôn', resourceId: '7102355709945188865' },
  { id: 'BV075_streaming_vibrato_dsp', label: 'Việt Méo', resourceId: '7569450639810465040' },
  { id: 'BV562_streaming', label: 'Mai', resourceId: '7483736254694035984' },
  {
    id: 'multi_female_yangguangnv_uranus_bigtts',
    label: 'Ban Mai',
    resourceId: '7637456432522218773',
  },
  {
    id: 'multi_female_richgirl_uranus_bigtts',
    label: 'Review Phim new',
    resourceId: '7637460351541447956',
  },
  {
    id: 'multi_female_quanweinv_uranus_bigtts',
    label: 'Bản Tin 1',
    resourceId: '7637458743197732117',
  },
  {
    id: 'multi_female_stokie_uranus_bigtts',
    label: 'Review Phim 4',
    resourceId: '7637456729696996628',
  },
  {
    id: 'multi_female_sisi_uranus_bigtts',
    label: 'Bản Tin nữ',
    resourceId: '7637455857285860629',
  },
  {
    id: 'multi_female_daqi_uranus_bigtts',
    label: 'Review Phim 3',
    resourceId: '7637451983389019409',
  },
  {
    id: 'multi_female_xyf04auto_uranus_bigtts',
    label: 'Review Phim 2',
    resourceId: '7637458743197732117',
  },
  {
    id: 'multi_female_kiwi_uranus_bigtts',
    label: 'Sunny Idol',
    resourceId: '7637457995882089749',
  },
  { id: 'BV075_streaming_demon_dsp', label: 'Kenny Đại Đế', resourceId: '7569442422665661712' },
  { id: 'BV075_streaming_robot_dsp', label: 'Robot VN', resourceId: '7538698409633516816' },
  {
    id: 'multi_male_felipe_uranus_bigtts',
    label: 'Giọng Nam Trầm',
    resourceId: '7637456729696996628',
  },
  {
    id: 'multi_female_peiqi_uranus_bigtts',
    label: 'Giọng Gái Mới Lớn',
    resourceId: '7637458789033151751',
  },
  {
    id: 'multi_female_xinwenjieshuo_uranus_bigtts',
    label: 'Nam bản tin',
    resourceId: '7637455039719640327',
  },
  {
    id: 'multi_female_tianmeijieshuo_uranus_bigtts',
    label: 'Quên Tên Tự Test',
    resourceId: '7637460417295469832',
  },
  { id: 'BV075_streaming', label: 'Thanh Niên Tự Tin', resourceId: '7102355803792740865' },
  { id: 'BV560_streaming', label: 'Alex Đại Đế', resourceId: '7483736167565758992' },
]

const envBase = import.meta.env.VITE_STUDIO_API_BASE as string | undefined

/**
 * Public Space by default. Set VITE_STUDIO_API_BASE (or the field in the Voice
 * tab) to use a local server, for example http://127.0.0.1:8000.
 */
export const DEFAULT_STUDIO_BASE = envBase?.trim() || 'https://tony2k-ai-voice-studio.hf.space'

export function studioBaseUrl(base: string): string {
  return (base.trim() || DEFAULT_STUDIO_BASE).replace(/\/+$/, '')
}

export function studioVoiceById(id: string, voices: StudioVoice[] = STUDIO_VOICES): StudioVoice {
  return voices.find((voice) => voice.id === id) ?? voices[0] ?? STUDIO_VOICES[0]
}

export interface StudioStatus {
  ok: boolean
  voicesLoaded: number
}

function studioNetworkError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('AI Voice Studio did not respond. The Space may be waking up; try again.')
  }
  if (error instanceof TypeError) {
    return new Error(
      'Could not reach AI Voice Studio. Check the base URL and your connection, then retry.',
    )
  }
  return error instanceof Error ? error : new Error('AI Voice Studio request failed.')
}

async function studioFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    throw studioNetworkError(error)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown; error?: unknown }
    const detail = payload.detail ?? payload.error
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string } | undefined
      if (first?.msg) return first.msg
    }
  } catch {
    // The Space can answer with plain text while it is starting up.
  }
  return fallback
}

/** Check that the Space is awake and can serve the API. */
export async function checkStudio(
  base: string,
  timeoutMs = 60_000,
): Promise<StudioStatus> {
  const url = `${studioBaseUrl(base)}/api/status`
  const response = await studioFetch(url, { headers: { Accept: 'application/json' } }, timeoutMs)
  if (!response.ok) {
    throw new Error(`AI Voice Studio answered HTTP ${response.status}.`)
  }
  const payload = (await response.json()) as {
    status?: string
    voices_loaded?: number
  }
  if (payload.status !== 'online') {
    throw new Error('AI Voice Studio is not online yet. Try again in a moment.')
  }
  return { ok: true, voicesLoaded: Number(payload.voices_loaded) || STUDIO_VOICES.length }
}

/** Refresh the live catalogue and keep only Vietnamese (`vi-VN`) voices. */
export async function fetchStudioVoices(
  base: string,
  timeoutMs = 60_000,
): Promise<StudioVoice[]> {
  const url = `${studioBaseUrl(base)}/api/voices`
  const response = await studioFetch(url, { headers: { Accept: 'application/json' } }, timeoutMs)
  if (!response.ok) {
    throw new Error(`AI Voice Studio answered HTTP ${response.status}.`)
  }
  const payload = (await response.json()) as Array<{
    lang?: string
    lan?: string
    voice_type?: string
    display_name?: string
    resource_id?: string
  }>
  if (!Array.isArray(payload)) {
    throw new Error('AI Voice Studio returned an unexpected voice catalogue.')
  }
  const seen = new Set<string>()
  const voices: StudioVoice[] = []
  for (const item of payload) {
    const isVietnamese = item.lang === 'vi-VN' || item.lan === 'vi'
    const id = item.voice_type?.trim()
    if (!isVietnamese || !id || seen.has(id)) continue
    seen.add(id)
    voices.push({
      id,
      label: item.display_name?.trim() || id,
      resourceId: item.resource_id?.trim() || '',
    })
  }
  if (voices.length === 0) {
    throw new Error('AI Voice Studio returned no Vietnamese voices.')
  }
  return voices
}

/** Synthesize one Vietnamese segment and download the resulting MP3. */
export async function synthesizeStudio(
  text: string,
  voiceId: string,
  base: string,
  rate = 1,
  onProgress?: (message: string, ratio?: number) => void,
): Promise<Blob> {
  const clean = text.trim()
  if (!clean) throw new Error('There is no text to speak.')
  const voice = studioVoiceById(voiceId)
  const root = studioBaseUrl(base)

  onProgress?.('Sending text to AI Voice Studio…', 0.15)
  const response = await studioFetch(
    `${root}/api/tts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        text: clean,
        voice: voice.id,
        rate: clamp(rate, 0.5, 2),
      }),
    },
    180_000,
  )

  if (!response.ok) {
    throw new Error(await readError(response, `AI Voice Studio TTS failed (HTTP ${response.status}).`))
  }
  const payload = (await response.json()) as {
    status?: string
    speech_url?: string
    display_name?: string
    detail?: string
  }
  if (payload.status !== 'success' || !payload.speech_url) {
    throw new Error(payload.detail || 'AI Voice Studio did not return a speech URL.')
  }

  onProgress?.('Downloading the generated audio…', 0.75)
  // The signed URL expires quickly, so fetch it right away and never cache it.
  const audioResponse = await studioFetch(payload.speech_url, { cache: 'no-store' }, 120_000)
  if (!audioResponse.ok) {
    throw new Error(
      `The generated audio link expired (HTTP ${audioResponse.status}). Try generating again.`,
    )
  }
  const raw = await audioResponse.blob()
  if (raw.size < 512) {
    throw new Error('AI Voice Studio returned an empty audio file. Try another voice.')
  }
  onProgress?.('Speech ready', 1)
  // The CDN labels MP3s as video/mp4; force the correct type for the editor.
  return new Blob([raw], { type: 'audio/mpeg' })
}

/* -------------------------------------------------------------------------- */
/* Speech to text                                                             */
/* -------------------------------------------------------------------------- */

export interface StudioUtterance {
  start_time?: number
  end_time?: number
  text?: string
}

export interface StudioSttResult {
  status?: string
  duration_ms?: number
  utterances?: StudioUtterance[]
  detail?: string
}

const MAX_CUE_CHARS = 88
const MAX_CUE_SECONDS = 6.5
const MERGE_GAP_SECONDS = 0.45

function cueFromUtterance(
  utterance: StudioUtterance,
  duration: number,
): { start: number; end: number; text: string } | null {
  const text = (utterance.text ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const start = clamp((utterance.start_time ?? 0) / 1000, 0, duration)
  const end = clamp(
    (utterance.end_time ?? (utterance.start_time ?? 0) + 1000) / 1000,
    start + 0.2,
    duration,
  )
  return { start, end, text }
}

/** Split a long Studio segment into proportional, readable caption cues. */
function splitLongCue(start: number, end: number, text: string): CaptionCue[] {
  if (text.length <= MAX_CUE_CHARS) return [{ start, end, text }]
  const words = text.split(' ')
  const chunks: string[] = []
  let current = ''
  for (const word of words) {
    if (current && current.length + word.length + 1 > MAX_CUE_CHARS) {
      chunks.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) chunks.push(current)
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1
  const span = Math.max(0.4, end - start)
  let cursor = start
  return chunks.map((chunk) => {
    const chunkEnd = Math.min(end, cursor + (chunk.length / total) * span)
    const cue = { start: cursor, end: Math.max(cursor + 0.2, chunkEnd), text: chunk }
    cursor = cue.end
    return cue
  })
}

/**
 * Studio returns short phrase segments ("Xin chào", "đây là kiểm tra"…).
 * Merge neighbours while the result stays readable, then split anything long.
 */
export function cuesFromStudioUtterances(
  utterances: StudioUtterance[],
  duration: number,
): CaptionCue[] {
  const cues: CaptionCue[] = []
  for (const utterance of utterances) {
    const cue = cueFromUtterance(utterance, duration)
    if (!cue) continue
    const previous = cues.at(-1)
    const endsSentence = previous ? /[.!?…]$/.test(previous.text) : false
    const canMerge =
      previous !== undefined &&
      !endsSentence &&
      cue.start - previous.end <= MERGE_GAP_SECONDS &&
      cue.end - previous.start <= MAX_CUE_SECONDS &&
      previous.text.length + cue.text.length + 1 <= MAX_CUE_CHARS
    if (canMerge && previous) {
      previous.text = `${previous.text} ${cue.text}`.replace(/\s+/g, ' ').trim()
      previous.end = cue.end
    } else {
      cues.push(...splitLongCue(cue.start, cue.end, cue.text))
    }
  }
  return cues
}

/** Transcribe an audio blob with the Space's Vietnamese STT endpoint. */
export async function transcribeStudio(
  audio: Blob,
  base: string,
  duration: number,
  onProgress?: (message: string, ratio?: number) => void,
): Promise<CaptionCue[]> {
  const root = studioBaseUrl(base)
  const form = new FormData()
  form.append('file', audio, 'project-audio.wav')
  form.append('language', 'vi-VN')
  form.append('translation_language', 'vi-VN')
  form.append('use_translation', 'false')

  onProgress?.('Uploading audio to AI Voice Studio…', 0.2)
  const response = await studioFetch(
    `${root}/api/stt`,
    { method: 'POST', body: form },
    300_000,
  )
  if (!response.ok) {
    throw new Error(await readError(response, `AI Voice Studio STT failed (HTTP ${response.status}).`))
  }

  onProgress?.('Reading transcript…', 0.8)
  const payload = (await response.json()) as StudioSttResult
  if (payload.status && payload.status !== 'success') {
    throw new Error(payload.detail || 'AI Voice Studio could not transcribe this audio.')
  }
  const utterances = payload.utterances ?? []
  const cues = cuesFromStudioUtterances(utterances, Math.max(0.1, duration))
  if (cues.length === 0) {
    throw new Error('AI Voice Studio did not detect any speech in this project.')
  }
  onProgress?.('Captions ready', 1)
  return cues
}
