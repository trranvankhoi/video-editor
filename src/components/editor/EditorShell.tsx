import { useEffect } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { LibraryPanel } from '../library/LibraryPanel'
import { Inspector } from './Inspector'
import { Preview } from './Preview'
import { Timeline } from './Timeline'
import { TopBar } from './TopBar'
import { useShortcuts } from '../../hooks/useShortcuts'
import { capturePreviewThumbnail } from '../../lib/thumbnail'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

const AUTOSAVE_DELAY = 1400

export function EditorShell() {
  const project = useEditor((state) => state.project)
  const dirty = useEditor((state) => state.dirty)
  const importStatus = useUI((state) => state.importStatus)
  useShortcuts()

  /* Debounced autosave. The project object is replaced on every mutation, so
     this effect naturally coalesces rapid gestures into one write. */
  useEffect(() => {
    if (!project || !dirty) return
    const timer = window.setTimeout(() => {
      void useEditor.getState().save(capturePreviewThumbnail())
    }, AUTOSAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [project, dirty])

  /* Best-effort save when the tab is hidden or closed. */
  useEffect(() => {
    const flush = () => {
      const state = useEditor.getState()
      if (state.project && state.dirty) void state.save(capturePreviewThumbnail())
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!project) return null

  return (
    <div className="editor">
      <TopBar />
      <div className="main-grid">
        <LibraryPanel />
        <Preview />
        <Inspector />
      </div>
      <Timeline />

      {importStatus?.active && <ImportOverlay status={importStatus} />}
    </div>
  )
}

function ImportOverlay({
  status,
}: {
  status: NonNullable<ReturnType<typeof useUI.getState>['importStatus']>
}) {
  const progress = status.total > 0 ? status.index / status.total : 0
  return (
    <div className="import-overlay" role="status" aria-live="polite">
      <div className="import-card">
        <div className="import-icon">
          {progress < 1 ? <Loader2 size={16} className="spin" /> : <FileUp size={16} />}
        </div>
        <div className="import-copy">
          <b>Importing media</b>
          <span className="ellipsis">{status.name}</span>
          <div className="progress-line">
            <span style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }} />
          </div>
        </div>
        <span className="import-count">
          {status.index} / {status.total}
        </span>
      </div>
    </div>
  )
}
