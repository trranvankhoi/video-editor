import { chromium } from 'playwright'

/**
 * End-to-end AI Voice Studio test (Vietnamese TTS + STT).
 *
 * Uses the public Space by default. Set STUDIO_BASE to test a local server:
 *   STUDIO_BASE=http://127.0.0.1:8000 node qa/qa-studio-tts.mjs
 *
 * The first request may take a while when the HF Space is waking up.
 */

const studioBase = process.env.STUDIO_BASE ?? 'https://tony2k-ai-voice-studio.hf.space'
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
await page.locator('#project-name').fill('AI Voice Studio QA')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })

await page.getByRole('tab', { name: 'Voice', exact: true }).click()
await page.waitForTimeout(400)

const library = page.locator('.library-body')
await library.getByRole('button', { name: 'Studio', exact: true }).click()
await page.waitForTimeout(300)

const voiceCount = await library.locator('select').first().locator('option').count()
console.log('STUDIO VOICES', voiceCount)

await page.getByLabel('AI Voice Studio base URL').fill(studioBase)
await page.getByRole('button', { name: 'Test', exact: true }).click()
await page.waitForFunction(
  () => (document.querySelector('.library-body')?.textContent ?? '').includes('Connected'),
  null,
  { timeout: 120000 },
)
const status = await library.evaluate((node) => {
  const text = node.textContent ?? ''
  return text.match(/Connected · \d+ Vietnamese voices/)?.[0] ?? ''
})
console.log('STUDIO STATUS', status)

await page
  .getByLabel('Text to speak')
  .fill('Xin chào, đây là bài kiểm tra giọng đọc tiếng Việt từ AI Voice Studio.')

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
  { timeout: 300000 },
)
await page.waitForTimeout(1200)

const audioClips = await page.locator('.timeline-clip.kind-audio').count()
const audioTitles = await page
  .locator('.timeline-clip.kind-audio')
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title') ?? ''))
const waveforms = await page.locator('.timeline-clip.kind-audio .clip-waveform').count()
const tracks = await page.locator('.track-name').allInnerTexts().catch(() => [])
const ttsToasts = await page.locator('.toast').allInnerTexts()

// STT: transcribe the voiceover we just generated.
await page.getByRole('tab', { name: 'Captions', exact: true }).click()
await page.waitForTimeout(400)
const captionsBody = page.locator('.library-body')
await captionsBody.locator('select').first().selectOption('studio')
await page.waitForTimeout(200)
const studioBaseField = page.getByLabel('AI Voice Studio base URL')
if (await studioBaseField.count()) await studioBaseField.fill(studioBase)

await page.getByRole('button', { name: /Generate captions from audio/ }).click()
await page.waitForFunction(
  () => {
    const textarea = document.querySelector('.library-body textarea')
    const failed = [...document.querySelectorAll('.toast')].some((toast) =>
      /failed|error|could not|no audio|empty transcript/i.test(toast.textContent ?? ''),
    )
    return (textarea?.value ?? '').trim().length > 0 || failed
  },
  null,
  { timeout: 300000 },
)
await page.waitForTimeout(800)

const transcript = await captionsBody.locator('textarea').inputValue()
const captionCues = await captionsBody.locator('.caption-row').count()
const sttToasts = await page.locator('.toast').allInnerTexts()

console.log(
  JSON.stringify(
    {
      studioBase,
      seconds: Math.round((Date.now() - started) / 1000),
      voiceCount,
      status,
      clipsBefore,
      audioClips,
      audioTitles,
      waveforms,
      voiceoverTrack: tracks.some((text) => /voiceover/i.test(text)),
      ttsToasts,
      transcriptPreview: transcript.slice(0, 240),
      captionCues,
      sttToasts,
      errors,
    },
    null,
    2,
  ),
)
await page.screenshot({ path: '/tmp/opencode/studio-tts.png' })
await browser.close()
