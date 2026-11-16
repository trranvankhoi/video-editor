import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`PAGEERROR ${err.message}`))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/opencode/home.png', fullPage: true })
console.log('TITLE', await page.title())
console.log('ERRORS', JSON.stringify(errors, null, 2))
console.log('BODY', (await page.locator('body').innerText()).slice(0, 3000))
await browser.close()
