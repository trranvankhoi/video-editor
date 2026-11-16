import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudUpload,
  HelpCircle,
  Keyboard,
  Loader2,
  Magnet,
  Redo2,
  Settings,
  Undo2,
  Upload,
} from 'lucide-react'
import { LogoWordmark } from '../Logo'
import { IconButton } from '../ui'
import { capturePreviewThumbnail } from '../../lib/thumbnail'
import { formatDuration } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

export function TopBar() {
  const project = useEditor((state) => state.project)
  const saveState = useEditor((state) => state.saveState)
  const dirty = useEditor((state) => state.dirty)
  const lastSavedAt = useEditor((state) => state.lastSavedAt)
  const past = useEditor((state) => state.past.length)
  const future = useEditor((state) => state.future.length)
  const snap = useEditor((state) => state.snap)
  const duration = useEditor((state) => {
    if (!state.project) return 0
    let end = 0
    for (const track of state.project.tracks) {
      for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration)
    }
    return end
  })
  const updateProjectSettings = useEditor((state) => state.updateProjectSettings)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const setSnap = useEditor((state) => state.setSnap)
  const save = useEditor((state) => state.save)
  const closeProject = useEditor((state) => state.closeProject)
  const setExportOpen = useUI((state) => state.setExportOpen)
  const setHelpOpen = useUI((state) => state.setHelpOpen)
  const setShortcutsOpen = useUI((state) => state.setShortcutsOpen)
  const setSettingsOpen = useUI((state) => state.setSettingsOpen)
  const toast = useUI((state) => state.toast)
  const [leaving, setLeaving] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? 'Save failed'
        : saveState === 'saved' && !dirty
          ? lastSavedAt
            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
            : 'Saved'
          : 'Unsaved changes'

  const goHome = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await save(capturePreviewThumbnail())
      closeProject()
    } finally {
      setLeaving(false)
    }
  }

  const manualSave = async () => {
    setSaving(true)
    await save(capturePreviewThumbnail())
    setSaving(false)
    toast('Project saved locally', 'success')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <LogoWordmark compact />
        <div className="topbar-divider" />
        <IconButton label="Back to projects" onClick={() => void goHome()} disabled={leaving}>
          {leaving ? <Loader2 size={15} className="spin" /> : <ArrowLeft size={15} />}
        </IconButton>
        <div className="topbar-divider" />
        <div className="project-title-wrap">
          <input
            className="project-title-input"
            value={project.name}
            maxLength={80}
            aria-label="Project name"
            onChange={(event) => updateProjectSettings({ name: event.target.value })}
            onBlur={(event) => {
              const next = event.target.value.trim()
              if (!next) updateProjectSettings({ name: 'Untitled project' })
            }}
          />
        </div>
        <span className="project-meta-pill">
          {project.width} × {project.height} · {project.fps} fps · {formatDuration(duration)}
        </span>
      </div>

      <div className="topbar-center">
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={past === 0}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={future === 0}>
          <Redo2 size={15} />
        </IconButton>
        <div className="topbar-divider" />
        <IconButton
          label="Magnetic snapping"
          active={snap}
          onClick={() => setSnap(!snap)}
        >
          <Magnet size={15} />
        </IconButton>
        <IconButton label="Save project (Ctrl+S)" onClick={() => void manualSave()} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : <CloudUpload size={15} />}
        </IconButton>
      </div>

      <div className="topbar-right">
        <span className="save-state" data-state={saveState}>
          {saveState === 'saving' ? (
            <Loader2 size={11} className="spin" />
          ) : saveState === 'error' ? (
            <AlertTriangle size={11} />
          ) : (
            <Check size={11} />
          )}
          {saveLabel}
        </span>
        <IconButton label="Project settings" onClick={() => setSettingsOpen(true)}>
          <Settings size={15} />
        </IconButton>
        <IconButton label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={15} />
        </IconButton>
        <IconButton label="Help" onClick={() => setHelpOpen(true)}>
          <HelpCircle size={15} />
        </IconButton>
        <div className="topbar-divider" />
        <button className="btn btn-primary btn-export" onClick={() => setExportOpen(true)}>
          <Upload size={14} /> Export
        </button>
      </div>
    </header>
  )
}
