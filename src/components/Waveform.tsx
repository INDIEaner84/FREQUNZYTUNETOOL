import { useEffect, useRef } from 'react'

type Props = {
  buffer: AudioBuffer | null
  progress: number
  onSeek?: (frac: number) => void
}

export default function Waveform({ buffer, progress, onSeek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(232,224,208,0.04)'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(232,224,208,0.08)'
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    if (!buffer) return
    const data = buffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / w))
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(201,162,39,0.85)'
    ctx.lineWidth = 1.2
    for (let x = 0; x < w; x++) {
      const i = x * step
      let min = 1
      let max = -1
      for (let j = 0; j < step; j += Math.max(1, Math.floor(step / 8))) {
        const v = data[i + j] ?? 0
        if (v < min) min = v
        if (v > max) max = v
      }
      ctx.moveTo(x, ((min + 1) / 2) * h)
      ctx.lineTo(x, ((max + 1) / 2) * h)
    }
    ctx.stroke()

    if (progress > 0) {
      ctx.fillStyle = 'rgba(201,162,39,0.12)'
      ctx.fillRect(0, 0, w * progress, h)
      ctx.fillStyle = '#e8c96a'
      ctx.fillRect(w * progress - 1, 0, 2, h)
    }
  }, [buffer, progress])

  return (
    <canvas
      ref={ref}
      className="wave-canvas"
      title="Klicken zum Spulen"
      onClick={(e) => {
        if (!onSeek) return
        const r = e.currentTarget.getBoundingClientRect()
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
      }}
    />
  )
}
