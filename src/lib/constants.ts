import type {
  Adjustments,
  AnimationType,
  EffectId,
  TextData,
  TransitionType,
} from './types'

export const APP_NAME = 'ClipPro'
export const APP_TAGLINE = 'Create. Cut. Wow.'

export interface FontOption {
  family: string
  label: string
  weights: number[]
  sample: string
}

export const FONT_OPTIONS: FontOption[] = [
  { family: 'Inter', label: 'Inter', weights: [400, 500, 600, 700, 800], sample: 'Modern & clean' },
  { family: 'Space Grotesk', label: 'Space Grotesk', weights: [400, 500, 600, 700], sample: 'Design forward' },
  { family: 'Bebas Neue', label: 'Bebas Neue', weights: [400], sample: 'Bold display' },
  { family: 'Oswald', label: 'Oswald', weights: [300, 400, 500, 600, 700], sample: 'Condensed' },
  { family: 'Playfair Display', label: 'Playfair', weights: [400, 500, 600, 700, 800, 900], sample: 'Editorial' },
  { family: 'Pacifico', label: 'Pacifico', weights: [400], sample: 'Handwritten' },
]

export const ASPECT_PRESETS = [
  { id: '16:9', label: 'Landscape', width: 1920, height: 1080, hint: 'YouTube · 16:9' },
  { id: '9:16', label: 'Portrait', width: 1080, height: 1920, hint: 'Shorts · 9:16' },
  { id: '1:1', label: 'Square', width: 1080, height: 1080, hint: 'Feed · 1:1' },
  { id: '4:5', label: 'Tall', width: 1080, height: 1350, hint: 'Post · 4:5' },
] as const

export interface FilterPreset {
  id: string
  name: string
  adjustments: Partial<Adjustments>
  swatch: string
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', name: 'Original', adjustments: {}, swatch: 'linear-gradient(135deg,#5a5a68,#c8c8d4)' },
  { id: 'warm', name: 'Golden', adjustments: { temperature: 32, saturation: 12, brightness: 4 }, swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'cool', name: 'Arctic', adjustments: { temperature: -28, saturation: 6, contrast: 6 }, swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'mono', name: 'Mono', adjustments: { saturation: -100, contrast: 12 }, swatch: 'linear-gradient(135deg,#3b3b43,#e9e9ef)' },
  { id: 'vintage', name: 'Vintage', adjustments: { temperature: 16, saturation: -24, contrast: -8, brightness: 6, vignette: 26 }, swatch: 'linear-gradient(135deg,#c9a26b,#7b5b3b)' },
  { id: 'vivid', name: 'Vivid', adjustments: { saturation: 34, contrast: 14, brightness: 2 }, swatch: 'linear-gradient(135deg,#ff5f6d,#ffc371)' },
  { id: 'film', name: 'Soft Film', adjustments: { contrast: 10, saturation: -12, brightness: 5, vignette: 16 }, swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'fade', name: 'Faded', adjustments: { contrast: -18, brightness: 10, saturation: -18 }, swatch: 'linear-gradient(135deg,#d9c7ff,#8ba6c9)' },
  { id: 'noir', name: 'Noir', adjustments: { saturation: -100, contrast: 26, brightness: -4, vignette: 30 }, swatch: 'linear-gradient(135deg,#111,#888)' },
  { id: 'sunrise', name: 'Sunrise', adjustments: { temperature: 24, saturation: 16, brightness: 8 }, swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'sunset', name: 'Sunset', adjustments: { temperature: 36, tint: 10, saturation: 22, brightness: 4 }, swatch: 'linear-gradient(135deg,#ff8a5c,#b23a6f)' },
  { id: 'dusk', name: 'Dusk', adjustments: { temperature: -6, tint: 18, saturation: -6, brightness: -6 }, swatch: 'linear-gradient(135deg,#4a3d75,#1b1830)' },
  { id: 'dawn', name: 'Dawn', adjustments: { temperature: 10, tint: -8, saturation: 8, brightness: 10 }, swatch: 'linear-gradient(135deg,#ffd6e0,#9fc9ff)' },
  { id: 'golden-hour', name: 'Golden Hour', adjustments: { temperature: 44, saturation: 18, brightness: 6, vignette: 12 }, swatch: 'linear-gradient(135deg,#ffcf6b,#e07a3f)' },
  { id: 'blue-hour', name: 'Blue Hour', adjustments: { temperature: -38, tint: 8, brightness: -4, contrast: 8 }, swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'tropical', name: 'Tropical', adjustments: { saturation: 40, temperature: 10, brightness: 6, contrast: 8 }, swatch: 'linear-gradient(135deg,#4cf0b0,#1c9bd8)' },
  { id: 'desert', name: 'Desert', adjustments: { temperature: 30, saturation: -10, brightness: 8, contrast: 4 }, swatch: 'linear-gradient(135deg,#f0c48a,#b06a3b)' },
  { id: 'forest', name: 'Forest', adjustments: { tint: -16, saturation: 12, temperature: -10, contrast: 8 }, swatch: 'linear-gradient(135deg,#7ccf7a,#204d3a)' },
  { id: 'ocean', name: 'Ocean', adjustments: { temperature: -20, tint: -6, saturation: 18, contrast: 10 }, swatch: 'linear-gradient(135deg,#57d9e8,#145c8a)' },
  { id: 'lavender', name: 'Lavender', adjustments: { tint: 22, temperature: -6, saturation: 6, brightness: 4 }, swatch: 'linear-gradient(135deg,#d7c4ff,#8a6bd6)' },
  { id: 'rose', name: 'Rose', adjustments: { tint: 18, temperature: 12, saturation: 10, brightness: 4 }, swatch: 'linear-gradient(135deg,#ffc2d1,#c45a7a)' },
  { id: 'peach', name: 'Peach', adjustments: { temperature: 18, tint: 8, saturation: 8, brightness: 10 }, swatch: 'linear-gradient(135deg,#ffd9c2,#ff9a8b)' },
  { id: 'mint', name: 'Mint', adjustments: { tint: -18, saturation: 10, brightness: 6 }, swatch: 'linear-gradient(135deg,#c9ffe8,#5fd6b0)' },
  { id: 'lemon', name: 'Lemon', adjustments: { temperature: 16, saturation: 14, brightness: 12, contrast: 4 }, swatch: 'linear-gradient(135deg,#fff6a8,#d8c93d)' },
  { id: 'cherry', name: 'Cherry', adjustments: { tint: 20, saturation: 24, contrast: 10 }, swatch: 'linear-gradient(135deg,#ff7a9c,#a1123f)' },
  { id: 'berry', name: 'Berry', adjustments: { tint: 14, saturation: 18, contrast: 8, brightness: -2 }, swatch: 'linear-gradient(135deg,#c86dd7,#4a1b70)' },
  { id: 'cocoa', name: 'Cocoa', adjustments: { temperature: 20, saturation: -22, brightness: -4, contrast: 6 }, swatch: 'linear-gradient(135deg,#b58a6a,#4d2f22)' },
  { id: 'sand', name: 'Sand', adjustments: { temperature: 22, saturation: -18, brightness: 8 }, swatch: 'linear-gradient(135deg,#e8d6b0,#b39b6d)' },
  { id: 'slate', name: 'Slate', adjustments: { temperature: -14, saturation: -26, contrast: 10, brightness: -4 }, swatch: 'linear-gradient(135deg,#a9b6c6,#4a5666)' },
  { id: 'steel', name: 'Steel', adjustments: { temperature: -18, saturation: -38, contrast: 18 }, swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'copper', name: 'Copper', adjustments: { temperature: 28, tint: 6, saturation: 8, contrast: 12 }, swatch: 'linear-gradient(135deg,#e8a06a,#7a3b1e)' },
  { id: 'emerald', name: 'Emerald', adjustments: { tint: -22, saturation: 22, contrast: 8 }, swatch: 'linear-gradient(135deg,#65e6a5,#0f5c3a)' },
  { id: 'sapphire', name: 'Sapphire', adjustments: { temperature: -28, saturation: 26, contrast: 12 }, swatch: 'linear-gradient(135deg,#6aa8ff,#143a8a)' },
  { id: 'amethyst', name: 'Amethyst', adjustments: { tint: 26, saturation: 20, contrast: 6 }, swatch: 'linear-gradient(135deg,#c79bff,#4a1a8a)' },
  { id: 'ruby', name: 'Ruby', adjustments: { tint: 24, temperature: 10, saturation: 28, contrast: 10 }, swatch: 'linear-gradient(135deg,#ff6b8a,#8a0f2a)' },
  { id: 'amber', name: 'Amber', adjustments: { temperature: 34, saturation: 6, brightness: 4, vignette: 10 }, swatch: 'linear-gradient(135deg,#ffc46b,#a55a12)' },
  { id: 'cinema', name: 'Cinema', adjustments: { contrast: 18, saturation: -8, temperature: 6, vignette: 18 }, swatch: 'linear-gradient(135deg,#9aa7b8,#26303f)' },
  { id: 'blockbuster', name: 'Blockbuster', adjustments: { contrast: 22, saturation: 12, temperature: 8, vignette: 12 }, swatch: 'linear-gradient(135deg,#ffb35c,#1c4a7a)' },
  { id: 'indie', name: 'Indie', adjustments: { contrast: -6, saturation: -14, temperature: 10, brightness: 6, vignette: 20 }, swatch: 'linear-gradient(135deg,#d8c7a8,#5c6b5a)' },
  { id: 'documentary', name: 'Documentary', adjustments: { contrast: 8, saturation: -20, temperature: -4 }, swatch: 'linear-gradient(135deg,#b7b7a8,#4a4a42)' },
  { id: 'music-video', name: 'Music Video', adjustments: { contrast: 20, saturation: 28, tint: 8 }, swatch: 'linear-gradient(135deg,#ff4fd8,#22d3ee)' },
  { id: 'commercial', name: 'Commercial', adjustments: { brightness: 8, saturation: 16, contrast: 8 }, swatch: 'linear-gradient(135deg,#fff1c9,#ff8f5c)' },
  { id: 'editorial', name: 'Editorial', adjustments: { contrast: 6, saturation: -10, temperature: 4, brightness: 4 }, swatch: 'linear-gradient(135deg,#e6e1d8,#8b8578)' },
  { id: 'retro-70s', name: 'Retro 70s', adjustments: { temperature: 24, saturation: -8, contrast: -10, brightness: 6, vignette: 22 }, swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'retro-80s', name: 'Retro 80s', adjustments: { tint: 20, saturation: 30, contrast: 16 }, swatch: 'linear-gradient(135deg,#ff5edb,#4de3ff)' },
  { id: 'polaroid', name: 'Polaroid', adjustments: { temperature: 12, contrast: -14, brightness: 14, saturation: -12, vignette: 18 }, swatch: 'linear-gradient(135deg,#fff6d8,#c9b48a)' },
  { id: 'cross-process', name: 'Cross Process', adjustments: { tint: 18, temperature: -12, saturation: 24, contrast: 18 }, swatch: 'linear-gradient(135deg,#5cf0c8,#b53cff)' },
  { id: 'bleach-bypass', name: 'Bleach Bypass', adjustments: { saturation: -46, contrast: 26, brightness: 4 }, swatch: 'linear-gradient(135deg,#d9dde2,#59606a)' },
  { id: 'teal-orange', name: 'Teal & Orange', adjustments: { temperature: 18, tint: -10, saturation: 14, contrast: 12 }, swatch: 'linear-gradient(135deg,#ff9a52,#178a9a)' },
  { id: 'warm-matte', name: 'Warm Matte', adjustments: { temperature: 14, contrast: -12, saturation: -8, brightness: 6 }, swatch: 'linear-gradient(135deg,#e8c7a8,#8a6a52)' },
  { id: 'cool-matte', name: 'Cool Matte', adjustments: { temperature: -14, contrast: -12, saturation: -8, brightness: 6 }, swatch: 'linear-gradient(135deg,#b8cbe0,#5a6a80)' },
  { id: 'high-key', name: 'High Key', adjustments: { brightness: 18, contrast: -8, saturation: 4 }, swatch: 'linear-gradient(135deg,#ffffff,#d8e2ec)' },
  { id: 'low-key', name: 'Low Key', adjustments: { brightness: -18, contrast: 22, vignette: 24 }, swatch: 'linear-gradient(135deg,#3a3f4a,#0b0b10)' },
  { id: 'dramatic', name: 'Dramatic', adjustments: { contrast: 30, saturation: -6, vignette: 26 }, swatch: 'linear-gradient(135deg,#9aa2ad,#12141a)' },
  { id: 'dreamy', name: 'Dreamy', adjustments: { brightness: 12, contrast: -16, saturation: 8, vignette: 10 }, swatch: 'linear-gradient(135deg,#ffd9f0,#b7c9ff)' },
  { id: 'crisp', name: 'Crisp', adjustments: { contrast: 16, saturation: 10, brightness: 2 }, swatch: 'linear-gradient(135deg,#8fe3ff,#1c7ab8)' },
  { id: 'soft', name: 'Soft', adjustments: { contrast: -10, brightness: 8, saturation: -6 }, swatch: 'linear-gradient(135deg,#f0e6dd,#b8a89a)' },
  { id: 'sepia-tone', name: 'Sepia', adjustments: { saturation: -70, temperature: 28, brightness: 4 }, swatch: 'linear-gradient(135deg,#d8b184,#7a5230)' },
  { id: 'mono-warm', name: 'Mono Warm', adjustments: { saturation: -100, temperature: 12, contrast: 10 }, swatch: 'linear-gradient(135deg,#d8c7b0,#4a4238)' },
  { id: 'infra', name: 'Infrared', adjustments: { tint: 30, saturation: 40, contrast: 20 }, swatch: 'linear-gradient(135deg,#ff3d7a,#6bff8a)' },
  { id: 'neon-pop', name: 'Neon Pop', adjustments: { saturation: 44, contrast: 18, tint: 10 }, swatch: 'linear-gradient(135deg,#c7f464,#ff2d95)' },
  { id: 'pastel', name: 'Pastel', adjustments: { saturation: -18, brightness: 14, contrast: -12, tint: 8 }, swatch: 'linear-gradient(135deg,#ffe6f0,#c9e8ff)' },
  { id: 'grunge', name: 'Grunge', adjustments: { contrast: 24, saturation: -22, brightness: -8, vignette: 30 }, swatch: 'linear-gradient(135deg,#6a6a5a,#1a1a16)' },
  { id: 'vhs', name: 'VHS', adjustments: { saturation: 18, contrast: -8, tint: 8, temperature: 8 }, swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'lomo', name: 'Lomo', adjustments: { saturation: 24, contrast: 22, vignette: 38 }, swatch: 'linear-gradient(135deg,#ffb35c,#0f1a3a)' },
  { id: 'faded-print', name: 'Faded Print', adjustments: { contrast: -20, brightness: 12, saturation: -24, temperature: 6 }, swatch: 'linear-gradient(135deg,#efe2cf,#a8947a)' },
]

export type TransitionGroup = 'fade' | 'slide' | 'zoom' | 'wipe' | 'shape' | 'distort' | 'light'

export interface TransitionPreset {
  id: TransitionType
  name: string
  hint: string
  group: TransitionGroup
}

export const TRANSITIONS: TransitionPreset[] = [
  { id: 'fade', name: 'Cross fade', hint: 'Blend into the next shot', group: 'fade' },
  { id: 'fade-black', name: 'Dip to black', hint: 'Fade through black', group: 'fade' },
  { id: 'fade-white', name: 'Dip to white', hint: 'Fade through white', group: 'fade' },
  { id: 'dissolve', name: 'Dissolve', hint: 'Soft optical dissolve', group: 'fade' },
  { id: 'slide-left', name: 'Slide left', hint: 'Push the frame left', group: 'slide' },
  { id: 'slide-right', name: 'Slide right', hint: 'Push the frame right', group: 'slide' },
  { id: 'slide-up', name: 'Slide up', hint: 'Push the frame up', group: 'slide' },
  { id: 'slide-down', name: 'Slide down', hint: 'Push the frame down', group: 'slide' },
  { id: 'push-left', name: 'Push left', hint: 'Push the previous shot aside', group: 'slide' },
  { id: 'push-right', name: 'Push right', hint: 'Push the previous shot aside', group: 'slide' },
  { id: 'push-up', name: 'Push up', hint: 'Push the previous shot aside', group: 'slide' },
  { id: 'push-down', name: 'Push down', hint: 'Push the previous shot aside', group: 'slide' },
  { id: 'zoom-in', name: 'Zoom in', hint: 'Punch into the new shot', group: 'zoom' },
  { id: 'zoom-out', name: 'Zoom out', hint: 'Pull back into the new shot', group: 'zoom' },
  { id: 'zoom-punch', name: 'Zoom punch', hint: 'Fast zoom with a snap', group: 'zoom' },
  { id: 'zoom-spin', name: 'Zoom spin', hint: 'Zoom and rotate together', group: 'zoom' },
  { id: 'wipe-left', name: 'Wipe left', hint: 'Sweep the new shot in', group: 'wipe' },
  { id: 'wipe-right', name: 'Wipe right', hint: 'Sweep the new shot in', group: 'wipe' },
  { id: 'wipe-up', name: 'Wipe up', hint: 'Sweep the new shot in', group: 'wipe' },
  { id: 'wipe-down', name: 'Wipe down', hint: 'Sweep the new shot in', group: 'wipe' },
  { id: 'wipe-diagonal', name: 'Diagonal wipe', hint: 'Slice across the frame', group: 'wipe' },
  { id: 'iris', name: 'Iris', hint: 'Open from the centre', group: 'shape' },
  { id: 'iris-out', name: 'Iris out', hint: 'Reveal from the edges', group: 'shape' },
  { id: 'clock', name: 'Clock wipe', hint: 'Radial clock sweep', group: 'shape' },
  { id: 'blinds-h', name: 'Blinds horizontal', hint: 'Reveal through slats', group: 'shape' },
  { id: 'blinds-v', name: 'Blinds vertical', hint: 'Reveal through slats', group: 'shape' },
  { id: 'checker', name: 'Checker', hint: 'Reveal in a grid', group: 'shape' },
  { id: 'split-h', name: 'Split horizontal', hint: 'Split and slide', group: 'shape' },
  { id: 'split-v', name: 'Split vertical', hint: 'Split and slide', group: 'shape' },
  { id: 'blur', name: 'Blur cut', hint: 'Blur through the edit', group: 'distort' },
  { id: 'blur-in', name: 'Blur in', hint: 'Resolve from soft focus', group: 'distort' },
  { id: 'whip-left', name: 'Whip left', hint: 'Fast pan with motion blur', group: 'distort' },
  { id: 'whip-right', name: 'Whip right', hint: 'Fast pan with motion blur', group: 'distort' },
  { id: 'whip-up', name: 'Whip up', hint: 'Fast pan with motion blur', group: 'distort' },
  { id: 'whip-down', name: 'Whip down', hint: 'Fast pan with motion blur', group: 'distort' },
  { id: 'spin', name: 'Spin', hint: 'Rotate through the cut', group: 'distort' },
  { id: 'flip-h', name: 'Flip horizontal', hint: 'Card flip sideways', group: 'distort' },
  { id: 'flip-v', name: 'Flip vertical', hint: 'Card flip vertically', group: 'distort' },
  { id: 'glitch', name: 'Glitch', hint: 'Digital signal slip', group: 'distort' },
  { id: 'light-leak', name: 'Light leak', hint: 'Warm flare wash', group: 'light' },
  { id: 'roll-left', name: 'Roll left', hint: 'Rolling film transition', group: 'distort' },
  { id: 'roll-right', name: 'Roll right', hint: 'Rolling film transition', group: 'distort' },
  { id: 'mosaic', name: 'Mosaic', hint: 'Pixelate through the cut', group: 'distort' },
  { id: 'diamond', name: 'Diamond', hint: 'Open as a diamond', group: 'shape' },
]

export interface AnimationPreset {
  id: AnimationType
  name: string
}

export const ANIMATIONS: AnimationPreset[] = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Fade' },
  { id: 'fade-up', name: 'Fade up' },
  { id: 'fade-down', name: 'Fade down' },
  { id: 'slide-up', name: 'Slide up' },
  { id: 'slide-down', name: 'Slide down' },
  { id: 'slide-left', name: 'Slide left' },
  { id: 'slide-right', name: 'Slide right' },
  { id: 'slide-up-far', name: 'Fly up' },
  { id: 'slide-down-far', name: 'Fly down' },
  { id: 'pop', name: 'Pop' },
  { id: 'zoom-in', name: 'Zoom in' },
  { id: 'zoom-out', name: 'Zoom out' },
  { id: 'rotate', name: 'Rotate' },
  { id: 'rotate-right', name: 'Rotate right' },
  { id: 'spin-in', name: 'Spin in' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'blur-in', name: 'Blur in' },
  { id: 'blur-out', name: 'Blur out' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'elastic', name: 'Elastic' },
  { id: 'flip-h', name: 'Flip horizontal' },
  { id: 'flip-v', name: 'Flip vertical' },
  { id: 'swing', name: 'Swing' },
  { id: 'drop', name: 'Drop' },
  { id: 'rise', name: 'Rise' },
  { id: 'expand', name: 'Expand' },
  { id: 'contract', name: 'Contract' },
  { id: 'wipe-left', name: 'Wipe left' },
  { id: 'wipe-right', name: 'Wipe right' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'shake', name: 'Shake' },
  { id: 'drift', name: 'Drift' },
  { id: 'float', name: 'Float' },
  { id: 'tumble', name: 'Tumble' },
  { id: 'unfold', name: 'Unfold' },
  { id: 'roll', name: 'Roll' },
  { id: 'drop-fade', name: 'Drop fade' },
  { id: 'zoom-pulse', name: 'Zoom pulse' },
]

export type EffectGroup = 'color' | 'light' | 'texture' | 'retro' | 'nature' | 'frame' | 'distort'

export interface EffectPreset {
  id: EffectId
  name: string
  hint: string
  group: EffectGroup
  swatch: string
}

export const EFFECTS: EffectPreset[] = [
  { id: 'vignette', name: 'Vignette', hint: 'Dark, cinematic corners', group: 'texture', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'grain', name: 'Film grain', hint: 'Organic 35mm texture', group: 'texture', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'light-leak', name: 'Light leak', hint: 'Warm edge flare', group: 'light', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'scanlines', name: 'Scanlines', hint: 'Retro CRT lines', group: 'retro', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'glitch', name: 'Glitch', hint: 'Digital signal slips', group: 'distort', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'shake', name: 'Handheld', hint: 'Subtle camera shake', group: 'distort', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'bloom', name: 'Bloom', hint: 'Soft light glow', group: 'light', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'warm-glow', name: 'Warm glow', hint: 'Golden screen wash', group: 'color', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'cool-mist', name: 'Cool mist', hint: 'Icy blue haze', group: 'color', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'teal-orange', name: 'Teal & Orange', hint: 'Cinematic colour split', group: 'color', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'sepia', name: 'Sepia', hint: 'Warm archival tone', group: 'color', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'noir', name: 'Noir', hint: 'High-contrast monochrome', group: 'color', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'dream', name: 'Dream', hint: 'Soft focus and glow', group: 'light', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'vhs', name: 'VHS', hint: 'Tape noise and colour bleed', group: 'retro', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'crt', name: 'CRT', hint: 'Curved tube glow', group: 'retro', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'old-film', name: 'Old film', hint: 'Sepia, grain and scratches', group: 'retro', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'projector', name: 'Projector', hint: 'Flickering cinema light', group: 'retro', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'neon', name: 'Neon', hint: 'Electric colour bloom', group: 'light', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'cyberpunk', name: 'Cyberpunk', hint: 'Magenta and cyan city', group: 'color', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'infrared', name: 'Infrared', hint: 'False-colour heat', group: 'color', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'thermal', name: 'Thermal', hint: 'Heat camera palette', group: 'color', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'night-vision', name: 'Night vision', hint: 'Green low-light view', group: 'color', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'bleach', name: 'Bleach bypass', hint: 'Desaturated and punchy', group: 'color', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'matte', name: 'Matte', hint: 'Soft lifted blacks', group: 'color', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'pastel', name: 'Pastel', hint: 'Airy candy tones', group: 'color', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'candy', name: 'Candy', hint: 'Sweet pink wash', group: 'color', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'sunset', name: 'Sunset', hint: 'Orange and violet', group: 'color', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'ocean', name: 'Ocean', hint: 'Deep blue grade', group: 'color', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'forest', name: 'Forest', hint: 'Mossy green grade', group: 'color', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'lavender', name: 'Lavender', hint: 'Soft violet haze', group: 'color', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'rose', name: 'Rose', hint: 'Blush pink grade', group: 'color', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'amber', name: 'Amber', hint: 'Golden amber wash', group: 'color', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'arctic', name: 'Arctic', hint: 'Frozen cyan grade', group: 'color', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'ember', name: 'Ember', hint: 'Fiery red glow', group: 'color', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'chrome', name: 'Chrome', hint: 'Polished silver sheen', group: 'color', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'duotone', name: 'Duotone', hint: 'Two-tone colour map', group: 'color', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'monochrome', name: 'Monochrome', hint: 'Pure greyscale', group: 'color', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'halftone', name: 'Halftone', hint: 'Printed dot screen', group: 'texture', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'dot-screen', name: 'Dot screen', hint: 'Comic dot texture', group: 'texture', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'grid', name: 'Grid', hint: 'Technical overlay', group: 'texture', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'crosshatch', name: 'Crosshatch', hint: 'Pencil texture', group: 'texture', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'stripes', name: 'Stripes', hint: 'Diagonal line texture', group: 'texture', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'noise', name: 'Noise', hint: 'Static texture', group: 'texture', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'paper', name: 'Paper', hint: 'Grainy paper stock', group: 'texture', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'watercolor', name: 'Watercolor', hint: 'Soft pigment wash', group: 'texture', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'sketch', name: 'Sketch', hint: 'Pencil outline look', group: 'texture', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'emboss', name: 'Emboss', hint: 'Raised relief shading', group: 'texture', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'edge-glow', name: 'Edge glow', hint: 'Luminous outlines', group: 'light', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'chromatic', name: 'Chromatic', hint: 'RGB channel split', group: 'distort', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'mirror', name: 'Mirror', hint: 'Horizontal reflection', group: 'distort', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'kaleido', name: 'Kaleidoscope', hint: 'Mirrored symmetry', group: 'distort', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'pixelate', name: 'Pixelate', hint: 'Chunky pixels', group: 'distort', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'mosaic', name: 'Mosaic', hint: 'Tile grid', group: 'distort', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'zoom-blur', name: 'Zoom blur', hint: 'Radial motion streaks', group: 'distort', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'echo', name: 'Echo', hint: 'Trailing double image', group: 'distort', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'snow', name: 'Snow', hint: 'Falling flakes', group: 'nature', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'rain', name: 'Rain', hint: 'Falling rain', group: 'nature', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'sparkle', name: 'Sparkle', hint: 'Twinkling stars', group: 'nature', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'bokeh', name: 'Bokeh', hint: 'Soft light circles', group: 'nature', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'confetti', name: 'Confetti', hint: 'Celebration pieces', group: 'nature', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
  { id: 'embers', name: 'Embers', hint: 'Rising sparks', group: 'nature', swatch: 'linear-gradient(135deg,#ffb86b,#ff6f91)' },
  { id: 'lens-flare', name: 'Lens flare', hint: 'Anamorphic flare', group: 'light', swatch: 'linear-gradient(135deg,#5ee7ff,#6d7cff)' },
  { id: 'sun-rays', name: 'Sun rays', hint: 'Radiant beams', group: 'light', swatch: 'linear-gradient(135deg,#c7f464,#22d3ee)' },
  { id: 'spotlight', name: 'Spotlight', hint: 'Stage light pool', group: 'light', swatch: 'linear-gradient(135deg,#ff4fd8,#4a1a8a)' },
  { id: 'letterbox', name: 'Letterbox', hint: 'Cinematic bars', group: 'frame', swatch: 'linear-gradient(135deg,#f2c879,#b5582e)' },
  { id: 'film-frame', name: 'Film frame', hint: '35mm border', group: 'frame', swatch: 'linear-gradient(135deg,#8affd8,#ff5edb)' },
  { id: 'polaroid', name: 'Polaroid', hint: 'Instant photo border', group: 'frame', swatch: 'linear-gradient(135deg,#a3b18a,#344e41)' },
  { id: 'film-strip', name: 'Film strip', hint: 'Sprocket border', group: 'frame', swatch: 'linear-gradient(135deg,#ffd08a,#ff7a59)' },
  { id: 'soft-focus', name: 'Soft focus', hint: 'Dreamy diffusion', group: 'light', swatch: 'linear-gradient(135deg,#6ea8ff,#2b3a7a)' },
  { id: 'lomo', name: 'Lomo', hint: 'Vignette and saturation', group: 'color', swatch: 'linear-gradient(135deg,#cfd8e3,#5c6878)' },
]

export interface StickerPreset {
  src: string
  label: string
  keywords?: string
}

export const STICKERS: StickerPreset[] = [
  { src: '/stickers/heart.svg', label: 'Heart', keywords: 'love like' },
  { src: '/stickers/star.svg', label: 'Star', keywords: 'favourite' },
  { src: '/stickers/sparkle.svg', label: 'Sparkle', keywords: 'magic shine' },
  { src: '/stickers/arrow.svg', label: 'Arrow', keywords: 'point' },
  { src: '/stickers/bolt.svg', label: 'Bolt', keywords: 'energy fast' },
  { src: '/stickers/smiley.svg', label: 'Smiley', keywords: 'happy face' },
  { src: '/stickers/speech.svg', label: 'Speech bubble', keywords: 'talk comment' },
  { src: '/stickers/crown.svg', label: 'Crown', keywords: 'king queen' },
  { src: '/stickers/flower.svg', label: 'Flower', keywords: 'nature' },
  { src: '/stickers/sun.svg', label: 'Sun', keywords: 'summer' },
  { src: '/stickers/cloud.svg', label: 'Cloud', keywords: 'sky' },
  { src: '/stickers/check.svg', label: 'Check', keywords: 'done ok' },
  { src: '/stickers/badge.svg', label: 'Badge', keywords: 'award' },
  { src: '/stickers/music.svg', label: 'Music', keywords: 'sound note' },
  { src: '/stickers/camera.svg', label: 'Camera', keywords: 'vlog film' },
  { src: '/stickers/play.svg', label: 'Play button', keywords: 'video' },
  { src: '/stickers/fire.svg', label: 'Fire', keywords: 'hot trend' },
  { src: '/stickers/leaf.svg', label: 'Leaf', keywords: 'eco nature' },
  { src: '/stickers/diamond.svg', label: 'Diamond', keywords: 'premium' },
  { src: '/stickers/idea.svg', label: 'Idea', keywords: 'bulb tip' },
  { src: '/stickers/eyes.svg', label: 'Eyes', keywords: 'look' },
  { src: '/stickers/burst.svg', label: 'Burst', keywords: 'wow new' },
  { src: '/stickers/underline.svg', label: 'Swoosh', keywords: 'line' },
  { src: '/stickers/ring.svg', label: 'Ring', keywords: 'circle highlight' },
]

export interface TextPreset {
  id: string
  name: string
  sample: string
  style: Partial<TextData>
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'clean',
    name: 'Clean',
    sample: 'Simply clear',
    style: {},
  },
  {
    id: 'impact',
    name: 'Impact',
    sample: 'MAKE IT LOUD',
    style: {
      fontFamily: 'Bebas Neue',
      fontSize: 132,
      fontWeight: 400,
      color: '#ffffff',
      strokeColor: '#09090c',
      strokeWidth: 5,
      shadowBlur: 28,
      shadowOffsetY: 10,
      letterSpacing: 2,
      content: 'MAKE IT LOUD',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    sample: 'A slower story',
    style: {
      fontFamily: 'Playfair Display',
      fontSize: 96,
      fontWeight: 500,
      italic: true,
      content: 'A slower story',
      shadowBlur: 18,
    },
  },
  {
    id: 'script',
    name: 'Script',
    sample: 'good vibes',
    style: {
      fontFamily: 'Pacifico',
      fontSize: 100,
      fontWeight: 400,
      content: 'good vibes',
      shadowBlur: 20,
      shadowOffsetY: 6,
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    sample: 'AFTER HOURS',
    style: {
      fontFamily: 'Oswald',
      fontSize: 100,
      fontWeight: 500,
      color: '#d6fff8',
      shadowColor: '#22d3ee',
      shadowBlur: 42,
      shadowOffsetY: 0,
      letterSpacing: 6,
      content: 'AFTER HOURS',
    },
  },
  {
    id: 'gradient',
    name: 'Aurora',
    sample: 'new horizons',
    style: {
      fontFamily: 'Space Grotesk',
      fontSize: 94,
      fontWeight: 700,
      gradient: { from: '#a78bfa', to: '#22d3ee' },
      content: 'new horizons',
    },
  },
  {
    id: 'caption',
    name: 'Caption',
    sample: 'This is the moment.',
    style: {
      fontFamily: 'Inter',
      fontSize: 46,
      fontWeight: 600,
      backgroundColor: '#09090c',
      backgroundOpacity: 0.68,
      backgroundRadius: 14,
      paddingX: 24,
      paddingY: 12,
      maxWidth: 0.78,
      content: 'This is the moment.',
    },
  },
  {
    id: 'badge',
    name: 'Badge',
    sample: 'NEW DROP',
    style: {
      fontFamily: 'Space Grotesk',
      fontSize: 54,
      fontWeight: 700,
      color: '#08080c',
      backgroundColor: '#c7f464',
      backgroundOpacity: 1,
      backgroundRadius: 16,
      paddingX: 30,
      paddingY: 12,
      letterSpacing: 2,
      content: 'NEW DROP',
    },
  },
  {
    id: 'outline',
    name: 'Outline',
    sample: 'OUTLINE',
    style: {
      fontFamily: 'Bebas Neue',
      fontSize: 132,
      fontWeight: 400,
      color: 'transparent',
      strokeColor: '#ffffff',
      strokeWidth: 3,
      shadowBlur: 0,
      content: 'OUTLINE',
    },
  },
  {
    id: 'retro',
    name: 'Postcard',
    sample: 'Summer 26',
    style: {
      fontFamily: 'Playfair Display',
      fontSize: 92,
      fontWeight: 700,
      color: '#ffe6a7',
      strokeColor: '#5a2e1c',
      strokeWidth: 4,
      shadowColor: '#7c2d12',
      shadowBlur: 18,
      content: 'Summer 26',
    },
  },
]

export const BLEND_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'screen', label: 'Screen' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'darken', label: 'Darken' },
] as const

export const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4]

export const EXPORT_HEIGHTS = [
  { label: '480p', height: 480 },
  { label: '720p', height: 720 },
  { label: '1080p', height: 1080 },
  { label: '1440p', height: 1440 },
  { label: '4K', height: 2160 },
]

export const MAX_HISTORY = 80
