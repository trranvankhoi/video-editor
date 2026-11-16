import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowLeftRight,
  AudioLines,
  Captions,
  Film,
  LayoutTemplate,
  Loader2,
  Music,
  Palette,
  Sparkles,
  Sticker,
  Type,
} from 'lucide-react'
import { MediaDropzone } from './common'
import { MediaTab } from './MediaTab'
import { AudioTab } from './AudioTab'
import { VoiceTab } from './VoiceTab'
import { TextTab } from './TextTab'
import { StickersTab } from './StickersTab'
import { EffectsTab, FiltersTab, TransitionsTab } from './EffectsTab'
import { CaptionsTab } from './CaptionsTab'
import { TemplatesTab } from './TemplatesTab'
import { useMediaImport } from '../../hooks/useMediaImport'
import { MEDIA_ACCEPT } from '../../lib/media'
import { useEditor } from '../../store/editor'
import { useUI, type LibraryTab } from '../../store/ui'

const TABS: Array<{ id: LibraryTab; label: string; icon: typeof Film }> = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Sticker },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'filters', label: 'Filters', icon: Palette },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
]

export function LibraryPanel() {
  const tab = useUI((state) => state.libraryTab)
  const setTab = useUI((state) => state.setLibraryTab)
  const importStatus = useUI((state) => state.importStatus)
  const project = useEditor((state) => state.project)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const { importFiles, busy } = useMediaImport()

  const openPicker = () => inputRef.current?.click()

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await importFiles(files, { addToTimeline: tab === 'media' })
    }
    event.target.value = ''
  }

  const onDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDragActive(false)
    if (event.dataTransfer.files.length > 0) {
      await importFiles(event.dataTransfer.files)
    }
  }

  const content = useMemo(() => {
    switch (tab) {
      case 'media':
        return <MediaTab onImport={openPicker} />
      case 'audio':
        return <AudioTab onImport={openPicker} />
      case 'voice':
        return <VoiceTab />
      case 'text':
        return <TextTab />
      case 'stickers':
        return <StickersTab />
      case 'effects':
        return <EffectsTab />
      case 'transitions':
        return <TransitionsTab />
      case 'filters':
        return <FiltersTab />
      case 'captions':
        return <CaptionsTab />
      case 'templates':
        return <TemplatesTab />
      default:
        return null
    }
    // openPicker is stable enough for this session; tabs do not depend on its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <aside
      className="library-panel"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          setDragActive(true)
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false)
      }}
      onDrop={onDrop}
      aria-label="Media library"
    >
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        hidden
        onChange={(event) => void onFileInput(event)}
      />
      <div className="library-tabs" role="tablist" aria-label="Library categories">
        {TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className="library-tab"
              data-active={tab === item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              <Icon size={12} />
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="library-body">
        {dragActive && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 4,
              padding: 12,
              border: '1px dashed rgba(139,108,255,.65)',
              borderRadius: 10,
              background: 'rgba(17,14,30,.96)',
              textAlign: 'center',
              fontSize: 11,
              color: '#c9bcff',
            }}
          >
            Drop media to import it into {project?.name ?? 'the project'}
          </div>
        )}
        {content}
        {busy && importStatus && (
          <div
            className="dropzone"
            style={{ cursor: 'default', borderStyle: 'solid' }}
            role="status"
          >
            <span className="icon-box">
              <Loader2 size={15} className="spin" />
            </span>
            <span style={{ minWidth: 0 }}>
              <b>Importing {importStatus.index} of {importStatus.total}</b>
              <span className="ellipsis" style={{ display: 'block' }}>
                {importStatus.name}
              </span>
            </span>
          </div>
        )}
        {!busy && (tab === 'media' || tab === 'audio') && (
          <MediaDropzone onClick={openPicker} compact />
        )}
      </div>
    </aside>
  )
}
