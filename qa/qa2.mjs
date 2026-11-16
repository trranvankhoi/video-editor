import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Open sample/i }).first().click()
await page.waitForSelector('.editor', { timeout: 10000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/opencode/editor.png' })

const canvasStats = await page.evaluate(() => {
  const canvas = document.querySelector('canvas.preview-canvas')
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let nonBlack = 0
  let sum = 0
  for (let i = 0; i < data.length; i += 4 * 97) {
    const v = data[i] + data[i + 1] + data[i + 2]
    sum += v
    if (v > 24) nonBlack++
  }
  return { width: canvas.width, height: canvas.height, nonBlack, sampled: Math.ceil(data.length / (4 * 97)), avg: sum / Math.ceil(data.length / (4 * 97)) / 3 }
})

const info = await page.evaluate(() => {
  const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null
  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  return {
    clips: document.querySelectorAll('.timeline-clip').length,
    tracks: document.querySelectorAll('.track-header').length,
    libraryTabs: document.querySelectorAll('.library-tabs button').length,
    title: text('.project-title-input'),
    meta: text('.project-meta-pill'),
    save: text('.save-state'),
    inspector: text('.inspector-head .clip-title b'),
    layout: {
      topbar: rect('.topbar'),
      main: rect('.main-grid'),
      library: rect('.library-panel'),
      preview: rect('.preview-panel'),
      inspector: rect('.inspector'),
      timeline: rect('.timeline-panel'),
      canvas: rect('.preview-canvas'),
    },
  }
})
console.log('CANVAS', JSON.stringify(canvasStats))
console.log('INFO', JSON.stringify(info, null, 2))

// Select first clip
await page.locator('.timeline-clip').first().click()
await page.waitForTimeout(400)
console.log('SELECTED', await page.locator('.inspector-head .clip-title').innerText())

// Play for 1.2s
await page.locator('.play-btn').click()
await page.waitForTimeout(1200)
const playhead = await page.evaluate(() => document.querySelector('.timecode')?.textContent?.trim())
console.log('PLAYHEAD', playhead)
await page.locator('.play-btn').click()

// Open export modal
await page.getByRole('button', { name: /^Export$/ }).first().click()
await page.waitForSelector('.modal', { timeout: 5000 })
await page.waitForTimeout(1200)
const exportInfo = await page.evaluate(() => ({
  title: document.querySelector('.modal-head h2')?.textContent,
  formats: [...document.querySelectorAll('.export-format')].map((el) => ({
    text: el.textContent?.replace(/\s+/g, ' ').trim(),
    disabled: el.disabled,
    active: el.getAttribute('data-active'),
  })),
  body: document.querySelector('.modal-body')?.textContent?.replace(/\s+/g, ' ').slice(0, 1200),
}))
console.log('EXPORT', JSON.stringify(exportInfo, null, 2))
await page.screenshot({ path: '/tmp/opencode/export.png' })
console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
