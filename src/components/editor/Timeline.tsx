import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlignHorizontalDistributeCenter,
  ArrowLeftRight,
  Combine,
  Copy,
  Diamond,
  Eye,
  EyeOff,
  Film,
  Flag,
  Layers,
  ListX,
  Loader2,
  Lock,
  Magnet,
  Music,
  Plus,
  Redo2,
  Scissors,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { IconButton } from '../ui'
import { Waveform } from '../Waveform'
import { ASSET_DRAG_TYPE } from '../library/common'
import {
  KEYFRAME_PROPERTIES,
  findClip,
  projectDuration,
  snapPoints,
  snapTime,
} from '../../lib/project'
import type { Asset, Clip, Marker, Track, TrackKind } from '../../lib/types'
import { clamp, formatTime } from '../../lib/utils'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'

const HEADER_WIDTH = 156
const MIN_LANE = 720

const TRACK_ICONS: Record<TrackKind, typeof Film> = {
  main: Film,
  overlay: Layers,
  text: Type,
  sticker: Sticker,
  audio: Music,
}

const CLIP_ICONS: Record<Clip['kind'], typeof Film> = {
  video: Film,
  image: Film,
  audio: Music,
  text: Type,
  sticker: Sticker,
}

interface ContextState {
  x: number
  y: number
  clipId: string
}

interface DragState {
  clipId: string
  mode: 'move' | 'start' | 'end'
  startX: number
  startY: number
  originalStart: number
  originalEnd: number
  originTrackId: string
}

export function Timeline() {
  const project = useEditor((state) => state.project)
  const playhead = useEditor((state) => state.playhead)
  const playing = useEditor((state) => state.playing)
  const zoom = useEditor((state) => state.zoom)
  const snap = useEditor((state) => state.snap)
  const selectedClipId = useEditor((state) => state.selectedClipId)
  const assets = useEditor((state) => state.assets)
  const setZoom = useEditor((state) => state.setZoom)
  const setSnap = useEditor((state) => state.setSnap)
  const setPlayhead = useEditor((state) => state.setPlayhead)
  const selectClip = useEditor((state) => state.selectClip)
  const moveClip = useEditor((state) => state.moveClip)
  const trimClip = useEditor((state) => state.trimClip)
  const splitAtPlayhead = useEditor((state) => state.splitAtPlayhead)
  const removeSelected = useEditor((state) => state.removeSelected)
  const duplicateClip = useEditor((state) => state.duplicateClip)
  const copySelected = useEditor((state) => state.copySelected)
  const pasteClip = useEditor((state) => state.pasteClip)
  const detachAudio = useEditor((state) => state.detachAudio)
  const rippleDelete = useEditor((state) => state.rippleDelete)
  const closeGaps = useEditor((state) => state.closeGaps)
  const mergeWithNext = useEditor((state) => state.mergeWithNext)
  const autoTransitions = useEditor((state) => state.autoTransitions)
  const addMarker = useEditor((state) => state.addMarker)
  const removeMarker = useEditor((state) => state.removeMarker)
  const updateMarker = useEditor((state) => state.updateMarker)
  const endGesture = useEditor((state) => state.endGesture)
  const updateTrack = useEditor((state) => state.updateTrack)
  const removeTrack = useEditor((state) => state.removeTrack)
  const addTrack = useEditor((state) => state.addTrack)
  const addMediaAsset = useEditor((state) => state.addMediaAsset)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)
  const follow = useUI((state) => state.timelineFollow)
  const setFollow = useUI((state) => state.setTimelineFollow)
  const toast = useUI((state) => state.toast)

  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [viewport, setViewport] = useState(900)
  const [context, setContext] = useState<ContextState | null>(null)
  const [dropTrackId, setDropTrackId] = useState<string | null>(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [height, setHeight] = useState(() =>
    Math.round(Math.min(window.innerHeight * 0.36, 380)),
  )
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const markerDragRef = useRef<{ id: string; startX: number; startTime: number } | null>(null)

  const pixelsPerSecond = 60 * zoom
  const duration = project ? projectDuration(project) : 0
  const timelineEnd = Math.max(20, duration + 8)
  const laneWidth = Math.max(MIN_LANE, viewport - HEADER_WIDTH, Math.ceil(timelineEnd * pixelsPerSecond))
  const contentWidth = HEADER_WIDTH + laneWidth
  const tickInterval = useMemo(() => {
    const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
    return candidates.find((value) => value * pixelsPerSecond >= 54) ?? 300
  }, [pixelsPerSecond])
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let time = 0; time <= timelineEnd; time += tickInterval) out.push(time)
    return out
  }, [timelineEnd, tickInterval])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewport(el.clientWidth))
    observer.observe(el)
    setViewport(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!follow || !scrollRef.current) return
    const el = scrollRef.current
    const x = HEADER_WIDTH + playhead * pixelsPerSecond
    const left = el.scrollLeft + HEADER_WIDTH
    const right = el.scrollLeft + el.clientWidth
    if (x > right - 60) el.scrollLeft = x - el.clientWidth + 140
    else if (x < left) el.scrollLeft = Math.max(0, x - HEADER_WIDTH)
  }, [playhead, follow, pixelsPerSecond])

  useEffect(() => {
    if (!context) return
    const close = () => setContext(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContext(null)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [context])

  if (!project) return null

  const timeFromClientX = (clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect()
    return clamp((clientX - rect.left) / pixelsPerSecond, 0, timelineEnd)
  }

  const snappedTime = (time: number, excludeClipId?: string): number => {
    if (!snap || !project) return time
    const points = snapPoints(project, playhead, excludeClipId)
    return snapTime(time, points, 8 / pixelsPerSecond).time
  }

  const seekFromEvent = (event: ReactPointerEvent<HTMLElement>) => {
    useEditor.getState().pause()
    setPlayhead(snappedTime(timeFromClientX(event.clientX, event.currentTarget)))
  }

  const startSeek = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    selectClip(null)
    seekFromEvent(event)
  }

  const beginClipDrag = (event: ReactPointerEvent<HTMLDivElement>, clip: Clip) => {
    if (event.button !== 0) return
    event.stopPropagation()
    selectClip(clip.id)
    useEditor.getState().pause()
    const found = findClip(project, clip.id)
    if (!found || found.track.locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      clipId: clip.id,
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      originalStart: clip.start,
      originalEnd: clip.start + clip.duration,
      originTrackId: found.track.id,
    }
  }

  const beginTrim = (
    event: ReactPointerEvent<HTMLSpanElement>,
    clip: Clip,
    edge: 'start' | 'end',
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    selectClip(clip.id)
    useEditor.getState().pause()
    event.currentTarget.setPointerCapture(event.pointerId)
    const found = findClip(project, clip.id)
    if (!found || found.track.locked) return
    dragRef.current = {
      clipId: clip.id,
      mode: edge,
      startX: event.clientX,
      startY: event.clientY,
      originalStart: clip.start,
      originalEnd: clip.start + clip.duration,
      originTrackId: found.track.id,
    }
  }

  const handleClipMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / pixelsPerSecond
    if (drag.mode === 'move') {
      const targetTime = snappedTime(drag.originalStart + dx, drag.clipId)
      const target = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((element) => element instanceof HTMLElement && element.dataset.trackId)
      const targetTrackId =
        target instanceof HTMLElement && target.dataset.trackId
          ? target.dataset.trackId
          : drag.originTrackId
      moveClip(drag.clipId, targetTrackId, targetTime, `move:${drag.clipId}`)
    } else if (drag.mode === 'start') {
      trimClip(
        drag.clipId,
        'start',
        snappedTime(drag.originalStart + dx, drag.clipId),
        `trim:${drag.clipId}:start`,
      )
    } else {
      trimClip(
        drag.clipId,
        'end',
        snappedTime(drag.originalEnd + dx, drag.clipId),
        `trim:${drag.clipId}:end`,
      )
    }
  }

  const finishClipDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDropTrackId(null)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released.
    }
    endGesture()
  }

  const openContext = (event: React.MouseEvent, clipId: string) => {
    event.preventDefault()
    event.stopPropagation()
    selectClip(clipId)
    setContext({ x: event.clientX, y: event.clientY, clipId })
  }

  const onDrop = (event: DragEvent<HTMLDivElement>, track: Track) => {
    event.preventDefault()
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE)
    setDropTrackId(null)
    if (!assetId) return
    const time = Math.max(0, (event.clientX - event.currentTarget.getBoundingClientRect().left) / pixelsPerSecond)
    const id = addMediaAsset(assetId, {
      trackId: track.id,
      start: snappedTime(time),
    })
    if (id) toast('Added to the timeline', 'success')
  }

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { startY: event.clientY, startHeight: height }
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current
    if (!state) return
    const next = clamp(state.startHeight + (state.startY - event.clientY), 168, Math.round(window.innerHeight * 0.62))
    setHeight(next)
  }

  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return
    resizeRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture may already be released.
    }
  }

  const contextClip = context ? findClip(project, context.clipId)?.clip ?? null : null
  const contextTrack = context ? findClip(project, context.clipId)?.track ?? null : null

  const addMarkerAt = (time: number) => {
    const id = addMarker(snappedTime(time))
    if (id) toast('Marker added', 'success')
  }

  const beginMarkerDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    marker: Marker,
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    useEditor.getState().pause()
    event.currentTarget.setPointerCapture(event.pointerId)
    markerDragRef.current = {
      id: marker.id,
      startX: event.clientX,
      startTime: marker.time,
    }
  }

  const moveMarkerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = markerDragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / pixelsPerSecond
    updateMarker(drag.id, {
      time: clamp(drag.startTime + dx, 0, timelineEnd),
    })
  }

  const finishMarkerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!markerDragRef.current) return
    markerDragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture may already be released.
    }
    endGesture()
  }

  const addTrackButton = (kind: TrackKind) => {
    const id = addTrack(kind)
    if (id) toast('Track added', 'success')
  }

  const runAutoTransitions = async () => {
    if (autoBusy) return
    setAutoBusy(true)
    try {
      const count = await autoTransitions()
      toast(
        count > 0
          ? `Added ${count} content-aware transition${count === 1 ? '' : 's'}`
          : 'No new cuts without a transition were found',
        count > 0 ? 'success' : 'default',
      )
    } catch {
      toast('Could not analyse the cuts on this device', 'error')
    } finally {
      setAutoBusy(false)
    }
  }

  return (
    <>
      <div
        className="timeline-resizer"
        role="separator"
        aria-label="Resize timeline"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <section className="timeline-panel" style={{ height }}>
        <div className="timeline-toolbar">
          <div className="tb-group">
            <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 size={14} />
            </IconButton>
            <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 size={14} />
            </IconButton>
            <div className="divider" />
            <IconButton label="Split at playhead (Ctrl+B)" onClick={splitAtPlayhead}>
              <Scissors size={14} />
            </IconButton>
            <IconButton label="Duplicate clip (Ctrl+D)" onClick={() => duplicateClip()} disabled={!selectedClipId}>
              <Copy size={14} />
            </IconButton>
            <IconButton label="Delete selected (Del)" onClick={removeSelected} disabled={!selectedClipId}>
              <Trash2 size={14} />
            </IconButton>
            <IconButton label="Paste clip (Ctrl+V)" onClick={pasteClip}>
              <Plus size={14} />
            </IconButton>
            <div className="divider" />
            <IconButton
              label="Ripple delete (Shift+Del)"
              onClick={() => rippleDelete()}
              disabled={!selectedClipId}
            >
              <ListX size={14} />
            </IconButton>
            <IconButton label="Close gaps on all tracks" onClick={closeGaps}>
              <AlignHorizontalDistributeCenter size={14} />
            </IconButton>
            <IconButton
              label="Merge with next clip"
              onClick={() => mergeWithNext()}
              disabled={!selectedClipId}
            >
              <Combine size={14} />
            </IconButton>
            <IconButton
              label="Auto transitions from frame analysis"
              onClick={() => void runAutoTransitions()}
              disabled={autoBusy}
            >
              {autoBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            </IconButton>
          </div>

          <div className="tb-group">
            <div className="divider" />
            <IconButton label="Magnetic snapping" active={snap} onClick={() => setSnap(!snap)}>
              <Magnet size={14} />
            </IconButton>
            <IconButton
              label={follow ? 'Timeline follows playhead' : 'Timeline follow is off'}
              active={follow}
              onClick={() => setFollow(!follow)}
            >
              <ArrowLeftRight size={14} />
            </IconButton>
          </div>

          <div className="tb-group">
            <div className="divider" />
            <IconButton label="Add text track" onClick={() => addTrackButton('text')}>
              <Type size={14} />
            </IconButton>
            <IconButton label="Add overlay track" onClick={() => addTrackButton('overlay')}>
              <Layers size={14} />
            </IconButton>
            <IconButton label="Add audio track" onClick={() => addTrackButton('audio')}>
              <Music size={14} />
            </IconButton>
          </div>

          <div className="zoom-box">
            <IconButton label="Zoom out" onClick={() => setZoom(zoom / 1.3)}>
              <ZoomOut size={13} />
            </IconButton>
            <input
              type="range"
              className="range"
              min={0.2}
              max={6}
              step={0.05}
              value={zoom}
              aria-label="Timeline zoom"
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <IconButton label="Zoom in" onClick={() => setZoom(zoom * 1.3)}>
              <ZoomIn size={13} />
            </IconButton>
            <span style={{ color: 'var(--muted-2)', fontSize: 9, width: 34, textAlign: 'right' }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>

        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-content" style={{ width: contentWidth }}>
            <div className="timeline-corner">
              <Layers size={11} />
              <span>Timeline</span>
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(playhead)}
              </span>
            </div>
            <div
              className="timeline-ruler"
              style={{ width: laneWidth }}
              onPointerDown={startSeek}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromEvent(event)
              }}
              onPointerUp={(event) => {
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                } catch {
                  // Ignore.
                }
              }}
            >
              {ticks.map((time) => (
                <div
                  key={time}
                  className="ruler-tick major"
                  style={{ left: time * pixelsPerSecond }}
                >
                  <span className="ruler-label">{formatTime(time)}</span>
                </div>
              ))}
            </div>

            <div className="marker-corner">
              <Flag size={11} />
              <span>Markers</span>
              <em>{project.markers.length}</em>
              <IconButton
                label="Add marker at playhead (M)"
                onClick={() => addMarkerAt(playhead)}
              >
                <Plus size={12} />
              </IconButton>
            </div>
            <div
              className="marker-lane"
              style={{ width: laneWidth }}
              onPointerDown={(event) => {
                if (event.button !== 0 || event.target !== event.currentTarget) return
                const time = timeFromClientX(event.clientX, event.currentTarget)
                setPlayhead(time)
                addMarkerAt(time)
              }}
              title="Click to add a marker"
            >
              {project.markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  className="timeline-marker"
                  style={
                    {
                      left: marker.time * pixelsPerSecond,
                      '--marker-color': marker.color,
                    } as CSSProperties
                  }
                  title={`${marker.label} · ${formatTime(marker.time, true, project.fps)}\nDrag to move · double-click to rename · right-click to delete`}
                  onPointerDown={(event) => beginMarkerDrag(event, marker)}
                  onPointerMove={moveMarkerDrag}
                  onPointerUp={finishMarkerDrag}
                  onPointerCancel={finishMarkerDrag}
                  onClick={(event) => {
                    event.stopPropagation()
                    setPlayhead(marker.time)
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    const label = window.prompt('Marker label', marker.label)
                    if (label !== null) updateMarker(marker.id, { label: label.trim() || marker.label })
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    removeMarker(marker.id)
                    toast('Marker removed')
                  }}
                >
                  <Flag size={9} fill="currentColor" />
                  <span>{marker.label}</span>
                </button>
              ))}
            </div>

            {project.tracks.map((track) => {
              const TrackIcon = TRACK_ICONS[track.kind]
              const isVisual = track.kind !== 'audio'
              return (
                <TrackRow
                  key={track.id}
                  track={track}
                  assets={assets}
                  selectedClipId={selectedClipId}
                  pixelsPerSecond={pixelsPerSecond}
                  dropTarget={dropTrackId === track.id}
                  onDrop={onDrop}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                    setDropTrackId(track.id)
                  }}
                  onDragLeave={() => setDropTrackId((current) => (current === track.id ? null : current))}
                  onSeek={startSeek}
                  onSeekMove={seekFromEvent}
                  onClipPointerDown={beginClipDrag}
                  onClipPointerMove={handleClipMove}
                  onClipPointerUp={finishClipDrag}
                  onTrim={beginTrim}
                  onContext={openContext}
                  onSelect={selectClip}
                  onToggleMute={() => updateTrack(track.id, { muted: !track.muted })}
                  onToggleHide={() => updateTrack(track.id, { hidden: !track.hidden })}
                  onToggleLock={() => updateTrack(track.id, { locked: !track.locked })}
                  onRemove={
                    track.kind === 'main'
                      ? undefined
                      : () => {
                          removeTrack(track.id)
                          toast('Track removed')
                        }
                  }
                  icon={<TrackIcon size={12} />}
                  isVisual={isVisual}
                />
              )
            })}

            <div className="timeline-add-row">
              <Plus size={11} />
              <span>Add</span>
              <IconButton label="Add overlay track" onClick={() => addTrackButton('overlay')}>
                <Layers size={12} />
              </IconButton>
              <IconButton label="Add text track" onClick={() => addTrackButton('text')}>
                <Type size={12} />
              </IconButton>
              <IconButton label="Add sticker track" onClick={() => addTrackButton('sticker')}>
                <Sticker size={12} />
              </IconButton>
              <IconButton label="Add audio track" onClick={() => addTrackButton('audio')}>
                <Music size={12} />
              </IconButton>
            </div>
            <div className="track-lane timeline-add-lane" style={{ width: laneWidth }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 11,
                  color: 'var(--muted-2)',
                  fontSize: 9,
                }}
              >
                Drop media anywhere on a compatible track
              </span>
            </div>

            <div
              className="playhead"
              style={{ left: HEADER_WIDTH + playhead * pixelsPerSecond }}
              aria-hidden="true"
            >
              <span className="playhead-time">{formatTime(playhead, true, project.fps)}</span>
            </div>
          </div>
        </div>

        {playing && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 8,
              padding: '2px 7px',
              borderRadius: 5,
              background: 'rgba(255,93,115,.12)',
              color: '#ff9aa8',
              fontSize: 9,
              pointerEvents: 'none',
            }}
          >
            Playing
          </div>
        )}
      </section>

      {context &&
        contextClip &&
        createPortal(
          <div
            className="context-menu"
            style={{
              left: Math.min(context.x, window.innerWidth - 210),
              top: Math.min(context.y, window.innerHeight - 280),
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              className="context-item"
              onClick={() => {
                duplicateClip(contextClip.id)
                setContext(null)
              }}
            >
              Duplicate <span className="shortcut">Ctrl+D</span>
            </button>
            <button
              className="context-item"
              onClick={() => {
                copySelected()
                setContext(null)
              }}
            >
              Copy <span className="shortcut">Ctrl+C</span>
            </button>
            <button
              className="context-item"
              onClick={() => {
                setPlayhead(contextClip.start + contextClip.duration / 2)
                setContext(null)
                splitAtPlayhead()
              }}
            >
              Split at middle <span className="shortcut">Ctrl+B</span>
            </button>
            {'assetId' in contextClip && contextClip.kind === 'video' && (
              <button
                className="context-item"
                onClick={() => {
                  detachAudio(contextClip.id)
                  setContext(null)
                }}
              >
                Detach audio
              </button>
            )}
            <button
              className="context-item"
              onClick={() => {
                rippleDelete(contextClip.id)
                setContext(null)
              }}
            >
              Ripple delete <span className="shortcut">⇧Del</span>
            </button>
            <button
              className="context-item"
              onClick={() => {
                mergeWithNext(contextClip.id)
                setContext(null)
              }}
            >
              Merge with next
            </button>
            <button
              className="context-item"
              onClick={() => {
                closeGaps()
                setContext(null)
              }}
            >
              Close gaps on all tracks
            </button>
            <button
              className="context-item"
              onClick={() => {
                setContext(null)
                void runAutoTransitions()
              }}
            >
              Auto transitions on all cuts
            </button>
            <button
              className="context-item"
              onClick={() => {
                if (contextTrack && contextTrack.kind !== 'main') {
                  removeTrack(contextTrack.id)
                  toast('Track removed')
                }
                setContext(null)
              }}
            >
              {contextTrack && contextTrack.kind !== 'main' ? 'Remove track' : 'Track is protected'}
            </button>
            <div className="context-sep" />
            <button
              className="context-item danger"
              onClick={() => {
                removeSelected()
                setContext(null)
              }}
            >
              Delete <span className="shortcut">Del</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Track row                                                                   */
/* -------------------------------------------------------------------------- */

function TrackRow({
  track,
  assets,
  selectedClipId,
  pixelsPerSecond,
  dropTarget,
  onDrop,
  onDragOver,
  onDragLeave,
  onSeek,
  onSeekMove,
  onClipPointerDown,
  onClipPointerMove,
  onClipPointerUp,
  onTrim,
  onContext,
  onSelect,
  onToggleMute,
  onToggleHide,
  onToggleLock,
  onRemove,
  icon,
  isVisual,
}: {
  track: Track
  assets: Record<string, Asset>
  selectedClipId: string | null
  pixelsPerSecond: number
  dropTarget: boolean
  onDrop: (event: DragEvent<HTMLDivElement>, track: Track) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onSeek: (event: ReactPointerEvent<HTMLElement>) => void
  onSeekMove: (event: ReactPointerEvent<HTMLElement>) => void
  onClipPointerDown: (event: ReactPointerEvent<HTMLDivElement>, clip: Clip) => void
  onClipPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onClipPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onTrim: (
    event: ReactPointerEvent<HTMLSpanElement>,
    clip: Clip,
    edge: 'start' | 'end',
  ) => void
  onContext: (event: React.MouseEvent, clipId: string) => void
  onSelect: (clipId: string | null) => void
  onToggleMute: () => void
  onToggleHide: () => void
  onToggleLock: () => void
  onRemove?: () => void
  icon: ReactNode
  isVisual: boolean
}) {
  return (
    <>
      <div
        className={`track-header ${track.locked ? 'is-locked' : ''} ${track.hidden ? 'is-hidden' : ''}`}
      >
        <span className="track-type">{icon}</span>
        <span className="track-name" title={track.name}>
          {track.name}
        </span>
        <div className="track-actions">
          {isVisual && (
            <IconButton
              label={track.hidden ? 'Show track' : 'Hide track'}
              className={track.hidden ? 'off' : ''}
              onClick={onToggleHide}
            >
              {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </IconButton>
          )}
          <IconButton
            label={track.muted ? 'Unmute track' : 'Mute track'}
            className={track.muted ? 'off' : ''}
            onClick={onToggleMute}
          >
            {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </IconButton>
          <IconButton
            label={track.locked ? 'Unlock track' : 'Lock track'}
            className={track.locked ? 'on' : ''}
            onClick={onToggleLock}
          >
            {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </IconButton>
          {onRemove && (
            <IconButton label="Remove track" onClick={onRemove}>
              <Trash2 size={12} />
            </IconButton>
          )}
        </div>
      </div>
      <div
        className={`track-lane ${dropTarget ? 'drop-target' : ''}`}
        data-track-id={track.id}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          if (event.target === event.currentTarget) onSeek(event)
        }}
        onPointerMove={(event) => {
          if (event.target === event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
            onSeekMove(event)
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(event) => onDrop(event, track)}
      >
        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            asset={'assetId' in clip ? assets[clip.assetId] : undefined}
            selected={clip.id === selectedClipId}
            pixelsPerSecond={pixelsPerSecond}
            onPointerDown={onClipPointerDown}
            onPointerMove={onClipPointerMove}
            onPointerUp={onClipPointerUp}
            onTrim={onTrim}
            onContext={onContext}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Clip                                                                        */
/* -------------------------------------------------------------------------- */

function TimelineClip({
  clip,
  asset,
  selected,
  pixelsPerSecond,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTrim,
  onContext,
  onSelect,
}: {
  clip: Clip
  asset?: Asset
  selected: boolean
  pixelsPerSecond: number
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, clip: Clip) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onTrim: (
    event: ReactPointerEvent<HTMLSpanElement>,
    clip: Clip,
    edge: 'start' | 'end',
  ) => void
  onContext: (event: React.MouseEvent, clipId: string) => void
  onSelect: (clipId: string | null) => void
}) {
  const width = Math.max(10, clip.duration * pixelsPerSecond)
  const left = clip.start * pixelsPerSecond
  const Icon = CLIP_ICONS[clip.kind]
  const filmstrip = asset?.filmstrip ?? (asset?.thumbnail ? [asset.thumbnail] : [])
  const frames = filmstrip.slice(0, Math.max(1, Math.min(12, Math.ceil(width / 70))))
  const from = asset && asset.duration > 0 ? clip.mediaStart / asset.duration : 0
  const to =
    asset && asset.duration > 0
      ? (clip.mediaStart + clip.duration * clip.speed) / asset.duration
      : 1

  return (
    <div
      className={`timeline-clip kind-${clip.kind} ${selected ? 'selected' : ''}`}
      style={{ left, width }}
      title={`${clip.name} · ${clip.duration.toFixed(2)}s`}
      onPointerDown={(event) => onPointerDown(event, clip)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => onContext(event, clip.id)}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(clip.id)
      }}
      onDoubleClick={() => useEditor.getState().setPlayhead(clip.start)}
    >
      {(clip.kind === 'video' || clip.kind === 'image') && frames.length > 0 && (
        <div className="clip-filmstrip">
          {frames.map((src, index) => (
            <span key={`${src.slice(-16)}-${index}`} style={{ backgroundImage: `url(${src})` }} />
          ))}
        </div>
      )}

      {clip.kind === 'audio' && asset?.waveform && (
        <Waveform peaks={asset.waveform} from={from} to={to} />
      )}

      {clip.kind === 'text' && (
        <div className="clip-text-preview">
          <span
            style={{
              fontFamily: `${clip.text.fontFamily}, Inter, sans-serif`,
              fontSize: 9,
              lineHeight: 1.15,
              maxHeight: '100%',
              overflow: 'hidden',
            }}
          >
            {clip.text.content}
          </span>
        </div>
      )}

      {clip.kind === 'sticker' && (
        <img className="clip-sticker-preview" src={clip.sticker.src} alt="" />
      )}

      {(clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'audio') && (
        <div className="clip-shade" />
      )}

      {clip.transitionIn && (
        <span className="transition-badge" title={`${clip.transitionIn.type} transition`}>
          <ArrowLeftRight size={8} />
        </span>
      )}

      {clip.keyframes.length > 0 && (
        <div className="clip-keyframes">
          {clip.keyframes.map((keyframe) => {
            const index = Math.max(
              0,
              KEYFRAME_PROPERTIES.findIndex((property) => property.id === keyframe.property),
            )
            return (
              <span
                key={keyframe.id}
                className="clip-keyframe"
                role="button"
                tabIndex={-1}
                aria-label={`${keyframe.property} keyframe`}
                style={{
                  left: keyframe.time * pixelsPerSecond,
                  top: 2 + (index % 4) * 7,
                }}
                title={`${KEYFRAME_PROPERTIES[index]?.label ?? keyframe.property} · ${keyframe.time.toFixed(2)}s`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(clip.id)
                  useEditor.getState().setPlayhead(clip.start + keyframe.time)
                }}
              >
                <Diamond size={7} fill="currentColor" />
              </span>
            )
          })}
        </div>
      )}

      <div className="clip-label">
        <Icon size={9} />
        <span className="ellipsis">{clip.name}</span>
      </div>

      {clip.kind === 'video' && clip.muted && (
        <span className="clip-badge" style={{ left: 'auto', right: 3 }}>
          <VolumeX size={8} /> Muted
        </span>
      )}

      <span
        className="trim-handle left"
        onPointerDown={(event) => onTrim(event, clip, 'start')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <span
        className="trim-handle right"
        onPointerDown={(event) => onTrim(event, clip, 'end')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
