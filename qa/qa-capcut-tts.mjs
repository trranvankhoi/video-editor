import { chromium } from 'playwright'

/**
 * End-to-end CapCut Vietnamese TTS test.
 *
 * By default it uses the Vite dev-server bridge at `/capcut`, which runs the
 * Python SDK through tools/capcut_tts_cli.py. No separate helper process is
 * needed. Set CAPCUT_PROXY to test another address (for example the standalone
 * http://127.0.0.1:8765 helper). The script makes one short synthesis request.
 */

const proxyUrl = process.env.CAPCUT_PROXY ?? '/capcut'
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New project' }).first().click()
await page.locator('#project-name').fill('CapCut TTS QA')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })

await page.getByRole('tab', { name: 'Voice', exact: true }).click()
await page.waitForTimeout(400)

const piperCount = await page.locator('.library-body select').first().locator('option').count()
console.log('PIPER VOICES', piperCount)

await page.getByRole('button', { name: 'CapCut · VN' }).click()
await page.waitForTimeout(300)
const capcutSelect = page.locator('.library-body select').first()
const capcutCount = await capcutSelect.locator('option').count()
console.log('CAPCUT VOICES', capcutCount)

const proxyInput = page.getByLabel('CapCut bridge URL')
await proxyInput.fill(proxyUrl)
await page.getByRole('button', { name: 'Test', exact: true }).click()
await page.waitForFunction(
  () => (document.querySelector('.library-body')?.textContent ?? '').includes('Connected'),
  null,
  { timeout: 15000 },
)
const status = await page
  .locator('.library-body')
  .evaluate((node) => {
    const text = node.textContent ?? ''
    const match = text.match(/Connected · \d+ voices(?: · mock)?/)
    return match?.[0] ?? ''
  })
console.log('PROXY STATUS', status)

await page.getByLabel('Text to speak').fill('Xin chào, đây là bài kiểm tra giọng đọc tiếng Việt từ CapCut.')

const clipsBefore = await page.locator('.timeline-clip').count()
const started = Date.now()
await page.getByRole('button', { name: /Add voiceover/ }).click()
await page.waitForFunction(
  (before) => {
    const clips = document.querySelectorAll('.timeline-clip').length
    const failed = [...document.querySelectorAll('.toast')].some((toast) =>
      /failed|error|could not|not connected|unknown/i.test(toast.textContent ?? ''),
    )
    return clips > before || failed
  },
  clipsBefore,
  { timeout: 240000 },
)
await page.waitForTimeout(1200)

const audioClips = await page.locator('.timeline-clip.kind-audio').count()
const audioTitles = await page
  .locator('.timeline-clip.kind-audio')
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title') ?? ''))
const waveforms = await page.locator('.timeline-clip.kind-audio .clip-waveform').count()
const tracks = await page.locator('.track-name').allInnerTexts().catch(() => [])
const toasts = await page.locator('.toast').allInnerTexts()
console.log(
  JSON.stringify(
    {
      proxyUrl,
      seconds: Math.round((Date.now() - started) / 1000),
      piperCount,
      capcutCount,
      status,
      clipsBefore,
      audioClips,
      audioTitles,
      waveforms,
      voiceoverTrack: tracks.some((text) => /voiceover/i.test(text)),
      toasts,
      errors,
    },
    null,
    2,
  ),
)
await page.screenshot({ path: '/tmp/opencode/capcut-tts.png' })
await browser.close()
