import { useCallback, useState } from 'react'
import { createAssetFromFile, getAssetType } from '../lib/media'
import { saveAssetRecord } from '../lib/db'
import { projectDuration } from '../lib/project'
import type { Asset } from '../lib/types'
import { useEditor } from '../store/editor'
import { useUI } from '../store/ui'

interface ImportOptions {
  addToTimeline?: boolean
  targetTrackId?: string
}

export function useMediaImport() {
  const [busy, setBusy] = useState(false)
  const importFiles = useCallback(async (files: FileList | File[], options: ImportOptions = {}) => {
    const state = useEditor.getState()
    if (!state.project) return
    const all = Array.from(files)
    if (all.length === 0) return
    const supported = all.filter((file) => getAssetType(file))
    const unsupported = all.length - supported.length
    if (unsupported > 0) {
      useUI.getState().toast(
        `${unsupported} file${unsupported > 1 ? 's were' : ' was'} skipped (unsupported format)`,
        'error',
      )
    }
    if (supported.length === 0) return
    setBusy(true)
    const added: Asset[] = []
    for (let index = 0; index < supported.length; index++) {
      const file = supported[index]
      useUI.getState().setImportStatus({
        active: true,
        name: file.name,
        index: index + 1,
        total: supported.length,
      })
      try {
        const asset = await createAssetFromFile(
          file,
          ({ name, index: i, total }) =>
            useUI.getState().setImportStatus({ active: true, name, index: i + 1, total }),
          index,
          supported.length,
        )
        await saveAssetRecord(asset, file)
        useEditor.getState().addAssets([asset])
        added.push(asset)
      } catch (error) {
        console.error(error)
        useUI.getState().toast(
          error instanceof Error ? error.message : `Could not import ${file.name}`,
          'error',
        )
      }
    }
    useUI.getState().setImportStatus(null)
    setBusy(false)
    if (added.length > 0) {
      useUI
        .getState()
        .toast(
          `Imported ${added.length} file${added.length > 1 ? 's' : ''}`,
          'success',
        )
      useUI
        .getState()
        .setLibraryTab(added.every((asset) => asset.type === 'audio') ? 'audio' : 'media')
      if (options.addToTimeline) {
        for (const asset of added) {
          const latest = useEditor.getState()
          if (!latest.project) break
          const at = projectDuration(latest.project)
          latest.addMediaAsset(asset.id, { start: at, trackId: options.targetTrackId })
        }
      }
    }
  }, [])
  return { importFiles, busy }
}
