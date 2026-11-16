import {
  Captions,
  Keyboard,
  Layers,
  MousePointer2,
  Music,
  Palette,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Kbd, Modal } from '../ui'
import { APP_NAME, APP_TAGLINE } from '../../lib/constants'
import { useUI } from '../../store/ui'

interface ShortcutGroup {
  title: string
  rows: Array<{ label: string; keys: string[] }>
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Playback',
    rows: [
      { label: 'Play / pause', keys: ['Space'] },
      { label: 'Pause', keys: ['K'] },
      { label: 'Play forward', keys: ['L'] },
      { label: 'Step back 1s', keys: ['J'] },
      { label: 'Previous frame', keys: ['←'] },
      { label: 'Next frame', keys: ['→'] },
      { label: 'Jump 1s', keys: ['Shift', '← / →'] },
      { label: 'Jump to start / end', keys: ['Home', 'End'] },
    ],
  },
  {
    title: 'Editing',
    rows: [
      { label: 'Split at playhead', keys: ['Ctrl', 'B'] },
      { label: 'Duplicate clip', keys: ['Ctrl', 'D'] },
      { label: 'Copy clip', keys: ['Ctrl', 'C'] },
      { label: 'Paste clip', keys: ['Ctrl', 'V'] },
      { label: 'Delete clip', keys: ['Del'] },
      { label: 'Ripple delete', keys: ['Shift', 'Del'] },
      { label: 'Mute clip', keys: ['Shift', 'M'] },
      { label: 'Add marker at playhead', keys: ['M'] },
      { label: 'Add text layer', keys: ['T'] },
      { label: 'Deselect', keys: ['Esc'] },
    ],
  },
  {
    title: 'Timeline',
    rows: [
      { label: 'Zoom in / out', keys: ['Ctrl', '+ / −'] },
      { label: 'Zoom in / out', keys: ['[', ']'] },
      { label: 'Save project', keys: ['Ctrl', 'S'] },
      { label: 'Undo', keys: ['Ctrl', 'Z'] },
      { label: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
      { label: 'Redo (alternate)', keys: ['Ctrl', 'Y'] },
      { label: 'Export', keys: ['Ctrl', 'E'] },
      { label: 'Shortcuts', keys: ['?'] },
    ],
  },
  {
    title: 'Canvas',
    rows: [
      { label: 'Move selection', keys: ['Drag'] },
      { label: 'Scale selection', keys: ['Corner drag'] },
      { label: 'Rotate selection', keys: ['Handle drag'] },
      { label: 'Rotate in 15° steps', keys: ['Shift', 'Rotate'] },
      { label: 'Fullscreen preview', keys: ['Button'] },
      { label: 'Safe area guides', keys: ['Button'] },
    ],
  },
]

const FEATURES = [
  {
    icon: Layers,
    title: 'Magnetic multi-track timeline',
    body: 'Video, overlay, text, sticker and audio tracks with snapping, ripple-free trimming, split, duplicate, detach audio and timeline markers.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Keyframes & masks',
    body: 'Animate transform, opacity, volume and mask position/scale with five easing curves. Shape masks with feather, invert, opacity and pen paths.',
  },
  {
    icon: Palette,
    title: 'Color grading & LUTs',
    body: '66 filters, three-way color wheels, hue/vibrance, temperature, curves-style adjustments and .cube LUT import with intensity control.',
  },
  {
    icon: Wand2,
    title: 'Effects, transitions & animations',
    body: '70 effects, 44 transitions and 40 in/out animations. Content-aware transitions analyse neighbouring frames and pick a fade, slide or whip.',
  },
  {
    icon: Captions,
    title: 'Captions, AI & voice',
    body: 'Import SRT/VTT, transcribe with local Whisper, OpenAI/Groq, or the Vietnamese AI Voice Studio, then narrate with 24 CapCut Vietnamese voices, 22 AI Voice Studio voices, three offline Piper Vietnamese voices, or an instant system voice. Export SRT.',
  },
  {
    icon: Music,
    title: 'Audio toolkit',
    body: 'Waveforms, per-clip volume, volume keyframes, fades, mute, speed, offline mixdown and in-browser voiceover recording.',
  },
  {
    icon: Scissors,
    title: 'Browser-native export',
    body: 'WebCodecs renders MP4 (H.264/AAC) or WebM (VP9/Opus) without uploads, with resolution, fps and quality presets.',
  },
  {
    icon: Palette,
    title: 'Original asset library',
    body: '24 hand-drawn SVG stickers, curated text presets, six templates and open-source Google Fonts bundled offline.',
  },
]

export function HelpModal() {
  const open = useUI((state) => state.helpOpen)
  const setOpen = useUI((state) => state.setHelpOpen)
  if (!open) return null

  return (
    <Modal
      title={`${APP_NAME} help`}
      subtitle={APP_TAGLINE}
      icon={<Sparkles size={18} />}
      onClose={() => setOpen(false)}
      size="wide"
      footer={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--muted-2)', fontSize: 10 }}>
            Press <Kbd>?</Kbd> anytime to open this guide.
          </span>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(false)}>
            Start editing
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="help-note">
          <MousePointer2 size={14} />
          <span>
            <b style={{ color: 'var(--text-soft)' }}>Quick start.</b> Drop media into the library,
            drag it to a track, then use the inspector on the right to trim, animate and style.
            Everything saves automatically to this browser.
          </span>
        </div>

        <div className="help-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} style={{ display: 'flex', gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(139,108,255,.12)',
                    color: '#b7a7ff',
                    flex: 'none',
                  }}
                >
                  <Icon size={14} />
                </span>
                <div>
                  <h4
                    style={{
                      margin: '0 0 3px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--text-soft)',
                    }}
                  >
                    {feature.title}
                  </h4>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: 10.5, lineHeight: 1.5 }}>
                    {feature.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="help-note">
          <ShieldCheck size={14} />
          <span>
            <b style={{ color: 'var(--text-soft)' }}>Privacy &amp; licensing.</b> Projects, media
            and AI keys stay in your browser — no accounts, no uploads, no telemetry. {APP_NAME}{' '}
            bundles the open-source Google Fonts Inter, Space Grotesk, Bebas Neue, Oswald, Playfair
            Display and Pacifico (SIL OFL), lucide icons (ISC), original SVG stickers, Piper voices
            and piper-phonemize (MIT), onnxruntime-web (MIT), Transformers.js / Whisper
            (Apache-2.0), the optional K07VN/capcut-tts-api bridge (MIT) and the optional AI Voice
            Studio HF Space. CapCut/ByteDance media assets are not used. CapCut TTS is opt-in:
            audio is generated by CapCut's service through the Vite /capcut bridge, not bundled
            with the app. AI Voice Studio requests go directly to the base URL you configure.
          </span>
        </div>

        <div className="help-note" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,.02)' }}>
          <Keyboard size={14} />
          <span>
            <b style={{ color: 'var(--text-soft)' }}>Browser support.</b> Chrome, Edge and other
            Chromium browsers offer the full MP4 + WebM export path. Safari supports H.264 MP4 where
            WebCodecs is enabled. Firefox can edit and preview; WebM export depends on WebCodecs
            availability.
          </span>
        </div>
      </div>
    </Modal>
  )
}

export function ShortcutsModal() {
  const open = useUI((state) => state.shortcutsOpen)
  const setOpen = useUI((state) => state.setShortcutsOpen)
  if (!open) return null

  return (
    <Modal
      title="Keyboard shortcuts"
      subtitle="Work at the speed of thought"
      icon={<Keyboard size={18} />}
      onClose={() => setOpen(false)}
      size="wide"
      footer={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--muted-2)', fontSize: 10 }}>
            On macOS use <Kbd>⌘</Kbd> instead of <Kbd>Ctrl</Kbd>.
          </span>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(false)}>
            Got it
          </button>
        </>
      }
    >
      <div className="help-grid">
        {SHORTCUT_GROUPS.map((group) => (
          <div className="help-group" key={group.title}>
            <h4>{group.title}</h4>
            {group.rows.map((row, rowIndex) => (
              <div className="help-row" key={`${group.title}-${rowIndex}-${row.label}`}>
                <span>{row.label}</span>
                <span className="help-keys">
                  {row.keys.map((key, keyIndex) => (
                    <Kbd key={`${key}-${keyIndex}`}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
