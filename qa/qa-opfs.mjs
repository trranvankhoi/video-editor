import { chromium } from 'playwright'

const context = await chromium.launchPersistentContext('/tmp/opencode/tts-profile', {
  viewport: { width: 1200, height: 800 },
})
const page = await context.newPage()
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

const info = await page.evaluate(async () => {
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('piper')
  const out = []
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const head = Array.from(bytes.slice(0, 32))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
    const asText = new TextDecoder().decode(bytes.slice(0, 200))
    out.push({ name, size: file.size, type: file.type, head, asText })
  }
  return out
})
console.log(JSON.stringify(info, null, 2))
await context.close()
