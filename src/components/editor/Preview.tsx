import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import {
  Crop,
  Expand,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Scan,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { IconButton } from '../ui'
import { ClipMediaPool, type MediaSyncItem } from '../../lib/media'
import { preloadProjectImages, ensureFonts, getClipRect, renderProject } from '../../lib/render'
import {
  collectMediaNeeds,
  findClip,
  projectDuration,
  sampleKeyframe,
  sourceTimeAt,
} from '../../lib/project'
import type { Asset, Clip, Mask, Project } from '../../lib/types'
import { setPreviewCanvas } from '../../lib/thumbnail'
import { clamp, formatTime } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

const RATES = [0.25, 0.5, 1, 1.5, 2, 3, 4]

function buildSyncItems(
  project: Project,
  assets: Record<string, Asset>,
  time: number,
  masterVolume: number,
  playing: boolean,
): MediaSyncItem[] {
  const items: MediaSyncItem[] = []
  const seen = new Set<string>()

  for (const track of project.tracks) {
    if (track.kind === 'text' || track.kind === 'sticker') continue
    for (const clip of track.clips) {
      if (!('assetId' in clip)) continue
      const asset = assets[clip.assetId]
      if (!asset || asset.type === 'image') continue
      if (time < clip.start || time >= clip.start + clip.duration) continue
      const keyedVolume = sampleKeyframe(clip, 'volume', time - clip.start)
      const baseVolume = keyedVolume ?? clip.volume
      const volume = clip.muted || track.muted ? 0 : clamp(baseVolume * masterVolume, 0, 1)
      items.push({
        clipId: clip.id,
        asset,
        sourceTime: sourceTimeAt(clip, time),
        volume,
        muted: volume <= 0.001,
        speed: clip.speed,
        playing,
      })
      seen.add(clip.id)
    }
  }

  // Frames needed for transitions (the outgoing clip) must also be decoded.
  for (const need of collectMediaNeeds(project, time)) {
    if (seen.has(need.clipId)) continue
    const asset = assets[need.assetId]
    if (!asset || asset.type !== 'video') continue
    items.push({
      clipId: need.clipId,
      asset,
      sourceTime: need.time,
      volume: 0,
      muted: true,
      speed: 1,
      playing: false,
    })
  }

  return items
}

interface GestureState {
  mode: 'move' | 'scale' | 'rotate'
  clipId: string
  startX: number
  startY: number
  startTransform: { x: number; y: number; scale: number; rotation: number }
  keyed: { x: boolean; y: boolean; scale: boolean; rotation: boolean }
  local: number
  centerX: number
  centerY: number
  startDistance: number
  startAngle: number
}

interface MaskGesture {
  mode: 'move' | 'resize'
  signX: number
  signY: number
  startX: number
  startY: number
  startMask: { x: number; y: number; width: number; height: number }
}

function MaskOverlay({
  clip,
  project,
  mask,
  shellRef,
  scale,
  playhead,
}: {
  clip: Clip
  project: Project
  mask: Mask
  shellRef: RefObject<HTMLDivElement | null>
  scale: number
  playhead: number
}) {
  const updateClip = useEditor((state) => state.updateClip)
  const endGesture = useEditor((state) => state.endGesture)
  const gestureRef = useRef<MaskGesture | null>(null)
  const local = clamp(playhead - clip.start, 0, clip.duration)
  const resolved: Mask = { ...mask }
  const kx = sampleKeyframe(clip, 'maskX', local)
  const ky = sampleKeyframe(clip, 'maskY', local)
  const ks = sampleKeyframe(clip, 'maskScale', local)
  const kr = sampleKeyframe(clip, 'maskRotation', local)
  if (kx !== null) resolved.x = kx
  if (ky !== null) resolved.y = ky
  if (ks !== null) {
    resolved.width *= ks
    resolved.height *= ks
  }
  if (kr !== null) resolved.rotation = kr

  const w = Math.max(2, resolved.width * project.width)
  const h = Math.max(2, resolved.height * project.height)
  const cx = project.width / 2 + resolved.x * project.width
  const cy = project.height / 2 + resolved.y * project.height

  const patchMask = (
    updater: (target: Mask) => void,
    key: string,
    merge = true,
  ) => {
    updateClip(
      clip.id,
      (target) => {
        if (target.mask) updater(target.mask)
      },
      merge ? `mask-gesture:${clip.id}:${key}` : undefined,
    )
  }

  const begin = (
    mode: MaskGesture['mode'],
    signX: number,
    signY: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      mode,
      signX,
      signY,
      startX: event.clientX,
      startY: event.clientY,
      startMask: {
        x: resolved.x,
        y: resolved.y,
        width: resolved.width,
        height: resolved.height,
      },
    }
  }

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const dx = ((event.clientX - gesture.startX) * scale) / project.width
    const dy = ((event.clientY - gesture.startY) * scale) / project.height
    if (gesture.mode === 'move') {
      patchMask((target) => {
        target.x = clamp(gesture.startMask.x + dx, -1.5, 1.5)
        target.y = clamp(gesture.startMask.y + dy, -1.5, 1.5)
      }, 'move')
    } else {
      patchMask((target) => {
        target.width = clamp(gesture.startMask.width + dx * gesture.signX, 0.05, 1.5)
        target.height = clamp(gesture.startMask.height + dy * gesture.signY, 0.05, 1.5)
      }, 'resize')
    }
  }

  const finish = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gestureRef.current) return
    gestureRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture may already be released.
    }
    endGesture()
  }

  const addPenPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * project.width
    const py = ((event.clientY - rect.top) / rect.height) * project.height
    const angle = (-resolved.rotation * Math.PI) / 180
    const dx = px - cx
    const dy = py - cy
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle)
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle)
    const nx = clamp(rx / w + 0.5, 0, 1)
    const ny = clamp(ry / h + 0.5, 0, 1)
    patchMask((target) => {
      target.points.push({ x: nx, y: ny })
    }, 'pen', false)
  }

  const penPoints = resolved.points
    .map((point) => `${(point.x - 0.5) * w},${(point.y - 0.5) * h}`)
    .join(' ')

  const starPoints = (() => {
    const outer = Math.min(w, h) / 2
    const inner = outer * 0.45
    const min = Math.min(w, h)
    return Array.from({ length: 10 }, (_, index) => {
      const radius = index % 2 === 0 ? outer : inner
      const angle = (Math.PI / 5) * index - Math.PI / 2
      return `${Math.cos(angle) * radius * (w / min)},${Math.sin(angle) * radius * (h / min)}`
    }).join(' ')
  })()

  return (
    <>
      <svg
        className="mask-svg"
        viewBox={`0 0 ${project.width} ${project.height}`}
        preserveAspectRatio="none"
        onPointerDown={resolved.shape === 'pen' ? addPenPoint : undefined}
        style={{ pointerEvents: resolved.shape === 'pen' ? 'auto' : 'none' }}
      >
        <g transform={`translate(${cx} ${cy}) rotate(${resolved.rotation})`}>
          {resolved.shape === 'ellipse' ? (
            <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} />
          ) : resolved.shape === 'triangle' ? (
            <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} />
          ) : resolved.shape === 'diamond' ? (
            <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} />
          ) : resolved.shape === 'star' ? (
            <polygon points={starPoints} />
          ) : resolved.shape === 'heart' ? (
            <path
              d={`M 0 ${h / 2} C ${-w * 0.62} ${h * 0.02} ${-w * 0.5} ${-h / 2} 0 ${-h / 2 + h * 0.18} C ${w * 0.5} ${-h / 2} ${w * 0.62} ${h * 0.02} 0 ${h / 2} Z`}
            />
          ) : resolved.shape === 'line' ? (
            <rect x={-w / 2} y={-h * 0.06} width={w} height={Math.max(2, h * 0.12)} />
          ) : resolved.shape === 'pen' ? (
            <polygon points={penPoints} />
          ) : (
            <rect x={-w / 2} y={-h / 2} width={w} height={h} />
          )}
        </g>
      </svg>

      <div
        className="mask-overlay"
        style={{
          left: `${((cx - w / 2) / project.width) * 100}%`,
          top: `${((cy - h / 2) / project.height) * 100}%`,
          width: `${(w / project.width) * 100}%`,
          height: `${(h / project.height) * 100}%`,
          transform: `rotate(${resolved.rotation}deg)`,
        }}
        onPointerDown={(event) => begin('move', 0, 0, event)}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        role="presentation"
      >
        <span className="mask-handle nw" onPointerDown={(event) => begin('resize', -1, -1, event)} />
        <span className="mask-handle ne" onPointerDown={(event) => begin('resize', 1, -1, event)} />
        <span className="mask-handle sw" onPointerDown={(event) => begin('resize', -1, 1, event)} />
        <span className="mask-handle se" onPointerDown={(event) => begin('resize', 1, 1, event)} />
      </div>
    </>
  )
}

export function Preview() {
  const project = useEditor((state) => state.project)
  const playhead = useEditor((state) => state.playhead)
  const playing = useEditor((state) => state.playing)
  const playbackRate = useEditor((state) => state.playbackRate)
  const masterVolume = useEditor((state) => state.masterVolume)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const assets = useEditor((state) => state.assets)
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const togglePlay = useEditor((state) => state.togglePlay)
  const setPlaybackRate = useEditor((state) => state.setPlaybackRate)
  const setMasterVolume = useEditor((state) => state.setMasterVolume)
  const updateClip = useEditor((state) => state.updateClip)
  const endGesture = useEditor((state) => state.endGesture)
  const quality = useUI((state) => state.previewQuality)
  const setQuality = useUI((state) => state.setPreviewQuality)
  const showSafeArea = useUI((state) => state.showSafeArea)
  const setShowSafeArea = useUI((state) => state.setShowSafeArea)
  const maskEditing = useUI((state) => state.maskEditing)

  const stageRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poolRef = useRef<ClipMediaPool | null>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const clockRef = useRef({ time: 0, last: 0, lastStore: 0 })
  const [box, setBox] = useState({ width: 640, height: 360 })
  const [loop, setLoop] = useState(false)

  const duration = project ? projectDuration(project) : 0
  const scale = project ? project.width / Math.max(1, box.width) : 1

  /* ------------------------------------------------------------------ */
  /* Sizing                                                              */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !project) return
    const measure = () => {
      const availableW = Math.max(80, stage.clientWidth - 48)
      const availableH = Math.max(60, stage.clientHeight - 10)
      const ratio = project.width / project.height
      let width = availableW
      let height = width / ratio
      if (height > availableH) {
        height = availableH
        width = height * ratio
      }
      setBox({ width: Math.max(40, Math.floor(width)), height: Math.max(24, Math.floor(height)) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [project])

  /* ------------------------------------------------------------------ */
  /* Canvas resolution + font/media preload                              */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !project) return
    const cap = quality === 'full' ? 1280 : 720
    const renderScale = Math.min(1, cap / project.width)
    const width = Math.max(2, Math.round(project.width * renderScale))
    const height = Math.max(2, Math.round(project.height * renderScale))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }, [project, quality])

  useEffect(() => {
    setPreviewCanvas(canvasRef.current)
    return () => setPreviewCanvas(null)
  }, [])

  useEffect(() => {
    void ensureFonts()
  }, [])

  useEffect(() => {
    if (project) void preloadProjectImages(project)
  }, [project])

  /* ------------------------------------------------------------------ */
  /* Realtime media pool                                                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const pool = new ClipMediaPool()
    poolRef.current = pool
    return () => {
      pool.destroy()
      poolRef.current = null
    }
  }, [])

  /* ------------------------------------------------------------------ */
  /* Render loop                                                         */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let raf = 0
    let paintedAt = 0
    const tick = (now: number) => {
      const state = useEditor.getState()
      const current = state.project
      const canvas = canvasRef.current
      const pool = poolRef.current
      if (current && canvas && pool) {
        const clock = clockRef.current
        if (state.playing) {
          const dt = Math.min(0.25, Math.max(0, (now - clock.last) / 1000))
          clock.time += dt * state.playbackRate
          const total = projectDuration(current)
          if (clock.time >= total) {
            if (loop) {
              clock.time = 0
              state.setPlayhead(0)
            } else {
              clock.time = total
              state.pause()
              state.setPlayhead(total)
            }
          }
          if (now - paintedAt > 33) {
            state.setPlayhead(Math.min(clock.time, total))
            paintedAt = now
          }
        } else if (Math.abs(clock.time - state.playhead) > 0.0005) {
          clock.time = state.playhead
        }
        clock.last = now

        const time = state.playing ? clock.time : state.playhead
        const items = buildSyncItems(current, state.assets, time, state.masterVolume, state.playing)
        pool.sync(items, state.playing)

        renderProject(canvas, current, time, {
          assets: state.assets,
          getVideoFrame: (clipId) => pool.getFrame(clipId),
        })
        clock.lastStore = state.playhead
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loop])

  /* Keep the local clock in sync with programmatic seeks. */
  useEffect(() => {
    const clock = clockRef.current
    if (Math.abs(playhead - clock.lastStore) > 0.0005) {
      if (Math.abs(playhead - clock.time) > 0.04) clock.time = playhead
      clock.lastStore = playhead
      clock.last = performance.now()
    }
  }, [playhead])

  /* ------------------------------------------------------------------ */
  /* Selection geometry                                                  */
  /* ------------------------------------------------------------------ */

  const selected = useMemo(() => {
    if (!project || !selectedClipId) return null
    const found = findClip(project, selectedClipId)
    if (!found) return null
    const asset = 'assetId' in found.clip ? assets[found.clip.assetId] : undefined
    return { clip: found.clip, track: found.track, rect: getClipRect(found.clip, project, asset) }
  }, [project, assets, selectedClipId])

  const selectionStyle = useMemo(() => {
    if (!selected || !project) return null
    const { rect } = selected
    return {
      left: `${((rect.x - rect.width / 2) / project.width) * 100}%`,
      top: `${((rect.y - rect.height / 2) / project.height) * 100}%`,
      width: `${(rect.width / project.width) * 100}%`,
      height: `${(rect.height / project.height) * 100}%`,
      transform: `rotate(${rect.rotation}deg)`,
    }
  }, [selected, project])

  /* ------------------------------------------------------------------ */
  /* Pointer gestures                                                    */
  /* ------------------------------------------------------------------ */

  const canvasCenterScreen = useCallback(() => {
    const shell = shellRef.current
    if (!shell || !project || !selected) return { x: 0, y: 0 }
    const rect = shell.getBoundingClientRect()
    return {
      x: rect.left + (selected.rect.x / project.width) * rect.width,
      y: rect.top + (selected.rect.y / project.height) * rect.height,
    }
  }, [project, selected])

  const beginGesture = (
    mode: GestureState['mode'],
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!selected) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const center = canvasCenterScreen()
    const local = clamp(playhead - selected.clip.start, 0, selected.clip.duration)
    const keyedX = sampleKeyframe(selected.clip, 'x', local)
    const keyedY = sampleKeyframe(selected.clip, 'y', local)
    const keyedScale = sampleKeyframe(selected.clip, 'scale', local)
    const keyedRotation = sampleKeyframe(selected.clip, 'rotation', local)
    gestureRef.current = {
      mode,
      clipId: selected.clip.id,
      startX: event.clientX,
      startY: event.clientY,
      startTransform: {
        x: keyedX ?? selected.clip.transform.x,
        y: keyedY ?? selected.clip.transform.y,
        scale: keyedScale ?? selected.clip.transform.scale,
        rotation: keyedRotation ?? selected.clip.transform.rotation,
      },
      keyed: {
        x: keyedX !== null,
        y: keyedY !== null,
        scale: keyedScale !== null,
        rotation: keyedRotation !== null,
      },
      local,
      centerX: center.x,
      centerY: center.y,
      startDistance: Math.max(
        8,
        Math.hypot(event.clientX - center.x, event.clientY - center.y),
      ),
      startAngle: Math.atan2(event.clientY - center.y, event.clientX - center.x),
    }
  }

  const commitTransform = (
    gesture: GestureState,
    property: 'x' | 'y' | 'scale' | 'rotation',
    value: number,
  ) => {
    const rounded = Math.round(value * 1000) / 1000
    if (gesture.keyed[property]) {
      useEditor
        .getState()
        .setKeyframe(gesture.clipId, property, gesture.local, rounded, 'linear')
      return
    }
    updateClip(
      gesture.clipId,
      (clip) => {
        if (property === 'x') clip.transform.x = Math.round(rounded * 10) / 10
        else if (property === 'y') clip.transform.y = Math.round(rounded * 10) / 10
        else if (property === 'scale') clip.transform.scale = rounded
        else clip.transform.rotation = Math.round(rounded * 10) / 10
      },
      `transform:${gesture.clipId}:${property}`,
    )
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current
    if (!gesture || !project) return
    const { mode, startTransform } = gesture
    if (mode === 'move') {
      const dx = (event.clientX - gesture.startX) * scale
      const dy = (event.clientY - gesture.startY) * scale
      commitTransform(gesture, 'x', startTransform.x + dx)
      commitTransform(gesture, 'y', startTransform.y + dy)
    } else if (mode === 'scale') {
      const distance = Math.max(
        8,
        Math.hypot(event.clientX - gesture.centerX, event.clientY - gesture.centerY),
      )
      const factor = distance / gesture.startDistance
      commitTransform(gesture, 'scale', clamp(startTransform.scale * factor, 0.04, 12))
    } else {
      const angle = Math.atan2(
        event.clientY - gesture.centerY,
        event.clientX - gesture.centerX,
      )
      let rotation =
        startTransform.rotation + ((angle - gesture.startAngle) * 180) / Math.PI
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15
      commitTransform(gesture, 'rotation', rotation)
    }
  }

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gestureRef.current) return
    gestureRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture may already be released.
    }
    endGesture()
  }

  /* ------------------------------------------------------------------ */
  /* Transport + fullscreen                                              */
  /* ------------------------------------------------------------------ */

  const step = (direction: 1 | -1) => {
    const fps = project?.fps ?? 30
    useEditor.getState().pause()
    setPlayhead(playhead + direction / fps)
  }

  const toggleFullscreen = async () => {
    const shell = shellRef.current
    if (!shell) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shell.requestFullscreen()
    } catch {
      useUI.getState().toast('Fullscreen is not available in this browser.', 'error')
    }
  }

  if (!project) {
    return (
      <section className="preview-panel">
        <div className="preview-empty">
          <div className="big">
            <Crop size={26} />
          </div>
          <h3>No project open</h3>
          <p>Open a project to start editing.</p>
        </div>
      </section>
    )
  }

  const currentClip = selected?.clip
  const isText = currentClip?.kind === 'text'
  const isSticker = currentClip?.kind === 'sticker'

  return (
    <section className="preview-panel">
      <div className="preview-topline">
        <div className="group">
          <span className="badge">
            <Zap size={10} /> {project.width} × {project.height}
          </span>
          <span className="preview-quality">{playing ? 'Playing' : 'Paused'}</span>
          <span className="preview-quality">{project.fps} fps</span>
        </div>
        <div className="group">
          <button
            className="preview-quality"
            type="button"
            data-active={showSafeArea}
            onClick={() => setShowSafeArea(!showSafeArea)}
            title="Toggle title-safe guides"
          >
            <Scan size={11} /> Safe area
          </button>
          <span className="preview-quality">
            <Crop size={10} /> {quality === 'full' ? 'Full quality' : 'Half quality'}
          </span>
          <IconButton
            label={quality === 'full' ? 'Use half preview quality' : 'Use full preview quality'}
            onClick={() => setQuality(quality === 'full' ? 'half' : 'full')}
          >
            <Zap size={13} />
          </IconButton>
          <IconButton label="Fullscreen" onClick={() => void toggleFullscreen()}>
            <Maximize2 size={13} />
          </IconButton>
        </div>
      </div>

      <div className="preview-stage" ref={stageRef}>
        <div
          className="canvas-shell"
          ref={shellRef}
          style={{ width: box.width, height: box.height }}
        >
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            style={{ width: '100%', height: '100%' }}
          />
          {showSafeArea && <div className="safe-area" />}
          <div className="canvas-badge">
            {formatTime(playhead, true, project.fps)}
          </div>

          {selected && selectionStyle && (
            <div className="selection-layer">
              <div
                className={`selection-box ${isText ? 'is-text' : ''} ${isSticker ? 'is-sticker' : ''}`}
                style={selectionStyle}
                onPointerDown={(event) => beginGesture('move', event)}
                onPointerMove={handlePointerMove}
                onPointerUp={finishGesture}
                onPointerCancel={finishGesture}
                role="presentation"
              >
                <span
                  className="selection-handle nw"
                  onPointerDown={(event) => beginGesture('scale', event)}
                />
                <span
                  className="selection-handle ne"
                  onPointerDown={(event) => beginGesture('scale', event)}
                />
                <span
                  className="selection-handle sw"
                  onPointerDown={(event) => beginGesture('scale', event)}
                />
                <span
                  className="selection-handle se"
                  onPointerDown={(event) => beginGesture('scale', event)}
                />
                <span className="selection-line" />
                <span
                  className="selection-handle rotate"
                  onPointerDown={(event) => beginGesture('rotate', event)}
                />
              </div>
            </div>
          )}

          {maskEditing && selected?.clip.mask && (
            <MaskOverlay
              clip={selected.clip}
              project={project}
              mask={selected.clip.mask}
              shellRef={shellRef}
              scale={scale}
              playhead={playhead}
            />
          )}
        </div>
      </div>

      <div className="transport">
        <div className="transport-group">
          <IconButton label="Jump to start (Home)" onClick={() => setPlayhead(0)}>
            <SkipBack size={14} />
          </IconButton>
          <IconButton label="Previous frame" onClick={() => step(-1)}>
            <StepBack size={14} />
          </IconButton>
          <button
            type="button"
            className="play-btn"
            onClick={togglePlay}
            aria-label={playing ? 'Pause (Space)' : 'Play (Space)'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <IconButton label="Next frame" onClick={() => step(1)}>
            <StepForward size={14} />
          </IconButton>
          <IconButton label="Jump to end (End)" onClick={() => setPlayhead(duration)}>
            <SkipForward size={14} />
          </IconButton>
        </div>

        <div className="timecode">
          {formatTime(playhead, true, project.fps)}
          <span>/ {formatTime(duration, true, project.fps)}</span>
        </div>

        <div className="transport-right">
          <IconButton
            label={loop ? 'Loop is on' : 'Loop playback'}
            active={loop}
            onClick={() => setLoop((value) => !value)}
          >
            <Repeat size={13} />
          </IconButton>
          <select
            className="select rate-select"
            value={playbackRate}
            aria-label="Playback speed"
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
          >
            {RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
          <div className="volume-control">
            <IconButton
              label={masterVolume === 0 ? 'Unmute' : 'Mute preview'}
              onClick={() => setMasterVolume(masterVolume === 0 ? 1 : 0)}
            >
              {masterVolume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </IconButton>
            <input
              className="range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              aria-label="Preview volume"
              onChange={(event) => setMasterVolume(Number(event.target.value))}
            />
          </div>
          <IconButton label="Toggle safe area" active={showSafeArea} onClick={() => setShowSafeArea(!showSafeArea)}>
            <Expand size={13} />
          </IconButton>
        </div>
      </div>
    </section>
  )
}
