import { useCallback, useEffect, useRef } from 'react'

type Props = {
  buffer: AudioBuffer | null
  progress: number
  onSeek?: (frac: number) => void
}

type CacheMeta = {
  buffer: AudioBuffer | null
  pw: number
  ph: number
  dpr: number
}

export default function Waveform({ buffer, progress, onSeek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cacheMetaRef = useRef<CacheMeta>({ buffer: null, pw: 0, ph: 0, dpr: 1 })

  const renderWaveform = useCallback(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w <= 0 || h <= 0) return
    const pw = Math.max(1, Math.floor(w * dpr))
    const ph = Math.max(1, Math.floor(h * dpr))

    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }

    const meta = cacheMetaRef.current
    if (!cacheCanvasRef.current || meta.buffer !== buffer || meta.pw !== pw || meta.ph !== ph || meta.dpr !== dpr) {
      const off = cacheCanvasRef.current ?? document.createElement('canvas')
      off.width = pw
      off.height = ph
      const octx = off.getContext('2d')
      if (octx) {
        octx.setTransform(dpr, 0, 0, dpr, 0, 0)
        octx.clearRect(0, 0, w, h)
        octx.fillStyle = 'rgba(232,224,208,0.04)'
        octx.fillRect(0, 0, w, h)
        octx.strokeStyle = 'rgba(232,224,208,0.08)'
        octx.beginPath()
        octx.moveTo(0, h / 2)
        octx.lineTo(w, h / 2)
        octx.stroke()

        if (buffer && buffer.numberOfChannels > 0) {
          const data = buffer.getChannelData(0)
          const step = Math.max(1, Math.floor(data.length / w))
          const subStep = Math.max(1, Math.floor(step / 8))
          octx.beginPath()
          octx.strokeStyle = 'rgba(201,162,39,0.85)'
          octx.lineWidth = 1.2
          for (let x = 0; x < w; x++) {
            const i = x * step
            let min = 1
            let max = -1
            for (let j = 0; j < step; j += subStep) {
              const v = data[i + j] ?? 0
              if (v < min) min = v
              if (v > max) max = v
            }
            if (min > max) {
              min = 0
              max = 0
            }
            octx.moveTo(x, ((min + 1) / 2) * h)
            octx.lineTo(x, ((max + 1) / 2) * h)
          }
          octx.stroke()
        }
      }
      cacheCanvasRef.current = off
      cacheMetaRef.current = { buffer, pw, ph, dpr }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, pw, ph)
    if (cacheCanvasRef.current) {
      ctx.drawImage(cacheCanvasRef.current, 0, 0)
    }

    if (buffer && progress > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = 'rgba(201,162,39,0.12)'
      ctx.fillRect(0, 0, w * progress, h)
      ctx.fillStyle = '#e8c96a'
      ctx.fillRect(w * progress - 1, 0, 2, h)
    }
  }, [buffer, progress])

  useEffect(() => {
    renderWaveform()
  }, [renderWaveform])

  useEffect(() => {
    const onResize = () => renderWaveform()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [renderWaveform])

  return (
    <canvas
      ref={ref}
      className="wave-canvas"
      role="slider"
      tabIndex={0}
      aria-label="Wiedergabeposition"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      title="Klicken zum Spulen"
      onClick={(e) => {
        if (!onSeek) return
        const r = e.currentTarget.getBoundingClientRect()
        if (r.width <= 0) return
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
      }}
      onKeyDown={(e) => {
        if (!onSeek) return
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          onSeek(Math.max(0, progress - 0.05))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          onSeek(Math.min(1, progress + 0.05))
        }
      }}
    />
  )
}
