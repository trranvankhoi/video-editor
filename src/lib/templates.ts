import { createStickerClip, createTextClip } from './project'
import type { Clip, Project } from './types'

export interface TemplateDef {
  id: string
  name: string
  description: string
  badge: string
  accent: string
  background: string
  previewFont: string
  previewTitle: string
  build: (project: Project) => { clips: Array<{ track: 'text' | 'sticker'; clip: Clip }>; background?: string }
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'bold-opener',
    name: 'Bold Opener',
    description: 'Punchy title card with a sparkle accent.',
    badge: 'Intro',
    accent: '#c7f464',
    background: 'linear-gradient(135deg,#181426 0%,#3b1d5e 55%,#0e2a3a 100%)',
    previewFont: 'Bebas Neue',
    previewTitle: 'MAKE IT MOVE',
    build: (project) => {
      const s = project.height / 1080
      const title = createTextClip(
        {
          content: 'MAKE IT\nMOVE',
          fontFamily: 'Bebas Neue',
          fontSize: Math.round(158 * s),
          fontWeight: 400,
          lineHeight: 0.92,
          letterSpacing: 4,
          strokeColor: '#08080c',
          strokeWidth: 6 * s,
          shadowBlur: 32 * s,
        },
        { start: 0, duration: 5.2, name: 'MAKE IT MOVE' },
      )
      title.transform.y = -40 * s
      title.animationIn = { type: 'zoom-in', duration: 0.7 }
      title.animationOut = { type: 'fade', duration: 0.5 }

      const kicker = createTextClip(
        {
          content: 'A  C L I P P R O  T E M P L A T E',
          fontFamily: 'Space Grotesk',
          fontSize: Math.round(26 * s),
          fontWeight: 600,
          color: '#c7f464',
          letterSpacing: 5,
          shadowBlur: 0,
        },
        { start: 0.7, duration: 4.2, name: 'Kicker' },
      )
      kicker.transform.y = 230 * s
      kicker.animationIn = { type: 'slide-up', duration: 0.6 }

      const sparkle = createStickerClip(
        { src: '/stickers/sparkle.svg', label: 'Sparkle', size: 0.18 },
        { start: 1.2, duration: 3.5 },
      )
      sparkle.transform.x = 440 * s
      sparkle.transform.y = -260 * s
      sparkle.transform.rotation = 12
      sparkle.animationIn = { type: 'pop', duration: 0.6 }

      return {
        clips: [
          { track: 'text', clip: title },
          { track: 'text', clip: kicker },
          { track: 'sticker', clip: sparkle },
        ],
      }
    },
  },
  {
    id: 'minimal',
    name: 'Quiet Luxury',
    description: 'Editorial serif with generous breathing room.',
    badge: 'Title',
    accent: '#f4dfc8',
    background: 'linear-gradient(150deg,#1b1a17 0%,#4a4032 60%,#141310 100%)',
    previewFont: 'Playfair Display',
    previewTitle: 'less, but better',
    build: (project) => {
      const s = project.height / 1080
      const title = createTextClip(
        {
          content: 'less, but better',
          fontFamily: 'Playfair Display',
          fontSize: Math.round(112 * s),
          fontWeight: 500,
          italic: true,
          color: '#f8f1e6',
          shadowBlur: 30 * s,
          shadowOffsetY: 10 * s,
        },
        { start: 0, duration: 5.5, name: 'less, but better' },
      )
      title.animationIn = { type: 'fade', duration: 1.4 }
      title.animationOut = { type: 'fade', duration: 0.8 }

      const label = createTextClip(
        {
          content: 'C L I P P R O  ·  S T U D I O',
          fontFamily: 'Inter',
          fontSize: Math.round(20 * s),
          fontWeight: 500,
          color: '#d8cbb8',
          letterSpacing: 6,
          shadowBlur: 0,
        },
        { start: 1.1, duration: 4.2, name: 'Label' },
      )
      label.transform.y = 210 * s
      label.animationIn = { type: 'fade', duration: 0.8 }

      return { clips: [{ track: 'text', clip: title }, { track: 'text', clip: label }] }
    },
  },
  {
    id: 'weekend',
    name: 'Weekend Diaries',
    description: 'Sun-soaked travel intro with a playful stamp.',
    badge: 'Vlog',
    accent: '#ffd166',
    background: 'linear-gradient(160deg,#ff9e6d 0%,#ff5f6d 48%,#6a2145 100%)',
    previewFont: 'Bebas Neue',
    previewTitle: 'WEEKEND DIARIES',
    build: (project) => {
      const s = project.height / 1080
      const title = createTextClip(
        {
          content: 'WEEKEND\nDIARIES',
          fontFamily: 'Bebas Neue',
          fontSize: Math.round(150 * s),
          fontWeight: 400,
          lineHeight: 0.9,
          color: '#fff7e8',
          strokeColor: '#4a1d33',
          strokeWidth: 4 * s,
          letterSpacing: 2,
        },
        { start: 0, duration: 5, name: 'WEEKEND DIARIES' },
      )
      title.transform.y = -20 * s
      title.animationIn = { type: 'slide-up', duration: 0.8 }

      const sun = createStickerClip(
        { src: '/stickers/sun.svg', label: 'Sun', size: 0.22 },
        { start: 0.5, duration: 4.5 },
      )
      sun.transform.x = 430 * s
      sun.transform.y = -330 * s
      sun.animationIn = { type: 'rotate', duration: 0.9 }

      const caption = createTextClip(
        {
          content: 'ep. 04  ·  somewhere warm',
          fontFamily: 'Inter',
          fontSize: Math.round(28 * s),
          fontWeight: 600,
          color: '#ffe9c9',
          letterSpacing: 1,
          shadowBlur: 12,
        },
        { start: 0.9, duration: 4, name: 'Caption' },
      )
      caption.transform.y = 270 * s
      caption.animationIn = { type: 'fade', duration: 0.6 }

      return {
        clips: [
          { track: 'text', clip: title },
          { track: 'text', clip: caption },
          { track: 'sticker', clip: sun },
        ],
      }
    },
  },
  {
    id: 'drop',
    name: 'Product Drop',
    description: 'A loud announcement with gradient type.',
    badge: 'Promo',
    accent: '#c7f464',
    background: 'linear-gradient(140deg,#0b0b12 0%,#241b48 60%,#0b2b33 100%)',
    previewFont: 'Space Grotesk',
    previewTitle: 'NEW DROP',
    build: (project) => {
      const s = project.height / 1080
      const badge = createTextClip(
        {
          content: 'NEW DROP',
          fontFamily: 'Space Grotesk',
          fontSize: Math.round(48 * s),
          fontWeight: 700,
          color: '#0a0a0f',
          backgroundColor: '#c7f464',
          backgroundOpacity: 1,
          backgroundRadius: 14 * s,
          paddingX: 28 * s,
          paddingY: 12 * s,
          letterSpacing: 3,
          shadowBlur: 0,
        },
        { start: 0.2, duration: 4.5, name: 'NEW DROP' },
      )
      badge.transform.y = -250 * s
      badge.animationIn = { type: 'pop', duration: 0.5 }

      const title = createTextClip(
        {
          content: 'CLIPPRO\nVOL. 01',
          fontFamily: 'Space Grotesk',
          fontSize: Math.round(128 * s),
          fontWeight: 700,
          gradient: { from: '#a78bfa', to: '#22d3ee' },
          lineHeight: 0.98,
          letterSpacing: -2,
        },
        { start: 0.35, duration: 4.5, name: 'CLIPPRO VOL. 01' },
      )
      title.animationIn = { type: 'zoom-in', duration: 0.7 }

      const burst = createStickerClip(
        { src: '/stickers/burst.svg', label: 'Burst', size: 0.16 },
        { start: 1, duration: 3.5 },
      )
      burst.transform.x = 430 * s
      burst.transform.y = -270 * s
      burst.animationIn = { type: 'pop', duration: 0.5 }

      return {
        clips: [
          { track: 'text', clip: badge },
          { track: 'text', clip: title },
          { track: 'sticker', clip: burst },
        ],
      }
    },
  },
  {
    id: 'story-caption',
    name: 'Story Captions',
    description: 'Top label and a readable lower-third.',
    badge: 'Caption',
    accent: '#7dd3fc',
    background: 'linear-gradient(160deg,#0f172a 0%,#1e3a5f 55%,#0b1220 100%)',
    previewFont: 'Inter',
    previewTitle: 'make every frame count',
    build: (project) => {
      const s = project.height / 1080
      const brand = createTextClip(
        {
          content: 'C L I P P R O  /  2 0 2 6',
          fontFamily: 'Inter',
          fontSize: Math.round(22 * s),
          fontWeight: 600,
          color: '#7dd3fc',
          letterSpacing: 4,
          shadowBlur: 0,
        },
        { start: 0, duration: 5.5, name: 'Brand' },
      )
      brand.transform.y = -project.height * 0.36
      brand.animationIn = { type: 'fade', duration: 0.5 }

      const caption = createTextClip(
        {
          content: 'make every frame count',
          fontFamily: 'Inter',
          fontSize: Math.round(44 * s),
          fontWeight: 550,
          backgroundColor: '#070b14',
          backgroundOpacity: 0.72,
          backgroundRadius: 14 * s,
          paddingX: 26 * s,
          paddingY: 12 * s,
          maxWidth: 0.82,
        },
        { start: 0.3, duration: 5.2, name: 'Caption' },
      )
      caption.transform.y = project.height * 0.3
      caption.animationIn = { type: 'slide-up', duration: 0.6 }
      caption.animationOut = { type: 'fade', duration: 0.5 }

      return { clips: [{ track: 'text', clip: brand }, { track: 'text', clip: caption }] }
    },
  },
  {
    id: 'postcard',
    name: 'Retro Postcard',
    description: 'Warm, nostalgic lettering for summer cuts.',
    badge: 'Titles',
    accent: '#ffd166',
    background: 'linear-gradient(145deg,#2a1a12 0%,#7c4a2d 55%,#301f16 100%)',
    previewFont: 'Playfair Display',
    previewTitle: "SUMMER '26",
    build: (project) => {
      const s = project.height / 1080
      const title = createTextClip(
        {
          content: "SUMMER '26",
          fontFamily: 'Playfair Display',
          fontSize: Math.round(126 * s),
          fontWeight: 800,
          color: '#ffe6a7',
          strokeColor: '#5a2e1c',
          strokeWidth: 5 * s,
          shadowColor: '#7c2d12',
          shadowBlur: 22 * s,
          letterSpacing: 1,
        },
        { start: 0.15, duration: 5.5, name: "SUMMER '26" },
      )
      title.animationIn = { type: 'fade', duration: 1.1 }

      const sub = createTextClip(
        {
          content: 'sun  ·  salt  ·  slow days',
          fontFamily: 'Pacifico',
          fontSize: Math.round(42 * s),
          fontWeight: 400,
          color: '#ffd8a8',
          shadowBlur: 16,
        },
        { start: 1, duration: 4.4, name: 'Subtitle' },
      )
      sub.transform.y = 180 * s
      sub.animationIn = { type: 'slide-up', duration: 0.7 }

      const flower = createStickerClip(
        { src: '/stickers/flower.svg', label: 'Flower', size: 0.16 },
        { start: 0.8, duration: 4.5 },
      )
      flower.transform.x = -450 * s
      flower.transform.y = -300 * s
      flower.transform.rotation = -12
      flower.animationIn = { type: 'rotate', duration: 0.8 }

      return {
        clips: [
          { track: 'text', clip: title },
          { track: 'text', clip: sub },
          { track: 'sticker', clip: flower },
        ],
      }
    },
  },
]
