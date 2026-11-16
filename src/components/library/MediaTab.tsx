import { useMemo, useState } from 'react'
import {
  Clock,
  Film,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Video,
} from 'lucide-react'
import { beginAssetDrag, LibraryLabel, MediaDropzone, TabHeader } from './common'
import { formatBytes, formatDuration } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import type { Asset } from '../../lib/types'
import { IconButton, Modal, SearchInput } from '../ui'

export function MediaTab({ onImport }: { onImport: () => void }) {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const addMediaAsset = useEditor((state) => state.addMediaAsset)
  const removeAsset = useEditor((state) => state.removeAsset)
  const toast = useUI((state) => state.toast)
  const [search, setSearch] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Asset | null>(null)

  const list = useMemo(() => {
    if (!project) return []
    const query = search.trim().toLowerCase()
    return project.assetIds
      .map((id) => assets[id])
      .filter((asset): asset is Asset => Boolean(asset) && asset.type !== 'audio')
      .filter((asset) => !query || asset.name.toLowerCase().includes(query))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [project, assets, search])

  const audioCount = project
    ? project.assetIds.filter((id) => assets[id]?.type === 'audio').length
    : 0

  const addToTimeline = (asset: Asset) => {
    const id = addMediaAsset(asset.id)
    if (id) toast(`Added “${asset.name}” to the timeline`, 'success')
  }

  return (
    <>
      <TabHeader
        title="Media"
        count={list.length}
        action={
          <button className="btn btn-subtle btn-sm" onClick={onImport}>
            <UploadCloud size={12} /> Import
          </button>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search media" />

      {list.length === 0 ? (
        <>
          <MediaDropzone onClick={onImport} />
          <div className="library-empty">
            <div className="circle">
              <Film size={18} />
            </div>
            <h4>{search ? 'No matching media' : 'Your library is empty'}</h4>
            <p>
              {search
                ? 'Try another search term.'
                : 'Drop video, photos or graphics here. Everything is processed locally.'}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="media-grid">
            {list.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                onAdd={() => addToTimeline(asset)}
                onRemove={() => setRemoveTarget(asset)}
              />
            ))}
          </div>
          <LibraryLabel>Tip</LibraryLabel>
          <p className="hint" style={{ margin: 0 }}>
            Drag a card onto any video track, or click it to add at the playhead.
          </p>
        </>
      )}
      {audioCount > 0 && (
        <div className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Clock size={12} /> {audioCount} audio asset{audioCount > 1 ? 's' : ''} live in the
          Audio tab.
        </div>
      )}

      {removeTarget && (
        <Modal
          title="Remove media?"
          subtitle="This also removes every clip using it from the timeline."
          size="narrow"
          onClose={() => setRemoveTarget(null)}
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
              <Trash2 size={16} />
            </div>
          }
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
                  toast('Media removed from the project')
                }}
              >
                <Trash2 size={13} /> Remove media
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {removeTarget.thumbnail ? (
              <img
                src={removeTarget.thumbnail}
                alt=""
                style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6 }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 40,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--panel-3)',
                }}
              >
                <ImageIcon size={16} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 12 }} className="ellipsis">
                {removeTarget.name}
              </b>
              <span className="hint">
                {formatBytes(removeTarget.size)} ·{' '}
                {removeTarget.type === 'image'
                  ? `${removeTarget.width}×${removeTarget.height}`
                  : formatDuration(removeTarget.duration)}
              </span>
            </div>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Media is stored only in this browser. Removing it cannot be undone.
          </p>
        </Modal>
      )}
    </>
  )
}

function MediaCard({
  asset,
  onAdd,
  onRemove,
}: {
  asset: Asset
  onAdd: () => void
  onRemove: () => void
}) {
  const isVideo = asset.type === 'video'
  return (
    <div
      className="media-card"
      draggable
      onDragStart={(event) => beginAssetDrag(event, asset.id)}
      onDoubleClick={onAdd}
      title={`${asset.name} — drag to the timeline or double-click to add`}
    >
      <div className="thumb">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt="" draggable={false} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted-2)',
            }}
          >
            <ImageIcon size={20} />
          </div>
        )}
        <span className="asset-kind">
          {isVideo ? <Video size={8} /> : <ImageIcon size={8} />}
          {isVideo ? 'VIDEO' : 'IMAGE'}
        </span>
        <span className="duration">
          {isVideo ? formatDuration(asset.duration) : `${asset.width}×${asset.height}`}
        </span>
        <div className="card-actions">
          <IconButton label={`Add ${asset.name} to timeline`} size="sm" onClick={onAdd}>
            <Plus size={13} />
          </IconButton>
          <IconButton label={`Remove ${asset.name}`} size="sm" onClick={onRemove}>
            <Trash2 size={12} />
          </IconButton>
        </div>
      </div>
      <div className="card-foot">
        <div className="name" title={asset.name}>
          {asset.name}
        </div>
      </div>
    </div>
  )
}

export function NoSearch({ onClear }: { onClear: () => void }) {
  return (
    <div className="library-empty">
      <div className="circle">
        <Search size={17} />
      </div>
      <h4>Nothing found</h4>
      <button className="btn btn-sm" onClick={onClear}>
        Clear search
      </button>
    </div>
  )
}
