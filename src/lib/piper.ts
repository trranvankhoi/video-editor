/**
 * Low-level Piper inference.
 *
 * `@diffusionstudio/vits-web` is great for downloading and caching voices, but
 * its `predict()` helper asks the bundled piper-phonemize WASM for phoneme ids
 * produced with Piper's *default* (English) id map. Voices whose model config
 * uses a different vocabulary (for example Vietnamese, which needs tone ids)
 * then fail with "indices element out of data bounds".
 *
 * The WASM phonemizer also returns the phoneme *symbols*. This module maps those
 * symbols through the selected voice's own `phoneme_id_map` and runs
 * onnxruntime-web directly, which is exactly what Piper's native CLI does.
 */

import * as ort from 'onnxruntime-web'
import createPiperPhonemize from '@diffusionstudio/piper-wasm/build/piper_phonemize.js'
import piperWasmUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm?url'
import piperDataUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.data?url'

interface PiperConfig {
  audio: { sample_rate: number }
  espeak: { voice: string }
  inference: {
    noise_scale: number
    length_scale: number
    noise_w: number
  }
  phoneme_id_map: Record<string, number[]>
  speaker_id_map?: Record<string, number>
  num_speakers?: number
}

interface PiperPhonemizerModule {
  callMain: (args: string[]) => void
}

interface PhonemizeOutput {
  phonemes?: string[]
  phoneme_ids?: number[]
}

const OPFS_DIR = 'piper'

async function readOpfsFile(name: string): Promise<File> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) {
    throw new Error(
      'This browser cannot read cached voices. Try Chrome or Edge, or use the system voice preview.',
    )
  }
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle(OPFS_DIR)
  const handle = await dir.getFileHandle(name)
  return handle.getFile()
}

async function readVoiceConfig(voiceId: string): Promise<PiperConfig> {
  const configFile = await readOpfsFile(`${voiceId}.onnx.json`)
  const config = JSON.parse(await configFile.text()) as PiperConfig
  if (!config.phoneme_id_map || !config.audio?.sample_rate) {
    throw new Error('The cached voice configuration is incomplete. Download the voice again.')
  }
  return config
}

async function readVoiceModel(voiceId: string): Promise<ArrayBuffer> {
  const modelFile = await readOpfsFile(`${voiceId}.onnx`)
  return modelFile.arrayBuffer()
}

/**
 * Run the piper-phonemize WASM module and return the phoneme symbols. A fresh
 * module is used per call because the Emscripten entry point exits after main.
 */
function phonemize(text: string, espeakVoice: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error: Error | null, phonemes?: string[]) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve(phonemes ?? [])
    }

    void createPiperPhonemize({
      noExitRuntime: true,
      print: (line: string) => {
        try {
          const data = JSON.parse(line) as PhonemizeOutput
          finish(null, data.phonemes ?? [])
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      },
      printErr: (message: string) => {
        finish(new Error(message))
      },
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) return piperWasmUrl
        if (file.endsWith('.data')) return piperDataUrl
        return file
      },
    })
      .then((module: PiperPhonemizerModule) => {
        module.callMain([
          '-l',
          espeakVoice,
          '--input',
          JSON.stringify([{ text }]),
          '--espeak_data',
          '/espeak-ng-data',
        ])
      })
      .catch((error: unknown) => {
        finish(error instanceof Error ? error : new Error(String(error)))
      })
  })
}

/**
 * Convert Piper phoneme symbols to model ids using the voice's own map, adding
 * BOS/EOS and the padding that Piper inserts between symbols. Sentence-final
 * punctuation starts a new BOS/EOS group, matching piper-phonemize.
 */
export function phonemesToIds(phonemes: string[], config: PiperConfig): number[] {
  const map = config.phoneme_id_map
  const pad = map['_']?.[0] ?? 0
  const bos = map['^']?.[0] ?? 1
  const eos = map['$']?.[0] ?? 2
  const ids: number[] = []
  let sentence: string[] = []
  let mapped = 0

  const flush = () => {
    if (sentence.length === 0) return
    ids.push(bos, pad)
    for (const phoneme of sentence) {
      const mappedIds = map[phoneme]
      if (!mappedIds) continue
      ids.push(...mappedIds, pad)
      mapped += 1
    }
    ids.push(eos)
    sentence = []
  }

  for (const phoneme of phonemes) {
    sentence.push(phoneme)
    if (phoneme === '.' || phoneme === '?' || phoneme === '!') flush()
  }
  flush()

  if (mapped === 0) {
    throw new Error(
      'This voice has no symbols in common with the text. Try the Vietnamese VAIS 1000 voice.',
    )
  }
  return ids
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const headerLength = 44
  const view = new DataView(new ArrayBuffer(samples.length * 2 + headerLength))
  view.setUint32(0, 0x46464952, true) // RIFF
  view.setUint32(4, view.buffer.byteLength - 8, true)
  view.setUint32(8, 0x45564157, true) // WAVE
  view.setUint32(12, 0x20746d66, true) // "fmt "
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  view.setUint32(36, 0x61746164, true) // "data"
  view.setUint32(40, samples.length * 2, true)
  let offset = headerLength
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i]
    const clamped = value >= 1 ? 32767 : value <= -1 ? -32768 : Math.round(value * 32768)
    view.setInt16(offset, clamped, true)
    offset += 2
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

const sessionCache = new Map<string, Promise<ort.InferenceSession>>()
const configCache = new Map<string, PiperConfig>()
const readyVoices = new Set<string>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * `vits-web`'s download helper resolves before its OPFS write necessarily
 * finishes (its internal write promise is not returned). Wait for a stable,
 * valid ONNX file before handing it to onnxruntime.
 */
export async function waitForCachedVoice(voiceId: string, timeoutMs = 180_000): Promise<void> {
  if (readyVoices.has(voiceId)) return
  const deadline = Date.now() + timeoutMs
  let lastSize = -1
  while (Date.now() < deadline) {
    try {
      const file = await readOpfsFile(`${voiceId}.onnx`)
      if (file.size > 1_000_000) {
        if (file.size === lastSize) {
          const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
          // ONNX ModelProto starts with field 1 (ir_version), tag 0x08.
          if (head[0] === 0x08) {
            readyVoices.add(voiceId)
            return
          }
        }
        lastSize = file.size
      }
    } catch {
      // The voice directory or file does not exist yet.
    }
    await sleep(250)
  }
  throw new Error('The voice download did not finish. Check your connection and try again.')
}

let wasmConfigured = false
function configureOrt() {
  if (wasmConfigured) return
  wasmConfigured = true
  // Single-threaded WASM works without cross-origin isolation and is plenty for
  // short narration segments. The matching file lives in public/ort/.
  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmPaths = '/ort/'
}

async function getSession(voiceId: string): Promise<ort.InferenceSession> {
  const existing = sessionCache.get(voiceId)
  if (existing) return existing
  const created = (async () => {
    const model = await readVoiceModel(voiceId)
    configureOrt()
    return ort.InferenceSession.create(model)
  })()
  sessionCache.set(voiceId, created)
  try {
    return await created
  } catch (error) {
    sessionCache.delete(voiceId)
    throw error
  }
}

async function getConfig(voiceId: string): Promise<PiperConfig> {
  const existing = configCache.get(voiceId)
  if (existing) return existing
  const config = await readVoiceConfig(voiceId)
  configCache.set(voiceId, config)
  return config
}

export interface PiperSynthesisOptions {
  /** Speaker index for multi-speaker voices (VIVOS, VCTK, ...). */
  speaker?: number
  /** Override the config's length scale (1 = normal, >1 = slower). */
  lengthScale?: number
}

/** Synthesize speech locally from a voice already cached in OPFS. */
export async function synthesizePiperVoice(
  text: string,
  voiceId: string,
  options: PiperSynthesisOptions = {},
): Promise<Blob> {
  const clean = text.trim()
  if (!clean) throw new Error('There is no text to speak.')

  await waitForCachedVoice(voiceId)
  const [config, session] = await Promise.all([getConfig(voiceId), getSession(voiceId)])
  const phonemes = await phonemize(clean, config.espeak.voice)
  const ids = phonemesToIds(phonemes, config)

  configureOrt()
  const speakerCount = config.num_speakers ?? 0
  const speaker = Math.max(0, Math.min(speakerCount > 0 ? speakerCount - 1 : 0, options.speaker ?? 0))
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map((id) => BigInt(id))), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
    scales: new ort.Tensor(
      'float32',
      Float32Array.from([
        config.inference.noise_scale,
        options.lengthScale ?? config.inference.length_scale,
        config.inference.noise_w,
      ]),
    ),
  }
  if (config.speaker_id_map && Object.keys(config.speaker_id_map).length > 0) {
    feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker)]))
  }

  const output = await session.run(feeds)
  const pcm = output.output?.data
  if (!(pcm instanceof Float32Array)) {
    throw new Error('The voice model returned an unexpected audio buffer.')
  }
  return encodeWav(pcm, config.audio.sample_rate)
}

/** Clear cached ONNX sessions (useful after deleting downloaded voices). */
export function clearPiperSessions() {
  sessionCache.clear()
  configCache.clear()
}
