import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type PlaySource = 'original' | 'preview' | 'result'

function getCtx(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new AC()
}

export function usePlayer() {
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const rafRef = useRef(0)
  const fracRef = useRef(0)
  const startAtRef = useRef(0)
  const rateRef = useRef(1)
  const durRef = useRef(0)
  const playingRef = useRef<PlaySource | null>(null)

  const [playing, setPlaying] = useState<PlaySource | null>(null)
  const [progress, setProgress] = useState(0)
  const [volume, setVolumeState] = useState(0.9)
  const [loop, setLoop] = useState(false)
  const loopRef = useRef(false)
  const volumeRef = useRef(0.9)

  const ensure = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = getCtx()
    }
    return ctxRef.current
  }, [])

  const stopNodes = useCallback(() => {
    try {
      sourceRef.current?.stop()
      sourceRef.current?.disconnect()
    } catch {
      /* already stopped */
    }
    sourceRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || !playingRef.current) return
    const elapsed = (ctx.currentTime - startAtRef.current) * rateRef.current
    const dur = durRef.current
    const rawFrac = dur > 0 ? fracRef.current + elapsed / dur : 0

    if (rawFrac >= 1) {
      if (loopRef.current && dur > 0) {
        const wrapped = rawFrac % 1
        fracRef.current = wrapped
        setProgress(wrapped)
        startAtRef.current = ctx.currentTime
      } else {
        fracRef.current = 0
        playingRef.current = null
        setPlaying(null)
        setProgress(0)
        stopNodes()
        return
      }
    } else {
      setProgress(Math.max(0, rawFrac))
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [stopNodes])

  const play = useCallback(
    async (buffer: AudioBuffer, source: PlaySource, rate = 1, fromFrac?: number) => {
      const ctx = ensure()
      if (ctx.state === 'suspended') await ctx.resume()
      if (fromFrac !== undefined) {
        fracRef.current = fromFrac >= 0.999 ? 0 : Math.max(0, fromFrac)
      } else if (fracRef.current >= 0.999) {
        fracRef.current = 0
      }
      stopNodes()

      const safeRate = Number.isFinite(rate) && rate > 0.05 && rate < 16 ? rate : 1
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.82
      const gain = ctx.createGain()
      gain.gain.value = volumeRef.current
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = safeRate
      src.loop = loopRef.current
      src.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)

      analyserRef.current = analyser
      gainRef.current = gain
      sourceRef.current = src
      rateRef.current = safeRate
      durRef.current = buffer.duration

      const maxOffset = Math.max(0, buffer.duration - 0.01)
      const offset = Math.min(maxOffset, Math.max(0, fracRef.current * buffer.duration))
      startAtRef.current = ctx.currentTime
      src.onended = () => {
        if (sourceRef.current === src && !loopRef.current) {
          playingRef.current = null
          setPlaying(null)
        }
      }
      src.start(0, offset)
      playingRef.current = source
      setPlaying(source)
      rafRef.current = requestAnimationFrame(tick)
    },
    [ensure, stopNodes, tick],
  )

  const pause = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx && playingRef.current) {
      const elapsed = (ctx.currentTime - startAtRef.current) * rateRef.current
      fracRef.current = Math.min(1, Math.max(0, fracRef.current + elapsed / Math.max(1e-6, durRef.current)))
      setProgress(fracRef.current)
    }
    stopNodes()
    playingRef.current = null
    setPlaying(null)
  }, [stopNodes])

  const stop = useCallback(() => {
    stopNodes()
    fracRef.current = 0
    playingRef.current = null
    setPlaying(null)
    setProgress(0)
  }, [stopNodes])

  const seek = useCallback((frac: number) => {
    fracRef.current = Math.min(1, Math.max(0, frac))
    setProgress(fracRef.current)
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    volumeRef.current = clamped
    setVolumeState(clamped)
    if (gainRef.current) gainRef.current.gain.value = clamped
  }, [])

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current
    setLoop(loopRef.current)
    if (sourceRef.current) sourceRef.current.loop = loopRef.current
  }, [])

  useEffect(
    () => () => {
      stopNodes()
      const ctx = ctxRef.current
      ctxRef.current = null
      if (ctx && ctx.state !== 'closed') {
        void ctx.close().catch(() => {})
      }
    },
    [stopNodes],
  )

  return useMemo(
    () => ({
      ctx: ensure,
      playing,
      progress,
      volume,
      loop,
      analyserRef,
      play,
      pause,
      stop,
      seek,
      setVolume,
      toggleLoop,
      frac: () => fracRef.current,
    }),
    [ensure, playing, progress, volume, loop, play, pause, stop, seek, setVolume, toggleLoop],
  )
}
