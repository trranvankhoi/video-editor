import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()))
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
const buttons = await page.getByRole('button').allInnerTexts()
console.log('BUTTONS', JSON.stringify(buttons))
await page.getByRole('button', { name: /Open sample/i }).first().click()
await page.waitForSelector('.editor', { timeout: 10000 })
await page.waitForTimeout(2500)
console.log(
  'MODALS',
  JSON.stringify(
    await page.evaluate(() =>
      [...document.querySelectorAll('.modal-backdrop')].map((el) => ({
        html: el.outerHTML.slice(0, 800),
        display: getComputedStyle(el).display,
      })),
    ),
    null,
    2,
  ),
)
console.log('DIALOGS', await page.getByRole('dialog').count())
console.log('EDITOR', await page.locator('.editor').count())
console.log('SAVE', await page.locator('.save-state').innerText())
console.log('ERRORS?')
await browser.close()
