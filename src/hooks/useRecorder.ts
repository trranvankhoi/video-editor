import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderPhase = 'idle' | 'requesting' | 'recording' | 'saving'

export function useRecorder(onComplete: (file: File) => void, onError: (message: string) => void) {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const completeRef = useRef(onComplete)
  const errorRef = useRef(onError)

  useEffect(() => {
    completeRef.current = onComplete
    errorRef.current = onError
  }, [onComplete, onError])

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const start = useCallback(async () => {
    if (phase !== 'idle' && phase !== 'saving') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      errorRef.current('Microphone recording is not supported in this browser.')
      return
    }
    setPhase('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const stamp = new Date()
          .toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          .replace(/[^\d]/g, '-')
        const extension = recorder.mimeType.includes('mp4') ? 'm4a' : 'webm'
        if (blob.size > 0) {
          completeRef.current(
            new File([blob], `Voiceover ${stamp}.${extension}`, {
              type: recorder.mimeType || 'audio/webm',
            }),
          )
        } else {
          errorRef.current('The recording was empty.')
        }
        cleanup()
        setPhase('idle')
        setSeconds(0)
      }
      recorder.start(250)
      startedAtRef.current = performance.now()
      setSeconds(0)
      setPhase('recording')
      timerRef.current = window.setInterval(() => {
        setSeconds((performance.now() - startedAtRef.current) / 1000)
      }, 200)
    } catch (error) {
      console.error(error)
      cleanup()
      setPhase('idle')
      errorRef.current(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the browser and try again.'
          : 'Could not start recording. Check that a microphone is connected.',
      )
    }
  }, [cleanup, phase])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setPhase('saving')
    try {
      recorder.stop()
    } catch {
      cleanup()
      setPhase('idle')
    }
  }, [cleanup])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    cleanup()
    setPhase('idle')
    setSeconds(0)
  }, [cleanup])

  return { phase, seconds, start, stop, cancel }
}
