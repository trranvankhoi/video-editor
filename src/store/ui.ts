import { create } from 'zustand'
import type { ClipKind, TrackKind } from '../lib/types'
import { uid } from '../lib/utils'

export type LibraryTab =
  | 'media'
  | 'audio'
  | 'voice'
  | 'text'
  | 'stickers'
  | 'effects'
  | 'transitions'
  | 'filters'
  | 'captions'
  | 'templates'

export type InspectorTab = 'basic' | 'animation' | 'adjust' | 'effects' | 'audio' | 'mask'

export interface Toast {
  id: string
  message: string
  tone: 'default' | 'success' | 'error'
}

export interface ImportStatus {
  active: boolean
  name: string
  index: number
  total: number
}

interface UIState {
  libraryTab: LibraryTab
  inspectorTab: InspectorTab
  exportOpen: boolean
  helpOpen: boolean
  shortcutsOpen: boolean
  settingsOpen: boolean
  importStatus: ImportStatus | null
  toasts: Toast[]
  previewQuality: 'full' | 'half'
  showSafeArea: boolean
  timelineFollow: boolean
  maskEditing: boolean
  setLibraryTab: (tab: LibraryTab) => void
  setInspectorTab: (tab: InspectorTab) => void
  setExportOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setImportStatus: (status: ImportStatus | null) => void
  setPreviewQuality: (quality: 'full' | 'half') => void
  setShowSafeArea: (show: boolean) => void
  setTimelineFollow: (follow: boolean) => void
  setMaskEditing: (editing: boolean) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  tabForClip: (kind: ClipKind | TrackKind | null) => InspectorTab
}

export const useUI = create<UIState>((set, get) => ({
  libraryTab: 'media',
  inspectorTab: 'basic',
  exportOpen: false,
  helpOpen: false,
  shortcutsOpen: false,
  settingsOpen: false,
  importStatus: null,
  toasts: [],
  previewQuality: 'full',
  showSafeArea: false,
  timelineFollow: true,
  maskEditing: false,
  setLibraryTab: (tab) => set({ libraryTab: tab }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setImportStatus: (importStatus) => set({ importStatus }),
  setPreviewQuality: (previewQuality) => set({ previewQuality }),
  setShowSafeArea: (showSafeArea) => set({ showSafeArea }),
  setTimelineFollow: (timelineFollow) => set({ timelineFollow }),
  setMaskEditing: (maskEditing) => set({ maskEditing }),
  toast: (message, tone = 'default') => {
    const id = uid('toast')
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
    }, 3800)
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  tabForClip: (kind) => {
    if (!kind) return 'basic'
    if (kind === 'audio') return get().inspectorTab === 'audio' ? 'audio' : 'audio'
    if (kind === 'text' || kind === 'sticker') return 'basic'
    return 'basic'
  },
}))
