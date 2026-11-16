import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))

const bodyText = () => page.locator('.library-body').innerText()

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New project' }).first().click()
await page.locator('#project-name').fill('Advanced QA')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })

await page.locator('input[type=file]').setInputFiles([
  '/tmp/opencode/test.png',
  '/tmp/opencode/test.webm',
  '/tmp/opencode/test.wav',
])
await page.waitForFunction(() => !document.querySelector('.import-card'), null, { timeout: 30000 })
await page.waitForTimeout(700)
console.log('IMPORTED CLIPS', await page.locator('.timeline-clip').count())

// Select a visual clip.
await page.locator('.timeline-clip.kind-video').first().click()
await page.waitForTimeout(250)

// --- Color wheels / LUT ---
await page.locator('.inspector-tab', { hasText: 'Adjust' }).click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: /Color wheels/ }).click()
await page.getByRole('button', { name: /^LUT/ }).click()
await page.waitForTimeout(250)
console.log('COLOR WHEELS', await page.locator('.wheel').count())
const lookSelect = page.locator('.field', { hasText: 'Look' }).locator('select').first()
console.log('LUT OPTIONS', await lookSelect.locator('option').count())
const wheelPad = page.locator('.wheel-pad').first()
if ((await wheelPad.count()) > 0) {
  const box = await wheelPad.boundingBox()
  if (box) await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.35)
  await page.waitForTimeout(200)
}
console.log('WHEEL DOT', await page.locator('.wheel-dot').count())

// --- Keyframes ---
await page.locator('.inspector-tab', { hasText: 'Basic' }).click()
await page.waitForTimeout(200)
await page.locator('.kf-toggle').first().click()
await page.waitForTimeout(300)
console.log('CLIP KEYFRAME DIAMONDS', await page.locator('.clip-keyframe').count())
console.log('KEYFRAME ROWS', await page.locator('.kf-row').count())

// Move the playhead and add a second keyframe with a different scale.
const ruler = await page.locator('.timeline-ruler').boundingBox()
if (ruler) await page.mouse.click(ruler.x + 220, ruler.y + 12)
await page.waitForTimeout(200)
await page.locator('.timeline-clip.kind-video').first().click()
await page.waitForTimeout(200)
const scaleInput = page.locator('.field', { hasText: 'Scale' }).locator('input[type=number]').first()
if ((await scaleInput.count()) > 0) {
  await scaleInput.fill('140')
  await scaleInput.press('Enter')
  await page.waitForTimeout(200)
  await page.locator('.kf-toggle').nth(1).click()
  await page.waitForTimeout(300)
}
console.log('KEYFRAMES AFTER SECOND', await page.locator('.clip-keyframe').count())

// --- Mask ---
await page.locator('.inspector-tab', { hasText: 'Mask' }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Ellipse', exact: true }).click()
await page.waitForTimeout(300)
console.log('MASK OVERLAY', await page.locator('.mask-overlay').count())
console.log('MASK HANDLES', await page.locator('.mask-handle').count())
console.log('MASK TEXT', (await bodyText()).includes('Mask transform'))

// --- Markers ---
await page.locator('.timeline-ruler').click({ position: { x: 120, y: 12 } })
await page.keyboard.press('m')
await page.waitForTimeout(300)
console.log('MARKERS', await page.locator('.timeline-marker').count())

// --- Content-aware transitions ---
const autoButton = page.locator('[aria-label="Auto transitions from frame analysis"]')
console.log('AUTO BUTTON', await autoButton.count())
await autoButton.click()
await page.waitForTimeout(2500)
const toast = await page.locator('.toast').allInnerTexts()
console.log('AUTO TOAST', toast.join(' | '))
console.log('TRANSITION BADGES', await page.locator('.transition-badge').count())

// --- Captions AI panel ---
await page.getByRole('tab', { name: 'Captions', exact: true }).click()
await page.waitForTimeout(250)
const captionsText = (await bodyText()).replace(/\s+/g, ' ')
console.log('CAPTIONS PANEL', captionsText.includes('Auto captions'), captionsText.includes('Local Whisper'))
const providerSelect = page.locator('.library-body .field', { hasText: 'Provider' }).locator('select').first()
await providerSelect.selectOption('groq')
await page.waitForTimeout(200)
console.log('GROQ KEY FIELD', await page.locator('input[aria-label="API key"]').count())
await providerSelect.selectOption('local')
await page.waitForTimeout(200)

// --- Voice tab ---
await page.getByRole('tab', { name: 'Voice', exact: true }).click()
await page.waitForTimeout(400)
const voiceText = (await bodyText()).replace(/\s+/g, ' ')
console.log('VOICE PANEL', voiceText.includes('Text to speech'), voiceText.includes('Piper'))
const voiceSelect = page.locator('.library-body select').first()
const voiceOptions = await voiceSelect.locator('option').allInnerTexts()
console.log('VI VOICES', voiceOptions.filter((option) => option.includes('Vietnamese')).length)
console.log('VOICE SEGMENTS', await page.locator('.caption-row').count())
await page.getByRole('button', { name: 'System', exact: true }).click()
await page.waitForTimeout(300)
const generateButton = page.getByRole('button', { name: /Add voiceover|Narrate timeline/ })
console.log('SYSTEM GENERATE DISABLED', await generateButton.isDisabled())
await page.getByRole('button', { name: 'CapCut · VN' }).click()
await page.waitForTimeout(300)
const capcutOptions = await page.locator('.library-body select').first().locator('option').allInnerTexts()
console.log('CAPCUT VOICES', capcutOptions.length)
console.log('CAPCUT GENERATE ENABLED', await generateButton.isEnabled())
await page.getByRole('button', { name: 'Studio', exact: true }).click()
await page.waitForTimeout(300)
const studioOptions = await page.locator('.library-body select').first().locator('option').allInnerTexts()
console.log('STUDIO VOICES', studioOptions.length)
console.log('STUDIO BASE FIELD', await page.getByLabel('AI Voice Studio base URL').count())
console.log('STUDIO GENERATE ENABLED', await generateButton.isEnabled())
await page.getByRole('button', { name: 'Piper · offline' }).click()
await page.waitForTimeout(300)
console.log('PIPER GENERATE ENABLED', await generateButton.isEnabled())
await page.screenshot({ path: '/tmp/opencode/voice-tab.png' })

// --- Help modal content ---
await page.locator('body').click({ position: { x: 10, y: 10 } })
await page.keyboard.press('?')
await page.waitForTimeout(400)
const helpText = (await page.locator('.modal').innerText()).replace(/\s+/g, ' ')
console.log('HELP KEYFRAMES', helpText.includes('Keyframes'))
console.log('HELP PIPER', helpText.includes('Piper'))
console.log('HELP CAPCUT', helpText.includes('capcut-tts-api'))
console.log('HELP STUDIO', helpText.includes('AI Voice Studio'))
await page.screenshot({ path: '/tmp/opencode/help-advanced.png' })

console.log('ERRORS', errors)
await browser.close()
