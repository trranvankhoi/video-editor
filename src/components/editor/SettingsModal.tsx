import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Check,
  Database,
  HardDrive,
  KeyRound,
  Monitor,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { ColorField, Modal, Section, Segmented, ToggleRow } from '../ui'
import { ASPECT_PRESETS } from '../../lib/constants'
import { clearAllData, requestPersistentStorage } from '../../lib/db'
import {
  AI_LANGUAGES,
  AI_PROVIDERS,
  defaultModelFor,
  loadAiSettings,
  saveAiSettings,
  type AiProvider,
  type AiSettings,
} from '../../lib/whisper'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

export function SettingsModal() {
  const open = useUI((state) => state.settingsOpen)
  const setOpen = useUI((state) => state.setSettingsOpen)
  const toast = useUI((state) => state.toast)
  const quality = useUI((state) => state.previewQuality)
  const setQuality = useUI((state) => state.setPreviewQuality)
  const safeArea = useUI((state) => state.showSafeArea)
  const setSafeArea = useUI((state) => state.setShowSafeArea)
  const follow = useUI((state) => state.timelineFollow)
  const setFollow = useUI((state) => state.setTimelineFollow)
  const project = useEditor((state) => state.project)
  const updateProjectSettings = useEditor((state) => state.updateProjectSettings)
  const closeProject = useEditor((state) => state.closeProject)

  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [ai, setAi] = useState<AiSettings>(() => loadAiSettings())

  const patchAi = (patch: Partial<AiSettings>) => {
    setAi((current) => {
      const next = { ...current, ...patch }
      saveAiSettings(next)
      return next
    })
  }

  const provider = AI_PROVIDERS.find((item) => item.id === ai.provider) ?? AI_PROVIDERS[0]

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const estimate = await navigator.storage?.estimate?.()
        if (!cancelled && estimate) {
          setUsage({ used: estimate.usage ?? 0, quota: estimate.quota ?? 0 })
        }
        const isPersisted = (await navigator.storage?.persisted?.()) ?? false
        if (!cancelled) setPersisted(isPersisted)
      } catch {
        // Storage APIs are optional.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const activeAspect = project
    ? (ASPECT_PRESETS.find(
        (preset) => preset.width === project.width && preset.height === project.height,
      )?.id ?? 'custom')
    : 'custom'

  const askPersistent = async () => {
    const granted = await requestPersistentStorage()
    setPersisted(granted)
    toast(
      granted
        ? 'Persistent storage granted — your projects are safer.'
        : 'The browser declined persistent storage. Your projects still save locally.',
      granted ? 'success' : 'default',
    )
  }

  const doClear = async () => {
    setClearing(true)
    try {
      await clearAllData()
      closeProject()
      setConfirmClear(false)
      setOpen(false)
      toast('All local projects and media were deleted.', 'success')
    } catch {
      toast('Could not clear local data. Try closing other tabs.', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <Modal
      title="Settings"
      subtitle="Project, preview and local storage"
      icon={<Settings2 size={18} />}
      onClose={() => setOpen(false)}
      size="wide"
      footer={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--muted-2)', fontSize: 10 }}>
            Changes apply instantly and are saved with your project.
          </span>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {project ? (
          <Section title="Project" icon={<Monitor size={12} />}>
            <div className="field">
              <span className="field-label">Project name</span>
              <input
                className="input"
                value={project.name}
                maxLength={80}
                onChange={(event) => updateProjectSettings({ name: event.target.value })}
              />
            </div>
            <div className="field">
              <span className="field-label">Aspect ratio</span>
              <Segmented
                value={activeAspect}
                options={[
                  ...ASPECT_PRESETS.map((preset) => ({
                    value: preset.id,
                    label: preset.id,
                  })),
                  ...(activeAspect === 'custom' ? [{ value: 'custom', label: 'Custom' }] : []),
                ]}
                onChange={(value) => {
                  const preset = ASPECT_PRESETS.find((item) => item.id === value)
                  if (preset) updateProjectSettings({ width: preset.width, height: preset.height })
                }}
              />
            </div>
            <div className="field">
              <span className="field-label">Frame rate</span>
              <Segmented
                value={String(project.fps)}
                options={[24, 25, 30, 50, 60].map((fps) => ({
                  value: String(fps),
                  label: `${fps} fps`,
                }))}
                onChange={(value) => updateProjectSettings({ fps: Number(value) })}
              />
            </div>
            <div className="field">
              <span className="field-label">Canvas background</span>
              <ColorField
                label="Canvas background"
                value={project.background}
                onChange={(background) => updateProjectSettings({ background })}
              />
            </div>
          </Section>
        ) : (
          <div className="help-note">
            <Monitor size={14} />
            <span>Open a project to change its canvas settings.</span>
          </div>
        )}

        <Section title="Preview" icon={<Monitor size={12} />} defaultOpen={false}>
          <div className="field">
            <span className="field-label">Preview quality</span>
            <Segmented
              value={quality}
              options={[
                { value: 'half', label: 'Half · faster' },
                { value: 'full', label: 'Full · sharper' },
              ]}
              onChange={(value) => setQuality(value)}
            />
          </div>
          <ToggleRow
            label="Title-safe guides"
            hint="Show the action-safe overlay on the preview canvas."
            checked={safeArea}
            onChange={setSafeArea}
          />
          <ToggleRow
            label="Timeline follows playhead"
            hint="Scroll the timeline automatically during playback."
            checked={follow}
            onChange={setFollow}
          />
        </Section>

        <Section title="AI captions" icon={<Bot size={12} />} defaultOpen={false}>
          <div className="field">
            <span className="field-label">Provider</span>
            <select
              className="select"
              value={ai.provider}
              onChange={(event) => {
                const id = event.target.value as AiProvider
                const meta = AI_PROVIDERS.find((item) => item.id === id)
                patchAi({
                  provider: id,
                  model: meta?.model ?? defaultModelFor(id),
                  ...(id === 'studio' ? { language: 'vi' } : {}),
                })
              }}
            >
              {AI_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="hint">{provider.hint}</span>
          </div>
          {provider.needsKey && (
            <div className="field">
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
                  placeholder={ai.provider === 'groq' ? 'gsk_…' : 'sk-…'}
                  value={ai.apiKey}
                  onChange={(event) => patchAi({ apiKey: event.target.value })}
                />
              </div>
              <span className="hint">
                Keys are kept in this browser only and are sent directly to {provider.label}.
              </span>
            </div>
          )}
          <div className="field">
            <span className="field-label">Spoken language</span>
            <select
              className="select"
              value={ai.language}
              disabled={ai.provider === 'studio'}
              onChange={(event) => patchAi({ language: event.target.value })}
            >
              {AI_LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
            {ai.provider === 'studio' && (
              <span className="hint">
                AI Voice Studio is Vietnamese-only (<code>vi-VN</code>).
              </span>
            )}
          </div>
          {ai.provider === 'studio' ? (
            <div className="field">
              <span className="field-label">API base URL</span>
              <input
                className="input"
                value={ai.studioBase}
                spellCheck={false}
                onChange={(event) => patchAi({ studioBase: event.target.value })}
              />
              <span className="hint">
                Public HF Space by default. Use <code>http://127.0.0.1:8000</code> when the Studio
                server runs locally.
              </span>
            </div>
          ) : (
            <div className="field">
              <span className="field-label">Model</span>
              <input
                className="input"
                value={ai.model}
                spellCheck={false}
                placeholder={provider.model}
                onChange={(event) => patchAi({ model: event.target.value })}
              />
              <span className="hint">
                Local models are downloaded from the Hugging Face CDN the first time you
                transcribe. Nothing is uploaded when using Local Whisper.
              </span>
            </div>
          )}
        </Section>

        <Section title="Storage" icon={<Database size={12} />} defaultOpen={false}>
          <div className="export-summary" style={{ marginBottom: 10 }}>
            <div className="export-spec">
              <span>Used by this browser</span>
              <b>{usage ? formatBytes(usage.used) : 'Checking…'}</b>
            </div>
            <div className="export-spec">
              <span>Available quota</span>
              <b>{usage && usage.quota ? formatBytes(usage.quota) : 'Unknown'}</b>
            </div>
            <div className="export-spec">
              <span>Persistent</span>
              <b>
                {persisted === null ? 'Checking…' : persisted ? (
                  <span style={{ color: 'var(--success)' }}>
                    <Check size={11} style={{ verticalAlign: '-1px' }} /> Granted
                  </span>
                ) : (
                  'Not granted'
                )}
              </b>
            </div>
          </div>

          <div className="help-note" style={{ marginBottom: 10 }}>
            <HardDrive size={14} />
            <span>
              Projects, thumbnails and media blobs live in IndexedDB on this device. Persistent
              storage asks the browser not to evict them when disk space is low.
            </span>
          </div>

          <button
            className="btn btn-sm btn-block"
            type="button"
            onClick={() => void askPersistent()}
            disabled={persisted === true}
          >
            <ShieldCheck size={12} />
            {persisted === true ? 'Persistent storage enabled' : 'Request persistent storage'}
          </button>

          {!confirmClear ? (
            <button
              className="btn btn-sm btn-block btn-danger"
              type="button"
              style={{ marginTop: 8 }}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={12} /> Clear all local data
            </button>
          ) : (
            <div
              className="help-note"
              style={{
                marginTop: 8,
                flexDirection: 'column',
                borderColor: 'rgba(255,93,115,.32)',
                background: 'rgba(255,93,115,.07)',
              }}
            >
              <span style={{ display: 'flex', gap: 8, color: 'var(--text-soft)' }}>
                <AlertTriangle size={14} style={{ color: 'var(--danger)', flex: 'none' }} />
                This deletes every project and media file stored by ClipPro in this browser. It
                cannot be undone.
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-sm btn-danger"
                  type="button"
                  onClick={() => void doClear()}
                  disabled={clearing}
                >
                  <Trash2 size={12} /> {clearing ? 'Deleting…' : 'Delete everything'}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={clearing}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </Modal>
  )
}
