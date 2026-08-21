/**
 * Simplified ITU-R BS.1770 / EBU R128 integrated loudness + true-peak limiter.
 */

type BQ = { b0: number; b1: number; b2: number; a1: number; a2: number }

function designHighShelf(fs: number, f0: number, gainDb: number): BQ {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const S = 1
  const alpha = (sin / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2)
  const b0 = A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha)
  const b1 = -2 * A * (A - 1 + (A + 1) * cos)
  const b2 = A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha)
  const a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha
  const a1 = 2 * (A - 1 - (A + 1) * cos)
  const a2 = A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function designHighpass(fs: number, f0: number): BQ {
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * 0.707)
  const b0 = (1 + cos) / 2
  const b1 = -(1 + cos)
  const b2 = (1 + cos) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
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

export type LoudnessReport = {
  lufs: number
  truePeakDb: number
}

export function measureLoudnessChannels(channels: Float32Array[], sampleRate: number): LoudnessReport {
  const pre = designHighShelf(sampleRate, 1500, 4)
  const hip = designHighpass(sampleRate, 38)
  const gated: number[] = []
  const block = Math.max(1, Math.round(sampleRate * 0.4))
  const hop = Math.max(1, Math.round(block * 0.25))
  const weighted = channels.map((ch) => applyBQ(applyBQ(ch, pre), hip))
  const n = channels[0]?.length ?? 0
  const chans = channels.length || 1

  for (let s = 0; s + block < n; s += hop) {
    let acc = 0
    for (let c = 0; c < chans; c++) {
      const d = weighted[c]
      let e = 0
      for (let i = 0; i < block; i++) e += d[s + i] * d[s + i]
      acc += e / block
    }
    const mean = acc / chans
    const lufs = -0.691 + 10 * Math.log10(mean + 1e-12)
    if (lufs > -70) gated.push(mean)
  }

  let integrated = -70
  if (gated.length) {
    const ungatedMean = gated.reduce((a, b) => a + b, 0) / gated.length
    const rel = -0.691 + 10 * Math.log10(ungatedMean + 1e-12) - 10
    const relLin = Math.pow(10, (rel + 0.691) / 10)
    const passed = gated.filter((m) => m > relLin)
    const use = passed.length ? passed : gated
    const m = use.reduce((a, b) => a + b, 0) / use.length
    integrated = -0.691 + 10 * Math.log10(m + 1e-12)
  }

  return { lufs: integrated, truePeakDb: truePeakChannels(channels) }
}

export function measureLoudness(buffer: AudioBuffer): LoudnessReport {
  const channels = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c))
  return measureLoudnessChannels(channels, buffer.sampleRate)
}

function truePeakChannels(channels: Float32Array[]): number {
  let peak = 0
  const n = channels[0]?.length ?? 0
  for (const d of channels) {
    for (let i = 0; i < n - 1; i++) {
      const a = d[i]
      const b = d[i + 1]
      const aa = Math.abs(a)
      const ab = Math.abs(b)
      if (aa > peak) peak = aa
      if (ab > peak) peak = ab
      const m1 = Math.abs(a * 0.75 + b * 0.25)
      const m2 = Math.abs(a * 0.5 + b * 0.5)
      const m3 = Math.abs(a * 0.25 + b * 0.75)
      if (m1 > peak) peak = m1
      if (m2 > peak) peak = m2
      if (m3 > peak) peak = m3
    }
  }
  if (peak < 1e-9) return -120
  return 20 * Math.log10(peak)
}

function applyGain(channels: Float32Array[], lin: number) {
  for (const d of channels) {
    for (let i = 0; i < d.length; i++) d[i] *= lin
  }
}

function limitChannels(channels: Float32Array[], sampleRate: number, ceilingDb: number) {
  const ceiling = Math.pow(10, ceilingDb / 20)
  const attack = Math.max(1, Math.round(sampleRate * 0.001))
  const release = Math.max(1, Math.round(sampleRate * 0.08))
  const n = channels[0]?.length ?? 0
  const env = new Float32Array(n)
  let g = 1
  for (let i = 0; i < n; i++) {
    let p = 0
    for (const ch of channels) {
      const a = Math.abs(ch[i])
      if (a > p) p = a
    }
    const needed = p > ceiling ? ceiling / p : 1
    if (needed < g) g += (needed - g) * Math.min(1, (1 / attack) * 8)
    else g += (needed - g) * (1 / release)
    env[i] = g
  }
  for (let i = 0; i < n; i++) {
    const look = env[Math.min(n - 1, i + attack)]
    for (const ch of channels) ch[i] *= look
  }
}

export function normalizeChannels(
  channels: Float32Array[],
  sampleRate: number,
  targetLufs: number,
  truePeakDb: number,
): LoudnessReport {
  const before = measureLoudnessChannels(channels, sampleRate)
  applyGain(channels, Math.pow(10, (targetLufs - before.lufs) / 20))
  limitChannels(channels, sampleRate, truePeakDb)
  return measureLoudnessChannels(channels, sampleRate)
}

export function normalizeToPlatform(
  buffer: AudioBuffer,
  targetLufs: number,
  truePeakDb: number,
): LoudnessReport {
  const channels = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c))
  return normalizeChannels(channels, buffer.sampleRate, targetLufs, truePeakDb)
}
