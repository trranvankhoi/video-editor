import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Clock,
  Cloud,
  Crown,
  FolderOpen,
  HelpCircle,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react'
import { ASPECT_PRESETS, APP_TAGLINE } from '../lib/constants'
import {
  deleteProjectsAndOrphanAssets,
  listProjects,
  loadProject,
  requestPersistentStorage,
  saveAssetRecord,
  saveProjectRecord,
  type ProjectSummary,
} from '../lib/db'
import { createProject } from '../lib/project'
import { createSampleProject } from '../lib/sample'
import { formatDuration, uid } from '../lib/utils'
import { useEditor } from '../store/editor'
import { useUI } from '../store/ui'
import { LogoMark, LogoWordmark } from './Logo'
import { Modal, Segmented } from './ui'

const FPS_OPTIONS = [24, 25, 30, 50, 60] as const

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ratioLabel(width: number, height: number): string {
  const divisor = (a: number, b: number): number => (b === 0 ? a : divisor(b, a % b))
  const d = divisor(width, height)
  return `${width / d}:${height / d}`
}

export function Home() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [creatingSample, setCreatingSample] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null)
  const loadProjectIntoStore = useEditor((state) => state.loadProject)
  const toast = useUI((state) => state.toast)
  const setHelpOpen = useUI((state) => state.setHelpOpen)

  const refresh = async () => {
    try {
      const list = await listProjects()
      setProjects(list)
    } catch (error) {
      console.error(error)
      setProjects([])
      toast('Could not read local projects. Storage may be unavailable.', 'error')
    }
  }

  useEffect(() => {
    void refresh()
    void requestPersistentStorage()
  }, [])

  const openProject = async (id: string) => {
    setBusyProjectId(id)
    try {
      const record = await loadProject(id)
      if (!record) {
        toast('That project could not be found.', 'error')
        await refresh()
        return
      }
      loadProjectIntoStore(record.project, record.assets)
    } catch (error) {
      console.error(error)
      toast('Could not open the project.', 'error')
    } finally {
      setBusyProjectId(null)
    }
  }

  const createNew = async (options: {
    name: string
    width: number
    height: number
    fps: number
  }) => {
    const project = createProject(options)
    try {
      await saveProjectRecord(project)
      loadProjectIntoStore(project, [])
      setNewOpen(false)
    } catch (error) {
      console.error(error)
      toast('Could not create the project.', 'error')
    }
  }

  const openSample = async () => {
    setCreatingSample(true)
    try {
      const sample = await createSampleProject()
      await Promise.all(
        sample.assets.map((asset) => {
          const blob = sample.blobs[asset.id]
          return blob ? saveAssetRecord(asset, blob) : Promise.resolve()
        }),
      )
      await saveProjectRecord(sample.project, sample.assets[0]?.thumbnail)
      loadProjectIntoStore(sample.project, sample.assets)
      toast('Sample project ready — press Space to play', 'success')
    } catch (error) {
      console.error(error)
      toast('Could not build the sample project.', 'error')
    } finally {
      setCreatingSample(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteProjectsAndOrphanAssets([deleteTarget.id])
      setProjects((current) => current?.filter((item) => item.id !== deleteTarget.id) ?? null)
      toast('Project deleted')
    } catch (error) {
      console.error(error)
      toast('Could not delete the project.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const hasProjects = Boolean(projects && projects.length > 0)

  return (
    <div className="home">
      <header className="home-top">
        <LogoWordmark />
        <div className="home-top-actions">
          <span className="badge lime" style={{ marginRight: 6 }}>
            <Cloud size={11} /> Local-first studio
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={14} /> Help & shortcuts
          </button>
          <button className="btn btn-subtle btn-sm" onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New project
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div>
          <div className="hero-kicker">
            <span className="dot">
              <Sparkles size={10} />
            </span>
            A full editing studio in your browser
          </div>
          <h1 className="home-title">
            Create.
            <br />
            Cut. <span className="gradient">Wow.</span>
          </h1>
          <p className="home-sub">
            {APP_TAGLINE} ClipPro gives you a magnetic multi-track timeline,
            cinematic effects, animated titles, captions and frame-accurate
            export — all running privately on your device.
          </p>
          <div className="home-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setNewOpen(true)}>
              <Clapperboard size={17} /> Start editing
            </button>
            <button
              className="btn btn-lg btn-subtle"
              onClick={openSample}
              disabled={creatingSample}
            >
              {creatingSample ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
              {creatingSample ? 'Building sample…' : 'Try a sample project'}
            </button>
          </div>
          <div className="home-stats">
            <span className="home-stat">
              <ShieldCheck size={14} /> 100% private — no uploads
            </span>
            <span className="home-stat">
              <Zap size={14} /> WebCodecs export
            </span>
            <span className="home-stat">
              <Cloud size={14} /> Autosaves locally
            </span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-frame">
            <div className="hero-frame-title">
              COASTAL
              <br />
              DAYS
            </div>
            <div className="hero-frame-sub">a clippro original · 01</div>
            <div className="hero-play">
              <span className="pulse">
                <ArrowRight size={9} />
              </span>
              00:12 · 1080p
            </div>
          </div>
          <div className="hero-float one">
            <span className="icon-box">
              <Wand2 size={13} />
            </span>
            <div>
              <b style={{ color: 'var(--text)', fontWeight: 600 }}>Auto captions</b>
              <div style={{ color: 'var(--muted-2)', fontSize: 9 }}>
                Styled in one click
              </div>
            </div>
          </div>
          <div className="hero-float two">
            <span className="icon-box">
              <Crown size={13} />
            </span>
            <div>
              <b style={{ color: 'var(--text)', fontWeight: 600 }}>4K export</b>
              <div style={{ color: 'var(--muted-2)', fontSize: 9 }}>
                MP4 · WebM · hardware encoded
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="home-content">
        <div className="content-head">
          <div>
            <h2>Your projects</h2>
            <p>Everything stays on this device. Open a project to pick up where you left off.</p>
          </div>
          <button className="btn btn-sm" onClick={() => setNewOpen(true)}>
            <Plus size={13} /> New
          </button>
        </div>

        {projects === null ? (
          <div className="empty-projects">
            <div className="empty-copy">
              <div className="empty-icon">
                <Loader2 size={18} className="spin" />
              </div>
              <div>
                <h3>Reading your local library…</h3>
                <p>ClipPro stores projects in IndexedDB.</p>
              </div>
            </div>
          </div>
        ) : hasProjects ? (
          <div className="recent-grid">
            {projects.map((project) => {
              const busy = busyProjectId === project.id
              return (
                <div
                  key={project.id}
                  className="project-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${project.name}`}
                  onClick={() => void openProject(project.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void openProject(project.id)
                    }
                  }}
                >
                  <div className="project-thumb">
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt="" />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'rgba(255,255,255,.22)',
                        }}
                      >
                        <LogoMark size={30} />
                      </div>
                    )}
                    <span className="ratio">{ratioLabel(project.width, project.height)}</span>
                    <span className="duration">
                      {formatDuration(project.duration)} · {project.clipCount} clips
                    </span>
                    {busy && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(5,5,9,.6)',
                        }}
                      >
                        <Loader2 size={20} className="spin" />
                      </div>
                    )}
                  </div>
                  <button
                    className="project-card-delete"
                    type="button"
                    title="Delete project"
                    aria-label={`Delete ${project.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setDeleteTarget(project)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                  <div className="project-card-body">
                    <h3>{project.name}</h3>
                    <div className="project-card-meta">
                      <Clock size={10} /> {relativeTime(project.updatedAt)}
                      <span>·</span>
                      <span>{project.fps} fps</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-projects">
            <div className="empty-copy">
              <div className="empty-icon">
                <FolderOpen size={19} />
              </div>
              <div>
                <h3>No projects yet</h3>
                <p>Create a blank canvas or explore the sample to see the editor in motion.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={openSample} disabled={creatingSample}>
                {creatingSample ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
                Sample
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
                <Plus size={13} /> New project
              </button>
            </div>
          </div>
        )}

        <div className="sample-banner">
          <div>
            <h3>Not sure where to start?</h3>
            <p>
              Open the ClipPro sample: three original gradient scenes, layered
              titles, stickers and a synthesized soundtrack. It is a great place
              to test splits, transitions and export.
            </p>
          </div>
          <div className="sample-banner-actions">
            <span className="badge cyan">
              <Sparkles size={11} /> Original assets
            </span>
            <button className="btn btn-lime btn-sm" onClick={openSample} disabled={creatingSample}>
              {creatingSample ? <Loader2 size={13} className="spin" /> : <ArrowRight size={13} />}
              {creatingSample ? 'Building…' : 'Open sample'}
            </button>
          </div>
        </div>
      </main>

      <footer className="home-footer">
        <span>
          ClipPro 1.0 · Create. Cut. Wow. · Media never leaves your browser.
        </span>
        <span className="links">
          <button onClick={() => setHelpOpen(true)}>Shortcuts</button>
          <span>·</span>
          <button
            onClick={() => {
              toast('All effects, fonts and stickers are original or openly licensed.', 'success')
            }}
          >
            Licenses
          </button>
        </span>
      </footer>

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={createNew}
      />

      {deleteTarget && (
        <Modal
          title="Delete this project?"
          subtitle="This cannot be undone. Unused media will also be removed from local storage."
          size="narrow"
          onClose={() => setDeleteTarget(null)}
          icon={
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,93,115,.12)',
                color: 'var(--danger)',
              }}
            >
              <Trash2 size={17} />
            </div>
          }
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => void confirmDelete()}>
                <Trash2 size={14} /> Delete project
              </button>
            </>
          }
        >
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>
            <b style={{ color: 'var(--text)' }}>{deleteTarget.name}</b> will be
            removed from this device. Media shared with other projects is kept.
          </p>
        </Modal>
      )}

      <button
        className="help-fab"
        aria-label="Help and shortcuts"
        title="Help & shortcuts"
        onClick={() => setHelpOpen(true)}
      >
        <HelpCircle size={18} />
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* New project dialog                                                          */
/* -------------------------------------------------------------------------- */

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (options: { name: string; width: number; height: number; fps: number }) => Promise<void>
}) {
  const [name, setName] = useState('Untitled project')
  const [aspect, setAspect] = useState<(typeof ASPECT_PRESETS)[number]['id']>('16:9')
  const [fps, setFps] = useState<number>(30)
  const [busy, setBusy] = useState(false)
  const preset = useMemo(
    () => ASPECT_PRESETS.find((item) => item.id === aspect) ?? ASPECT_PRESETS[0],
    [aspect],
  )

  useEffect(() => {
    if (open) {
      setName(`Untitled project ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
      setAspect('16:9')
      setFps(30)
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const submit = async () => {
    setBusy(true)
    try {
      await onCreate({
        name: name.trim() || `Project ${uid('untitled').slice(-4)}`,
        width: preset.width,
        height: preset.height,
        fps,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New project"
      subtitle="Choose a canvas. You can change the aspect ratio later in project settings."
      onClose={onClose}
      icon={
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(139,108,255,.14)',
            color: '#b7a7ff',
          }}
        >
          <Clapperboard size={17} />
        </div>
      }
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <ArrowRight size={14} />}
            Create project
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          className="input"
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
        />
      </div>
      <div className="field">
        <span className="field-label">Canvas</span>
        <div className="aspect-grid">
          {ASPECT_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="aspect-card"
              data-active={item.id === aspect}
              onClick={() => setAspect(item.id)}
            >
              <span className="aspect-shape">
                <span
                  style={{
                    width: item.width >= item.height ? 26 : (26 * item.width) / item.height,
                    height: item.height >= item.width ? 26 : (26 * item.height) / item.width,
                  }}
                />
              </span>
              <b>{item.id}</b>
              <small>{item.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Frame rate</span>
        <Segmented
          value={String(fps)}
          options={FPS_OPTIONS.map((value) => ({ value: String(value), label: value }))}
          onChange={(value) => setFps(Number(value))}
        />
      </div>
      <div className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CheckCircle2 size={13} color="var(--success)" /> {preset.width} × {preset.height}px ·{' '}
        {preset.hint} · {fps} fps
      </div>
    </Modal>
  )
}
