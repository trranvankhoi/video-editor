import type { AnimationType } from './types'

export type AnimationEase = 'out' | 'back' | 'quint' | 'bounce' | 'elastic' | 'linear'

/**
 * Declarative animation description. Values describe the "away" state at the
 * start of an in-animation (or the end of an out-animation); the renderer
 * interpolates back to the clip's resting transform.
 *
 * Offsets are fractions of the project width/height so animations scale with
 * any canvas size. Rotations are degrees.
 */
export interface AnimationSpec {
  alphaFrom?: number
  dx?: number
  dy?: number
  scaleFrom?: number
  scaleXFrom?: number
  scaleYFrom?: number
  rotFrom?: number
  blurFrom?: number
  reveal?: boolean
  ease?: AnimationEase
}

export const ANIMATION_SPECS: Record<AnimationType, AnimationSpec> = {
  none: {},
  fade: { alphaFrom: 0 },
  'fade-up': { alphaFrom: 0, dy: 0.05 },
  'fade-down': { alphaFrom: 0, dy: -0.05 },
  'slide-up': { alphaFrom: 1, dy: 0.12 },
  'slide-down': { alphaFrom: 1, dy: -0.12 },
  'slide-left': { alphaFrom: 1, dx: 0.14 },
  'slide-right': { alphaFrom: 1, dx: -0.14 },
  'slide-up-far': { alphaFrom: 0, dy: 0.4 },
  'slide-down-far': { alphaFrom: 0, dy: -0.4 },
  pop: { alphaFrom: 0, scaleFrom: 0.4, ease: 'back' },
  'zoom-in': { alphaFrom: 0, scaleFrom: 0.55 },
  'zoom-out': { alphaFrom: 0, scaleFrom: 1.7 },
  rotate: { alphaFrom: 0, rotFrom: -18, scaleFrom: 0.82 },
  'rotate-right': { alphaFrom: 0, rotFrom: 18, scaleFrom: 0.82 },
  'spin-in': { alphaFrom: 0, rotFrom: -180, scaleFrom: 0.2, ease: 'quint' },
  typewriter: { alphaFrom: 1, reveal: true },
  'blur-in': { alphaFrom: 0, blurFrom: 18 },
  'blur-out': { alphaFrom: 1, blurFrom: 18 },
  bounce: { alphaFrom: 1, dy: -0.28, ease: 'bounce' },
  elastic: { alphaFrom: 0, scaleFrom: 0.2, ease: 'elastic' },
  'flip-h': { alphaFrom: 0, scaleXFrom: 0.02 },
  'flip-v': { alphaFrom: 0, scaleYFrom: 0.02 },
  swing: { alphaFrom: 0, rotFrom: 24 },
  drop: { alphaFrom: 0, dy: -0.45, ease: 'bounce' },
  rise: { alphaFrom: 0, dy: 0.45 },
  expand: { alphaFrom: 0, scaleFrom: 0.01 },
  contract: { alphaFrom: 0, scaleFrom: 2.2 },
  'wipe-left': { alphaFrom: 1, dx: -0.14 },
  'wipe-right': { alphaFrom: 1, dx: 0.14 },
  pulse: { alphaFrom: 0, scaleFrom: 0.85 },
  glitch: { alphaFrom: 0.2, dx: 0.03, blurFrom: 2 },
  shake: { alphaFrom: 1, dx: 0.02, dy: 0.02 },
  drift: { alphaFrom: 0, dy: 0.08, ease: 'linear' },
  float: { alphaFrom: 0, dy: -0.08 },
  tumble: { alphaFrom: 0, rotFrom: -90, dx: 0.2, scaleFrom: 0.5 },
  unfold: { alphaFrom: 0, scaleYFrom: 0.05 },
  roll: { alphaFrom: 0, rotFrom: 180, ease: 'quint' },
  'drop-fade': { alphaFrom: 0, dy: -0.22, blurFrom: 6 },
  'zoom-pulse': { alphaFrom: 0, scaleFrom: 1.35, ease: 'back' },
}
