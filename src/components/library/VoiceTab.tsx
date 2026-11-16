import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Play,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react'
import { LibraryLabel, TabHeader } from './common'
import { formatTime } from '../../lib/utils'
import { createAssetFromFile } from '../../lib/media'
import {
  CAPCUT_VOICES,
  capcutVoiceById,
  checkCapcutProxy,
  synthesizeCapcut,
  type CapcutHealth,
} from '../../lib/capcutTts'
import {
  STUDIO_VOICES,
  checkStudio,
  fetchStudioVoices,
  studioVoiceById,
  synthesizeStudio,
  type StudioVoice,
} from '../../lib/studio'
import {
  DEFAULT_TTS_SETTINGS,
  PIPER_VOICES,
  downloadPiperVoice,
  isPiperVoiceStored,
  loadSystemVoices,
  loadTtsSettings,
  narrationFromTextClips,
  piperVoiceById,
  playAudioBlob,
  previewSystemSpeech,
  saveTtsSettings,
  splitScript,
  stopSpeechPreview,
  synthesizePiper,
  ttsVoiceLabel,
  type NarrationSegment,
  type TtsSettings,
} from '../../lib/tts'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import type { Asset } from '../../lib/types'
import { IconButton, Slider } from '../ui'

const SAMPLE = `Xin chào! Đây là giọng đọc được tạo hoàn toàn trong trình duyệt.

Chọn một giọng, nghe thử, rồi thêm vào timeline. Mọi thứ chạy cục bộ, không cần tài khoản.`

interface TextClipInfo {
  id: string
  start: number
  text: string
}

export function VoiceTab() {
  const project = useEditor((state) => state.project)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const playhead = useEditor((state) => state.playhead)
  const addAssets = useEditor((state) => state.addAssets)
  const addVoiceover = useEditor((state) => state.addVoiceover)
  const toast = useUI((state) => state.toast)

  const [settings, setSettings] = useState<TtsSettings>(() => loadTtsSettings())
  const [source, setSource] = useState<'script' | 'timeline'>('script')
  const [script, setScript] = useState(SAMPLE)
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceStored, setVoiceStored] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<'preview' | 'generate' | 'download' | null>(null)
  const [progress, setProgress] = useState<{ message: string; ratio: number } | null>(null)
  const [capcutStatus, setCapcutStatus] = useState<'unknown' | 'checking' | 'online' | 'offline'>(
    'unknown',
  )
  const [capcutInfo, setCapcutInfo] = useState<CapcutHealth | null>(null)
  const [studioVoices, setStudioVoices] = useState<StudioVoice[]>(STUDIO_VOICES)
  const [studioStatus, setStudioStatus] = useState<
    'unknown' | 'checking' | 'online' | 'offline'
  >('unknown')
  const cancelRef = useRef(false)

  const piperVoice = piperVoiceById(settings.piperVoice)
  const capcutVoice = capcutVoiceById(settings.capcutVoice)
  const studioOptions = useMemo<StudioVoice[]>(() => {
    if (!settings.studioVoice || studioVoices.some((voice) => voice.id === settings.studioVoice)) {
      return studioVoices
    }
    // A voice from a refreshed live catalogue may not be in the bundled list yet.
    return [{ id: settings.studioVoice, label: settings.studioVoice, resourceId: '' }, ...studioVoices]
  }, [studioVoices, settings.studioVoice])
  const studioVoice = studioVoiceById(settings.studioVoice, studioOptions)
  const vietnameseSystemVoices = useMemo(
    () => systemVoices.filter((voice) => voice.lang.toLowerCase().startsWith('vi')),
    [systemVoices],
  )

  const patchSettings = (patch: Partial<TtsSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveTtsSettings(next)
      return next
    })
  }

  const textClips = useMemo<TextClipInfo[]>(() => {
    if (!project) return []
    const clips: TextClipInfo[] = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.kind === 'text' && clip.text.content.trim()) {
          clips.push({ id: clip.id, start: clip.start, text: clip.text.content.trim() })
        }
      }
    }
    return clips.sort((a, b) => a.start - b.start)
  }, [project])

  const selectedText = useMemo(
    () => textClips.find((clip) => clip.id === selectedClipId) ?? null,
    [textClips, selectedClipId],
  )

  const segments = useMemo<NarrationSegment[]>(() => {
    if (source === 'timeline') {
      return narrationFromTextClips(textClips.map((clip) => ({ start: clip.start, text: clip.text })))
    }
    return splitScript(script).map((text) => ({ text, start: null }))
  }, [source, script, textClips])

  const previewText =
    source === 'timeline' ? (segments[0]?.text ?? '') : script.trim()

  useEffect(() => {
    let active = true
    void loadSystemVoices().then((voices) => {
      if (active) setSystemVoices(voices)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (vietnameseSystemVoices.length === 0) return
    if (
      settings.systemVoice &&
      vietnameseSystemVoices.some((voice) => voice.voiceURI === settings.systemVoice)
    ) {
      return
    }
    const preferred = vietnameseSystemVoices[0]
    if (preferred) patchSettings({ systemVoice: preferred.voiceURI })
    // patchSettings is stable enough for this one-time default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vietnameseSystemVoices, settings.systemVoice])

  useEffect(() => {
    let active = true
    setVoiceStored(null)
    void isPiperVoiceStored(settings.piperVoice).then((stored) => {
      if (active) setVoiceStored(stored)
    })
    return () => {
      active = false
    }
  }, [settings.piperVoice])

  useEffect(() => () => stopSpeechPreview(), [])

  const preview = async () => {
    if (!previewText) {
      toast('Add some text to speak first.', 'error')
      return
    }
    stopSpeechPreview()
    setBusy('preview')
    setProgress({ message: 'Preparing preview…', ratio: 0 })
    try {
      if (settings.engine === 'system') {
        if (vietnameseSystemVoices.length === 0) {
          throw new Error('No Vietnamese system voices were found. Use Piper or CapCut instead.')
        }
        setProgress({ message: 'Speaking with the system voice…', ratio: 1 })
        await previewSystemSpeech(previewText, settings, vietnameseSystemVoices)
      } else if (settings.engine === 'capcut') {
        const blob = await synthesizeCapcut(
          previewText,
          settings.capcutVoice,
          settings.capcutProxy,
          (message, ratio) => {
            setProgress({ message, ratio: ratio ?? 0 })
          },
        )
        setProgress({ message: 'Playing preview…', ratio: 1 })
        await playAudioBlob(blob, settings.volume)
      } else if (settings.engine === 'studio') {
        const blob = await synthesizeStudio(
          previewText,
          settings.studioVoice,
          settings.studioBase,
          settings.rate,
          (message, ratio) => {
            setProgress({ message, ratio: ratio ?? 0 })
          },
        )
        setProgress({ message: 'Playing preview…', ratio: 1 })
        await playAudioBlob(blob, settings.volume)
      } else {
        const blob = await synthesizePiper(
          previewText,
          settings.piperVoice,
          (message, ratio) => {
            setProgress({ message, ratio: ratio ?? 0 })
          },
          settings.rate,
        )
        setProgress({ message: 'Playing preview…', ratio: 1 })
        await playAudioBlob(blob, settings.volume)
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not preview this voice.', 'error')
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const downloadVoice = async () => {
    setBusy('download')
    setProgress({ message: 'Preparing download…', ratio: 0 })
    try {
      await downloadPiperVoice(settings.piperVoice, (message, ratio) => {
        setProgress({ message, ratio: ratio ?? 0 })
      })
      setVoiceStored(true)
      toast(`${piperVoice.label} is cached and ready offline`, 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not download this voice.', 'error')
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const testProxy = async () => {
    setCapcutStatus('checking')
    try {
      const info = await checkCapcutProxy(settings.capcutProxy)
      setCapcutInfo(info)
      setCapcutStatus('online')
      toast(
        `CapCut bridge connected · ${info.voices ?? CAPCUT_VOICES.length} Vietnamese voices`,
        'success',
      )
    } catch (error) {
      setCapcutInfo(null)
      setCapcutStatus('offline')
      toast(
        error instanceof Error ? error.message : 'Could not reach the CapCut bridge.',
        'error',
      )
    }
  }

  const testStudio = async () => {
    setStudioStatus('checking')
    try {
      const status = await checkStudio(settings.studioBase)
      let voices = studioVoices
      try {
        voices = await fetchStudioVoices(settings.studioBase)
      } catch {
        // The status endpoint is enough for a health check; keep the bundled list.
      }
      setStudioVoices(voices)
      setStudioStatus('online')
      if (!voices.some((voice) => voice.id === settings.studioVoice)) {
        patchSettings({ studioVoice: voices[0].id })
      }
      toast(
        `AI Voice Studio connected · ${voices.length} Vietnamese voices (${status.voicesLoaded} loaded)`,
        'success',
      )
    } catch (error) {
      setStudioStatus('offline')
      toast(
        error instanceof Error ? error.message : 'Could not reach AI Voice Studio.',
        'error',
      )
    }
  }

  const generate = async () => {
    if (!project) {
      toast('Open a project before adding a voiceover.', 'error')
      return
    }
    if (settings.engine === 'system') {
      toast('System voices are preview-only. Choose Piper or CapCut to add audio.', 'error')
      return
    }
    if (segments.length === 0) {
      toast('There is no text to narrate.', 'error')
      return
    }
    setBusy('generate')
    cancelRef.current = false
    setProgress({ message: 'Starting…', ratio: 0 })
    const created: Asset[] = []
    const items: Array<{ assetId: string; start: number; volume: number }> = []
    let cursor = playhead
    try {
      for (let index = 0; index < segments.length; index++) {
        if (cancelRef.current) break
        const segment = segments[index]
        setProgress({
          message: `Synthesizing ${index + 1} of ${segments.length}…`,
          ratio: index / segments.length,
        })
        const onSegmentProgress = (message: string, ratio?: number) => {
          setProgress({
            message: `${index + 1}/${segments.length} · ${message}`,
            ratio: (index + (ratio ?? 0)) / segments.length,
          })
        }
        const blob =
          settings.engine === 'studio'
            ? await synthesizeStudio(
                segment.text,
                settings.studioVoice,
                settings.studioBase,
                settings.rate,
                onSegmentProgress,
              )
            : settings.engine === 'capcut'
              ? await synthesizeCapcut(
                  segment.text,
                  settings.capcutVoice,
                  settings.capcutProxy,
                  onSegmentProgress,
                )
              : await synthesizePiper(
                  segment.text,
                  settings.piperVoice,
                  onSegmentProgress,
                  settings.rate,
                )
        if (cancelRef.current) break
        const extension = settings.engine === 'piper' ? 'wav' : 'mp3'
        const mimeType = settings.engine === 'piper' ? 'audio/wav' : 'audio/mpeg'
        const file = new File(
          [blob],
          `Voice ${String(index + 1).padStart(2, '0')}.${extension}`,
          { type: mimeType },
        )
        const asset = await createAssetFromFile(file, undefined, index + 1, segments.length)
        created.push(asset)
        const start = segment.start ?? cursor
        items.push({ assetId: asset.id, start, volume: settings.volume })
        cursor = start + asset.duration + 0.18
      }
      if (created.length === 0) {
        toast('Voice generation was cancelled.', 'default')
        return
      }
      addAssets(created)
      const count = addVoiceover(items)
      if (count > 0) {
        toast(
          `Added ${count} voiceover clip${count === 1 ? '' : 's'} with ${ttsVoiceLabel(settings)}`,
          'success',
        )
      } else {
        toast('The audio was generated but could not be placed on the timeline.', 'error')
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Voice generation failed.', 'error')
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const cancel = () => {
    cancelRef.current = true
    stopSpeechPreview()
    setProgress({ message: 'Stopping after the current segment…', ratio: 0 })
  }

  return (
    <>
      <TabHeader
        title="Voice"
        count={segments.length || undefined}
        action={
          selectedText ? (
            <button
              className="btn btn-subtle btn-sm"
              onClick={() => {
                setScript(selectedText.text)
                setSource('script')
                toast('Loaded the selected text clip', 'success')
              }}
            >
              <Wand2 size={12} /> Use selected
            </button>
          ) : undefined
        }
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          padding: 10,
          borderRadius: 10,
          border: '1px solid rgba(139,108,255,.22)',
          background:
            'radial-gradient(220px 90px at 0% 0%, rgba(139,108,255,.12), transparent 70%), rgba(255,255,255,.02)',
        }}
      >
        <div style={{ display: 'flex', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(139,108,255,.14)',
              color: '#b7a7ff',
              flex: 'none',
            }}
          >
            <AudioLines size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>Text to speech</b>
            <span className="hint">
              Vietnamese voices only. Piper runs offline; CapCut and Studio use hosted APIs.
            </span>
          </div>
        </div>

        <div className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Engine</span>
          <div className="segmented">
            <button
              type="button"
              data-active={settings.engine === 'piper'}
              onClick={() => patchSettings({ engine: 'piper' })}
            >
              Piper · offline
            </button>
            <button
              type="button"
              data-active={settings.engine === 'capcut'}
              onClick={() => patchSettings({ engine: 'capcut' })}
            >
              CapCut · VN
            </button>
            <button
              type="button"
              data-active={settings.engine === 'studio'}
              onClick={() => patchSettings({ engine: 'studio' })}
            >
              Studio
            </button>
            <button
              type="button"
              data-active={settings.engine === 'system'}
              onClick={() => patchSettings({ engine: 'system' })}
            >
              System
            </button>
          </div>
        </div>

        {settings.engine === 'piper' ? (
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Voice</span>
            <select
              className="select"
              value={settings.piperVoice}
              onChange={(event) => patchSettings({ piperVoice: event.target.value })}
            >
              {PIPER_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 5,
                fontSize: 9,
                color: 'var(--muted-2)',
              }}
            >
              {voiceStored ? (
                <>
                  <CheckCircle2 size={11} color="var(--success)" /> Cached in this browser · offline
                  ready
                </>
              ) : voiceStored === null ? (
                <>
                  <Loader2 size={11} className="spin" /> Checking local cache…
                </>
              ) : (
                <>
                  <Info size={11} /> First render downloads about {piperVoice.sizeMb} MB, once.
                </>
              )}
            </div>
          </div>
        ) : settings.engine === 'capcut' ? (
          <>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">
                CapCut Vietnamese voice · {CAPCUT_VOICES.length} models
              </span>
              <select
                className="select"
                value={settings.capcutVoice}
                onChange={(event) => patchSettings({ capcutVoice: event.target.value })}
              >
                {CAPCUT_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
              <span className="hint" style={{ fontSize: 9 }}>
                {capcutVoice.label} · <code>{capcutVoice.id}</code>
              </span>
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Bridge URL</span>
              <input
                className="input"
                value={settings.capcutProxy}
                spellCheck={false}
                aria-label="CapCut bridge URL"
                onChange={(event) => {
                  setCapcutStatus('unknown')
                  setCapcutInfo(null)
                  patchSettings({ capcutProxy: event.target.value })
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 5,
                  fontSize: 9,
                  color: 'var(--muted-2)',
                }}
              >
                {capcutStatus === 'online' ? (
                  <>
                    <CheckCircle2 size={11} color="var(--success)" /> Connected ·{' '}
                    {capcutInfo?.voices ?? CAPCUT_VOICES.length} voices
                    {capcutInfo?.mock ? ' · mock' : ''}
                  </>
                ) : capcutStatus === 'checking' ? (
                  <>
                    <Loader2 size={11} className="spin" /> Checking the helper…
                  </>
                ) : capcutStatus === 'offline' ? (
                  <>
                    <Info size={11} /> Not connected
                  </>
                ) : (
                  <>
                    <Info size={11} /> Not checked yet
                  </>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginLeft: 'auto', height: 22, fontSize: 9.5 }}
                  onClick={() => void testProxy()}
                  disabled={capcutStatus === 'checking' || busy !== null}
                >
                  Test
                </button>
              </div>
              <span className="hint" style={{ fontSize: 9 }}>
                The Vite dev server handles <code>/capcut</code> itself, so no separate helper
                process is needed. It requires the MIT <code>capcut-tts-api</code> Python package.
                For file-only use, run <code>npm run tts:cli</code> and import the MP3.
              </span>
            </div>
          </>
        ) : settings.engine === 'studio' ? (
          <>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">
                AI Voice Studio voice · {studioVoices.length} Vietnamese models
              </span>
              <select
                className="select"
                value={settings.studioVoice}
                onChange={(event) => patchSettings({ studioVoice: event.target.value })}
              >
                {studioOptions.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
              <span className="hint" style={{ fontSize: 9 }}>
                {studioVoice.label} · <code>{studioVoice.id}</code>
              </span>
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">API base URL</span>
              <input
                className="input"
                value={settings.studioBase}
                spellCheck={false}
                aria-label="AI Voice Studio base URL"
                onChange={(event) => {
                  setStudioStatus('unknown')
                  patchSettings({ studioBase: event.target.value })
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 5,
                  fontSize: 9,
                  color: 'var(--muted-2)',
                }}
              >
                {studioStatus === 'online' ? (
                  <>
                    <CheckCircle2 size={11} color="var(--success)" /> Connected ·{' '}
                    {studioVoices.length} Vietnamese voices
                  </>
                ) : studioStatus === 'checking' ? (
                  <>
                    <Loader2 size={11} className="spin" /> Waking the Space…
                  </>
                ) : studioStatus === 'offline' ? (
                  <>
                    <Info size={11} /> Not connected
                  </>
                ) : (
                  <>
                    <Info size={11} /> Not checked yet
                  </>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  style={{ marginLeft: 'auto', height: 22, fontSize: 9.5 }}
                  onClick={() => void testStudio()}
                  disabled={studioStatus === 'checking' || busy !== null}
                >
                  Test
                </button>
              </div>
              <span className="hint" style={{ fontSize: 9 }}>
                Public HF Space by default. Use <code>http://127.0.0.1:8000</code> when running
                the Studio server locally. The Space may need a moment to wake up.
              </span>
            </div>
          </>
        ) : (
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Vietnamese system voice</span>
            <select
              className="select"
              value={settings.systemVoice}
              onChange={(event) => patchSettings({ systemVoice: event.target.value })}
              disabled={vietnameseSystemVoices.length === 0}
            >
              {vietnameseSystemVoices.length === 0 && (
                <option value="">No Vietnamese system voices found</option>
              )}
              {vietnameseSystemVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} · {voice.lang}
                  {voice.default ? ' · default' : ''}
                </option>
              ))}
            </select>
            <span className="hint" style={{ fontSize: 9 }}>
              Preview only. The operating system decides which Vietnamese voices are installed and
              they cannot always be captured for export.
            </span>
          </div>
        )}

        <div className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Source</span>
          <div className="segmented">
            <button
              type="button"
              data-active={source === 'script'}
              onClick={() => setSource('script')}
            >
              Script
            </button>
            <button
              type="button"
              data-active={source === 'timeline'}
              onClick={() => setSource('timeline')}
            >
              Timeline text · {textClips.length}
            </button>
          </div>
        </div>

        {source === 'script' ? (
          <div className="field" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="field-label">Script · blank line = new clip</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ height: 22, fontSize: 9.5 }}
                onClick={() => setScript(SAMPLE)}
              >
                Use sample
              </button>
            </div>
            <textarea
              className="textarea"
              rows={6}
              value={script}
              spellCheck={false}
              onChange={(event) => setScript(event.target.value)}
              aria-label="Text to speak"
            />
          </div>
        ) : textClips.length === 0 ? (
          <div className="hint">
            No text clips yet. Add captions or a text layer, then come back to narrate them at their
            original timestamps.
          </div>
        ) : (
          <div className="caption-panel">
            {textClips.slice(0, 6).map((clip) => (
              <div className="caption-row" key={clip.id}>
                <span className="time">{formatTime(clip.start)}</span>
                <span style={{ minWidth: 0, lineHeight: 1.4 }}>{clip.text}</span>
              </div>
            ))}
            {textClips.length > 6 && (
              <span className="hint">+ {textClips.length - 6} more text clip(s).</span>
            )}
          </div>
        )}

        {settings.engine !== 'capcut' && (
          <Slider
            label="Rate"
            value={Math.round(settings.rate * 100)}
            min={50}
            max={200}
            format={(value) => `${(value / 100).toFixed(2)}×`}
            compact
            onChange={(value) => patchSettings({ rate: value / 100 })}
          />
        )}
        {settings.engine === 'capcut' && (
          <span className="hint" style={{ fontSize: 9 }}>
            CapCut controls its own pacing. Adjust the generated clip's speed on the timeline if
            needed.
          </span>
        )}
        {settings.engine === 'system' && (
          <Slider
            label="Pitch"
            value={Math.round(settings.pitch * 100)}
            min={0}
            max={200}
            format={(value) => `${(value / 100).toFixed(2)}×`}
            compact
            onChange={(value) => patchSettings({ pitch: value / 100 })}
          />
        )}
        <Slider
          label="Volume"
          value={Math.round(settings.volume * 100)}
          min={0}
          max={100}
          format={(value) => `${value}%`}
          compact
          onChange={(value) => patchSettings({ volume: value / 100 })}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-block"
            type="button"
            onClick={() => void preview()}
            disabled={busy !== null}
          >
            {busy === 'preview' ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            Preview
          </button>
          <button
            className="btn btn-primary btn-block"
            type="button"
            onClick={() => void generate()}
            disabled={busy !== null || settings.engine === 'system'}
          >
            {busy === 'generate' ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
            {source === 'timeline' ? 'Narrate timeline' : 'Add voiceover'}
          </button>
        </div>

        {settings.engine === 'piper' && !voiceStored && voiceStored !== null && (
          <button
            className="btn btn-sm btn-block"
            type="button"
            onClick={() => void downloadVoice()}
            disabled={busy !== null}
          >
            {busy === 'download' ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <Download size={12} />
            )}
            Download {piperVoice.label} now
          </button>
        )}

        {busy && (
          <IconButton label="Stop" onClick={cancel}>
            <Square size={12} fill="currentColor" />
          </IconButton>
        )}

        {progress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="hint" style={{ fontSize: 9 }}>
              {progress.message}
            </div>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: 'rgba(255,255,255,.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress.ratio * 100)}%`,
                  height: '100%',
                  background: 'var(--violet, #8b6cff)',
                  transition: 'width .2s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <LibraryLabel
        action={
          <span style={{ fontSize: 9, textTransform: 'none', letterSpacing: 0 }}>
            {segments.length} segment{segments.length === 1 ? '' : 's'}
          </span>
        }
      >
        Narration plan
      </LibraryLabel>
      {segments.length === 0 ? (
        <div className="library-empty">
          <div className="circle">
            <AudioLines size={18} />
          </div>
          <h4>Nothing to narrate</h4>
          <p>Write a script, or add captions and switch the source to “Timeline text”.</p>
        </div>
      ) : (
        <div className="caption-panel">
          {segments.slice(0, 8).map((segment, index) => (
            <div className="caption-row" key={`${segment.start ?? 'seq'}-${index}`}>
              <span className="time">
                {segment.start === null ? `#${index + 1}` : formatTime(segment.start)}
              </span>
              <span style={{ minWidth: 0, lineHeight: 1.4 }}>{segment.text}</span>
            </div>
          ))}
          {segments.length > 8 && (
            <span className="hint">+ {segments.length - 8} more segment(s).</span>
          )}
        </div>
      )}

      <div className="hint">
        <b>Piper</b> is MIT-licensed. The phonemizer and ONNX runtime ship with the app; only the
        selected Vietnamese voice model is fetched from Hugging Face the first time, then cached in
        your browser. Phonemes are mapped through the voice's own id map, so Vietnamese tone ids
        work. System voices come from your OS and are never uploaded.
      </div>
      <div className="hint" style={{ opacity: 0.75 }}>
        <b>CapCut · VN</b> lists all {CAPCUT_VOICES.length} Vietnamese voices from{' '}
        <code>K07VN/capcut-tts-api</code> (MIT). The browser cannot sign CapCut requests or read
        its CDN, so the Vite server exposes a same-origin <code>/capcut</code> bridge. No separate
        helper process is needed. Audio is generated by CapCut's service and may be subject to
        CapCut's terms.
      </div>
      <div className="hint" style={{ opacity: 0.75 }}>
        <b>Studio</b> exposes the 22 Vietnamese voices from the AI Voice Studio HF Space. TTS
        returns a short-lived TikTok CDN link, so ClipPro downloads the MP3 immediately. The same
        Space powers the <b>AI Voice Studio · VN</b> speech-to-text provider in the Captions tab.
      </div>
      <div className="hint" style={{ opacity: 0.65 }}>
        Default settings: {DEFAULT_TTS_SETTINGS.engine} · {DEFAULT_TTS_SETTINGS.rate}× rate.
      </div>
    </>
  )
}
