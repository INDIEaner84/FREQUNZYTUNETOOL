import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type PlaySource = 'original' | 'preview' | 'result'

function getCtx(): AudioContext {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
    if (!ctxRef.current) ctxRef.current = getCtx()
    return ctxRef.current
  }, [])

  const stopNodes = () => {
    try {
      sourceRef.current?.stop()
    } catch {
      /* already stopped */
    }
    sourceRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const tick = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || !playingRef.current) return
    const elapsed = (ctx.currentTime - startAtRef.current) * rateRef.current
    const frac = durRef.current > 0 ? Math.min(1, fracRef.current + elapsed / durRef.current) : 0
    setProgress(frac)
    if (frac >= 1) {
      if (loopRef.current) {
        fracRef.current = 0
        setProgress(0)
        startAtRef.current = ctx.currentTime
      } else {
        fracRef.current = 0
        playingRef.current = null
        setPlaying(null)
        setProgress(0)
        stopNodes()
        return
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback(
    async (buffer: AudioBuffer, source: PlaySource, rate = 1, fromFrac?: number) => {
      const ctx = ensure()
      if (ctx.state === 'suspended') await ctx.resume()
      if (fromFrac !== undefined) fracRef.current = fromFrac
      stopNodes()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.82
      const gain = ctx.createGain()
      gain.gain.value = volumeRef.current
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = rate
      src.loop = loopRef.current
      src.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)

      analyserRef.current = analyser
      gainRef.current = gain
      sourceRef.current = src
      rateRef.current = rate
      durRef.current = buffer.duration
      const offset = Math.min(buffer.duration - 0.01, Math.max(0, fracRef.current * buffer.duration))
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
    [ensure, tick],
  )

  const pause = useCallback(() => {
    const ctx = ctxRef.current
    if (ctx && playingRef.current) {
      const elapsed = (ctx.currentTime - startAtRef.current) * rateRef.current
      fracRef.current = Math.min(1, fracRef.current + elapsed / Math.max(1e-6, durRef.current))
      setProgress(fracRef.current)
    }
    stopNodes()
    playingRef.current = null
    setPlaying(null)
  }, [])

  const stop = useCallback(() => {
    stopNodes()
    fracRef.current = 0
    playingRef.current = null
    setPlaying(null)
    setProgress(0)
  }, [])

  const seek = useCallback((frac: number) => {
    fracRef.current = Math.min(1, Math.max(0, frac))
    setProgress(fracRef.current)
  }, [])

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v
    setVolumeState(v)
    if (gainRef.current) gainRef.current.gain.value = v
  }, [])

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current
    setLoop(loopRef.current)
    if (sourceRef.current) sourceRef.current.loop = loopRef.current
  }, [])

  useEffect(() => () => stopNodes(), [])

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
