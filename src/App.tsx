import { useEffect } from 'react'
import { Home } from './components/Home'
import { EditorShell } from './components/editor/EditorShell'
import { ExportModal } from './components/editor/ExportModal'
import { HelpModal, ShortcutsModal } from './components/editor/HelpModals'
import { SettingsModal } from './components/editor/SettingsModal'
import { Toasts } from './components/editor/Toasts'
import { APP_NAME, APP_TAGLINE } from './lib/constants'
import { useEditor } from './store/editor'

export default function App() {
  const project = useEditor((state) => state.project)

  useEffect(() => {
    document.title = project ? `${project.name} · ${APP_NAME}` : `${APP_NAME} — ${APP_TAGLINE}`
  }, [project])

  return (
    <>
      {project ? <EditorShell /> : <Home />}
      <Toasts />
      {project && <ExportModal />}
      <SettingsModal />
      <HelpModal />
      <ShortcutsModal />
    </>
  )
}
