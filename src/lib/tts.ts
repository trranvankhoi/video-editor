/**
 * Vietnamese text-to-speech.
 *
 * Four engines are exposed:
 *  - `piper`: Piper VITS voices running locally through onnxruntime-web. Models
 *    are downloaded once from Hugging Face and cached in the browser's origin
 *    private file system, so later renders work offline. Only the Vietnamese
 *    Piper voices are listed.
 *  - `capcut`: the 24 Vietnamese voices from K07VN/capcut-tts-api. A browser
 *    cannot call CapCut directly (request signing + CORS), so this engine talks
 *    to the same-origin `/capcut` route served by the Vite dev/preview server.
 *  - `studio`: the 22 Vietnamese voices from the AI Voice Studio HF Space. The
 *    Space returns a short-lived TikTok CDN URL, so the client downloads the MP3
 *    immediately.
 *  - `system`: the Web Speech API. It is instant and needs no download, but it
 *    uses voices installed by the operating system and cannot be recorded for
 *    export in every browser. Use it for quick previews.
 */

import { download, stored } from '@diffusionstudio/vits-web'
import {
  CAPCUT_VOICES,
  DEFAULT_CAPCUT_PROXY,
  LEGACY_CAPCUT_PROXY,
} from './capcutTts'
import { synthesizePiperVoice, waitForCachedVoice } from './piper'
import { DEFAULT_STUDIO_BASE, STUDIO_VOICES, studioVoiceById } from './studio'

export type TtsEngine = 'piper' | 'capcut' | 'studio' | 'system'

export interface PiperVoice {
  id: string
  label: string
  language: string
  languageLabel: string
  quality: 'x_low' | 'low' | 'medium' | 'high'
  /** Approximate ONNX model size in megabytes. */
  sizeMb: number
}

export interface TtsSettings {
  engine: TtsEngine
  piperVoice: string
  capcutVoice: string
  capcutProxy: string
  studioVoice: string
  studioBase: string
  systemVoice: string
  rate: number
  pitch: number
  volume: number
}

export type TtsProgress = (message: string, ratio?: number) => void

const STORAGE_KEY = 'clippro.tts.v1'

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  engine: 'piper',
  piperVoice: 'vi_VN-vais1000-medium',
  capcutVoice: CAPCUT_VOICES[0].id,
  capcutProxy: DEFAULT_CAPCUT_PROXY,
  studioVoice: STUDIO_VOICES[0].id,
  studioBase: DEFAULT_STUDIO_BASE,
  systemVoice: '',
  rate: 1,
  pitch: 1,
  volume: 1,
}

/**
 * Vietnamese Piper voices. The app intentionally hides the non-Vietnamese
 * models: the TTS panel is a Vietnamese narration tool. All three models come
 * from the MIT-licensed Piper project.
 */
export const PIPER_VOICES: PiperVoice[] = [
  {
    id: 'vi_VN-vais1000-medium',
    label: 'Vietnamese · VAIS 1000 (medium)',
    language: 'vi',
    languageLabel: 'Tiếng Việt',
    quality: 'medium',
    sizeMb: 63,
  },
  {
    id: 'vi_VN-25hours_single-low',
    label: 'Vietnamese · 25hours single (low)',
    language: 'vi',
    languageLabel: 'Tiếng Việt',
    quality: 'low',
    sizeMb: 63,
  },
  {
    id: 'vi_VN-vivos-x_low',
    label: 'Vietnamese · VIVOS 65 speakers (x-low)',
    language: 'vi',
    languageLabel: 'Tiếng Việt',
    quality: 'x_low',
    sizeMb: 28,
  },
]

export function loadTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TTS_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<TtsSettings>
    const piperVoice = PIPER_VOICES.some((voice) => voice.id === parsed.piperVoice)
      ? (parsed.piperVoice as string)
      : DEFAULT_TTS_SETTINGS.piperVoice
    const capcutVoice = CAPCUT_VOICES.some((voice) => voice.id === parsed.capcutVoice)
      ? (parsed.capcutVoice as string)
      : DEFAULT_TTS_SETTINGS.capcutVoice
    const engine: TtsEngine =
      parsed.engine === 'capcut' || parsed.engine === 'studio' || parsed.engine === 'system'
        ? parsed.engine
        : 'piper'
    const storedProxy =
      typeof parsed.capcutProxy === 'string' ? parsed.capcutProxy.trim() : ''
    // Older sessions stored the legacy loopback URL. The Vite middleware now
    // serves the same API at /capcut, so migrate it unless an env override is set.
    const capcutProxy =
      !storedProxy ||
      (storedProxy === LEGACY_CAPCUT_PROXY && DEFAULT_CAPCUT_PROXY !== LEGACY_CAPCUT_PROXY)
        ? DEFAULT_CAPCUT_PROXY
        : storedProxy
    // Keep a custom Studio voice id so a refreshed live catalogue survives a
    // reload, but fall back to the bundled catalogue when the value is empty.
    const studioVoice =
      typeof parsed.studioVoice === 'string' && parsed.studioVoice.trim()
        ? parsed.studioVoice.trim()
        : DEFAULT_TTS_SETTINGS.studioVoice
    const studioBase =
      typeof parsed.studioBase === 'string' && parsed.studioBase.trim()
        ? parsed.studioBase.trim()
        : DEFAULT_STUDIO_BASE
    return {
      engine,
      piperVoice,
      capcutVoice,
      capcutProxy,
      studioVoice,
      studioBase,
      systemVoice: typeof parsed.systemVoice === 'string' ? parsed.systemVoice : '',
      rate: clampNumber(parsed.rate, 0.5, 2, 1),
      pitch: clampNumber(parsed.pitch, 0, 2, 1),
      volume: clampNumber(parsed.volume, 0, 1, 1),
    }
  } catch {
    return { ...DEFAULT_TTS_SETTINGS }
  }
}

/** Human-readable engine/voice label for toasts and summaries. */
export function ttsVoiceLabel(settings: TtsSettings): string {
  if (settings.engine === 'capcut') {
    const voice = CAPCUT_VOICES.find((item) => item.id === settings.capcutVoice)
    return voice ? `${voice.label} (CapCut)` : 'CapCut Vietnamese voice'
  }
  if (settings.engine === 'studio') {
    const voice = studioVoiceById(settings.studioVoice)
    return `${voice.label} (AI Voice Studio)`
  }
  if (settings.engine === 'system') {
    return 'the system voice'
  }
  return piperVoiceById(settings.piperVoice).label
}

export function saveTtsSettings(settings: TtsSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private browsing can reject localStorage writes; settings stay in memory.
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

/* -------------------------------------------------------------------------- */
/* Script splitting                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Split a script into speakable segments. Blank lines are the primary
 * separator; very long single blocks are also broken at sentence boundaries so
 * the model does not receive a wall of text at once.
 */
export function splitScript(text: string, maxChars = 420): string[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
  const segments: string[] = []
  for (const block of blocks) {
    if (block.length <= maxChars) {
      segments.push(block)
      continue
    }
    const sentences = block.match(/[^.!?…]+[.!?…]*/g) ?? [block]
    let current = ''
    for (const sentence of sentences) {
      const piece = sentence.trim()
      if (!piece) continue
      if (current && current.length + piece.length + 1 > maxChars) {
        segments.push(current)
        current = piece
      } else {
        current = current ? `${current} ${piece}` : piece
      }
    }
    if (current) segments.push(current)
  }
  return segments
}

/* -------------------------------------------------------------------------- */
/* Piper (local, downloadable)                                                */
/* -------------------------------------------------------------------------- */

export function piperVoiceById(id: string): PiperVoice {
  return PIPER_VOICES.find((voice) => voice.id === id) ?? PIPER_VOICES[0]
}

/** True when the voice model is already cached in the browser. */
export async function isPiperVoiceStored(voiceId: string): Promise<boolean> {
  try {
    const ids = await stored()
    return ids.includes(voiceId as never)
  } catch {
    return false
  }
}

/** Download a voice into OPFS with progress reporting. */
export async function downloadPiperVoice(
  voiceId: string,
  onProgress?: TtsProgress,
): Promise<void> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) {
    throw new Error(
      'This browser cannot cache local voices. Try Chrome or Edge, or use the system voice preview.',
    )
  }
  const meta = piperVoiceById(voiceId)
  onProgress?.(`Downloading ${meta.label} · ${meta.sizeMb} MB`, 0)
  let lastRatio = 0
  await download(voiceId as never, (progress) => {
    const ratio = progress.total > 0 ? progress.loaded / progress.total : 0
    // The model is the large file; only let the ratio move forward.
    lastRatio = Math.max(lastRatio, Math.min(1, ratio))
    onProgress?.(`Downloading ${meta.label} · ${Math.round(lastRatio * 100)}%`, lastRatio)
  })
  onProgress?.('Finishing download…', 1)
  await waitForCachedVoice(voiceId)
  onProgress?.(`${meta.label} is ready`, 1)
}

/**
 * Synthesize one segment locally. The first call downloads the voice model;
 * subsequent calls reuse the OPFS cache. `rate` stretches the generated speech
 * without changing its pitch.
 */
export async function synthesizePiper(
  text: string,
  voiceId: string,
  onProgress?: TtsProgress,
  rate = 1,
): Promise<Blob> {
  const clean = text.trim()
  if (!clean) throw new Error('There is no text to speak.')
  const alreadyStored = await isPiperVoiceStored(voiceId)
  if (!alreadyStored) {
    await downloadPiperVoice(voiceId, onProgress)
  }
  onProgress?.('Synthesizing speech…', 1)
  try {
    const lengthScale = Math.min(2, Math.max(0.5, 1 / Math.max(0.5, Math.min(2, rate))))
    return await synthesizePiperVoice(clean, voiceId, { lengthScale })
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Local speech failed: ${error.message}`
        : 'Local speech failed. Try a smaller voice or the system preview.',
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Web Speech API preview                                                     */
/* -------------------------------------------------------------------------- */

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Resolve the list of voices installed on this device. */
export function loadSystemVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSynthesisSupported()) return Promise.resolve([])
  const synth = window.speechSynthesis
  const existing = synth.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      synth.removeEventListener('voiceschanged', finish)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 1200)
  })
}

export function systemVoiceById(
  voices: SpeechSynthesisVoice[],
  id: string,
): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => voice.voiceURI === id || voice.name === id)
}

/** Speak a preview through the operating system voice. */
export function previewSystemSpeech(
  text: string,
  settings: TtsSettings,
  voices: SpeechSynthesisVoice[],
): Promise<void> {
  if (!speechSynthesisSupported()) {
    return Promise.reject(new Error('This browser does not expose the Web Speech API.'))
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = systemVoiceById(voices, settings.systemVoice)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  }
  utterance.rate = clampNumber(settings.rate, 0.5, 2, 1)
  utterance.pitch = clampNumber(settings.pitch, 0, 2, 1)
  utterance.volume = clampNumber(settings.volume, 0, 1, 1)
  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve()
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') resolve()
      else reject(new Error(`System speech failed (${event.error}).`))
    }
    synth.speak(utterance)
  })
}

let activeAudio: HTMLAudioElement | null = null

export function stopSpeechPreview() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel()
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
}

/* -------------------------------------------------------------------------- */
/* Audio preview                                                              */
/* -------------------------------------------------------------------------- */

/** Play a generated WAV/MP3 blob and resolve when it finishes. */
export function playAudioBlob(blob: Blob, volume = 1): Promise<void> {
  stopSpeechPreview()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, volume))
  activeAudio = audio
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.onended = null
      audio.onerror = null
      URL.revokeObjectURL(url)
      if (activeAudio === audio) activeAudio = null
    }
    audio.onended = () => {
      cleanup()
      resolve()
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('The generated audio could not be played.'))
    }
    void audio.play().catch((error) => {
      cleanup()
      reject(error instanceof Error ? error : new Error('Playback was blocked.'))
    })
  })
}

/* -------------------------------------------------------------------------- */
/* Timeline narration helper                                                  */
/* -------------------------------------------------------------------------- */

export interface NarrationSegment {
  text: string
  /** Timeline seconds. `null` means "lay out sequentially from the playhead". */
  start: number | null
}

/** Build narration segments from text clips already on the timeline. */
export function narrationFromTextClips(
  clips: Array<{ start: number; text: string }>,
): NarrationSegment[] {
  return clips
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((clip) => ({ text: clip.text, start: clip.start }))
}

/**
 * Resolve sequential starts for custom scripts. Each segment starts after the
 * previous generated audio ends, with a small pause between paragraphs.
 */
export function sequentialStarts(
  durations: number[],
  from: number,
  gap = 0.18,
): number[] {
  const starts: number[] = []
  let cursor = from
  for (const duration of durations) {
    starts.push(cursor)
    cursor += Math.max(0.1, duration) + gap
  }
  return starts
}
