import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const b64 = readFileSync('/tmp/opencode/export-result.webm').toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage()
const info = await page.evaluate(async (b64) => {
  const video = document.createElement('video')
  video.src = 'data:video/webm;base64,' + b64
  video.muted = true
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = () => reject(new Error('metadata failed'))
  })
  // Seek to 1s and confirm a frame decodes.
  await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = 1 })
  return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, readyState: video.readyState }
}, b64)
console.log(info)
await browser.close()
