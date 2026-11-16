import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('about:blank')

const assets = await page.evaluate(async () => {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 270
  const ctx = canvas.getContext('2d')

  const draw = (t) => {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    grad.addColorStop(0, `hsl(${(t * 80) % 360} 80% 45%)`)
    grad.addColorStop(1, `hsl(${(t * 80 + 120) % 360} 80% 25%)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText('TEST CLIP', 100, 140)
    ctx.beginPath()
    ctx.arc(240 + Math.sin(t * 3) * 120, 135, 30, 0, Math.PI * 2)
    ctx.fillStyle = '#c7f464'
    ctx.fill()
  }

  draw(0)
  const png = canvas.toDataURL('image/png')

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
  const chunks = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const done = new Promise((resolve) => (recorder.onstop = resolve))
  recorder.start(100)
  const start = performance.now()
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000
      draw(t)
      if (t < 3) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  recorder.stop()
  await done
  stream.getTracks().forEach((track) => track.stop())
  const webm = await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }))
  })
  return { png, webm }
})

writeFileSync('/tmp/opencode/test.png', Buffer.from(assets.png.split(',')[1], 'base64'))
writeFileSync('/tmp/opencode/test.webm', Buffer.from(assets.webm.split(',')[1], 'base64'))

// Simple 2 second 440 Hz mono WAV
const sampleRate = 44100
const seconds = 2
const samples = sampleRate * seconds
const buffer = Buffer.alloc(44 + samples * 2)
buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + samples * 2, 4)
buffer.write('WAVE', 8)
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)
buffer.writeUInt16LE(1, 22)
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE(sampleRate * 2, 28)
buffer.writeUInt16LE(2, 32)
buffer.writeUInt16LE(16, 34)
buffer.write('data', 36)
buffer.writeUInt32LE(samples * 2, 40)
for (let i = 0; i < samples; i++) {
  const v = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3 * 32767
  buffer.writeInt16LE(Math.round(v), 44 + i * 2)
}
writeFileSync('/tmp/opencode/test.wav', buffer)
await browser.close()
console.log('wrote test.png, test.webm, test.wav')
