import { chromium } from 'playwright'
import { statSync } from 'node:fs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New project' }).first().click()
await page.locator('#project-name').fill('Export QA')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })
await page.locator('input[type=file]').setInputFiles(['/tmp/opencode/test.webm', '/tmp/opencode/test.wav'])
await page.waitForFunction(() => !document.querySelector('.import-card'), null, { timeout: 30000 })
await page.waitForTimeout(800)

// Remove the audio clip from the timeline? Keep it; 6s total.
console.log('CLIPS', await page.locator('.timeline-clip').count())
await page.getByRole('button', { name: /^Export$/ }).first().click()
await page.waitForSelector('.modal', { timeout: 5000 })
await page.waitForTimeout(1200)
await page.locator('.export-format', { hasText: 'WebM' }).click()
await page.getByRole('button', { name: '480p', exact: true }).click()
await page.waitForTimeout(300)
console.log(
  'SETTINGS',
  (await page.locator('.modal-body').innerText()).replace(/\s+/g, ' ').slice(0, 400),
)

const downloadPromise = page.waitForEvent('download', { timeout: 180000 })
await page.getByRole('button', { name: /Export video/ }).click()
// Wait for done state or error
await page.waitForSelector('.export-done h3, .help-note .lucide-triangle-alert', { timeout: 180000 })
const done = await page.locator('.export-done h3').count()
console.log('DONE', done)
if (done) {
  console.log('DONE TEXT', await page.locator('.export-done').first().innerText())
  const download = await downloadPromise
  const path = '/tmp/opencode/export-result.webm'
  await download.saveAs(path)
  console.log('DOWNLOAD', download.suggestedFilename(), statSync(path).size)
  try {
    const info = await page.evaluate(async (url) => {
      const video = document.createElement('video')
      video.src = url
      video.muted = true
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve
        video.onerror = () => reject(new Error('metadata failed'))
      })
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
    }, 'file://' + path)
    console.log('VIDEO META', info)
  } catch (error) {
    console.log('VIDEO META FAILED', error.message)
  }
} else {
  console.log('BODY', (await page.locator('.modal-body').innerText()).slice(0, 1000))
}
await page.screenshot({ path: '/tmp/opencode/export-done.png' })
console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
