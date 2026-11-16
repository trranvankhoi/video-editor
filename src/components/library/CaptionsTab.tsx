import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Captions,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react'
import { LibraryLabel, TabHeader } from './common'
import { formatTime, downloadBlob, safeFilename } from '../../lib/utils'
import { parseCaptions, rulesFromCues, toSrt } from '../../lib/captions'
import type { CaptionCue } from '../../lib/captions'
import {
  AI_LANGUAGES,
  AI_PROVIDERS,
  defaultModelFor,
  loadAiSettings,
  saveAiSettings,
  transcribeProject,
  type AiProvider,
  type AiSettings,
} from '../../lib/whisper'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import { IconButton } from '../ui'

const SAMPLE = `1
00:00:00,400 --> 00:00:02,800
Every story starts somewhere.

2
00:00:02,900 --> 00:00:05,600
Cut it, shape it, make it yours.`

export function CaptionsTab() {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const addCaptions = useEditor((state) => state.addCaptions)
  const toast = useUI((state) => state.toast)
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings())
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ message: string; ratio: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const provider = AI_PROVIDERS.find((item) => item.id === settings.provider) ?? AI_PROVIDERS[0]

  const patchSettings = (patch: Partial<AiSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveAiSettings(next)
      return next
    })
  }

  const changeProvider = (id: AiProvider) => {
    const meta = AI_PROVIDERS.find((item) => item.id === id)
    patchSettings({
      provider: id,
      model: meta?.model ?? defaultModelFor(id),
      ...(id === 'studio' ? { language: 'vi' } : {}),
    })
  }

  const generate = async () => {
    if (!project) {
      toast('Open a project before generating captions.', 'error')
      return
    }
    setGenerating(true)
    setProgress({ message: 'Starting…', ratio: 0 })
    try {
      const cues = await transcribeProject(project, assets, settings, (message, ratio) => {
        setProgress({ message, ratio: ratio ?? 0 })
      })
      setRaw(toSrt(cues))
      setFileName(null)
      toast(
        `Transcribed ${cues.length} caption${cues.length === 1 ? '' : 's'}. Review, then add them to the timeline.`,
        'success',
      )
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Transcription failed.', 'error')
    } finally {
      setGenerating(false)
      setProgress(null)
    }
  }

  const cues = useMemo(() => parseCaptions(raw), [raw])

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReading(true)
    try {
      const content = await file.text()
      setRaw(content)
      setFileName(file.name)
      const parsed = parseCaptions(content)
      if (parsed.length === 0) {
        toast('No caption cues found. Check that the file is SRT or WebVTT.', 'error')
      } else {
        toast(`Loaded ${parsed.length} cue${parsed.length > 1 ? 's' : ''}`, 'success')
      }
    } catch (error) {
      console.error(error)
      toast('Could not read that caption file.', 'error')
    } finally {
      setReading(false)
    }
  }

  const apply = () => {
    if (cues.length === 0) {
      toast('Paste an SRT or WebVTT file first.', 'error')
      return
    }
    setApplying(true)
    const count = addCaptions(cues)
    setApplying(false)
    if (count > 0) {
      const last = cues[cues.length - 1]
      toast(
        `Added ${count} caption${count > 1 ? 's' : ''} to the text track · ends at ${formatTime(last.end)}`,
        'success',
      )
      useUI.getState().setLibraryTab('text')
    }
  }

  const exportSrt = () => {
    if (!project) return
    const projectCues: CaptionCue[] = []
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.kind === 'text') {
          projectCues.push({
            start: clip.start,
            end: clip.start + clip.duration,
            text: clip.text.content,
          })
        }
      }
    }
    projectCues.sort((a, b) => a.start - b.start)
    if (projectCues.length === 0) {
      toast('There are no text clips to export yet.', 'error')
      return
    }
    const blob = new Blob([toSrt(projectCues)], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${safeFilename(project.name)}.srt`)
    toast('Captions exported as SRT', 'success')
  }

  return (
    <>
      <TabHeader
        title="Captions"
        count={cues.length || undefined}
        action={
          <button className="btn btn-subtle btn-sm" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={12} /> Import
          </button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept=".srt,.vtt,.txt,text/plain,text/vtt"
        hidden
        onChange={(event) => void onFile(event)}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          padding: 10,
          borderRadius: 10,
          border: '1px solid rgba(34,211,238,.18)',
          background:
            'radial-gradient(220px 90px at 0% 0%, rgba(34,211,238,.09), transparent 70%), rgba(255,255,255,.02)',
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
              background: 'rgba(34,211,238,.12)',
              color: 'var(--cyan)',
              flex: 'none',
            }}
          >
            <Sparkles size={15} />
          </div>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
              Auto captions
            </b>
            <span className="hint">{provider.hint}</span>
          </div>
        </div>

        <div className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Provider</span>
          <select
            className="select"
            value={settings.provider}
            onChange={(event) => changeProvider(event.target.value as AiProvider)}
          >
            {AI_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginTop: 0 }}>
          <span className="field-label">Spoken language</span>
          <select
            className="select"
            value={settings.language}
            disabled={settings.provider === 'studio'}
            onChange={(event) => patchSettings({ language: event.target.value })}
          >
            {AI_LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
          {settings.provider === 'studio' && (
            <span className="hint" style={{ fontSize: 9 }}>
              AI Voice Studio is Vietnamese-only (<code>vi-VN</code>).
            </span>
          )}
        </div>

        {settings.provider === 'studio' && (
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">API base URL</span>
            <input
              className="input"
              value={settings.studioBase}
              spellCheck={false}
              aria-label="AI Voice Studio base URL"
              onChange={(event) => patchSettings({ studioBase: event.target.value })}
            />
            <span className="hint" style={{ fontSize: 9 }}>
              Public HF Space by default. Use <code>http://127.0.0.1:8000</code> for a local Studio
              server. Uploads go only to this URL.
            </span>
          </div>
        )}

        {provider.needsKey && (
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">API key</span>
            <div style={{ position: 'relative' }}>
              <KeyRound
                size={12}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 9,
                  color: 'var(--muted-2)',
                  pointerEvents: 'none',
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 26 }}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.provider === 'groq' ? 'gsk_…' : 'sk-…'}
                value={settings.apiKey}
                onChange={(event) => patchSettings({ apiKey: event.target.value })}
                aria-label="API key"
              />
            </div>
            <span className="hint" style={{ fontSize: 9 }}>
              Stored only in this browser. Sent directly to {provider.label}.
            </span>
          </div>
        )}

        {settings.provider !== 'studio' && (
          <details>
            <summary
              style={{
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: 10,
                listStyle: 'none',
              }}
            >
              Model · {settings.model || provider.model}
            </summary>
            <input
              className="input"
              style={{ marginTop: 5 }}
              value={settings.model}
              spellCheck={false}
              placeholder={provider.model}
              onChange={(event) => patchSettings({ model: event.target.value })}
              aria-label="Transcription model"
            />
          </details>
        )}

        <button
          className="btn btn-primary btn-block"
          type="button"
          onClick={() => void generate()}
          disabled={generating}
        >
          {generating ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
          {generating ? 'Transcribing…' : 'Generate captions from audio'}
        </button>

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
                  background: 'var(--cyan)',
                  transition: 'width .2s ease',
                }}
              />
            </div>
          </div>
        )}

        <span className="hint" style={{ fontSize: 9 }}>
          The mixed project audio is transcribed, so clip volume, mutes and fades are respected.
          You can still import SRT/VTT below.
        </span>
      </div>

      <div className="field" style={{ marginTop: 0 }}>
        <span className="field-label">Caption file</span>
        <button className="dropzone" type="button" onClick={() => inputRef.current?.click()}>
          <span className="icon-box">
            {reading ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
          </span>
          <span style={{ minWidth: 0, textAlign: 'left' }}>
            <b>{fileName ?? 'Choose SRT or VTT'}</b>
            <span className="ellipsis" style={{ display: 'block' }}>
              {fileName ? 'Click to replace this file' : 'Standard caption files only'}
            </span>
          </span>
        </button>
      </div>

      <div className="field" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="field-label">Paste captions</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ height: 22, fontSize: 9.5 }}
            onClick={() => {
              setRaw(SAMPLE)
              setFileName(null)
            }}
          >
            Use sample
          </button>
        </div>
        <textarea
          className="textarea"
          rows={6}
          spellCheck={false}
          value={raw}
          placeholder={'1\n00:00:00,000 --> 00:00:02,000\nYour caption here…'}
          onChange={(event) => {
            setRaw(event.target.value)
            setFileName(null)
          }}
          aria-label="Caption source"
        />
      </div>

      {raw.trim() && (
        <>
          <LibraryLabel
            action={
              <span style={{ fontSize: 9, textTransform: 'none', letterSpacing: 0 }}>
                {cues.length} cue{cues.length === 1 ? '' : 's'}
              </span>
            }
          >
            Preview
          </LibraryLabel>
          {cues.length === 0 ? (
            <div className="hint" style={{ color: 'var(--warning)' }}>
              No valid cues found. Timestamps must look like 00:00:01,200 --&gt; 00:00:03,000.
            </div>
          ) : (
            <div className="caption-panel">
              {cues.slice(0, 8).map((cue, index) => (
                <div className="caption-row" key={`${cue.start}-${index}`}>
                  <span className="time">
                    {formatTime(cue.start)}
                    <br />
                    {formatTime(cue.end)}
                  </span>
                  <span style={{ minWidth: 0, lineHeight: 1.4 }}>{cue.text}</span>
                </div>
              ))}
              {cues.length > 8 && (
                <span className="hint">+ {cues.length - 8} more cue(s) will be added.</span>
              )}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={apply} disabled={applying || cues.length === 0}>
            {applying ? <Loader2 size={13} className="spin" /> : <Captions size={13} />}
            Add {cues.length || ''} caption{cues.length === 1 ? '' : 's'} to timeline
          </button>
        </>
      )}

      {!raw.trim() && (
        <div className="library-empty">
          <div className="circle">
            <Captions size={18} />
          </div>
          <h4>No captions loaded</h4>
          <p>
            Import a subtitle file or paste SRT text. Cues become editable text clips on the
            timeline.
          </p>
          <button className="btn btn-sm" onClick={() => setRaw(SAMPLE)}>
            <Wand2 size={12} /> Try a sample
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconButton label="Export captions as SRT" onClick={exportSrt}>
          <Download size={14} />
        </IconButton>
        <span className="hint">Export every text clip as an SRT file.</span>
      </div>

      <div className="hint">
        Each cue is placed at its original timestamp. Select a caption clip to restyle it, or
        edit its text in the inspector.
      </div>
      <div className="hint" style={{ opacity: 0.7 }}>
        {rulesFromCues(cues)}
      </div>
    </>
  )
}
