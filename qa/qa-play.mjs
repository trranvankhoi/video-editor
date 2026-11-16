import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Open sample/i }).first().click()
await page.waitForSelector('.editor', { timeout: 10000 })
await page.waitForTimeout(1200)

const read = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas.preview-canvas')
    let avg = null
    if (canvas) {
      const ctx = canvas.getContext('2d')
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let sum = 0
      let n = 0
      for (let i = 0; i < d.length; i += 4 * 401) {
        sum += d[i] + d[i + 1] + d[i + 2]
        n++
      }
      avg = Math.round(sum / n / 3)
    }
    return {
      timecode: document.querySelector('.timecode')?.textContent?.replace(/\s+/g, ' ').trim(),
      playing: document.querySelector('.preview-quality')?.textContent,
      avg,
      playBtn: document.querySelector('.play-btn')?.getAttribute('aria-label'),
    }
  })

console.log('T0', await read())
await page.locator('.play-btn').click()
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(200)
  console.log(`T${(i + 1) * 200}`, await read())
}
await page.locator('.play-btn').click()
await page.waitForTimeout(200)
console.log('PAUSED', await read())
await page.screenshot({ path: '/tmp/opencode/play.png' })
await browser.close()
