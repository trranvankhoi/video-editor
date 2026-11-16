import type { EffectId } from './types'

export type PatternKind = 'dots' | 'grid' | 'cross' | 'stripes' | 'halftone' | 'noise'
export type ParticleKind = 'snow' | 'rain' | 'sparkle' | 'bokeh' | 'confetti' | 'embers'

/**
 * Small, composable drawing operations. Every effect is a list of ops, which
 * keeps the renderer generic while still giving each preset a distinct look.
 * Intensities from the clip scale every op at render time.
 */
export type EffectOp =
  | {
      kind: 'tint'
      color: string
      blend?: GlobalCompositeOperation
      alpha?: number
    }
  | {
      kind: 'gradient'
      from: string
      to: string
      angle?: number
      blend?: GlobalCompositeOperation
      alpha?: number
    }
  | { kind: 'vignette'; strength?: number }
  | { kind: 'grain'; alpha?: number }
  | { kind: 'scanlines'; alpha?: number; gap?: number }
  | {
      kind: 'leak'
      from: string
      to: string
      corner?: 'tl' | 'tr' | 'bl' | 'br'
      alpha?: number
    }
  | { kind: 'soften'; px?: number; alpha?: number }
  | { kind: 'bloom'; alpha?: number; px?: number }
  | { kind: 'glitch'; amount?: number }
  | { kind: 'mirror'; axis?: 'x' | 'y'; alpha?: number }
  | { kind: 'pixelate'; size?: number }
  | {
      kind: 'pattern'
      pattern: PatternKind
      color: string
      alpha?: number
      scale?: number
    }
  | {
      kind: 'particles'
      particle: ParticleKind
      color?: string
      count?: number
      alpha?: number
    }
  | { kind: 'flare'; color?: string; alpha?: number }
  | { kind: 'rays'; color?: string; alpha?: number }
  | { kind: 'channels'; offset?: number; alpha?: number }
  | { kind: 'zoomblur'; amount?: number; alpha?: number }
  | {
      kind: 'frame'
      color?: string
      inset?: number
      alpha?: number
      sprockets?: boolean
    }
  | { kind: 'letterbox'; ratio?: number }
  | { kind: 'spotlight'; alpha?: number }

const grade = (color: string, alpha = 0.6, blend: GlobalCompositeOperation = 'soft-light'): EffectOp => ({
  kind: 'tint',
  color,
  blend,
  alpha,
})

export const EFFECT_SPECS: Record<EffectId, EffectOp[]> = {
  vignette: [{ kind: 'vignette', strength: 1 }],
  grain: [{ kind: 'grain', alpha: 0.5 }],
  'light-leak': [{ kind: 'leak', from: '#ffb347', to: '#ff2d95', corner: 'tr', alpha: 0.8 }],
  scanlines: [{ kind: 'scanlines', alpha: 0.6 }],
  glitch: [{ kind: 'glitch', amount: 1 }],
  shake: [],
  bloom: [{ kind: 'bloom', alpha: 0.6 }],
  'warm-glow': [grade('#ffb46b', 0.7), { kind: 'bloom', alpha: 0.25 }],
  'cool-mist': [grade('#6bb8ff', 0.65), { kind: 'soften', px: 1.5, alpha: 0.25 }],
  'teal-orange': [
    { kind: 'gradient', from: '#ff8a3c', to: '#0d8a9e', angle: 135, blend: 'soft-light', alpha: 0.85 },
  ],
  sepia: [grade('#c98a4b', 0.85, 'color'), { kind: 'grain', alpha: 0.18 }],
  noir: [grade('#9aa0aa', 0.95, 'color'), { kind: 'vignette', strength: 1.1 }],
  dream: [{ kind: 'soften', px: 6, alpha: 0.65 }, { kind: 'bloom', alpha: 0.5 }],
  vhs: [
    { kind: 'channels', offset: 3, alpha: 0.7 },
    { kind: 'scanlines', alpha: 0.55 },
    { kind: 'grain', alpha: 0.3 },
  ],
  crt: [
    { kind: 'scanlines', alpha: 0.75, gap: 3 },
    { kind: 'vignette', strength: 1.1 },
    { kind: 'bloom', alpha: 0.3 },
  ],
  'old-film': [grade('#d8b06a', 0.8, 'color'), { kind: 'grain', alpha: 0.5 }, { kind: 'vignette', strength: 1.1 }],
  projector: [
    { kind: 'vignette', strength: 1.2 },
    { kind: 'grain', alpha: 0.35 },
    { kind: 'leak', from: '#fff3c4', to: '#ffb347', corner: 'tl', alpha: 0.35 },
  ],
  neon: [
    grade('#22d3ee', 0.35, 'screen'),
    { kind: 'bloom', alpha: 0.7 },
    { kind: 'channels', offset: 1.5, alpha: 0.35 },
  ],
  cyberpunk: [
    { kind: 'gradient', from: '#ff2d95', to: '#22d3ee', angle: 120, blend: 'soft-light', alpha: 0.9 },
    { kind: 'scanlines', alpha: 0.2 },
  ],
  infrared: [
    grade('#ff2d55', 0.9, 'color'),
    { kind: 'gradient', from: '#ff2d55', to: '#6bff8a', angle: 45, blend: 'soft-light', alpha: 0.6 },
  ],
  thermal: [{ kind: 'gradient', from: '#0a1cff', to: '#ff3d00', angle: 90, blend: 'color', alpha: 0.95 }],
  'night-vision': [
    grade('#4dff88', 0.95, 'color'),
    { kind: 'grain', alpha: 0.45 },
    { kind: 'vignette', strength: 1.2 },
  ],
  bleach: [
    grade('#e8e8e8', 0.55),
    { kind: 'gradient', from: '#ffffff', to: '#202020', angle: 90, blend: 'overlay', alpha: 0.25 },
  ],
  matte: [grade('#8a94a8', 0.45)],
  pastel: [grade('#ffd6ec', 0.55), grade('#bde4ff', 0.15, 'screen')],
  candy: [
    { kind: 'gradient', from: '#ff8ad8', to: '#ffe08a', angle: 135, blend: 'soft-light', alpha: 0.75 },
  ],
  sunset: [
    { kind: 'gradient', from: '#ff8a3c', to: '#7a3cc8', angle: 90, blend: 'soft-light', alpha: 0.8 },
  ],
  ocean: [grade('#2f8fd8', 0.7), grade('#0a3a6a', 0.2, 'multiply')],
  forest: [grade('#4d8a4d', 0.7)],
  lavender: [grade('#b48aff', 0.7)],
  rose: [grade('#ff8ab0', 0.7)],
  amber: [grade('#ffb347', 0.75)],
  arctic: [grade('#7ad8ff', 0.7), grade('#d8f6ff', 0.12, 'screen')],
  ember: [{ kind: 'gradient', from: '#ff3d00', to: '#ffb347', angle: 0, blend: 'soft-light', alpha: 0.75 }],
  chrome: [
    { kind: 'gradient', from: '#ffffff', to: '#5a6472', angle: 135, blend: 'overlay', alpha: 0.5 },
    { kind: 'bloom', alpha: 0.3 },
  ],
  duotone: [{ kind: 'gradient', from: '#0a1a4a', to: '#ff5edb', angle: 135, blend: 'color', alpha: 0.95 }],
  monochrome: [grade('#9a9a9a', 1, 'color')],
  halftone: [{ kind: 'pattern', pattern: 'halftone', color: '#000000', alpha: 0.35, scale: 6 }],
  'dot-screen': [{ kind: 'pattern', pattern: 'dots', color: '#ffffff', alpha: 0.3, scale: 8 }],
  grid: [{ kind: 'pattern', pattern: 'grid', color: '#7ad8ff', alpha: 0.35, scale: 48 }],
  crosshatch: [{ kind: 'pattern', pattern: 'cross', color: '#ffffff', alpha: 0.28, scale: 10 }],
  stripes: [{ kind: 'pattern', pattern: 'stripes', color: '#ffffff', alpha: 0.2, scale: 12 }],
  noise: [{ kind: 'pattern', pattern: 'noise', color: '#ffffff', alpha: 0.35, scale: 1 }],
  paper: [grade('#f0e2c8', 0.5), { kind: 'pattern', pattern: 'noise', color: '#8a7a5a', alpha: 0.25, scale: 1 }],
  watercolor: [
    { kind: 'soften', px: 4, alpha: 0.5 },
    { kind: 'pattern', pattern: 'noise', color: '#ffffff', alpha: 0.2, scale: 1 },
    grade('#a8c8ff', 0.3),
  ],
  sketch: [
    grade('#ffffff', 0.7, 'color'),
    { kind: 'pattern', pattern: 'cross', color: '#1a1a1a', alpha: 0.4, scale: 6 },
    { kind: 'gradient', from: '#ffffff', to: '#b0b0b0', angle: 90, blend: 'overlay', alpha: 0.35 },
  ],
  emboss: [
    { kind: 'gradient', from: '#ffffff', to: '#000000', angle: 135, blend: 'overlay', alpha: 0.55 },
  ],
  'edge-glow': [{ kind: 'channels', offset: 2.5, alpha: 0.55 }, { kind: 'bloom', alpha: 0.45 }],
  chromatic: [{ kind: 'channels', offset: 4, alpha: 0.9 }],
  mirror: [{ kind: 'mirror', axis: 'x', alpha: 0.5 }],
  kaleido: [{ kind: 'mirror', axis: 'x', alpha: 0.5 }, { kind: 'mirror', axis: 'y', alpha: 0.5 }],
  pixelate: [{ kind: 'pixelate', size: 12 }],
  mosaic: [{ kind: 'pixelate', size: 20 }, { kind: 'pattern', pattern: 'grid', color: '#000000', alpha: 0.25, scale: 24 }],
  'zoom-blur': [{ kind: 'zoomblur', amount: 0.18, alpha: 0.65 }],
  echo: [{ kind: 'channels', offset: 7, alpha: 0.55 }, { kind: 'zoomblur', amount: 0.1, alpha: 0.3 }],
  snow: [{ kind: 'particles', particle: 'snow', color: '#ffffff', count: 80, alpha: 0.85 }],
  rain: [{ kind: 'particles', particle: 'rain', color: '#bcd8ff', count: 90, alpha: 0.6 }],
  sparkle: [{ kind: 'particles', particle: 'sparkle', color: '#fff3b0', count: 40, alpha: 0.9 }],
  bokeh: [{ kind: 'particles', particle: 'bokeh', color: '#ffd9a8', count: 22, alpha: 0.55 }],
  confetti: [{ kind: 'particles', particle: 'confetti', color: '#ff5edb', count: 50, alpha: 0.8 }],
  embers: [{ kind: 'particles', particle: 'embers', color: '#ff8a3c', count: 45, alpha: 0.8 }],
  'lens-flare': [{ kind: 'flare', color: '#9ad8ff', alpha: 0.75 }],
  'sun-rays': [{ kind: 'rays', color: '#ffe6a8', alpha: 0.55 }],
  spotlight: [{ kind: 'spotlight', alpha: 0.75 }],
  letterbox: [{ kind: 'letterbox', ratio: 2.39 }],
  'film-frame': [{ kind: 'frame', color: '#0a0a0a', inset: 0.035, alpha: 0.9 }],
  polaroid: [
    { kind: 'frame', color: '#f4efe6', inset: 0.055, alpha: 0.95 },
    grade('#ffe9c8', 0.3),
  ],
  'film-strip': [{ kind: 'frame', color: '#08080a', inset: 0.06, alpha: 0.95, sprockets: true }],
  'soft-focus': [{ kind: 'soften', px: 7, alpha: 0.55 }, { kind: 'bloom', alpha: 0.35 }],
  lomo: [{ kind: 'vignette', strength: 1.5 }, grade('#ff8a3c', 0.4)],
}
