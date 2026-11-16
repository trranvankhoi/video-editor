import { audioBufferToWav } from './audio'
import { createAssetFromFile } from './media'
import {
  cloneAdjustments,
  createMediaClip,
  createProject,
  createStickerClip,
  createTextClip,
  createTrack,
} from './project'
import type { Asset, Project } from './types'
import { DEFAULT_ADJUSTMENTS } from './types'

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  const ctx = canvas.getContext('2d')!
  return { canvas, ctx }
}

function addGrain(ctx: CanvasRenderingContext2D, amount = 0.05) {
  const image = ctx.getImageData(0, 0, 1920, 1080)
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amount
    image.data[i] += n
    image.data[i + 1] += n
    image.data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)
}

function drawDunes(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas()
  const sky = ctx.createLinearGradient(0, 0, 0, 1080)
  sky.addColorStop(0, '#2b1738')
  sky.addColorStop(0.45, '#8a3350')
  sky.addColorStop(0.72, '#ff8a62')
  sky.addColorStop(1, '#ffd9a8')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1920, 1080)

  const glow = ctx.createRadialGradient(1270, 560, 20, 1270, 560, 420)
  glow.addColorStop(0, 'rgba(255,230,180,0.95)')
  glow.addColorStop(0.28, 'rgba(255,170,110,0.55)')
  glow.addColorStop(1, 'rgba(255,120,90,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1920, 1080)
  ctx.fillStyle = '#ffe9c9'
  ctx.beginPath()
  ctx.arc(1270, 560, 128, 0, Math.PI * 2)
  ctx.fill()

  const drawDune = (y: number, color: string, offset: number, height: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(-100, 1080)
    ctx.bezierCurveTo(280 + offset, y - height, 720 + offset, y + height * 0.4, 1080, y + 40)
    ctx.bezierCurveTo(1450, y + height * 0.7, 1720, y - height * 0.3, 2020, y + 90)
    ctx.lineTo(2020, 1080)
    ctx.closePath()
    ctx.fill()
  }
  drawDune(760, '#7c3b48', 0, 150)
  drawDune(850, '#5e2a3f', -100, 120)
  drawDune(950, '#3a1c2e', 120, 100)
  drawDune(1030, '#241222', 0, 60)

  ctx.strokeStyle = 'rgba(255,220,190,0.18)'
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 200 + i * 26)
    ctx.bezierCurveTo(500, 180 + i * 26, 1400, 240 + i * 26, 1920, 200 + i * 26)
    ctx.stroke()
  }
  addGrain(ctx, 0.035)
  return canvas
}

function drawOcean(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas()
  const sky = ctx.createLinearGradient(0, 0, 0, 1080)
  sky.addColorStop(0, '#03121f')
  sky.addColorStop(0.45, '#0c4a6e')
  sky.addColorStop(0.75, '#22d3ee')
  sky.addColorStop(1, '#a5f3fc')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1920, 1080)

  const sun = ctx.createRadialGradient(960, 660, 10, 960, 660, 380)
  sun.addColorStop(0, 'rgba(240,255,255,1)')
  sun.addColorStop(0.18, 'rgba(190,245,255,0.8)')
  sun.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, 1920, 1080)

  ctx.fillStyle = '#e6ffff'
  ctx.beginPath()
  ctx.arc(960, 660, 90, 0, Math.PI * 2)
  ctx.fill()

  const sea = ctx.createLinearGradient(0, 700, 0, 1080)
  sea.addColorStop(0, '#0e7490')
  sea.addColorStop(0.55, '#083344')
  sea.addColorStop(1, '#02111e')
  ctx.fillStyle = sea
  ctx.fillRect(0, 740, 1920, 340)

  for (let i = 0; i < 26; i++) {
    const y = 760 + i * 13
    ctx.strokeStyle = `rgba(165,243,252,${0.25 - i * 0.007})`
    ctx.lineWidth = 1.5 + (i % 4) * 0.6
    ctx.beginPath()
    for (let x = 0; x <= 1920; x += 60) {
      const wave = Math.sin(x * 0.008 + i * 1.7) * (3 + i * 0.35)
      if (x === 0) ctx.moveTo(x, y + wave)
      else ctx.lineTo(x, y + wave)
    }
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(240,255,255,0.85)'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.ellipse(900 + i * 34, 500 - i * 33, 70 - i * 6, 12 - i, -0.15, 0, Math.PI * 2)
    ctx.fill()
  }
  addGrain(ctx, 0.03)
  return canvas
}

function drawNeon(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas()
  const sky = ctx.createLinearGradient(0, 0, 0, 1080)
  sky.addColorStop(0, '#04040d')
  sky.addColorStop(0.5, '#140b2e')
  sky.addColorStop(0.78, '#3b1456')
  sky.addColorStop(1, '#0a0614')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1920, 1080)

  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 1920
    const y = Math.random() * 620
    const r = Math.random() * 1.7
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.shadowColor = '#ff2d95'
  ctx.shadowBlur = 60
  ctx.fillStyle = '#ff2d95'
  ctx.beginPath()
  ctx.arc(960, 480, 210, Math.PI, 0)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#0a0614'
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(740, 380 + i * 22, 440, 7)
  }
  ctx.strokeStyle = 'rgba(255,45,149,0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(960, 480, 212, Math.PI, 0)
  ctx.stroke()

  ctx.fillStyle = '#08040f'
  ctx.beginPath()
  ctx.moveTo(0, 780)
  ctx.lineTo(280, 600)
  ctx.lineTo(470, 740)
  ctx.lineTo(720, 560)
  ctx.lineTo(980, 760)
  ctx.lineTo(1280, 620)
  ctx.lineTo(1560, 780)
  ctx.lineTo(1920, 650)
  ctx.lineTo(1920, 1080)
  ctx.lineTo(0, 1080)
  ctx.closePath()
  ctx.fill()

  const floor = ctx.createLinearGradient(0, 760, 0, 1080)
  floor.addColorStop(0, 'rgba(59,20,86,0.1)')
  floor.addColorStop(1, 'rgba(255,45,149,0.22)')
  ctx.fillStyle = floor
  ctx.fillRect(0, 760, 1920, 320)
  ctx.strokeStyle = 'rgba(34,211,238,0.5)'
  ctx.lineWidth = 2
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath()
    ctx.moveTo(960 + i * 24, 770)
    ctx.lineTo(960 + i * 220, 1080)
    ctx.stroke()
  }
  for (let i = 0; i < 9; i++) {
    const y = 780 + i ** 1.8 * 5.2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1920, y)
    ctx.stroke()
  }
  addGrain(ctx, 0.04)
  return canvas
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], name, { type: 'image/png' }))
      else reject(new Error('Could not create sample image'))
    }, 'image/png')
  })
}

async function createSampleMusic(): Promise<File> {
  const sampleRate = 48_000
  const duration = 12
  const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate)
  const master = ctx.createGain()
  master.gain.value = 0.5
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -16
  compressor.knee.value = 12
  compressor.ratio.value = 4
  master.connect(compressor)
  compressor.connect(ctx.destination)

  const chords = [
    [146.83, 185.0, 220.0, 277.18],
    [123.47, 146.83, 185.0, 220.0],
    [98.0, 123.47, 146.83, 185.0],
    [110.0, 138.59, 164.81, 196.0],
  ]

  const playPad = (freq: number, start: number, length: number, gainAmount: number) => {
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 900
      filter.Q.value = 0.6
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(gainAmount, start + 0.55)
      gain.gain.setValueAtTime(gainAmount, start + length - 0.5)
      gain.gain.linearRampToValueAtTime(0, start + length)
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start(start)
      osc.stop(start + length + 0.05)
    }
  }

  for (let bar = 0; bar < 4; bar++) {
    const start = bar * 3
    const chord = chords[bar]
    for (const note of chord) playPad(note, start, 3, 0.028)
    playPad(chord[0] / 2, start, 3, 0.05)
  }

  const playBass = (freq: number, start: number) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.16, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + 0.75)
  }
  for (let bar = 0; bar < 4; bar++) {
    playBass(chords[bar][0] / 2, bar * 3)
    playBass(chords[bar][0] / 2, bar * 3 + 1.5)
  }

  const pluckNotes = [0, 2, 1, 3, 2, 0, 1, 3, 0, 2, 3, 1, 2, 0, 3, 1, 0, 2, 1, 3]
  for (let i = 0; i < pluckNotes.length; i++) {
    const bar = Math.floor(i / 5) % 4
    const freq = chords[bar][pluckNotes[i]] * 2
    const start = i * 0.6 + 0.3
    if (start > duration - 0.4) break
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3200
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.045, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + 0.55)
  }

  // A soft kick gives the loop a pulse without using any sampled material.
  for (let beat = 0; beat < 20; beat++) {
    const start = beat * 0.6
    if (start > duration - 0.3) break
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, start)
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.22)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + 0.3)
  }

  const buffer = await ctx.startRendering()
  return new File([audioBufferToWav(buffer)], 'Golden Hour.wav', { type: 'audio/wav' })
}

export interface SampleProject {
  project: Project
  assets: Asset[]
  blobs: Record<string, Blob>
}

export async function createSampleProject(): Promise<SampleProject> {
  const blobs: Record<string, Blob> = {}
  const [dunesFile, oceanFile, neonFile, musicFile] = await Promise.all([
    canvasToFile(drawDunes(), 'Golden Dunes.png'),
    canvasToFile(drawOcean(), 'Quiet Ocean.png'),
    canvasToFile(drawNeon(), 'Neon After Dark.png'),
    createSampleMusic(),
  ])
  const assets: Asset[] = []
  for (const file of [dunesFile, oceanFile, neonFile, musicFile]) {
    const asset = await createAssetFromFile(file)
    assets.push(asset)
    blobs[asset.id] = file
  }

  const project = createProject({
    name: 'Coastal Days · Sample',
    width: 1920,
    height: 1080,
    fps: 30,
  })
  const main = project.tracks[0]
  const textTrack = createTrack('text')
  const stickerTrack = createTrack('sticker')
  const audioTrack = createTrack('audio')
  project.tracks.push(textTrack, stickerTrack, audioTrack)

  const images = assets.filter((asset) => asset.type === 'image')
  const music = assets.find((asset) => asset.type === 'audio')!

  const warm = { ...DEFAULT_ADJUSTMENTS, temperature: 24, saturation: 10, brightness: 3, vignette: 18 }
  const cool = { ...DEFAULT_ADJUSTMENTS, temperature: -18, saturation: 12, contrast: 8, vignette: 12 }
  const night = { ...DEFAULT_ADJUSTMENTS, saturation: 22, contrast: 14, temperature: -8, vignette: 28 }

  images.forEach((asset, index) => {
    const clip = createMediaClip(asset, { start: index * 4, duration: 4 })
    clip.adjustments = cloneAdjustments(
      index === 0 ? warm : index === 1 ? cool : night,
    )
    if (index > 0) clip.transitionIn = { type: index === 1 ? 'fade' : 'slide-left', duration: 0.8 }
    clip.animationIn = { type: 'fade', duration: 0.4 }
    main.clips.push(clip)
  })

  const title = createTextClip(
    {
      content: 'COASTAL\nDAYS',
      fontFamily: 'Bebas Neue',
      fontSize: 184,
      fontWeight: 400,
      lineHeight: 0.9,
      strokeColor: '#1b0b17',
      strokeWidth: 7,
      letterSpacing: 4,
      shadowBlur: 40,
    },
    { start: 0.25, duration: 3.5, name: 'COASTAL DAYS' },
  )
  title.transform.y = -30
  title.animationIn = { type: 'zoom-in', duration: 0.8 }
  title.animationOut = { type: 'fade', duration: 0.5 }

  const subtitle = createTextClip(
    {
      content: 'a  c l i p p r o  o r i g i n a l',
      fontFamily: 'Space Grotesk',
      fontSize: 26,
      fontWeight: 500,
      color: '#ffe9c9',
      letterSpacing: 5,
      shadowBlur: 16,
    },
    { start: 0.9, duration: 2.9, name: 'Subtitle' },
  )
  subtitle.transform.y = 235
  subtitle.animationIn = { type: 'slide-up', duration: 0.6 }

  const captionStyle = {
    fontFamily: 'Inter',
    fontSize: 30,
    fontWeight: 600,
    backgroundColor: '#08080c',
    backgroundOpacity: 0.6,
    backgroundRadius: 10,
    paddingX: 20,
    paddingY: 9,
    color: '#ffffff',
    shadowBlur: 0,
    maxWidth: 0.8,
  }
  const labels = ['01  ·  golden dunes', '02  ·  quiet ocean', '03  ·  after dark']
  labels.forEach((label, index) => {
    const caption = createTextClip(
      { ...captionStyle, content: label },
      { start: index * 4 + 0.4, duration: 3.1, name: label },
    )
    caption.transform.y = 400
    caption.animationIn = { type: 'fade', duration: 0.5 }
    textTrack.clips.push(caption)
  })

  const sun = createStickerClip(
    { src: '/stickers/sun.svg', label: 'Sun', size: 0.13 },
    { start: 1.1, duration: 2.6 },
  )
  sun.transform.x = 620
  sun.transform.y = -290
  sun.animationIn = { type: 'rotate', duration: 0.9 }
  stickerTrack.clips.push(sun)

  const sparkle = createStickerClip(
    { src: '/stickers/sparkle.svg', label: 'Sparkle', size: 0.09 },
    { start: 8.3, duration: 3 },
  )
  sparkle.transform.x = -620
  sparkle.transform.y = -300
  sparkle.animationIn = { type: 'pop', duration: 0.7 }
  stickerTrack.clips.push(sparkle)

  textTrack.clips.push(title, subtitle)

  const musicClip = createMediaClip(music, { start: 0, duration: 12 })
  musicClip.volume = 0.5
  musicClip.fadeIn = 1.2
  musicClip.fadeOut = 2.4
  audioTrack.clips.push(musicClip)

  for (const track of project.tracks) {
    track.clips.sort((a, b) => a.start - b.start)
  }
  project.updatedAt = Date.now()

  return { project, assets, blobs }
}
