import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileVideo,
  Film,
  Loader2,
  Music,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { Modal, Segmented, ToggleRow } from '../ui'
import {
  defaultExportOptions,
  estimateFileSize,
  exportHeightOptions,
  exportProject,
  getExportFormats,
  type ExportFormat,
  type ExportResult,
} from '../../lib/export'
import type { ExportOptions, ExportProgress } from '../../lib/types'
import { projectDuration } from '../../lib/project'
import { downloadBlob, formatDuration } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

const QUALITIES: Array<{ value: ExportOptions['quality']; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
]

const FPS_OPTIONS = [24, 25, 30, 50, 60]

function formatIcon(format: ExportFormat) {
  return format.id === 'mp4' ? <Film size={16} /> : <FileVideo size={16} />
}

export function ExportModal() {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const open = useUI((state) => state.exportOpen)
  const close = useUI((state) => state.setExportOpen)
  const toast = useUI((state) => state.toast)

  const [formats, setFormats] = useState<ExportFormat[]>([])
  const [loadingFormats, setLoadingFormats] = useState(true)
  const [formatId, setFormatId] = useState<'mp4' | 'webm'>('mp4')
  const [options, setOptions] = useState<ExportOptions | null>(null)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const duration = project ? projectDuration(project) : 0

  useEffect(() => {
    let cancelled = false
    setLoadingFormats(true)
    void getExportFormats().then((next) => {
      if (cancelled) return
      setFormats(next)
      setLoadingFormats(false)
      const firstSupported = next.find((item) => item.supported)
      if (firstSupported) setFormatId(firstSupported.id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!project) return
    setOptions(defaultExportOptions(project))
  }, [project])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const selectedFormat = formats.find((item) => item.id === formatId) ?? null
  const heightOptions = useMemo(() => (project ? exportHeightOptions(project) : []), [project])
  const estimate = project && options ? estimateFileSize(project, options, options.fps) : '—'

  if (!open || !project || !options) return null

  const closeModal = () => {
    if (running) {
      abortRef.current?.abort()
      return
    }
    close(false)
  }

  const patch = (next: Partial<ExportOptions>) => setOptions((current) => (current ? { ...current, ...next } : current))

  const pickHeight = (height: number) => {
    const match = heightOptions.find((option) => option.height === height)
    if (!match) return
    patch({ width: match.width, height: match.height })
  }

  const start = async () => {
    if (!selectedFormat) return
    if (!selectedFormat.supported) {
      toast(selectedFormat.note, 'error')
      return
    }
    setError(null)
    setResult(null)
    setRunning(true)
    setProgress({ phase: 'preparing', progress: 0, message: 'Preparing export…' })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const output = await exportProject(
        project,
        assets,
        { ...options, format: selectedFormat.id },
        selectedFormat,
        setProgress,
        controller.signal,
      )
      setResult(output)
      downloadBlob(output.blob, output.filename)
      toast(`Exported ${output.filename}`, 'success')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Export cancelled')
      } else {
        const message = err instanceof Error ? err.message : 'Export failed'
        setError(message)
        toast(message, 'error')
      }
    } finally {
      abortRef.current = null
      setRunning(false)
      setProgress(null)
    }
  }

  const restart = () => {
    setResult(null)
    setError(null)
  }

  const footer = result ? (
    <div className="export-done" style={{ padding: 0 }}>
      <div className="done-actions">
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => downloadBlob(result.blob, result.filename)}
        >
          <Download size={13} /> Download again
        </button>
        <button className="btn btn-primary" type="button" onClick={() => close(false)}>
          Done
        </button>
      </div>
    </div>
  ) : (
    <>
      <span style={{ marginRight: 'auto', color: 'var(--muted-2)', fontSize: 10 }}>
        {running ? 'Keep this tab open while exporting.' : `${formatDuration(duration)} · ~${estimate}`}
      </span>
      <button className="btn btn-ghost" type="button" onClick={closeModal}>
        {running ? (
          <>
            <X size={13} /> Cancel
          </>
        ) : (
          'Close'
        )}
      </button>
      {!running && (
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => void start()}
          disabled={!selectedFormat?.supported || duration < 0.05}
        >
          <Download size={13} /> Export video
        </button>
      )}
      {running && (
        <button className="btn btn-primary" type="button" disabled>
          <Loader2 size={13} className="spin" /> Exporting…
        </button>
      )}
    </>
  )

  return (
    <Modal
      title="Export video"
      subtitle={`${project.name} · ${formatDuration(duration)}`}
      icon={<Download size={18} />}
      onClose={closeModal}
      size="wide"
      footer={footer}
    >
      {result ? (
        <div className="export-done">
          <div className="done-icon">
            <CheckCircle2 size={24} />
          </div>
          <h3>Your video is ready</h3>
          <p>
            {result.filename} · {result.width} × {result.height} · {formatDuration(result.duration)}
            {result.hasAudio ? ' · with audio' : ' · silent'}
          </p>
          <div className="done-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => downloadBlob(result.blob, result.filename)}
            >
              <Download size={13} /> Download
            </button>
            <button className="btn btn-ghost" type="button" onClick={restart}>
              Export again
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="export-summary">
            <div className="export-spec">
              <span>Resolution</span>
              <b>
                {options.width} × {options.height}
              </b>
            </div>
            <div className="export-spec">
              <span>Frame rate</span>
              <b>{options.fps} fps</b>
            </div>
            <div className="export-spec">
              <span>Duration</span>
              <b>{formatDuration(duration)}</b>
            </div>
            <div className="export-spec">
              <span>Est. size</span>
              <b>{estimate}</b>
            </div>
          </div>

          {loadingFormats ? (
            <div className="export-progress">
              <div className="progress-meta">
                <span>
                  <Loader2 size={12} className="spin" /> Checking encoder support…
                </span>
              </div>
            </div>
          ) : (
            <div className="export-formats">
              {formats.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  className="export-format"
                  data-active={formatId === format.id}
                  disabled={!format.supported}
                  onClick={() => setFormatId(format.id)}
                >
                  <span className="fmt-icon">{formatIcon(format)}</span>
                  <span className="fmt-name">
                    <b>{format.label}</b>
                    <span>{format.note}</span>
                  </span>
                  {format.supported ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                  ) : (
                    <span className="unsupported">Unavailable</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="field">
            <span className="field-label">Resolution</span>
            <Segmented
              value={String(options.height)}
              options={heightOptions.map((option) => ({
                value: String(option.height),
                label: option.label,
              }))}
              onChange={(value) => pickHeight(Number(value))}
            />
          </div>

          <div className="field-row">
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Frame rate</span>
              <select
                className="select"
                value={options.fps}
                onChange={(event) => patch({ fps: Number(event.target.value) })}
              >
                {FPS_OPTIONS.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps} fps
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Quality</span>
              <Segmented
                value={options.quality}
                options={QUALITIES}
                onChange={(quality) => patch({ quality })}
              />
            </div>
          </div>

          <ToggleRow
            label="Include audio"
            hint="Mix clip volume, fades and muted tracks into the exported file."
            checked={options.includeAudio}
            onChange={(includeAudio) => patch({ includeAudio })}
          />

          {running && progress && (
            <div className="export-progress">
              <div className="progress-line">
                <span style={{ width: `${Math.max(2, Math.round(progress.progress * 100))}%` }} />
              </div>
              <div className="progress-meta">
                <span>{progress.message}</span>
                <b>{Math.round(progress.progress * 100)}%</b>
              </div>
            </div>
          )}

          {error && (
            <div className="help-note" style={{ borderColor: 'rgba(255,93,115,.3)', background: 'rgba(255,93,115,.07)' }}>
              <AlertTriangle size={13} />
              <span>{error}</span>
            </div>
          )}

          <div className="help-note">
            <ShieldCheck size={13} />
            <span>
              Rendering happens entirely in your browser with WebCodecs. Nothing is uploaded.
              MP4 gives the widest compatibility; WebM is a reliable fallback when H.264 is
              unavailable.
            </span>
          </div>

          <div className="help-note" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,.02)' }}>
            <Sparkles size={13} />
            <span>
              <Music size={11} style={{ verticalAlign: '-1px' }} /> Audio is mixed offline at 48
              kHz. Long timelines take longer — export uses every core your browser will give it.
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}
