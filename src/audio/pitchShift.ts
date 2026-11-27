/**
 * Pitch shift with optional tempo preservation.
 *
 * Artifact-free path: zero-phase anti-aliasing filter (when ratio > 1) + cubic resampling.
 * Tempo-hold path: resample + 50%-COLA WSOLA time-stretch back to original duration.
 * Stereo image is preserved by searching offsets on a mid mix and applying identical grain hops.
 */

import { hannPeriodic } from './fft'
import { mixMono } from './raw'

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

function designButterworthLowpass(fs: number, fc: number): Biquad {
  const clampedFc = Math.max(20, Math.min(fs * 0.49, fc))
  const k = Math.tan((Math.PI * clampedFc) / fs)
  const k2 = k * k
  const root2k = Math.SQRT2 * k
  const norm = 1 / (1 + root2k + k2)
  const b0 = k2 * norm
  return {
    b0,
    b1: 2 * b0,
    b2: b0,
    a1: 2 * (k2 - 1) * norm,
    a2: (1 - root2k + k2) * norm,
  }
}

/** Zero-phase forward-backward 2nd-order Butterworth filter (4th-order -24 dB/oct, zero phase shift). */
function filtfiltLowpass(src: Float32Array, fs: number, fc: number): Float32Array {
  const n = src.length
  if (n < 4) return src.slice()
  const c = designButterworthLowpass(fs, fc)
  const tmp = new Float32Array(n)
  let x1 = src[0]
  let x2 = src[0]
  let y1 = src[0]
  let y2 = src[0]
  for (let i = 0; i < n; i++) {
    const x = src[i]
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    tmp[i] = y
  }

  const out = new Float32Array(n)
  x1 = tmp[n - 1]
  x2 = tmp[n - 1]
  y1 = tmp[n - 1]
  y2 = tmp[n - 1]
  for (let i = n - 1; i >= 0; i--) {
    const x = tmp[i]
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

function cubicAt(src: Float32Array, pos: number): number {
  const n = src.length
  if (n === 0) return 0
  const i = Math.floor(pos)
  const mu = pos - i
  const y0 = src[Math.max(0, Math.min(n - 1, i - 1))]
  const y1 = src[Math.max(0, Math.min(n - 1, i))]
  const y2 = src[Math.max(0, Math.min(n - 1, i + 1))]
  const y3 = src[Math.max(0, Math.min(n - 1, i + 2))]
  // Catmull-Rom spline (overshoot-controlled C1 cubic interpolation)
  const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3
  const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
  const a2 = -0.5 * y0 + 0.5 * y2
  return ((a0 * mu + a1) * mu + a2) * mu + y1
}

function resampleChannel(src: Float32Array, sampleRate: number, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 1e-7 || src.length === 0) return src.slice()
  const filtered =
    ratio > 1.001 ? filtfiltLowpass(src, sampleRate, 0.46 * (sampleRate / ratio)) : src
  const outLen = Math.max(1, Math.round(filtered.length / ratio))
  const out = new Float32Array(outLen)
  if (outLen === 1 || filtered.length === 1) {
    out[0] = filtered[0]
    return out
  }
  const step = (filtered.length - 1) / (outLen - 1)
  for (let i = 0; i < outLen; i++) out[i] = cubicAt(filtered, i * step)
  return out
}

function correlateAt(
  mid: Float32Array,
  aBase: number,
  cand: number,
  overlap: number,
  stride: number,
): number {
  let corr = 0
  let e0 = 0
  let e1 = 0
  for (let i = 0; i < overlap; i += stride) {
    const a = mid[aBase + i]
    const b = mid[cand + i]
    corr += a * b
    e0 += a * a
    e1 += b * b
  }
  return corr / (Math.sqrt(e0 * e1) + 1e-12)
}

function bestOffset(
  mid: Float32Array,
  prevStart: number,
  expected: number,
  grain: number,
  hopOut: number,
  overlap: number,
  seek: number,
): number {
  const n = mid.length
  const maxStart = Math.max(0, n - grain)
  const start0 = Math.max(0, Math.min(maxStart, Math.round(expected)))
  if (seek < 2 || prevStart < 0) return start0

  // Reference is prevStart + hopOut: the exact input slice already placed at the current output position!
  const aBase = prevStart + hopOut
  if (aBase + overlap > n) return start0

  const lo = Math.max(0, start0 - seek)
  const hi = Math.min(maxStart, n - overlap, start0 + seek)
  if (hi <= lo) return start0

  // Stage 1: coarse search (4-sample step)
  let coarseBest = start0
  let bestCorr = -Infinity
  for (let cand = lo; cand <= hi; cand += 4) {
    const c = correlateAt(mid, aBase, cand, overlap, 2)
    if (c > bestCorr) {
      bestCorr = c
      coarseBest = cand
    }
  }

  // Stage 2: single-sample refinement around coarse peak for 1-sample phase lock
  const fineLo = Math.max(lo, coarseBest - 4)
  const fineHi = Math.min(hi, coarseBest + 4)
  let best = coarseBest
  bestCorr = -Infinity
  for (let cand = fineLo; cand <= fineHi; cand++) {
    const c = correlateAt(mid, aBase, cand, overlap, 1)
    if (c > bestCorr) {
      bestCorr = c
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
  if (channels.length === 0) return []
  const inputLen = channels[0].length
  if (inputLen === 0 || Math.abs(stretch - 1) < 0.0005) {
    return channels.map((c) => c.slice())
  }

  const target = Math.max(1, Math.round(inputLen * stretch))
  const grain = Math.max(256, Math.round(sampleRate * 0.04) & ~1)
  if (inputLen <= grain) {
    // Very short buffer fallback: smooth resample back to target length
    return channels.map((ch) => resampleChannel(ch, sampleRate, inputLen / target))
  }

  // Exact 50 % overlap with periodic Hann window satisfies Constant Overlap-Add (COLA = 1.0)
  const hopOut = grain >> 1
  const hopIn = hopOut / stretch
  const overlap = Math.min(hopOut, Math.max(64, Math.round(sampleRate * 0.012)))
  const seek = Math.max(16, Math.round(sampleRate * 0.012))

  const mid = mixMono(channels)
  const win = hannPeriodic(grain)

  // Start half a grain early so output [0 .. target) is 100 % covered with no edge dip or trailing zeros
  const inPositions: number[] = []
  const outStarts: number[] = []
  let ip = 0
  for (let op = 0; op < target; op += hopOut) {
    outStarts.push(op)
    inPositions.push(Math.min(inputLen - grain, Math.max(0, ip)))
    ip += hopIn
  }

  const outCap = (outStarts[outStarts.length - 1] ?? 0) + grain
  const outs = channels.map(() => new Float32Array(outCap))
  const norm = new Float32Array(outCap)

  let prev = -1
  for (let g = 0; g < inPositions.length; g++) {
    const expected = inPositions[g]
    const start = bestOffset(mid, prev, expected, grain, hopOut, overlap, seek)
    prev = start
    const outStart = outStarts[g]
    for (let i = 0; i < grain; i++) {
      const oi = outStart + i
      const si = start + i
      if (si >= inputLen) break
      const w = win[i]
      for (let c = 0; c < channels.length; c++) {
        outs[c][oi] += channels[c][si] * w
      }
      norm[oi] += w
    }
    if (onProgress && g % 32 === 0) onProgress(g / inPositions.length)
  }

  for (let i = 0; i < target; i++) {
    const n = norm[i]
    if (n > 1e-4) {
      const invN = 1 / n
      for (let c = 0; c < outs.length; c++) outs[c][i] *= invN
    }
  }

  return outs.map((ch) => ch.slice(0, target))
}

export function pitchShiftChannels(
  channels: Float32Array[],
  sampleRate: number,
  ratio: number,
  preserveTempo: boolean,
  onProgress?: (p: number) => void,
): Float32Array[] {
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 1e-6) {
    onProgress?.(1)
    return channels.map((c) => c.slice())
  }

  onProgress?.(0.05)
  const resampled = channels.map((ch) => resampleChannel(ch, sampleRate, ratio))
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
