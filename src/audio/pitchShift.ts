/**
 * Pitch shift with optional tempo preservation.
 *
 * Artifact-free path: resample only (duration scales with 1/ratio).
 * Tempo-hold path: resample + WSOLA time-stretch back to original length.
 * Stereo image is kept by searching on a mid mix and applying the same hops.
 */

function cubicAt(src: Float32Array, pos: number): number {
  const n = src.length
  if (n === 0) return 0
  const i = Math.floor(pos)
  const mu = pos - i
  const y0 = src[Math.max(0, Math.min(n - 1, i - 1))]
  const y1 = src[Math.max(0, Math.min(n - 1, i))]
  const y2 = src[Math.max(0, Math.min(n - 1, i + 1))]
  const y3 = src[Math.max(0, Math.min(n - 1, i + 2))]
  const a0 = y3 - y2 - y0 + y1
  const a1 = y0 - y1 - a0
  const a2 = y2 - y0
  return a0 * mu * mu * mu + a1 * mu * mu + a2 * mu + y1
}

function resampleChannel(src: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 1e-7) return src.slice()
  const outLen = Math.max(1, Math.round(src.length / ratio))
  const out = new Float32Array(outLen)
  const step = (src.length - 1) / Math.max(1, outLen - 1)
  for (let i = 0; i < outLen; i++) out[i] = cubicAt(src, i * step)
  return out
}

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n)
  if (n <= 1) {
    w[0] = 1
    return w
  }
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  return w
}

type WsolaHops = { inPos: number[]; grain: number; hopOut: number }

function planWsola(inputLen: number, stretch: number, sampleRate: number): WsolaHops {
  const grainMs = 40
  const hopOutMs = 18
  const grain = Math.max(256, Math.round((sampleRate * grainMs) / 1000))
  const hopOut = Math.max(64, Math.round((sampleRate * hopOutMs) / 1000))
  const hopIn = hopOut / stretch
  const outLen = Math.max(grain, Math.round(inputLen * stretch))
  const inPos: number[] = []
  let ip = 0
  for (let op = 0; op + grain < outLen; op += hopOut) {
    inPos.push(ip)
    ip += hopIn
  }
  return { inPos, grain, hopOut }
}

function bestOffset(
  mid: Float32Array,
  prevStart: number,
  expected: number,
  grain: number,
  seek: number,
): number {
  const n = mid.length
  const start0 = Math.max(0, Math.min(n - grain, Math.round(expected)))
  if (seek < 8 || prevStart < 0) return start0
  const lo = Math.max(0, start0 - seek)
  const hi = Math.min(n - grain, start0 + seek)
  if (hi <= lo) return start0

  const overlap = Math.min(grain >> 3, 160)
  let best = start0
  let bestCorr = -Infinity
  for (let cand = lo; cand <= hi; cand += 8) {
    let corr = 0
    let e0 = 0
    let e1 = 0
    const aBase = prevStart + grain - overlap
    for (let i = 0; i < overlap; i += 2) {
      const a = mid[aBase + i]
      const b = mid[cand + i]
      corr += a * b
      e0 += a * a
      e1 += b * b
    }
    const ncorr = corr / (Math.sqrt(e0 * e1) + 1e-12)
    if (ncorr > bestCorr) {
      bestCorr = ncorr
      best = cand
    }
  }
  return best
}

function applyWsola(
  channels: Float32Array[],
  stretch: number,
  sampleRate: number,
  onProgress?: (p: number) => void,
): Float32Array[] {
  if (Math.abs(stretch - 1) < 0.0008) return channels.map((c) => c.slice())

  const inputLen = channels[0].length
  const mid = new Float32Array(inputLen)
  const inv = 1 / channels.length
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c]
    for (let i = 0; i < inputLen; i++) mid[i] += ch[i] * inv
  }

  const { inPos, grain, hopOut } = planWsola(inputLen, stretch, sampleRate)
  const win = hannWindow(grain)
  const seek = Math.abs(stretch - 1) < 0.04 ? 0 : Math.round(sampleRate * 0.008)
  const outLen = Math.round(inputLen * stretch) + grain
  const outs = channels.map(() => new Float32Array(outLen))
  const norm = new Float32Array(outLen)

  let prev = -1
  for (let g = 0; g < inPos.length; g++) {
    const expected = inPos[g]
    const start = bestOffset(mid, prev, expected, grain, seek)
    prev = start
    const outStart = g * hopOut
    for (let i = 0; i < grain; i++) {
      const oi = outStart + i
      if (oi >= outLen) break
      const w = win[i]
      const si = start + i
      if (si >= inputLen) break
      for (let c = 0; c < channels.length; c++) {
        outs[c][oi] += channels[c][si] * w
      }
      norm[oi] += w
    }
    if (onProgress && g % 32 === 0) onProgress(g / inPos.length)
  }

  for (let i = 0; i < outLen; i++) {
    const n = norm[i]
    if (n > 1e-6) {
      const invN = 1 / n
      for (let c = 0; c < outs.length; c++) outs[c][i] *= invN
    }
  }

  const target = Math.round(inputLen * stretch)
  return outs.map((ch) => ch.slice(0, target))
}

export function pitchShiftChannels(
  channels: Float32Array[],
  sampleRate: number,
  ratio: number,
  preserveTempo: boolean,
  onProgress?: (p: number) => void,
): Float32Array[] {
  if (Math.abs(ratio - 1) < 1e-6) {
    onProgress?.(1)
    return channels.map((c) => c.slice())
  }

  onProgress?.(0.05)
  const resampled = channels.map((ch) => resampleChannel(ch, ratio))
  onProgress?.(preserveTempo ? 0.35 : 0.9)

  let finalCh = resampled
  if (preserveTempo) {
    finalCh = applyWsola(resampled, ratio, sampleRate, (p) => {
      onProgress?.(0.35 + p * 0.6)
    })
  }
  onProgress?.(1)
  return finalCh
}

export async function pitchShiftBuffer(
  ctx: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  ratio: number,
  preserveTempo: boolean,
  onProgress?: (p: number) => void,
): Promise<AudioBuffer> {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }
  const finalCh = pitchShiftChannels(channels, buffer.sampleRate, ratio, preserveTempo, onProgress)
  const out = ctx.createBuffer(buffer.numberOfChannels, finalCh[0].length, buffer.sampleRate)
  for (let c = 0; c < finalCh.length; c++) out.getChannelData(c).set(finalCh[c])
  return out
}
