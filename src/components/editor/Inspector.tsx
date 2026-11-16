import { useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AudioLines,
  Diamond,
  Film,
  FlipHorizontal2,
  FlipVertical2,
  Gauge,
  Image as ImageIcon,
  Music,
  RotateCw,
  Scissors,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Upload,
  Volume2,
  Wand2,
  X,
} from 'lucide-react'
import {
  ANIMATIONS,
  ASPECT_PRESETS,
  BLEND_MODES,
  EFFECTS,
  FILTER_PRESETS,
  FONT_OPTIONS,
  SPEED_PRESETS,
  TRANSITIONS,
} from '../../lib/constants'
import {
  EASING_OPTIONS,
  KEYFRAME_PROPERTIES,
  createMask,
  defaultKeyframeValue,
  findClip,
  keyframesFor,
  projectDuration,
  sampleKeyframe,
} from '../../lib/project'
import { importLut, listLuts, removeLut } from '../../lib/lut'
import type {
  Animation,
  AnimationType,
  BaseClip,
  Clip,
  ColorGrade,
  ColorWheel,
  Easing,
  EffectId,
  FitMode,
  Keyframe,
  KeyframeProperty,
  Mask,
  MaskShape,
  TextData,
  TransitionType,
} from '../../lib/types'
import { DEFAULT_ADJUSTMENTS } from '../../lib/types'
import { clamp, formatDuration } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI, type InspectorTab } from '../../store/ui'
import { ColorField, IconButton, Section, Segmented, Slider, ToggleRow } from '../ui'

const CLIP_ICONS = {
  video: Film,
  image: ImageIcon,
  audio: Music,
  text: Type,
  sticker: Sticker,
} as const

type NumericAdjustment =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'exposure'
  | 'temperature'
  | 'tint'
  | 'vignette'

const KIND_LABELS: Record<Clip['kind'], string> = {
  video: 'Video clip',
  image: 'Image clip',
  audio: 'Audio clip',
  text: 'Text layer',
  sticker: 'Sticker',
}

export function Inspector() {
  const project = useEditor((state) => state.project)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const tab = useUI((state) => state.inspectorTab)
  const setTab = useUI((state) => state.setInspectorTab)
  const duplicateClip = useEditor((state) => state.duplicateClip)
  const removeSelected = useEditor((state) => state.removeSelected)

  const found = project && selectedClipId ? findClip(project, selectedClipId) : null
  const clip = found?.clip ?? null
  const track = found?.track ?? null

  const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: 'basic', label: 'Basic' },
    { id: 'animation', label: 'Animation' },
    { id: 'adjust', label: 'Adjust' },
    { id: 'effects', label: 'Effects' },
    { id: 'mask', label: 'Mask' },
  ]
  if (clip && clip.kind !== 'text' && clip.kind !== 'sticker') {
    tabs.push({ id: 'audio', label: 'Audio' })
  }

  if (!project) return null

  return (
    <aside className="inspector">
      {clip ? (
        <>
          <div className="inspector-head">
            {(() => {
              const Icon = CLIP_ICONS[clip.kind]
              return (
                <div className="clip-kind">
                  <Icon size={14} />
                </div>
              )
            })()}
            <div className="clip-title">
              <b>{clip.name}</b>
              <span>
                {KIND_LABELS[clip.kind]} · {clip.duration.toFixed(2)}s
                {track ? ` · ${track.name}` : ''}
              </span>
            </div>
            <IconButton label="Duplicate clip (Ctrl+D)" onClick={() => duplicateClip(clip.id)}>
              <Film size={13} />
            </IconButton>
            <IconButton label="Delete clip (Del)" onClick={removeSelected}>
              <Trash2 size={13} />
            </IconButton>
          </div>
          <div className="inspector-tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className="inspector-tab"
                data-active={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="inspector-body">
            {tab === 'basic' && <BasicPanel clip={clip} />}
            {tab === 'animation' && <AnimationPanel clip={clip} />}
            {tab === 'adjust' && <AdjustPanel clip={clip} />}
            {tab === 'effects' && <EffectsPanel clip={clip} />}
            {tab === 'audio' && <AudioPanel clip={clip} />}
            {tab === 'mask' && <MaskPanel clip={clip} />}
          </div>
        </>
      ) : (
        <ProjectPanel />
      )}
    </aside>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function useClipPatch(clip: Clip) {
  const updateClip = useEditor((state) => state.updateClip)
  return (patcher: (clip: Clip) => void, mergeKey?: string) => {
    updateClip(clip.id, patcher, mergeKey ?? `clip:${clip.id}`)
  }
}

function useTextPatch(clip: Clip) {
  const updateClip = useEditor((state) => state.updateClip)
  return (patch: Partial<TextData>, mergeKey?: string) => {
    updateClip(
      clip.id,
      (target) => {
        if (target.kind === 'text') Object.assign(target.text, patch)
      },
      mergeKey ?? `text:${clip.id}`,
    )
  }
}

function applyStaticProperty(clip: Clip, property: KeyframeProperty, value: number) {
  switch (property) {
    case 'x':
      clip.transform.x = value
      break
    case 'y':
      clip.transform.y = value
      break
    case 'scale':
      clip.transform.scale = value
      break
    case 'rotation':
      clip.transform.rotation = value
      break
    case 'opacity':
      clip.opacity = value
      break
    case 'volume':
      clip.volume = value
      break
    case 'maskX':
      if (clip.mask) clip.mask.x = value
      break
    case 'maskY':
      if (clip.mask) clip.mask.y = value
      break
    case 'maskRotation':
      if (clip.mask) clip.mask.rotation = value
      break
    default:
      break
  }
}

function KeyframeButton({ clip, property }: { clip: Clip; property: KeyframeProperty }) {
  const playhead = useEditor((state) => state.playhead)
  const toggleKeyframe = useEditor((state) => state.toggleKeyframe)
  const local = clamp(playhead - clip.start, 0, clip.duration)
  const atPlayhead = clip.keyframes.some(
    (keyframe) => keyframe.property === property && Math.abs(keyframe.time - local) <= 0.03,
  )
  const keyed = clip.keyframes.some((keyframe) => keyframe.property === property)
  return (
    <button
      type="button"
      className="kf-toggle"
      data-active={atPlayhead}
      data-keyed={keyed}
      title={atPlayhead ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}
      aria-label={atPlayhead ? 'Remove keyframe' : 'Add keyframe'}
      onClick={() => toggleKeyframe(clip.id, property)}
    >
      <Diamond size={11} fill={atPlayhead ? 'currentColor' : 'none'} />
    </button>
  )
}

function KeyedSlider({
  clip,
  property,
  label,
  min,
  max,
  step,
  format,
}: {
  clip: Clip
  property: KeyframeProperty
  label: string
  min: number
  max: number
  step: number
  format?: (value: number) => string
}) {
  const playhead = useEditor((state) => state.playhead)
  const setKeyframe = useEditor((state) => state.setKeyframe)
  const updateClip = useEditor((state) => state.updateClip)
  const local = clamp(playhead - clip.start, 0, clip.duration)
  const sampled = sampleKeyframe(clip, property, local)
  const keyed = sampled !== null
  const value = sampled ?? defaultKeyframeValue(clip, property)

  return (
    <Slider
      label={label}
      value={Number(value.toFixed(step < 0.1 ? 2 : step < 1 ? 2 : 0))}
      min={min}
      max={max}
      step={step}
      format={format}
      action={<KeyframeButton clip={clip} property={property} />}
      onChange={(next) => {
        if (keyed) {
          setKeyframe(clip.id, property, local, next)
        } else {
          updateClip(
            clip.id,
            (target) => applyStaticProperty(target, property, next),
            `clip:${clip.id}:${property}`,
          )
        }
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Basic                                                                       */
/* -------------------------------------------------------------------------- */

function BasicPanel({ clip }: { clip: Clip }) {
  const assets = useEditor((state) => state.assets)
  const asset = 'assetId' in clip ? assets[clip.assetId] : undefined
  const patch = useClipPatch(clip)
  const patchText = useTextPatch(clip)
  const projectWidth = useProjectWidth()
  const projectHeight = useProjectHeight()

  return (
    <>
      {clip.kind === 'text' && (
        <Section title="Text" icon={<Type size={12} />}>
          <div className="field">
            <textarea
              className="textarea"
              rows={3}
              value={clip.text.content}
              aria-label="Text content"
              onChange={(event) => patchText({ content: event.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Font</span>
            <select
              className="select"
              value={clip.text.fontFamily}
              onChange={(event) => {
                const font = FONT_OPTIONS.find((item) => item.family === event.target.value)
                patchText({
                  fontFamily: event.target.value,
                  fontWeight: font?.weights.includes(clip.text.fontWeight)
                    ? clip.text.fontWeight
                    : font?.weights[Math.min(2, (font?.weights.length ?? 1) - 1)] ?? 500,
                })
              }}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.label} — {font.sample}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Size</span>
              <input
                className="input"
                type="number"
                min={8}
                max={420}
                value={clip.text.fontSize}
                onChange={(event) => patchText({ fontSize: clamp(Number(event.target.value), 8, 420) })}
              />
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Weight</span>
              <select
                className="select"
                value={clip.text.fontWeight}
                onChange={(event) => patchText({ fontWeight: Number(event.target.value) })}
              >
                {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <span className="field-label">Colour</span>
            <ColorField
              label="Text colour"
              value={clip.text.color}
              onChange={(color) => patchText({ color, gradient: null })}
            />
          </div>
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            <button
              type="button"
              data-active={clip.text.align === 'left'}
              onClick={() => patchText({ align: 'left' })}
              aria-label="Align left"
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              data-active={clip.text.align === 'center'}
              onClick={() => patchText({ align: 'center' })}
              aria-label="Align centre"
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              data-active={clip.text.align === 'right'}
              onClick={() => patchText({ align: 'right' })}
              aria-label="Align right"
            >
              <AlignRight size={13} />
            </button>
          </div>
          <Slider
            label="Line height"
            value={clip.text.lineHeight}
            min={0.7}
            max={2.2}
            step={0.01}
            onChange={(lineHeight) => patchText({ lineHeight })}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Letter spacing"
            value={clip.text.letterSpacing}
            min={-4}
            max={24}
            step={0.1}
            onChange={(letterSpacing) => patchText({ letterSpacing })}
            format={(value) => `${value.toFixed(1)}px`}
          />
          <ToggleRow
            label="Italic"
            checked={clip.text.italic}
            onChange={(italic) => patchText({ italic })}
          />
          <ToggleRow
            label="Underline"
            checked={clip.text.underline}
            onChange={(underline) => patchText({ underline })}
          />
        </Section>
      )}

      {clip.kind === 'text' && (
        <Section title="Gradient & outline" defaultOpen={false}>
          <ToggleRow
            label="Gradient fill"
            checked={Boolean(clip.text.gradient)}
            onChange={(on) =>
              patchText({
                gradient: on
                  ? { from: clip.text.gradient?.from ?? '#a78bfa', to: clip.text.gradient?.to ?? '#22d3ee' }
                  : null,
              })
            }
          />
          {clip.text.gradient && (
            <>
              <ColorField
                label="Gradient start"
                value={clip.text.gradient.from}
                onChange={(from) =>
                  patchText({ gradient: { from, to: clip.text.gradient?.to ?? '#22d3ee' } })
                }
              />
              <ColorField
                label="Gradient end"
                value={clip.text.gradient.to}
                onChange={(to) =>
                  patchText({ gradient: { from: clip.text.gradient?.from ?? '#a78bfa', to } })
                }
              />
            </>
          )}
          <ColorField
            label="Outline colour"
            value={clip.text.strokeColor}
            onChange={(strokeColor) => patchText({ strokeColor })}
          />
          <Slider
            label="Outline width"
            value={clip.text.strokeWidth}
            min={0}
            max={20}
            step={0.5}
            onChange={(strokeWidth) => patchText({ strokeWidth })}
            format={(value) => `${value}px`}
          />
          <Slider
            label="Shadow blur"
            value={clip.text.shadowBlur}
            min={0}
            max={80}
            onChange={(shadowBlur) => patchText({ shadowBlur })}
            format={(value) => `${value}px`}
          />
          <Slider
            label="Shadow offset"
            value={clip.text.shadowOffsetY}
            min={-30}
            max={30}
            onChange={(shadowOffsetY) => patchText({ shadowOffsetY })}
            format={(value) => `${value}px`}
          />
        </Section>
      )}

      {clip.kind === 'text' && (
        <Section title="Text background" defaultOpen={false}>
          <ToggleRow
            label="Background plate"
            checked={Boolean(clip.text.backgroundColor)}
            onChange={(on) => patchText({ backgroundColor: on ? '#09090c' : null })}
          />
          {clip.text.backgroundColor && (
            <>
              <ColorField
                label="Background colour"
                value={clip.text.backgroundColor}
                onChange={(backgroundColor) => patchText({ backgroundColor })}
              />
              <Slider
                label="Opacity"
                value={clip.text.backgroundOpacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(backgroundOpacity) => patchText({ backgroundOpacity })}
                format={(value) => `${Math.round(value * 100)}%`}
              />
              <Slider
                label="Corner radius"
                value={clip.text.backgroundRadius}
                min={0}
                max={80}
                onChange={(backgroundRadius) => patchText({ backgroundRadius })}
                format={(value) => `${value}px`}
              />
              <Slider
                label="Padding X"
                value={clip.text.paddingX}
                min={0}
                max={120}
                onChange={(paddingX) => patchText({ paddingX })}
                format={(value) => `${value}px`}
              />
              <Slider
                label="Padding Y"
                value={clip.text.paddingY}
                min={0}
                max={120}
                onChange={(paddingY) => patchText({ paddingY })}
                format={(value) => `${value}px`}
              />
            </>
          )}
        </Section>
      )}

      {clip.kind === 'sticker' && (
        <Section title="Sticker" icon={<Sticker size={12} />}>
          <Slider
            label="Size"
            value={Math.round(clip.sticker.size * 100)}
            min={4}
            max={80}
            onChange={(value) =>
              patch((target) => {
                if (target.kind === 'sticker') target.sticker.size = value / 100
              })
            }
            format={(value) => `${value}%`}
          />
          <div className="animation-preview-row">
            <img src={clip.sticker.src} alt="" width={28} height={28} />
            <span>{clip.sticker.label}</span>
          </div>
        </Section>
      )}

      <Section title="Transform" icon={<RotateCw size={12} />}>
        <KeyedSlider
          clip={clip}
          property="x"
          label="Position X"
          min={-Math.round(projectWidth / 2)}
          max={Math.round(projectWidth / 2)}
          step={1}
          format={(value) => `${Math.round(value)}px`}
        />
        <KeyedSlider
          clip={clip}
          property="y"
          label="Position Y"
          min={-Math.round(projectHeight / 2)}
          max={Math.round(projectHeight / 2)}
          step={1}
          format={(value) => `${Math.round(value)}px`}
        />
        <KeyedSlider
          clip={clip}
          property="scale"
          label="Scale"
          min={0.05}
          max={4}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <KeyedSlider
          clip={clip}
          property="rotation"
          label="Rotation"
          min={-180}
          max={180}
          step={0.5}
          format={(value) => `${value}°`}
        />
        <KeyedSlider
          clip={clip}
          property="opacity"
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <div className="field-row">
          <button
            type="button"
            className="btn btn-sm"
            data-active={clip.transform.flipH}
            onClick={() => patch((target) => (target.transform.flipH = !target.transform.flipH))}
          >
            <FlipHorizontal2 size={13} /> Flip H
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => patch((target) => (target.transform.flipV = !target.transform.flipV))}
          >
            <FlipVertical2 size={13} /> Flip V
          </button>
        </div>
        {clip.kind !== 'text' && clip.kind !== 'sticker' && (
          <div className="field">
            <span className="field-label">Fit</span>
            <Segmented<FitMode>
              value={clip.fit}
              options={[
                { value: 'contain', label: 'Contain' },
                { value: 'cover', label: 'Cover' },
                { value: 'stretch', label: 'Stretch' },
              ]}
              onChange={(fit) => patch((target) => (target.fit = fit))}
            />
          </div>
        )}
        {clip.kind !== 'text' && clip.kind !== 'sticker' && (
          <div className="field">
            <span className="field-label">Blend mode</span>
            <select
              className="select"
              value={clip.blend}
              onChange={(event) =>
                patch((target) => (target.blend = event.target.value as BaseClip['blend']))
              }
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </Section>

      <Section title="Timing" icon={<Gauge size={12} />}>
        <div className="field-row">
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Start (s)</span>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0}
              value={Number(clip.start.toFixed(2))}
              onChange={(event) =>
                patch((target) => {
                  target.start = Math.max(0, Number(event.target.value) || 0)
                })
              }
            />
          </div>
          <div className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Duration (s)</span>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.08}
              value={Number(clip.duration.toFixed(2))}
              onChange={(event) =>
                patch((target) => {
                  target.duration = Math.max(0.08, Number(event.target.value) || 0.08)
                })
              }
            />
          </div>
        </div>
        {asset && asset.type !== 'image' && (
          <>
            <div className="field">
              <span className="field-label">Speed</span>
              <Segmented
                value={String(clip.speed)}
                options={SPEED_PRESETS.map((speed) => ({
                  value: String(speed),
                  label: `${speed}×`,
                }))}
                onChange={(value) => useEditor.getState().setSpeed(clip.id, Number(value))}
              />
            </div>
            <Slider
              label="Custom speed"
              value={clip.speed}
              min={0.1}
              max={8}
              step={0.05}
              onChange={(value) => useEditor.getState().setSpeed(clip.id, value)}
              format={(value) => `${value.toFixed(2)}×`}
            />
          </>
        )}
        <div className="hint">
          Timeline source offset: {clip.mediaStart.toFixed(2)}s
          {asset ? ` of ${formatDuration(asset.duration)}` : ''}
        </div>
      </Section>
    </>
  )
}

/* Project dimensions are read directly from the store to keep sliders stable. */
function useProjectWidth() {
  return useEditor((state) => state.project?.width ?? 1920)
}

function useProjectHeight() {
  return useEditor((state) => state.project?.height ?? 1080)
}

/* -------------------------------------------------------------------------- */
/* Animation                                                                   */
/* -------------------------------------------------------------------------- */

function AnimationPanel({ clip }: { clip: Clip }) {
  const patch = useClipPatch(clip)

  const setAnimation = (slot: 'in' | 'out', type: AnimationType) => {
    patch((target) => {
      const current = slot === 'in' ? target.animationIn : target.animationOut
      const next: Animation | null =
        type === 'none'
          ? null
          : { type, duration: current?.duration ?? 0.45 }
      if (slot === 'in') target.animationIn = next
      else target.animationOut = next
    })
  }

  const setDuration = (slot: 'in' | 'out', duration: number) => {
    patch((target) => {
      const current = slot === 'in' ? target.animationIn : target.animationOut
      if (current) current.duration = clamp(duration, 0.05, target.duration)
    }, `anim:${clip.id}:${slot}`)
  }

  const inType: AnimationType = clip.animationIn?.type ?? 'none'
  const outType: AnimationType = clip.animationOut?.type ?? 'none'

  return (
    <>
      <Section
        title="In animation"
        icon={<Sparkles size={12} />}
        action={<span className="badge cyan">{ANIMATIONS.find((item) => item.id === inType)?.name ?? 'None'}</span>}
      >
        <div className="chip-row">
          {ANIMATIONS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip-tiny"
              data-active={inType === preset.id}
              onClick={() => setAnimation('in', preset.id)}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {clip.animationIn && (
          <>
            <div className="animation-preview-row">
              <span className="anim-icon">
                <Wand2 size={12} />
              </span>
              <span>
                Starts at {clip.start.toFixed(2)}s for {clip.animationIn.duration.toFixed(2)}s
              </span>
            </div>
            <Slider
              label="Duration"
              value={clip.animationIn.duration}
              min={0.05}
              max={Math.min(4, clip.duration)}
              step={0.05}
              onChange={(value) => setDuration('in', value)}
              format={(value) => `${value.toFixed(2)}s`}
            />
          </>
        )}
      </Section>

      <Section
        title="Out animation"
        icon={<Sparkles size={12} />}
        defaultOpen={false}
        action={<span className="badge">{ANIMATIONS.find((item) => item.id === outType)?.name ?? 'None'}</span>}
      >
        <div className="chip-row">
          {ANIMATIONS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip-tiny"
              data-active={outType === preset.id}
              onClick={() => setAnimation('out', preset.id)}
            >
              {preset.name}
            </button>
          ))}
        </div>
        {clip.animationOut && (
          <Slider
            label="Duration"
            value={clip.animationOut.duration}
            min={0.05}
            max={Math.min(4, clip.duration)}
            step={0.05}
            onChange={(value) => setDuration('out', value)}
            format={(value) => `${value.toFixed(2)}s`}
          />
        )}
      </Section>

      <Section title="Fades" icon={<AudioLines size={12} />} defaultOpen={false}>
        <Slider
          label="Fade in"
          value={clip.fadeIn}
          min={0}
          max={Math.min(5, clip.duration)}
          step={0.05}
          onChange={(value) => patch((target) => (target.fadeIn = value), `fade:${clip.id}`)}
          format={(value) => `${value.toFixed(2)}s`}
        />
        <Slider
          label="Fade out"
          value={clip.fadeOut}
          min={0}
          max={Math.min(5, clip.duration)}
          step={0.05}
          onChange={(value) => patch((target) => (target.fadeOut = value), `fade:${clip.id}`)}
          format={(value) => `${value.toFixed(2)}s`}
        />
      </Section>

      <Section title="Transition in" icon={<Sparkles size={12} />} defaultOpen={false}>
        <div className="chip-row">
          <button
            type="button"
            className="chip-tiny"
            data-active={!clip.transitionIn}
            onClick={() => useEditor.getState().setTransition(clip.id, null)}
          >
            None
          </button>
          {TRANSITIONS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip-tiny"
              data-active={clip.transitionIn?.type === preset.id}
              onClick={() =>
                useEditor.getState().setTransition(clip.id, preset.id as TransitionType)
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
        {clip.transitionIn && (
          <Slider
            label="Duration"
            value={clip.transitionIn.duration}
            min={0.15}
            max={Math.min(2, clip.duration)}
            step={0.05}
            onChange={(value) =>
              useEditor.getState().setTransition(clip.id, clip.transitionIn!.type, value)
            }
            format={(value) => `${value.toFixed(2)}s`}
          />
        )}
      </Section>

      <KeyframesSection clip={clip} />
    </>
  )
}

function KeyframesSection({ clip }: { clip: Clip }) {
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const removeKeyframe = useEditor((state) => state.removeKeyframe)
  const updateKeyframe = useEditor((state) => state.updateKeyframe)
  const clearKeyframes = useEditor((state) => state.clearKeyframes)
  const groups = KEYFRAME_PROPERTIES.filter((property) =>
    clip.keyframes.some((keyframe) => keyframe.property === property.id),
  )

  return (
    <Section
      title="Keyframes"
      icon={<Diamond size={12} />}
      defaultOpen={false}
      action={
        clip.keyframes.length > 0 ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => clearKeyframes(clip.id)}
          >
            Clear all
          </button>
        ) : undefined
      }
    >
      {clip.keyframes.length === 0 ? (
        <div className="hint">
          Click the diamond next to a transform, audio or mask slider to record a keyframe
          at the playhead. Drag the playhead and change the value to build motion.
        </div>
      ) : (
        <div className="kf-list">
          {groups.map((property) => (
            <div className="kf-group" key={property.id}>
              <div className="kf-group-head">
                <span>{property.label}</span>
                <em>{keyframesFor(clip, property.id).length}</em>
              </div>
              {keyframesFor(clip, property.id).map((keyframe: Keyframe) => (
                <div className="kf-row" key={keyframe.id}>
                  <button
                    type="button"
                    className="kf-time"
                    title="Jump to keyframe"
                    onClick={() => setPlayhead(clip.start + keyframe.time)}
                  >
                    {keyframe.time.toFixed(2)}s
                  </button>
                  <input
                    className="input mini"
                    type="number"
                    step={property.step}
                    value={Number(keyframe.value.toFixed(2))}
                    aria-label={`${property.label} value`}
                    onChange={(event) =>
                      updateKeyframe(clip.id, keyframe.id, {
                        value: Number(event.target.value),
                      })
                    }
                  />
                  <select
                    className="select mini"
                    value={keyframe.easing}
                    aria-label="Easing"
                    onChange={(event) =>
                      updateKeyframe(clip.id, keyframe.id, {
                        easing: event.target.value as Easing,
                      })
                    }
                  >
                    {EASING_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    label="Remove keyframe"
                    size="sm"
                    onClick={() => removeKeyframe(clip.id, keyframe.id)}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Adjust                                                                      */
/* -------------------------------------------------------------------------- */

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb: [number, number, number] = [0, 0, 0]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = l - c / 2
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m]
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 0.0001) return 0
  const d = max - min
  let hue = 0
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4
  return (hue * 60 + 360) % 360
}

function wheelFromPad(angle: number, radius: number): ColorWheel {
  const [r, g, b] = hslToRgb(angle, 1, 0.5)
  const amount = clamp(radius, 0, 1) * 100
  return {
    r: Math.round((r - 0.5) * 2 * amount),
    g: Math.round((g - 0.5) * 2 * amount),
    b: Math.round((b - 0.5) * 2 * amount),
  }
}

function padFromWheel(wheel: ColorWheel): { angle: number; radius: number } {
  const amount = Math.max(Math.abs(wheel.r), Math.abs(wheel.g), Math.abs(wheel.b))
  if (amount < 1) return { angle: 0, radius: 0 }
  const norm = (value: number) => (value / amount + 1) / 2
  const hue = rgbToHue(norm(wheel.r), norm(wheel.g), norm(wheel.b))
  return { angle: hue, radius: clamp(amount / 100, 0, 1) }
}

function ColorWheelPad({
  label,
  value,
  onChange,
}: {
  label: string
  value: ColorWheel
  onChange: (wheel: ColorWheel) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const { angle, radius } = padFromWheel(value)
  const dotX = 50 + Math.cos((angle * Math.PI) / 180) * radius * 46
  const dotY = 50 + Math.sin((angle * Math.PI) / 180) * radius * 46
  const strength = Math.round(
    Math.max(Math.abs(value.r), Math.abs(value.g), Math.abs(value.b)),
  )

  const apply = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const distance = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2))
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    onChange(wheelFromPad(hue, distance))
  }

  return (
    <div className="wheel">
      <div className="wheel-head">
        <span>{label}</span>
        <b>{strength}</b>
      </div>
      <div
        ref={ref}
        className="wheel-pad"
        onPointerDown={(event) => {
          setDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
          apply(event)
        }}
        onPointerMove={(event) => {
          if (dragging) apply(event)
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => onChange({ r: 0, g: 0, b: 0 })}
        title="Drag to tint · double-click to reset"
      >
        <span className="wheel-dot" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
      </div>
    </div>
  )
}

function AdjustPanel({ clip }: { clip: Clip }) {
  const applyFilter = useEditor((state) => state.applyFilterPreset)
  const reset = useEditor((state) => state.resetAdjustments)
  const patch = useClipPatch(clip)
  const toast = useUI((state) => state.toast)
  const adjustments = clip.adjustments
  const grade = adjustments.grade
  const [luts, setLuts] = useState(() => listLuts())
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const setAdjustment = (key: NumericAdjustment, value: number) => {
    patch((target) => {
      target.adjustments[key] = value
    }, `adjust:${clip.id}:${key}`)
  }

  const setGrade = (next: Partial<ColorGrade>, key: string) => {
    patch((target) => {
      Object.assign(target.adjustments.grade, next)
    }, `grade:${clip.id}:${key}`)
  }

  const setWheel = (
    tone: 'shadows' | 'midtones' | 'highlights',
    wheel: ColorWheel,
  ) => {
    patch((target) => {
      target.adjustments.grade[tone] = wheel
    }, `grade:${clip.id}:${tone}`)
  }

  const handleLutFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const lut = importLut(file.name, text)
      if (!lut) {
        toast('That file is not a valid .cube LUT', 'error')
        return
      }
      setLuts(listLuts())
      setGrade({ lut: lut.id }, 'lut')
      toast(`Imported “${lut.name}”`, 'success')
    } catch {
      toast('Could not read that LUT file', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Section title="Filters" icon={<Wand2 size={12} />}>
        <div className="filter-grid">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="filter-card"
              data-active={matchesFilter(clip, preset.id)}
              onClick={() => applyFilter(clip.id, preset)}
              title={preset.name}
            >
              <span className="filter-swatch" style={{ background: preset.swatch }} />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Adjust"
        icon={<SlidersHorizontal size={12} />}
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => reset(clip.id)}>
            Reset
          </button>
        }
      >
        <Slider label="Brightness" value={adjustments.brightness} min={-100} max={100} onChange={(value) => setAdjustment('brightness', value)} />
        <Slider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(value) => setAdjustment('contrast', value)} />
        <Slider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(value) => setAdjustment('saturation', value)} />
        <Slider label="Exposure" value={adjustments.exposure} min={-100} max={100} onChange={(value) => setAdjustment('exposure', value)} />
        <Slider label="Temperature" value={adjustments.temperature} min={-100} max={100} onChange={(value) => setAdjustment('temperature', value)} />
        <Slider label="Tint" value={adjustments.tint} min={-100} max={100} onChange={(value) => setAdjustment('tint', value)} />
        <Slider label="Vignette" value={adjustments.vignette} min={0} max={100} onChange={(value) => setAdjustment('vignette', value)} />
      </Section>

      <Section
        title="Color wheels"
        icon={<Shapes size={12} />}
        defaultOpen={false}
        action={
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              patch((target) => {
                target.adjustments.grade.shadows = { r: 0, g: 0, b: 0 }
                target.adjustments.grade.midtones = { r: 0, g: 0, b: 0 }
                target.adjustments.grade.highlights = { r: 0, g: 0, b: 0 }
              })
            }
          >
            Reset
          </button>
        }
      >
        <div className="wheel-grid">
          <ColorWheelPad
            label="Shadows"
            value={grade.shadows}
            onChange={(wheel) => setWheel('shadows', wheel)}
          />
          <ColorWheelPad
            label="Midtones"
            value={grade.midtones}
            onChange={(wheel) => setWheel('midtones', wheel)}
          />
          <ColorWheelPad
            label="Highlights"
            value={grade.highlights}
            onChange={(wheel) => setWheel('highlights', wheel)}
          />
        </div>
        <Slider
          label="Hue"
          value={grade.hue}
          min={-180}
          max={180}
          onChange={(value) => setGrade({ hue: value }, 'hue')}
          format={(value) => `${value}°`}
        />
        <Slider
          label="Vibrance"
          value={grade.vibrance}
          min={-100}
          max={100}
          onChange={(value) => setGrade({ vibrance: value }, 'vibrance')}
          format={(value) => `${value}`}
        />
      </Section>

      <Section
        title="LUT"
        icon={<Film size={12} />}
        defaultOpen={false}
        action={
          <button
            className="btn btn-ghost btn-sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={11} /> Import
          </button>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".cube"
          hidden
          onChange={handleLutFile}
        />
        <div className="field">
          <span className="field-label">Look</span>
          <select
            className="select"
            value={grade.lut ?? ''}
            onChange={(event) => setGrade({ lut: event.target.value || null }, 'lut')}
          >
            <option value="">None</option>
            {luts.map((lut) => (
              <option key={lut.id} value={lut.id}>
                {lut.name}
                {lut.builtin ? ' · built-in' : ''}
              </option>
            ))}
          </select>
        </div>
        {grade.lut && (
          <Slider
            label="Intensity"
            value={grade.lutIntensity}
            min={0}
            max={100}
            onChange={(value) => setGrade({ lutIntensity: value }, 'lutIntensity')}
            format={(value) => `${value}%`}
          />
        )}
        {grade.lut && !luts.find((lut) => lut.id === grade.lut)?.builtin && (
          <button
            className="btn btn-sm btn-block"
            onClick={() => {
              removeLut(grade.lut!)
              setLuts(listLuts())
              setGrade({ lut: null }, 'lut')
            }}
          >
            <Trash2 size={12} /> Remove imported LUT
          </button>
        )}
        <div className="hint">
          Built-in looks are generated in the browser. Import standard .cube files for
          film-grade colour transforms.
        </div>
      </Section>

      <div className="hint">
        Adjustments are applied live on the canvas and included in exports. Presets are
        non-destructive — reset at any time.
      </div>
    </>
  )
}

function matchesFilter(clip: Clip, id: string): boolean {
  const preset = FILTER_PRESETS.find((item) => item.id === id)
  if (!preset) return false
  const expected = { ...DEFAULT_ADJUSTMENTS, ...preset.adjustments }
  return (Object.keys(expected) as Array<keyof typeof expected>)
    .filter((key) => typeof expected[key] === 'number')
    .every((key) => Math.abs((clip.adjustments[key] as number) - (expected[key] as number)) < 0.01)
}

/* -------------------------------------------------------------------------- */
/* Effects                                                                     */
/* -------------------------------------------------------------------------- */

function EffectsPanel({ clip }: { clip: Clip }) {
  const addEffect = useEditor((state) => state.addEffect)
  const removeEffect = useEditor((state) => state.removeEffect)
  const updateEffect = useEditor((state) => state.updateEffect)

  return (
    <>
      <Section title="Clip effects" icon={<Sparkles size={12} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EFFECTS.map((preset) => {
            const active = clip.effects.find((effect) => effect.id === preset.id)
            return (
              <div className="effect-chip" key={preset.id}>
                <button
                  type="button"
                  className="btn btn-sm"
                  data-active={Boolean(active)}
                  onClick={() =>
                    active ? removeEffect(clip.id, preset.id) : addEffect(clip.id, preset.id)
                  }
                  style={{ minWidth: 74 }}
                >
                  {preset.name}
                </button>
                <span className="effect-chip-name">{preset.hint}</span>
                {active && (
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={100}
                    value={active.intensity}
                    aria-label={`${preset.name} intensity`}
                    onChange={(event) =>
                      updateEffect(clip.id, preset.id as EffectId, Number(event.target.value))
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      </Section>
      <div className="hint">
        Effects render on the clip layer, so they follow transforms and move with the
        timeline. Combine a few at low intensity for a natural look.
      </div>
      {clip.effects.length > 0 && (
        <button
          className="btn btn-ghost btn-block btn-sm"
          onClick={() => {
            for (const effect of [...clip.effects]) removeEffect(clip.id, effect.id)
          }}
        >
          <Trash2 size={12} /> Remove all effects
        </button>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                       */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Mask                                                                        */
/* -------------------------------------------------------------------------- */

const MASK_SHAPES: Array<{ id: MaskShape | 'none'; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'line', label: 'Line' },
  { id: 'pen', label: 'Pen' },
]

function MaskPanel({ clip }: { clip: Clip }) {
  const patch = useClipPatch(clip)
  const maskEditing = useUI((state) => state.maskEditing)
  const setMaskEditing = useUI((state) => state.setMaskEditing)
  const mask = clip.mask

  const setMask = (patcher: (mask: Mask) => void, key: string) => {
    patch((target) => {
      if (!target.mask) target.mask = createMask()
      patcher(target.mask)
    }, `mask:${clip.id}:${key}`)
  }

  const chooseShape = (shape: MaskShape | 'none') => {
    if (shape === 'none') {
      patch((target) => {
        target.mask = null
      })
      setMaskEditing(false)
      return
    }
    patch((target) => {
      if (!target.mask) target.mask = createMask(shape)
      else target.mask.shape = shape
      if (shape !== 'pen') target.mask.points = []
    })
    setMaskEditing(true)
  }

  return (
    <>
      <Section title="Mask shape" icon={<Shapes size={12} />}>
        <div className="chip-row">
          {MASK_SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className="chip-tiny"
              data-active={(mask?.shape ?? 'none') === shape.id}
              onClick={() => chooseShape(shape.id)}
            >
              {shape.label}
            </button>
          ))}
        </div>
        {mask && (
          <div className="hint">
            {mask.shape === 'pen'
              ? 'Click on the preview to drop pen points. Drag the mask on the canvas to reposition it.'
              : 'Drag the mask on the preview to reposition it. Toggle “Edit on canvas” to show the handles.'}
          </div>
        )}
      </Section>

      {mask && (
        <>
          <Section title="Mask transform" icon={<RotateCw size={12} />}>
            <KeyedSlider
              clip={clip}
              property="maskX"
              label="Position X"
              min={-1}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <KeyedSlider
              clip={clip}
              property="maskY"
              label="Position Y"
              min={-1}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <Slider
              label="Width"
              value={Math.round(mask.width * 100)}
              min={5}
              max={150}
              onChange={(value) =>
                setMask((target) => (target.width = value / 100), 'width')
              }
              format={(value) => `${value}%`}
            />
            <Slider
              label="Height"
              value={Math.round(mask.height * 100)}
              min={5}
              max={150}
              onChange={(value) =>
                setMask((target) => (target.height = value / 100), 'height')
              }
              format={(value) => `${value}%`}
            />
            <KeyedSlider
              clip={clip}
              property="maskRotation"
              label="Rotation"
              min={-180}
              max={180}
              step={0.5}
              format={(value) => `${value}°`}
            />
          </Section>

          <Section title="Mask edge" icon={<SlidersHorizontal size={12} />} defaultOpen={false}>
            <Slider
              label="Feather"
              value={mask.feather}
              min={0}
              max={100}
              step={0.5}
              onChange={(value) => setMask((target) => (target.feather = value), 'feather')}
              format={(value) => `${value}px`}
            />
            <Slider
              label="Opacity"
              value={mask.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => setMask((target) => (target.opacity = value), 'opacity')}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <ToggleRow
              label="Invert mask"
              checked={mask.invert}
              onChange={(invert) => setMask((target) => (target.invert = invert), 'invert')}
            />
            <ToggleRow
              label="Edit on canvas"
              checked={maskEditing}
              onChange={setMaskEditing}
            />
            {mask.shape === 'pen' && (
              <button
                className="btn btn-sm btn-block"
                onClick={() => setMask((target) => (target.points = []), 'points')}
              >
                <X size={12} /> Clear pen points ({mask.points.length})
              </button>
            )}
          </Section>
        </>
      )}
    </>
  )
}

function AudioPanel({ clip }: { clip: Clip }) {
  const patch = useClipPatch(clip)
  const detachAudio = useEditor((state) => state.detachAudio)
  const assets = useEditor((state) => state.assets)
  const asset = 'assetId' in clip ? assets[clip.assetId] : undefined
  const hasAudio = Boolean(asset?.hasAudio)

  return (
    <>
      <Section title="Levels" icon={<Volume2 size={12} />}>
        <KeyedSlider
          clip={clip}
          property="volume"
          label="Volume"
          min={0}
          max={2}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <ToggleRow
          label="Mute clip"
          checked={clip.muted}
          onChange={(muted) => patch((target) => (target.muted = muted))}
        />
        <Slider
          label="Fade in"
          value={clip.fadeIn}
          min={0}
          max={Math.min(5, clip.duration)}
          step={0.05}
          onChange={(value) => patch((target) => (target.fadeIn = value), `fade:${clip.id}`)}
          format={(value) => `${value.toFixed(2)}s`}
        />
        <Slider
          label="Fade out"
          value={clip.fadeOut}
          min={0}
          max={Math.min(5, clip.duration)}
          step={0.05}
          onChange={(value) => patch((target) => (target.fadeOut = value), `fade:${clip.id}`)}
          format={(value) => `${value.toFixed(2)}s`}
        />
      </Section>

      {clip.kind === 'video' && (
        <Section title="Detached audio" icon={<Scissors size={12} />} defaultOpen={false}>
          <div className="hint">
            {hasAudio
              ? 'Split the sound from the picture so you can trim and fade it independently.'
              : 'This video has no audio track.'}
          </div>
          <button
            className="btn btn-sm btn-block"
            disabled={!hasAudio}
            onClick={() => detachAudio(clip.id)}
          >
            <Scissors size={12} /> Detach audio
          </button>
        </Section>
      )}

      <Section title="Speed" icon={<Gauge size={12} />} defaultOpen={false}>
        <Slider
          label="Playback speed"
          value={clip.speed}
          min={0.1}
          max={8}
          step={0.05}
          onChange={(value) => useEditor.getState().setSpeed(clip.id, value)}
          format={(value) => `${value.toFixed(2)}×`}
        />
        <div className="hint">Changing speed updates the clip duration and pitch.</div>
      </Section>

      <Section title="Project audio" icon={<AudioLines size={12} />} defaultOpen={false}>
        <button
          className="btn btn-sm btn-block"
          onClick={() => useUI.getState().toast('Voiceover recording lives in the Audio library tab.')}
        >
          <Music size={12} /> Record a voiceover
        </button>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty selection: project settings                                           */
/* -------------------------------------------------------------------------- */

function ProjectPanel() {
  const project = useEditor((state) => state.project)
  const assets = useEditor((state) => state.assets)
  const updateProjectSettings = useEditor((state) => state.updateProjectSettings)
  const setExportOpen = useUI((state) => state.setExportOpen)

  if (!project) return null
  const duration = projectDuration(project)
  const clipCount = project.tracks.reduce((sum, track) => sum + track.clips.length, 0)
  const assetCount = project.assetIds.filter((id) => assets[id]).length
  const activeAspect =
    ASPECT_PRESETS.find(
      (preset) => preset.width === project.width && preset.height === project.height,
    )?.id ?? 'custom'

  return (
    <>
      <div className="inspector-head">
        <div className="clip-kind">
          <SlidersHorizontal size={14} />
        </div>
        <div className="clip-title">
          <b>{project.name}</b>
          <span>Project settings</span>
        </div>
        <IconButton label="Export project" onClick={() => setExportOpen(true)}>
          <Wand2 size={13} />
        </IconButton>
      </div>
      <div className="inspector-body">
        <div className="project-summary">
          <h3>{formatDuration(duration)} timeline</h3>
          <p>
            {clipCount} clip{clipCount === 1 ? '' : 's'} across {project.tracks.length} track
            {project.tracks.length === 1 ? '' : 's'} · {assetCount} media asset
            {assetCount === 1 ? '' : 's'}
          </p>
          <div className="project-stats">
            <div className="project-stat">
              <b>{project.width}×{project.height}</b>
              <span>Resolution</span>
            </div>
            <div className="project-stat">
              <b>{project.fps}</b>
              <span>Frame rate</span>
            </div>
            <div className="project-stat">
              <b>{clipCount}</b>
              <span>Clips</span>
            </div>
          </div>
        </div>

        <Section title="Canvas" icon={<Film size={12} />}>
          <div className="field">
            <span className="field-label">Project name</span>
            <input
              className="input"
              value={project.name}
              maxLength={80}
              onChange={(event) => updateProjectSettings({ name: event.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">Aspect ratio</span>
            <div className="aspect-grid">
              {ASPECT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="aspect-card"
                  data-active={activeAspect === preset.id}
                  onClick={() =>
                    updateProjectSettings({ width: preset.width, height: preset.height })
                  }
                >
                  <span className="aspect-shape">
                    <span
                      style={{
                        width: preset.width >= preset.height ? 24 : (24 * preset.width) / preset.height,
                        height: preset.height >= preset.width ? 24 : (24 * preset.height) / preset.width,
                      }}
                    />
                  </span>
                  <b>{preset.id}</b>
                  <small>{preset.label}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Frame rate</span>
            <Segmented
              value={String(project.fps)}
              options={[24, 25, 30, 50, 60].map((fps) => ({
                value: String(fps),
                label: `${fps}`,
              }))}
              onChange={(value) => updateProjectSettings({ fps: Number(value) })}
            />
          </div>
          <div className="field">
            <span className="field-label">Background</span>
            <ColorField
              label="Project background"
              value={project.background}
              onChange={(background) => updateProjectSettings({ background })}
            />
          </div>
        </Section>

        <Section title="Quick actions" icon={<Sparkles size={12} />}>
          <button className="btn btn-primary btn-block btn-sm" onClick={() => setExportOpen(true)}>
            <Wand2 size={13} /> Export video
          </button>
          <div className="hint">
            Select a clip on the timeline to edit its transform, animation, colour,
            effects and audio. Press <span className="kbd">?</span> for all shortcuts.
          </div>
        </Section>

        <Section title="Storage" icon={<ImageIcon size={12} />} defaultOpen={false}>
          <div className="hint">
            Projects and media are stored privately in this browser via IndexedDB. Large
            files stay on this device and are never uploaded. Autosave runs after every
            edit.
          </div>
        </Section>
      </div>
    </>
  )
}
