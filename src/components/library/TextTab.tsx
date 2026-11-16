import { useState } from 'react'
import { Plus, Type as TypeIcon } from 'lucide-react'
import { LibraryLabel, TabHeader } from './common'
import { TEXT_PRESETS } from '../../lib/constants'
import type { TextPreset } from '../../lib/constants'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

export function TextTab() {
  const addText = useEditor((state) => state.addText)
  const toast = useUI((state) => state.toast)
  const [custom, setCustom] = useState('')

  const add = (preset?: TextPreset, content?: string) => {
    const id = addText(preset ? { ...preset, style: { ...preset.style, ...(content ? { content } : {}) } } : undefined)
    if (id) toast(content ? 'Your text was added' : `${preset?.name ?? 'Text'} added to the timeline`, 'success')
  }

  return (
    <>
      <TabHeader
        title="Text"
        count={TEXT_PRESETS.length + 1}
        action={
          <button className="btn btn-subtle btn-sm" onClick={() => add(undefined, 'Your text')}>
            <Plus size={12} /> Add
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          placeholder="Type something…"
          value={custom}
          maxLength={160}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && custom.trim()) {
              add(TEXT_PRESETS[0], custom.trim())
              setCustom('')
            }
          }}
        />
        <button
          className="btn btn-primary"
          style={{ height: 32, flex: 'none' }}
          disabled={!custom.trim()}
          onClick={() => {
            add(TEXT_PRESETS[0], custom.trim())
            setCustom('')
          }}
        >
          <Plus size={13} />
        </button>
      </div>

      <LibraryLabel
        action={<span style={{ fontSize: 9, textTransform: 'none', letterSpacing: 0 }}>Click to add</span>}
      >
        Title styles
      </LibraryLabel>
      <div className="text-preset-grid">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="text-preset"
            onClick={() => add(preset)}
            title={`Add ${preset.name} text`}
          >
            <span
              className="preset-sample"
              style={{
                fontFamily: preset.style.fontFamily,
                fontWeight: preset.style.fontWeight,
                fontStyle: preset.style.italic ? 'italic' : undefined,
                letterSpacing: preset.style.letterSpacing
                  ? `${Math.min(3, preset.style.letterSpacing * 0.25)}px`
                  : undefined,
                color: preset.style.color === 'transparent' ? 'transparent' : preset.style.color,
                WebkitTextStroke:
                  preset.style.color === 'transparent' && preset.style.strokeWidth
                    ? `1px ${preset.style.strokeColor ?? '#fff'}`
                    : undefined,
                background: preset.style.gradient
                  ? `linear-gradient(100deg, ${preset.style.gradient.from}, ${preset.style.gradient.to})`
                  : preset.style.backgroundColor && preset.style.backgroundOpacity === 1
                    ? preset.style.backgroundColor
                    : undefined,
                WebkitBackgroundClip: preset.style.gradient ? 'text' : undefined,
                backgroundClip: preset.style.gradient ? 'text' : undefined,
                padding:
                  preset.style.backgroundColor && preset.style.backgroundOpacity === 1
                    ? '1px 7px'
                    : undefined,
                borderRadius: 3,
              }}
            >
              {preset.sample}
            </span>
            <span className="preset-name">{preset.name}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 9,
          border: '1px solid var(--line)',
          borderRadius: 9,
          background: 'rgba(255,255,255,.022)',
          alignItems: 'flex-start',
        }}
      >
        <TypeIcon size={14} color="var(--accent)" style={{ marginTop: 2, flex: 'none' }} />
        <span className="hint">
          Double-click a text clip to edit it in the inspector. Every style — fonts, gradient,
          stroke, shadow and animation — is adjustable.
        </span>
      </div>

      <LibraryLabel>Bundled fonts</LibraryLabel>
      <div className="chip-row">
        {['Inter', 'Space Grotesk', 'Bebas Neue', 'Oswald', 'Playfair Display', 'Pacifico'].map(
          (font) => (
            <span
              key={font}
              className="chip-tiny"
              style={{ display: 'inline-flex', alignItems: 'center', fontFamily: font, cursor: 'default' }}
            >
              {font}
            </span>
          ),
        )}
      </div>
    </>
  )
}
