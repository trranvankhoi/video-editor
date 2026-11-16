import type { TransitionType } from './types'

export type TransitionKind =
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'wipe'
  | 'blur'
  | 'whip'
  | 'spin'
  | 'flip'
  | 'glitch'
  | 'light'
  | 'roll'
  | 'mosaic'
  | 'iris'
  | 'clock'
  | 'blinds'
  | 'checker'
  | 'split'
  | 'diamond'

export type TransitionDirection = 'left' | 'right' | 'up' | 'down'

export interface TransitionSpec {
  kind: TransitionKind
  direction?: TransitionDirection
  /** Zoom strength, iris direction or dissolve softness depending on kind. */
  amount?: number
  /** Dip colour for fade-through transitions. */
  color?: string
  spin?: boolean
}

export const TRANSITION_SPECS: Record<TransitionType, TransitionSpec> = {
  fade: { kind: 'fade' },
  'fade-black': { kind: 'fade', color: '#000000' },
  'fade-white': { kind: 'fade', color: '#ffffff' },
  dissolve: { kind: 'fade', amount: 0.5 },
  'slide-left': { kind: 'slide', direction: 'left' },
  'slide-right': { kind: 'slide', direction: 'right' },
  'slide-up': { kind: 'slide', direction: 'up' },
  'slide-down': { kind: 'slide', direction: 'down' },
  'push-left': { kind: 'slide', direction: 'left', amount: 1.15 },
  'push-right': { kind: 'slide', direction: 'right', amount: 1.15 },
  'push-up': { kind: 'slide', direction: 'up', amount: 1.15 },
  'push-down': { kind: 'slide', direction: 'down', amount: 1.15 },
  'zoom-in': { kind: 'zoom', amount: 1 },
  'zoom-out': { kind: 'zoom', amount: -1 },
  'zoom-punch': { kind: 'zoom', amount: 1.5 },
  'zoom-spin': { kind: 'zoom', amount: 1, spin: true },
  'wipe-left': { kind: 'wipe', direction: 'left' },
  'wipe-right': { kind: 'wipe', direction: 'right' },
  'wipe-up': { kind: 'wipe', direction: 'up' },
  'wipe-down': { kind: 'wipe', direction: 'down' },
  'wipe-diagonal': { kind: 'wipe', direction: 'left', amount: 1 },
  iris: { kind: 'iris', amount: 1 },
  'iris-out': { kind: 'iris', amount: -1 },
  clock: { kind: 'clock' },
  'blinds-h': { kind: 'blinds', direction: 'up' },
  'blinds-v': { kind: 'blinds', direction: 'left' },
  checker: { kind: 'checker' },
  'split-h': { kind: 'split', direction: 'left' },
  'split-v': { kind: 'split', direction: 'up' },
  blur: { kind: 'blur' },
  'blur-in': { kind: 'blur', amount: 1 },
  'whip-left': { kind: 'whip', direction: 'left' },
  'whip-right': { kind: 'whip', direction: 'right' },
  'whip-up': { kind: 'whip', direction: 'up' },
  'whip-down': { kind: 'whip', direction: 'down' },
  spin: { kind: 'spin' },
  'flip-h': { kind: 'flip', direction: 'left' },
  'flip-v': { kind: 'flip', direction: 'up' },
  glitch: { kind: 'glitch' },
  'light-leak': { kind: 'light' },
  'roll-left': { kind: 'roll', direction: 'left' },
  'roll-right': { kind: 'roll', direction: 'right' },
  mosaic: { kind: 'mosaic' },
  diamond: { kind: 'diamond' },
}
