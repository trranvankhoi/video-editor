import { ArrowRight, Layers, Loader2, Sparkles } from 'lucide-react'
import { TabHeader } from './common'
import { TEMPLATES } from '../../lib/templates'
import { formatDuration } from '../../lib/utils'
import { projectDuration } from '../../lib/project'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import { useState } from 'react'

export function TemplatesTab() {
  const applyTemplate = useEditor((state) => state.applyTemplate)
  const project = useEditor((state) => state.project)
  const toast = useUI((state) => state.toast)
  const [applying, setApplying] = useState<string | null>(null)

  const duration = project ? projectDuration(project) : 0

  return (
    <>
      <TabHeader
        title="Templates"
        count={TEMPLATES.length}
        action={
          <span className="badge cyan">
            <Sparkles size={10} /> Original
          </span>
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 9,
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'rgba(255,255,255,.02)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(139,108,255,.14)',
            color: '#b7a7ff',
            flex: 'none',
          }}
        >
          <Layers size={15} />
        </div>
        <div style={{ minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>Layered title packs</b>
          <span className="hint">
            Templates add styled text and sticker layers above your footage. Your media stays
            untouched.
          </span>
        </div>
      </div>

      <div className="template-grid">
        {TEMPLATES.map((template) => {
          const busy = applying === template.id
          return (
            <button
              key={template.id}
              className="template-card"
              style={{ background: template.background }}
              onClick={() => {
                if (!project) return
                setApplying(template.id)
                try {
                  applyTemplate(template)
                } finally {
                  setApplying(null)
                }
              }}
              disabled={Boolean(applying)}
              title={`Apply ${template.name}`}
            >
              <span className="template-badge">{template.badge}</span>
              <span
                className="template-title"
                style={{
                  fontFamily: `${template.previewFont}, Inter, sans-serif`,
                  color: template.accent,
                }}
              >
                {template.previewTitle}
              </span>
              <span className="template-desc">
                {busy ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Loader2 size={10} className="spin" /> Adding layers…
                  </span>
                ) : (
                  template.description
                )}
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 9,
                  bottom: 9,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,.16)',
                  color: '#fff',
                }}
              >
                <ArrowRight size={11} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Current timeline</span>
        <b style={{ color: 'var(--text-soft)', fontWeight: 550 }}>{formatDuration(duration)}</b>
      </div>
      <div className="hint">
        Want a different look? Apply a template, then tweak the text and colours in the
        inspector. Templates are fully editable — nothing is locked.
      </div>
      <button
        className="btn btn-sm btn-block"
        onClick={() =>
          toast('Save-as-template will arrive with the template library update.', 'default')
        }
      >
        <Layers size={13} /> Save current project as template
      </button>
    </>
  )
}
