import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const targets = [
  { src: 'public/icons/icon-source.svg', out: 'public/icons/icon-512.png', size: 512, maskable: false },
  { src: 'public/icons/icon-source.svg', out: 'public/icons/icon-192.png', size: 192, maskable: false },
  { src: 'public/icons/icon-maskable-source.svg', out: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const target of targets) {
  const svg = readFileSync(resolve(root, target.src), 'utf8')
  const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  await page.setViewportSize({ width: target.size, height: target.size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${target.size}px;height:${target.size}px}</style><img src="${data}">`,
  )
  await page.waitForTimeout(80)
  await page.screenshot({
    path: resolve(root, target.out),
    omitBackground: true,
    clip: { x: 0, y: 0, width: target.size, height: target.size },
  })
  console.log('wrote', target.out)
}
await browser.close()
