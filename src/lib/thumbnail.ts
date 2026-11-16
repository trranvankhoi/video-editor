let previewCanvas: HTMLCanvasElement | null = null

/** Register the live preview canvas so autosave can snapshot the current frame. */
export function setPreviewCanvas(canvas: HTMLCanvasElement | null) {
  previewCanvas = canvas
}

export function getPreviewCanvas(): HTMLCanvasElement | null {
  return previewCanvas
}

/**
 * Capture a JPEG data URL of the current preview. Returns undefined when the
 * preview is not mounted or the canvas has no pixels yet.
 */
export function capturePreviewThumbnail(maxWidth = 640): string | undefined {
  const canvas = previewCanvas
  if (!canvas || canvas.width < 2 || canvas.height < 2) return undefined
  try {
    const scale = Math.min(1, maxWidth / canvas.width)
    const target = document.createElement('canvas')
    target.width = Math.max(2, Math.round(canvas.width * scale))
    target.height = Math.max(2, Math.round(canvas.height * scale))
    const ctx = target.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, target.width, target.height)
    return target.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  }
}

export function captureCanvasThumbnail(
  canvas: HTMLCanvasElement,
  maxWidth = 640,
): string | undefined {
  if (canvas.width < 2 || canvas.height < 2) return undefined
  try {
    const scale = Math.min(1, maxWidth / canvas.width)
    const target = document.createElement('canvas')
    target.width = Math.max(2, Math.round(canvas.width * scale))
    target.height = Math.max(2, Math.round(canvas.height * scale))
    const ctx = target.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, target.width, target.height)
    return target.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  }
}
