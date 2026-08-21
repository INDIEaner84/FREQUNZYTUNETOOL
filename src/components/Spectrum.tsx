import { useEffect, useRef } from 'react'

type Props = {
  analyser: AnalyserNode | null
  active: boolean
}

export default function Spectrum({ analyser, active }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let raf = 0
    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.max(1, Math.floor(w * dpr))
        canvas.height = Math.max(1, Math.floor(h * dpr))
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = 'rgba(12,13,16,0.35)'
      ctx.fillRect(0, 0, w, h)

      if (analyser && active) {
        const bins = analyser.frequencyBinCount
        const data = new Uint8Array(bins)
        analyser.getByteFrequencyData(data)
        const bars = 72
        const gap = 2
        const bw = (w - gap * bars) / bars
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor(Math.pow(i / bars, 1.6) * bins)
          const v = data[idx] / 255
          const bh = Math.max(2, v * h)
          const x = i * (bw + gap)
          ctx.fillStyle = `rgba(201,162,39,${0.25 + v * 0.75})`
          ctx.fillRect(x, h - bh, bw, bh)
        }
      } else {
        ctx.fillStyle = 'rgba(232,224,208,0.08)'
        for (let i = 0; i < 48; i++) {
          const bh = 4 + (Math.sin(i * 0.4) * 0.5 + 0.5) * 10
          ctx.fillRect(i * (w / 48), h - bh, w / 48 - 2, bh)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [analyser, active])

  return <canvas ref={ref} className="spec-canvas" />
}
