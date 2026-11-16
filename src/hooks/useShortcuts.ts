import { useEffect } from 'react'
import { useEditor } from '../store/editor'
import { useUI } from '../store/ui'
import { isTypingTarget } from '../lib/utils'

export function useShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const state = useEditor.getState()
      const ui = useUI.getState()
      const key = event.key

      if (key === 'Escape') {
        if (ui.exportOpen) {
          ui.setExportOpen(false)
          return
        }
        if (ui.helpOpen) {
          ui.setHelpOpen(false)
          return
        }
        if (ui.shortcutsOpen) {
          ui.setShortcutsOpen(false)
          return
        }
        state.selectClip(null)
        return
      }

      if (mod && key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (mod && key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
        return
      }
      if (mod && key.toLowerCase() === 'b') {
        event.preventDefault()
        state.splitAtPlayhead()
        return
      }
      if (mod && key.toLowerCase() === 'd') {
        event.preventDefault()
        state.duplicateClip()
        return
      }
      if (mod && key.toLowerCase() === 'c') {
        event.preventDefault()
        state.copySelected()
        return
      }
      if (mod && key.toLowerCase() === 'v') {
        event.preventDefault()
        state.pasteClip()
        return
      }
      if (mod && key.toLowerCase() === 's') {
        event.preventDefault()
        void state.save()
        ui.toast('Project saved', 'success')
        return
      }
      if (mod && key.toLowerCase() === 'e') {
        event.preventDefault()
        ui.setExportOpen(true)
        return
      }
      if (mod && (key === '+' || key === '=')) {
        event.preventDefault()
        state.setZoom(state.zoom * 1.25)
        return
      }
      if (mod && key === '-') {
        event.preventDefault()
        state.setZoom(state.zoom / 1.25)
        return
      }
      if (mod) return

      switch (key) {
        case ' ':
          event.preventDefault()
          state.togglePlay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          state.setPlayhead(state.playhead - (event.shiftKey ? 1 : 1 / (state.project?.fps ?? 30)))
          break
        case 'ArrowRight':
          event.preventDefault()
          state.setPlayhead(state.playhead + (event.shiftKey ? 1 : 1 / (state.project?.fps ?? 30)))
          break
        case 'Home':
          event.preventDefault()
          state.setPlayhead(0)
          break
        case 'End': {
          event.preventDefault()
          if (state.project) {
            let end = 0
            for (const track of state.project.tracks)
              for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration)
            state.setPlayhead(end)
          }
          break
        }
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          if (event.shiftKey) state.rippleDelete()
          else state.removeSelected()
          break
        case 'k':
          state.pause()
          break
        case 'l':
          state.play()
          break
        case 'j':
          state.pause()
          state.setPlayhead(state.playhead - 1)
          break
        case 'm':
          event.preventDefault()
          if (event.shiftKey) {
            if (state.selectedClipId) {
              const selected = state.selectedClipId
              state.updateClip(selected, (clip) => {
                clip.muted = !clip.muted
              })
            }
          } else {
            const id = state.addMarker()
            if (id) ui.toast('Marker added at playhead', 'success')
          }
          break
        case 't':
          state.addText()
          break
        case '?':
          ui.setHelpOpen(true)
          break
        case '[':
          state.setZoom(state.zoom / 1.25)
          break
        case ']':
          state.setZoom(state.zoom * 1.25)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
