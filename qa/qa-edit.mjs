import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))

const countClips = () => page.locator('.timeline-clip').count()
const bodyText = () => page.locator('.library-body').innerText()

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'New project' }).first().click()
await page.locator('#project-name').fill('QA Project')
await page.getByRole('button', { name: /Create project/ }).click()
await page.waitForSelector('.editor', { timeout: 10000 })
console.log('NEW PROJECT', await page.locator('.project-title-input').inputValue())

// Import 3 assets
await page.locator('input[type=file]').setInputFiles([
  '/tmp/opencode/test.png',
  '/tmp/opencode/test.webm',
  '/tmp/opencode/test.wav',
])
await page.waitForFunction(() => !document.querySelector('.import-card'), null, { timeout: 30000 })
await page.waitForTimeout(800)
console.log('CLIPS AFTER IMPORT', await countClips())
console.log('MEDIA CARDS', await page.locator('.media-card').count())
console.log('BODY', (await bodyText()).slice(0, 500))
await page.screenshot({ path: '/tmp/opencode/imported.png' })

// Seek to 1.5s via ruler
const ruler = await page.locator('.timeline-ruler').boundingBox()
await page.mouse.click(ruler.x + 90, ruler.y + 12)
await page.waitForTimeout(300)
console.log('TIMECODE', await page.locator('.timecode').innerText())

// Select a video/image clip and split
const clip = page.locator('.timeline-clip.kind-video, .timeline-clip.kind-image').first()
await clip.click()
const beforeSplit = await countClips()
await page.keyboard.press('Control+b')
await page.waitForTimeout(400)
const afterSplit = await countClips()
console.log('SPLIT', { beforeSplit, afterSplit })
await page.keyboard.press('Control+z')
await page.waitForTimeout(300)
console.log('UNDO', await countClips())
await page.keyboard.press('Control+Shift+z')
await page.waitForTimeout(300)
console.log('REDO', await countClips())

// Text via shortcut
const beforeText = await countClips()
await page.keyboard.press('t')
await page.waitForTimeout(300)
console.log('TEXT ADD', { beforeText, after: await countClips() })

// Library tabs
const tabs = ['Media', 'Audio', 'Text', 'Stickers', 'Effects', 'Transitions', 'Filters', 'Captions', 'Templates']
for (const tab of tabs) {
  await page.getByRole('tab', { name: tab, exact: true }).click()
  await page.waitForTimeout(150)
  const text = (await bodyText()).replace(/\s+/g, ' ').trim()
  console.log('TAB', tab, text.slice(0, 140))
}

// Add a sticker
await page.getByRole('tab', { name: 'Stickers', exact: true }).click()
const beforeSticker = await countClips()
await page.locator('.sticker-card').first().click()
await page.waitForTimeout(300)
console.log('STICKER ADD', { beforeSticker, after: await countClips() })

// Inspector tabs on selected sticker
for (const tab of ['Basic', 'Animation', 'Adjust', 'Effects']) {
  const button = page.locator('.inspector-tab', { hasText: tab })
  if ((await button.count()) > 0) {
    await button.first().click()
    await page.waitForTimeout(120)
    console.log(
      'INSPECTOR TAB',
      tab,
      (await page.locator('.inspector-body').innerText()).slice(0, 120).replace(/\s+/g, ' '),
    )
  }
}

// Open help and shortcuts
await page.keyboard.press('?')
await page.waitForTimeout(400)
console.log('HELP OPEN', await page.locator('.modal-head h2').innerText())
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
await page.locator('.topbar-right .btn-icon[title="Keyboard shortcuts"]').click()
await page.waitForTimeout(300)
console.log('SHORTCUTS OPEN', await page.locator('.modal-head h2').innerText(), 'rows', await page.locator('.help-row').count())
await page.keyboard.press('Escape')

console.log('ERRORS', JSON.stringify(errors, null, 2))
await browser.close()
