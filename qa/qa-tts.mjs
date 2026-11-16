import { chromium } from 'playwright'

/**
 * End-to-end Piper smoke test. It downloads a Vietnamese voice from Hugging
 * Face once (persistent profile caches it in OPFS), synthesizes the sample
 * script and checks that audio clips land on the Voiceover track.
 *
 * Run with: node qa/qa-tts.mjs
 * The first run needs network access; later runs reuse /tmp/opencode/tts-profile.
 */

const context = await chromium.launchPersistentContext(
  process.env.TTS_PROFILE ?? '/tmp/opencode/tts-profile',
  {
    viewport: { width: 1600, height: 1000 },
    args: ['--autoplay-policy=no-user-gesture-required'],
  },
)
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New project' }).first().click()
await page.locator('#project-name').fill('TTS QA')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })

await page.getByRole('tab', { name: 'Voice', exact: true }).click()
await page.waitForTimeout(500)

const voiceId = process.env.VOICE_ID ?? 'vi_VN-vais1000-medium'
const voiceSelect = page.locator('.library-body select').first()
await voiceSelect.selectOption(voiceId)
await page.waitForTimeout(600)

const downloadButton = page.getByRole('button', { name: /Download .*now/ })
if (await downloadButton.count()) {
  console.log('DOWNLOAD START', voiceId)
  await downloadButton.click()
  await page.waitForFunction(
    () => (document.querySelector('.library-body')?.textContent ?? '').includes('Cached in this browser'),
    null,
    { timeout: 300000 },
  )
  console.log('DOWNLOAD CACHED')
} else {
  console.log('VOICE ALREADY CACHED')
}

const clipsBefore = await page.locator('.timeline-clip').count()
const generateButton = page.getByRole('button', { name: /Add voiceover/ })
await generateButton.click()

const started = Date.now()
await page.waitForFunction(
  (before) => {
    const clips = document.querySelectorAll('.timeline-clip').length
    const failed = [...document.querySelectorAll('.toast')].some((toast) =>
      /failed|error|could not|blocked|no symbols/i.test(toast.textContent ?? ''),
    )
    return clips > before || failed
  },
  clipsBefore,
  { timeout: 300000 },
)
await page.waitForTimeout(1200)

const clipsAfter = await page.locator('.timeline-clip').count()
const toasts = await page.locator('.toast').allInnerTexts()
const tracks = await page.locator('.track-name').allInnerTexts().catch(() => [])
const audioClips = await page.locator('.timeline-clip.kind-audio').count()
const audioTitles = await page
  .locator('.timeline-clip.kind-audio')
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('title') ?? ''))
const audioDurations = audioTitles
  .map((title) => Number.parseFloat(title.split('·')[1] ?? ''))
  .filter((value) => Number.isFinite(value))
const waveforms = await page.locator('.timeline-clip.kind-audio .clip-waveform').count()
console.log(
  JSON.stringify(
    {
      voiceId,
      seconds: Math.round((Date.now() - started) / 1000),
      clipsBefore,
      clipsAfter,
      audioClips,
      audioTitles,
      minAudioDuration: audioDurations.length ? Math.min(...audioDurations) : 0,
      waveforms,
      voiceoverTrack: tracks.some((text) => /voiceover/i.test(text)),
      toasts,
      errors,
    },
    null,
    2,
  ),
)
await page.screenshot({ path: '/tmp/opencode/voice-generated.png' })
await context.close()
