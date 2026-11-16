import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Circle,
  Film,
  Focus,
  Monitor,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Wand2,
  Zap,
} from 'lucide-react'
import { LibraryLabel, TabHeader } from './common'
import { EFFECTS, FILTER_PRESETS, TRANSITIONS } from '../../lib/constants'
import type { Adjustments, EffectId, TransitionType } from '../../lib/types'
import type { EffectGroup, TransitionGroup } from '../../lib/constants'
import { findClip } from '../../lib/project'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import { Slider } from '../ui'

function useSelectedClip() {
  const project = useEditor((state) => state.project)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  return useMemo(() => {
    if (!project || !selectedClipId) return null
    return findClip(project, selectedClipId)?.clip ?? null
  }, [project, selectedClipId])
}

const EFFECT_ICONS: Record<EffectGroup, ReactNode> = {
  color: <Palette size={18} />,
  light: <Sun size={18} />,
  texture: <Film size={18} />,
  retro: <Monitor size={18} />,
  nature: <Sparkles size={18} />,
  frame: <Focus size={18} />,
  distort: <Zap size={18} />,
}

const TRANSITION_ARROWS: Record<TransitionGroup, ReactNode> = {
  fade: (
    <>
      <Circle size={11} style={{ opacity: 0.4 }} />
      <Circle size={11} />
    </>
  ),
  slide: <ArrowRight size={13} />,
  zoom: <Focus size={14} />,
  wipe: (
    <>
      <ArrowRight size={11} style={{ opacity: 0.4 }} />
      <ArrowRight size={11} />
    </>
  ),
  shape: <Circle size={13} />,
  distort: <Zap size={13} />,
  light: <Sun size={13} />,
}

export function EffectsTab() {
  const selected = useSelectedClip()
  const addEffect = useEditor((state) => state.addEffect)
  const removeEffect = useEditor((state) => state.removeEffect)
  const updateEffect = useEditor((state) => state.updateEffect)
  const toast = useUI((state) => state.toast)
  const clip = selected

  const toggle = (id: EffectId) => {
    if (!clip) {
      toast('Select a clip on the timeline to apply an effect', 'error')
      return
    }
    const active = clip.effects.some((effect) => effect.id === id)
    if (active) {
      removeEffect(clip.id, id)
    } else {
      addEffect(clip.id, id)
      toast('Effect applied — adjust its strength in the inspector', 'success')
    }
  }

  return (
    <>
      <TabHeader title="Effects" count={EFFECTS.length} />
      {!clip && (
        <div className="hint" style={{ color: 'var(--warning)' }}>
          Select a clip on the timeline to apply effects.
        </div>
      )}
      <div className="effects-grid">
        {EFFECTS.map((effect) => {
          const active = Boolean(clip?.effects.some((item) => item.id === effect.id))
          return (
            <button
              key={effect.id}
              className="effect-card"
              data-active={active}
              onClick={() => toggle(effect.id)}
              title={effect.hint}
            >
              <div
                className="effect-visual"
                style={{ '--swatch': effect.swatch } as React.CSSProperties}
              >
                {EFFECT_ICONS[effect.group]}
              </div>
              {active && (
                <span className="effect-active">
                  <Sparkles size={9} />
                </span>
              )}
              <div className="effect-label">{effect.name}</div>
            </button>
          )
        })}
      </div>

      {clip && clip.effects.length > 0 && (
        <>
          <LibraryLabel>Applied to this clip</LibraryLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clip.effects.map((effect) => {
              const preset = EFFECTS.find((item) => item.id === effect.id)
              return (
                <div key={effect.id}>
                  <Slider
                    label={preset?.name ?? effect.id}
                    value={effect.intensity}
                    min={0}
                    max={100}
                    format={(value) => `${Math.round(value)}%`}
                    onChange={(value) => updateEffect(clip.id, effect.id, value)}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="hint">
        Effects are rendered live on the preview canvas and baked into exports. Stack as many as
        you like; they are processed in order.
      </div>
    </>
  )
}

export function TransitionsTab() {
  const selected = useSelectedClip()
  const setTransition = useEditor((state) => state.setTransition)
  const toast = useUI((state) => state.toast)
  const clip = selected

  const apply = (type: TransitionType | null) => {
    if (!clip) {
      toast('Select the incoming clip on the timeline first', 'error')
      return
    }
    setTransition(clip.id, type, clip.transitionIn?.duration ?? 0.6)
    toast(type ? 'Transition added at the start of the clip' : 'Transition removed', 'success')
  }

  return (
    <>
      <TabHeader title="Transitions" count={TRANSITIONS.length} />
      {!clip ? (
        <div className="hint" style={{ color: 'var(--warning)' }}>
          Select a clip that follows another clip to add a transition.
        </div>
      ) : (
        <div
          className="hint"
          style={{
            padding: '7px 9px',
            borderRadius: 7,
            border: '1px solid var(--line)',
            background: 'rgba(255,255,255,.02)',
          }}
        >
          Applying to <b style={{ color: 'var(--text-soft)' }}>{clip.name}</b>. Transitions blend
          with the clip immediately before it on the same track.
        </div>
      )}
      <div className="transition-grid">
        <button
          className="transition-card"
          data-active={!clip?.transitionIn}
          onClick={() => apply(null)}
        >
          <span className="arrow">
            <span style={{ fontSize: 14 }}>—</span>
          </span>
          None
        </button>
        {TRANSITIONS.map((transition) => (
          <button
            key={transition.id}
            className="transition-card"
            data-active={clip?.transitionIn?.type === transition.id}
            onClick={() => apply(transition.id)}
            title={transition.hint}
          >
            <span className="arrow">{TRANSITION_ARROWS[transition.group]}</span>
            {transition.name}
          </button>
        ))}
      </div>

      {clip?.transitionIn && (
        <Slider
          label="Transition duration"
          value={clip.transitionIn.duration}
          min={0.15}
          max={Math.min(2, clip.duration)}
          step={0.05}
          format={(value) => `${value.toFixed(2)}s`}
          onChange={(value) => setTransition(clip.id, clip.transitionIn!.type, value)}
        />
      )}

      <div className="hint">
        Tip: transitions only appear when two clips touch on the same track. Drag a clip so its
        edges snap together, then pick a style.
      </div>
    </>
  )
}

const adjustmentKey = (adjustments: Adjustments) =>
  Object.entries(adjustments)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|')

export function FiltersTab() {
  const selected = useSelectedClip()
  const applyFilterPreset = useEditor((state) => state.applyFilterPreset)
  const toast = useUI((state) => state.toast)
  const clip = selected

  const current = clip ? adjustmentKey(clip.adjustments) : ''

  return (
    <>
      <TabHeader title="Filters" count={FILTER_PRESETS.length} />
      {!clip && (
        <div className="hint" style={{ color: 'var(--warning)' }}>
          Select a clip to apply a colour preset.
        </div>
      )}
      <div className="filter-grid">
        {FILTER_PRESETS.map((preset) => {
          const active = clip
            ? adjustmentKey({ ...clip.adjustments, ...preset.adjustments }) === current &&
              (preset.id !== 'original' ||
                Object.values(clip.adjustments).every((value) => value === 0))
            : false
          return (
            <button
              key={preset.id}
              className="filter-card"
              data-active={active}
              onClick={() => {
                if (!clip) {
                  toast('Select a clip first', 'error')
                  return
                }
                applyFilterPreset(clip.id, preset)
                toast(`${preset.name} filter applied`, 'success')
              }}
            >
              <span className="filter-swatch" style={{ background: preset.swatch }} />
              {preset.name}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 9,
          border: '1px solid var(--line)',
          borderRadius: 9,
          background: 'rgba(255,255,255,.022)',
        }}
      >
        <SlidersHorizontal size={14} color="var(--accent)" style={{ flex: 'none' }} />
        <span className="hint">
          Fine-tune brightness, contrast, saturation, temperature, tint and vignette in the
          Adjust tab of the inspector.
        </span>
      </div>
      <div className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Palette size={12} /> Presets write real adjustment values — no image is modified.
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted-2)' }}>
        <Wand2 size={12} />
        <span className="hint">More cinematic looks are on the roadmap.</span>
      </div>
    </>
  )
}
