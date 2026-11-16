/**
 * Optional CapCut Vietnamese TTS bridge.
 *
 * CapCut's speech endpoint is not callable from a browser: requests need native
 * signing headers and the audio CDN does not send CORS headers. The Vite
 * dev/preview server exposes a same-origin `/capcut` route
 * (`tools/capcutTtsPlugin.ts`) that runs the MIT-licensed
 * `K07VN/capcut-tts-api` Python SDK through `tools/capcut_tts_cli.py`. No
 * separate helper process is required. The package is never bundled with the
 * app.
 *
 * The catalogue below mirrors the 24 `vi-VN` records shipped in that package's
 * Voice.json. They are service voice ids, not downloadable model files.
 */

export interface CapcutVoice {
  /** CapCut voice_type, also used by the Python client. */
  id: string
  /** Human friendly Vietnamese name from Voice.json. */
  label: string
  resourceId: string
}

export const CAPCUT_VOICES: CapcutVoice[] = [
  { id: 'BV421_vivn_streaming', label: 'Nhỏ Ngọt Ngào', resourceId: '7252594014782755330' },
  { id: 'vi_female_huong', label: 'Giọng Nữ Phổ Thông', resourceId: '7264854897953083905' },
  { id: 'BV074_streaming_dsp', label: 'Giọng Bé', resourceId: '7550087831092251920' },
  { id: 'BV074_streaming', label: 'Cô Gái Hoạt Ngôn', resourceId: '7102355709945188865' },
  { id: 'vi-VN-HoaiMyNeural', label: 'Hoai My', resourceId: '7371666434650280464' },
  { id: 'vi-VN-NamMinhNeural', label: 'Nam Minh', resourceId: '7371666524727153168' },
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

export function capcutVoiceById(id: string): CapcutVoice {
  return CAPCUT_VOICES.find((voice) => voice.id === id) ?? CAPCUT_VOICES[0]
}

const envProxy = import.meta.env.VITE_CAPCUT_TTS_PROXY as string | undefined

/**
 * The Vite dev/preview server exposes the Python SDK at `/capcut`, so the
 * browser can use a same-origin URL. This works on localhost and behind
 * Cloud Shell/Codespaces tunnels, where `127.0.0.1` points at the viewer's
 * machine and HTTPS pages cannot call an HTTP helper.
 *
 * Set VITE_CAPCUT_TTS_PROXY (or the field in the Voice tab) to use the
 * standalone bridge URL instead.
 */
export const DEFAULT_CAPCUT_PROXY = envProxy?.trim() || '/capcut'

/** The historical standalone-helper URL, migrated to `/capcut` automatically. */
export const LEGACY_CAPCUT_PROXY = 'http://127.0.0.1:8765'

export function capcutProxyBase(proxyUrl: string): string {
  return (proxyUrl.trim() || DEFAULT_CAPCUT_PROXY).replace(/\/+$/, '')
}

export interface CapcutHealth {
  ok: boolean
  voices?: number
  version?: string
  mock?: boolean
}

/** Ask the Vite bridge whether it is running and can reach the catalogue. */
export async function checkCapcutProxy(proxyUrl: string, timeoutMs = 15000): Promise<CapcutHealth> {
  const base = capcutProxyBase(proxyUrl)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${base}/health`, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`The CapCut bridge answered HTTP ${response.status}.`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error(
        'The CapCut TTS bridge was not found at this URL. Restart "npm run dev" or check the bridge URL.',
      )
    }
    const data = (await response.json()) as CapcutHealth
    if (!data.ok) throw new Error('The CapCut bridge is not ready.')
    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'The CapCut TTS bridge did not respond. Restart "npm run dev" and check the bridge URL.',
      )
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Could not reach the CapCut TTS bridge. Restart "npm run dev" and check the bridge URL.',
      )
    }
    throw error instanceof Error ? error : new Error('Could not reach the CapCut TTS bridge.')
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Synthesize one Vietnamese segment through the Vite bridge. The bridge
 * returns the MP3 bytes itself, avoiding the CapCut CDN's missing CORS headers.
 */
export async function synthesizeCapcut(
  text: string,
  voiceId: string,
  proxyUrl: string,
  onProgress?: (message: string, ratio?: number) => void,
): Promise<Blob> {
  const clean = text.trim()
  if (!clean) throw new Error('There is no text to speak.')
  const voice = capcutVoiceById(voiceId)
  const base = capcutProxyBase(proxyUrl)

  onProgress?.('Sending text to CapCut…', 0.15)
  let response: Response
  try {
    response = await fetch(`${base}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        voice: voice.id,
        resource_id: voice.resourceId,
      }),
    })
  } catch {
    throw new Error(
      'Could not reach the CapCut TTS bridge. Restart "npm run dev", then retry.',
    )
  }

  if (!response.ok) {
    let message = `CapCut TTS failed (HTTP ${response.status}).`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) message = payload.error
    } catch {
      // The bridge may return plain text for unexpected errors.
    }
    throw new Error(message)
  }

  onProgress?.('Downloading the generated audio…', 0.8)
  const raw = await response.blob()
  if (raw.size < 512) {
    throw new Error('CapCut returned an empty audio file. Try another voice.')
  }
  const blob = raw.type ? raw : new Blob([raw], { type: 'audio/mpeg' })
  onProgress?.('Speech ready', 1)
  return blob
}
