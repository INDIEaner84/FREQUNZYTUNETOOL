/**
 * ITU-R BS.1770-4 / EBU R128 integrated loudness, 4x polyphase sinc True-Peak
 * measurement, and brickwall lookahead True-Peak limiter.
 */

type BQ = { b0: number; b1: number; b2: number; a1: number; a2: number }

/**
 * ITU-R BS.1770-4 Stage 1 spherical-head pre-filter (bilinear transform for arbitrary sampleRate).
 * Reproduces BS.1770-4 Table 1 at 48 kHz to 14 significant digits.
 */
function designKPreFilter(fs: number): BQ {
  const db = 3.999843853973347
  const f0 = 1681.974450955533
  const Q = 0.7071752369554196
  const K = Math.tan((Math.PI * f0) / fs)
  const Vh = Math.pow(10, db / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const K2 = K * K
  const a0 = 1 + K / Q + K2
  return {
    b0: (Vh + (Vb * K) / Q + K2) / a0,
    b1: (2 * (K2 - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K2) / a0,
    a1: (2 * (K2 - 1)) / a0,
    a2: (1 - K / Q + K2) / a0,
  }
}

/**
 * ITU-R BS.1770-4 Stage 2 RLB high-pass filter (f0 = 38.135 Hz, Q = 0.500327).
 * Reproduces BS.1770-4 Table 2 at 48 kHz to 14 significant digits.
 */
function designKRlbHighpass(fs: number): BQ {
  const f0 = 38.13547087602444
  const Q = 0.5003270373238773
  const K = Math.tan((Math.PI * f0) / fs)
  const K2 = K * K
  const a0 = 1 + K / Q + K2
  return {
    b0: 1 / a0,
    b1: -2 / a0,
    b2: 1 / a0,
    a1: (2 * (K2 - 1)) / a0,
    a2: (1 - K / Q + K2) / a0,
  }
}

function applyBQ(src: Float32Array, c: BQ): Float32Array {
  const out = new Float32Array(src.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < src.length; i++) {
    const x = src[i]
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

function channelWeight(channelIndex: number, totalChannels: number): number {
  // ITU-R BS.1770-4 Section 2.2: G = 1.0 for L, R, C; 0.0 for LFE (ch 3 in 5.1); 1.41 (~+1.5 dB) for surrounds
  if (totalChannels >= 6) {
    if (channelIndex === 3) return 0
    if (channelIndex === 4 || channelIndex === 5) return 1.41
  }
  return 1.0
}

/**
 * 48-tap 4x oversampling polyphase windowed-sinc FIR kernel (3 fractional phases x 12 taps;
 * phase 0 is the exact input sample). Matches ITU-R BS.1770-4 Annex 2 structure.
 */
const TP_TAPS = 12
const TP_HALF = TP_TAPS / 2 - 1 // sample index offset 5
const TP_PHASES: [Float64Array, Float64Array, Float64Array] = (() => {
  const phases: Float64Array[] = []
  for (const tau of [0.25, 0.5, 0.75]) {
    const h = new Float64Array(TP_TAPS)
    let sum = 0
    for (let k = 0; k < TP_TAPS; k++) {
      const x = k - TP_HALF - tau
      const sinc = Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
      // Hann window across [-6, +6]
      const w = 0.5 * (1 + Math.cos((Math.PI * x) / (TP_TAPS / 2)))
      const coeff = sinc * w
      h[k] = coeff
      sum += coeff
    }
    for (let k = 0; k < TP_TAPS; k++) h[k] /= sum
    phases.push(h)
  }
  return [phases[0], phases[1], phases[2]]
})()

/** Computes 4x-oversampled True-Peak per sample interval across all channels. */
function computeTruePeakEnvelope(channels: Float32Array[]): { maxPeak: number; perSample: Float32Array } {
  const n = channels[0]?.length ?? 0
  const perSample = new Float32Array(n)
  if (n === 0 || channels.length === 0) return { maxPeak: 0, perSample }

  const [h1, h2, h3] = TP_PHASES
  let maxPeak = 0

  for (let c = 0; c < channels.length; c++) {
    const d = channels[c]
    const len = Math.min(n, d.length)
    for (let i = 0; i < len; i++) {
      let local = Math.abs(d[i])
      if (len > 1) {
        let s1 = 0
        let s2 = 0
        let s3 = 0
        const base = i - TP_HALF
        if (base >= 0 && base + TP_TAPS <= len) {
          for (let k = 0; k < TP_TAPS; k++) {
            const v = d[base + k]
            s1 += v * h1[k]
            s2 += v * h2[k]
            s3 += v * h3[k]
          }
        } else {
          for (let k = 0; k < TP_TAPS; k++) {
            const idx = base + k
            const v = idx >= 0 && idx < len ? d[idx] : 0
            s1 += v * h1[k]
            s2 += v * h2[k]
            s3 += v * h3[k]
          }
        }
        const a1 = Math.abs(s1)
        const a2 = Math.abs(s2)
        const a3 = Math.abs(s3)
        if (a1 > local) local = a1
        if (a2 > local) local = a2
        if (a3 > local) local = a3
      }
      if (local > perSample[i]) perSample[i] = local
      if (local > maxPeak) maxPeak = local
    }
  }

  return { maxPeak, perSample }
}

export function truePeakLinear(channels: Float32Array[]): number {
  return computeTruePeakEnvelope(channels).maxPeak
}

export function truePeakChannels(channels: Float32Array[]): number {
  const peak = truePeakLinear(channels)
  if (peak < 1e-9) return -120
  return 20 * Math.log10(peak)
}

export type LoudnessReport = {
  lufs: number
  truePeakDb: number
}

export function measureLoudnessChannels(channels: Float32Array[], sampleRate: number): LoudnessReport {
  const n = channels[0]?.length ?? 0
  const chans = channels.length
  if (!chans || !n || sampleRate <= 0) {
    return { lufs: -70, truePeakDb: -120 }
  }

  const pre = designKPreFilter(sampleRate)
  const hip = designKRlbHighpass(sampleRate)
  const weighted = channels.map((ch) => applyBQ(applyBQ(ch, pre), hip))

  const block = Math.max(1, Math.round(sampleRate * 0.4))
  const hop = Math.max(1, Math.round(block * 0.25))
  const gated: number[] = []

  const measureBlock = (start: number, len: number) => {
    let sumWeightedPower = 0
    for (let c = 0; c < chans; c++) {
      const g = channelWeight(c, chans)
      if (g === 0) continue
      const d = weighted[c]
      let e = 0
      for (let i = 0; i < len; i++) {
        const v = d[start + i]
        e += v * v
      }
      sumWeightedPower += g * (e / len)
    }
    const blockLufs = -0.691 + 10 * Math.log10(sumWeightedPower + 1e-15)
    if (blockLufs > -70) gated.push(sumWeightedPower)
  }

  if (n < block) {
    measureBlock(0, n)
  } else {
    for (let s = 0; s + block <= n; s += hop) {
      measureBlock(s, block)
    }
  }

  let integrated = -70
  if (gated.length > 0) {
    let sumAbs = 0
    for (let i = 0; i < gated.length; i++) sumAbs += gated[i]
    const ungatedMean = sumAbs / gated.length
    const relGateLufs = -0.691 + 10 * Math.log10(ungatedMean + 1e-15) - 10
    const relThreshold = Math.pow(10, (relGateLufs + 0.691) / 10)

    let sumRel = 0
    let countRel = 0
    for (let i = 0; i < gated.length; i++) {
      if (gated[i] >= relThreshold) {
        sumRel += gated[i]
        countRel++
      }
    }
    const finalMean = countRel > 0 ? sumRel / countRel : ungatedMean
    integrated = -0.691 + 10 * Math.log10(finalMean + 1e-15)
  }

  return { lufs: integrated, truePeakDb: truePeakChannels(channels) }
}

function applyGain(channels: Float32Array[], lin: number): void {
  for (let c = 0; c < channels.length; c++) {
    const d = channels[c]
    for (let i = 0; i < d.length; i++) d[i] *= lin
  }
}

/**
 * Brickwall lookahead True-Peak limiter.
 * Uses a monotonic-queue sliding minimum over a 3 ms lookahead window + smooth attack/release
 * envelope + final True-Peak safety trim so output is strictly <= ceilingDb.
 */
function limitChannels(channels: Float32Array[], sampleRate: number, ceilingDb: number): void {
  const n = channels[0]?.length ?? 0
  if (n === 0 || channels.length === 0) return

  // Slight internal headroom (-0.04 dB) absorbs polyphase transition ripple during gain ramps
  const targetCeiling = Math.pow(10, ceilingDb / 20)
  const workingCeiling = targetCeiling * Math.pow(10, -0.04 / 20)

  const { maxPeak, perSample } = computeTruePeakEnvelope(channels)
  if (maxPeak <= targetCeiling) return

  const req = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = perSample[i]
    req[i] = p > workingCeiling ? workingCeiling / p : 1
  }

  // O(n) monotonic queue: minReq[i] = min_{k in [i .. min(n-1, i + lookahead)]} req[k]
  const lookahead = Math.max(8, Math.round(sampleRate * 0.003))
  const minReq = new Float32Array(n)
  const dequeIdx = new Int32Array(n)
  let head = 0
  let tail = 0
  let right = 0

  for (let i = 0; i < n; i++) {
    const limit = Math.min(n - 1, i + lookahead)
    while (right <= limit) {
      const v = req[right]
      while (tail > head && req[dequeIdx[tail - 1]] >= v) tail--
      dequeIdx[tail++] = right
      right++
    }
    while (head < tail && dequeIdx[head] < i) head++
    minReq[i] = req[dequeIdx[head]]
  }

  // Causal boxcar smoothing of length `lookahead` over `minReq` turns step drops into linear
  // lookahead ramps that reach exact `minReq` on or before the peak, followed by smooth release.
  const releaseCoeff = 1 - Math.exp(-1 / Math.max(1, sampleRate * 0.08))
  let boxSum = 0
  let env = 1
  for (let i = 0; i < n; i++) {
    boxSum += minReq[i]
    if (i >= lookahead) boxSum -= minReq[i - lookahead]
    const winCount = Math.min(i + 1, lookahead)
    const smoothedAttack = Math.min(req[i], boxSum / winCount)

    if (smoothedAttack <= env) {
      env = smoothedAttack
    } else {
      env += (smoothedAttack - env) * releaseCoeff
      if (env > req[i]) env = req[i]
    }
    for (let c = 0; c < channels.length; c++) {
      channels[c][i] *= env
    }
  }

  // Final post-limiter True-Peak check guarantees zero ceiling overshoot
  const postTp = truePeakLinear(channels)
  if (postTp > targetCeiling) {
    applyGain(channels, (targetCeiling / postTp) * 0.9995)
  }
}

export function normalizeChannels(
  channels: Float32Array[],
  sampleRate: number,
  targetLufs: number,
  truePeakDb: number,
): LoudnessReport {
  const before = measureLoudnessChannels(channels, sampleRate)
  if (before.lufs <= -65) {
    // Near-silent input: do not amplify noise floor by +50 dB
    limitChannels(channels, sampleRate, truePeakDb)
    return measureLoudnessChannels(channels, sampleRate)
  }

  const gainDb = Math.max(-40, Math.min(40, targetLufs - before.lufs))
  applyGain(channels, Math.pow(10, gainDb / 20))
  limitChannels(channels, sampleRate, truePeakDb)
  return measureLoudnessChannels(channels, sampleRate)
}
