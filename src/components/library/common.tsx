import type { DragEvent } from 'react'
import type { ReactNode } from 'react'
import { UploadCloud } from 'lucide-react'

export const ASSET_DRAG_TYPE = 'application/x-clippro-asset'

export function beginAssetDrag(event: DragEvent, assetId: string) {
  event.dataTransfer.setData(ASSET_DRAG_TYPE, assetId)
  event.dataTransfer.setData('text/plain', assetId)
  event.dataTransfer.effectAllowed = 'copy'
}

export function TabHeader({
  title,
  count,
  action,
}: {
  title: string
  count?: string | number
  action?: ReactNode
}) {
  return (
    <div className="library-title">
      <h3>
        {title}
        {count !== undefined && (
          <span className="count" style={{ marginLeft: 6 }}>
            {count}
          </span>
        )}
      </h3>
      {action}
    </div>
  )
}

export function MediaDropzone({
  onClick,
  label = 'Import media',
  hint = 'Drop files here or click to browse',
  compact = false,
}: {
  onClick: () => void
  label?: string
  hint?: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      className="dropzone"
      style={compact ? { padding: '9px 10px' } : undefined}
      onClick={onClick}
    >
      <span className="icon-box">
        <UploadCloud size={15} />
      </span>
      <span style={{ minWidth: 0, textAlign: 'left' }}>
        <b>{label}</b>
        <span className="ellipsis" style={{ display: 'block' }}>
          {hint}
        </span>
      </span>
    </button>
  )
}

export function LibraryLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="library-section-label">
      <span>{children}</span>
      {action}
    </div>
  )
}
