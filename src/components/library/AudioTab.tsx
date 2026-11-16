import { useMemo, useState } from 'react'
import {
  AudioLines,
  Mic,
  Music,
  Plus,
  Square,
  Trash2,
  UploadCloud,
  Volume2,
  X,
} from 'lucide-react'
import { beginAssetDrag, LibraryLabel, MediaDropzone, TabHeader } from './common'
import { Waveform } from '../Waveform'
import { useRecorder } from '../../hooks/useRecorder'
import { useMediaImport } from '../../hooks/useMediaImport'
import { formatDuration } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import type { Asset } from '../../lib/types'
import { IconButton, Modal, SearchInput, Slider } from '../ui'

function clock(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function AudioTab({ onImport }: { onImport: () => void }) {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const addMediaAsset = useEditor((state) => state.addMediaAsset)
  const removeAsset = useEditor((state) => state.removeAsset)
  const detachAudio = useEditor((state) => state.detachAudio)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const masterVolume = useEditor((state) => state.masterVolume)
  const setMasterVolume = useEditor((state) => state.setMasterVolume)
  const toast = useUI((state) => state.toast)
  const { importFiles } = useMediaImport()
  const [search, setSearch] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Asset | null>(null)

  const recorder = useRecorder(
    (file) => {
      void importFiles([file], { addToTimeline: true })
      toast('Voiceover recorded and added to the timeline', 'success')
    },
    (message) => toast(message, 'error'),
  )

  const list = useMemo(() => {
    if (!project) return []
    const query = search.trim().toLowerCase()
    return project.assetIds
      .map((id) => assets[id])
      .filter((asset): asset is Asset => Boolean(asset) && asset.type === 'audio')
      .filter((asset) => !query || asset.name.toLowerCase().includes(query))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [project, assets, search])

  const selectedVideoWithAudio = useMemo(() => {
    if (!project || !selectedClipId) return false
    for (const track of project.tracks) {
      const clip = track.clips.find((item) => item.id === selectedClipId)
      if (clip && 'assetId' in clip && clip.kind === 'video') {
        return Boolean(assets[clip.assetId]?.hasAudio)
      }
    }
    return false
  }, [project, selectedClipId, assets])

  return (
    <>
      <TabHeader
        title="Audio"
        count={list.length}
        action={
          <button className="btn btn-subtle btn-sm" onClick={onImport}>
            <UploadCloud size={12} /> Import
          </button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search audio" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--line)',
          background:
            'radial-gradient(220px 90px at 0% 0%, rgba(34,211,238,.08), transparent 70%), rgba(255,255,255,.02)',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            background:
              recorder.phase === 'recording'
                ? 'rgba(255,93,115,.16)'
                : 'rgba(34,211,238,.12)',
            color: recorder.phase === 'recording' ? 'var(--danger)' : 'var(--cyan)',
            flex: 'none',
          }}
        >
          <Mic size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 11, fontWeight: 550 }}>
            {recorder.phase === 'recording'
              ? `Recording ${clock(recorder.seconds)}`
              : recorder.phase === 'requesting'
                ? 'Waiting for microphone…'
                : recorder.phase === 'saving'
                  ? 'Saving recording…'
                  : 'Voiceover'}
          </b>
          <span className="hint">
            {recorder.phase === 'recording'
              ? 'Speak clearly. The clip will land on the audio track.'
              : 'Record narration straight onto the timeline.'}
          </span>
        </div>
        {recorder.phase === 'recording' ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton label="Stop recording" onClick={recorder.stop}>
              <Square size={13} fill="currentColor" />
            </IconButton>
            <IconButton label="Cancel recording" onClick={recorder.cancel}>
              <X size={14} />
            </IconButton>
          </div>
        ) : (
          <button
            className="btn btn-sm"
            onClick={() => void recorder.start()}
            disabled={recorder.phase !== 'idle'}
          >
            <Mic size={12} /> Record
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <>
          <MediaDropzone
            onClick={onImport}
            label="Import audio"
            hint="MP3, WAV, M4A, AAC, OGG, FLAC"
          />
          <div className="library-empty">
            <div className="circle">
              <Music size={18} />
            </div>
            <h4>No audio yet</h4>
            <p>Import music, drop in a sound effect, or record a voiceover.</p>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((asset) => (
            <div
              key={asset.id}
              className="asset-row"
              draggable
              onDragStart={(event) => beginAssetDrag(event, asset.id)}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {asset.waveform && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: '8px 40px 8px 46px',
                    opacity: 0.25,
                    color: '#7fe8ff',
                  }}
                >
                  <Waveform peaks={asset.waveform} buckets={48} className="" />
                </div>
              )}
              <span className="asset-icon">
                <AudioLines size={15} />
              </span>
              <div className="asset-info" style={{ position: 'relative' }}>
                <b title={asset.name}>{asset.name}</b>
                <span>{formatDuration(asset.duration)} · audio</span>
              </div>
              <div className="row-actions" style={{ position: 'relative' }}>
                <IconButton
                  label={`Add ${asset.name} to timeline`}
                  size="sm"
                  onClick={() => {
                    addMediaAsset(asset.id)
                    toast('Audio added at the playhead', 'success')
                  }}
                >
                  <Plus size={13} />
                </IconButton>
                <IconButton
                  label={`Remove ${asset.name}`}
                  size="sm"
                  onClick={() => setRemoveTarget(asset)}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <LibraryLabel>Mixer</LibraryLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Volume2 size={14} color="var(--muted)" />
        <div style={{ flex: 1 }}>
          <Slider
            label="Master volume"
            value={Math.round(masterVolume * 100)}
            min={0}
            max={100}
            format={(value) => `${value}%`}
            compact
            onChange={(value) => setMasterVolume(value / 100)}
          />
        </div>
      </div>
      <div className="hint">
        Use the speaker icon on the timeline to mute individual tracks. Clip volume and fades
        live in the inspector.
      </div>

      {selectedVideoWithAudio && (
        <button className="btn btn-sm btn-block" onClick={() => detachAudio(selectedClipId!)}>
          <AudioLines size={13} /> Detach audio from selected clip
        </button>
      )}

      {removeTarget && (
        <Modal
          title="Remove audio?"
          subtitle="Clips using this audio will be removed as well."
          size="narrow"
          onClose={() => setRemoveTarget(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  removeAsset(removeTarget.id)
                  setRemoveTarget(null)
                  toast('Audio removed')
                }}
              >
                <Trash2 size={13} /> Remove audio
              </button>
            </>
          }
        >
          <b style={{ fontSize: 12 }}>{removeTarget.name}</b>
          <span className="hint">{formatDuration(removeTarget.duration)}</span>
        </Modal>
      )}
    </>
  )
}
