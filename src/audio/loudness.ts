/**
 * ITU-R BS.1770-4 / EBU R128 integrated loudness + true peak.
 *
 * K-weighting nach ITU-R BS.1770-4 (B. De Man's exakte Biquad-Design-Gleichungen,
 * identisch zu pyloudnorm filter_class='DeMan'):
 *  - High-Shelf  f0 = 1681.9745 Hz, +3.9998 dB, Q = 0.70718  (K = tan(pi·f0/fs))
 *  - Highpass    f0 = 38.1355 Hz             Q = 0.50033
 * Gating: 400 ms Blöcke, 75 % Überlappung, absolutes Gate −70 LUFS,
 * relatives Gate −10 LU unter dem Mittel der absolut gegateten Blöcke.
 * Kanalgewichtung: L/R/C = 1.0 (kein LFE in dieser App). Keine Normalisierung
 * durch die Kanalzahl — die Summe der Gewichte IST die Kanalgewichtung.
 * Signale kürzer als 400 ms werden mit Nullen auf 400 ms aufgefüllt.
 *
 * True Peak: Max aus Sample-Peak und bandlimitiert (Blackman-sinc)
 * 4×-überabgetasteten Intersample-Spitzen in Kandidaten-Regionen.
 */

type BQ = { b0: number; b1: number; b2: number; a1: number; a2: number }

function highShelfDeMan(fs: number, f0: number, gainDb: number, q: number): BQ {
  const K = Math.tan((Math.PI * f0) / fs)
  const Vh = Math.pow(10, gainDb / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416) // ITU-Spezifikation: Exponent 0.499666774155
  const a0 = 1 + K / q + K * K
  const b0 = (Vh + (Vb * K) / q + K * K) / a0
  const b1 = (2 * (K * K - Vh)) / a0
  const b2 = (Vh - (Vb * K) / q + K * K) / a0
  const a1 = (2 * (K * K - 1)) / a0
  const a2 = (1 - K / q + K * K) / a0
  return { b0, b1, b2, a1, a2 }
}

function highpassDeMan(fs: number, f0: number, q: number): BQ {
  const K = Math.tan((Math.PI * f0) / fs)
  const norm = 1 + K / q + K * K
  const a1 = (2 * (K * K - 1)) / norm
  const a2 = (1 - K / q + K * K) / norm
  return { b0: 1, b1: -2, b2: 1, a1, a2 }
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
  const pre = highShelfDeMan(sampleRate, 1681.974450955533, 3.99984385397, 0.7071752369554196)
  const hip = highpassDeMan(sampleRate, 38.13547087602444, 0.5003270373253953)
  const gated: number[] = []
  const block = Math.max(1, Math.round(sampleRate * 0.4))
  const hop = Math.max(1, Math.round(block * 0.25))
  const weighted = channels.map((ch) => applyBQ(applyBQ(ch, pre), hip))
  let n = channels[0]?.length ?? 0
  // Kürzere Signale als ein 400-ms-Block werden mit Nullen aufgefüllt
  if (n < block) {
    for (let c = 0; c < weighted.length; c++) {
      const w = new Float32Array(block)
      w.set(weighted[c])
      weighted[c] = w
    }
    n = block
  }

  // BS.1770: Summe der (mit 1.0 gewichteten) Kanal-Energien, KEINE Division durch Kanalzahl
  for (let s = 0; s + block <= n; s += hop) {
    let acc = 0
    for (let c = 0; c < channels.length; c++) {
      const d = weighted[c]
      let e = 0
      for (let i = 0; i < block; i++) e += d[s + i] * d[s + i]
      acc += e / block // Kanalgewicht 1.0 für L/R/C (kein LFE in dieser App)
    }
    const mean = acc
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

/** Blackman-windowed sinc interpolation (bandlimited) for true-peak estimation. */
function sinc(x: number): number {
  if (x === 0) return 1
  return Math.sin(Math.PI * x) / (Math.PI * x)
}

function blackman(u: number): number {
  const t = Math.min(1, Math.max(0, u))
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t)
}

const TP_TAPS = 16

function sincAt(src: Float32Array, pos: number): number {
  const base = Math.floor(pos)
  let acc = 0
  let wsum = 0
  for (let m = -TP_TAPS; m <= TP_TAPS; m++) {
    const idx = base + m
    if (idx < 0 || idx >= src.length) continue
    const x = pos - idx
    const w = blackman((m + TP_TAPS) / (2 * TP_TAPS)) * sinc(x)
    acc += src[idx] * w
    wsum += w
  }
  return wsum !== 0 ? acc / wsum : 0
}

/**
 * True Peak nach BS.1770: Maximum des bandlimitierten (≈4× überabgetasteten)
 * Signals. Zwei-Pass: Sample-Peak finden, dann nur Kandidaten innerhalb
 * ~4 dB darunter mit Sinc-Interpolation zwischen den 3 Intersample-Positionen
 * belegen — praktisch exakt, aber ohne volles 4×-Resampling.
 */
function truePeakChannels(channels: Float32Array[]): number {
  let sampPeak = 0
  for (const d of channels) {
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > sampPeak) sampPeak = a
    }
  }
  if (sampPeak < 1e-9) return -120

  let peak = sampPeak
  const thresh = sampPeak / 1.6 // ≈ −4.1 dB unter dem Sample-Peak
  for (const d of channels) {
    for (let i = 0; i < d.length; i++) {
      if (Math.abs(d[i]) < thresh) continue
      for (const off of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) {
        const p = i + off
        if (p < 0 || p >= d.length - 1) continue
        const v = Math.abs(sincAt(d, p))
        if (v > peak) peak = v
      }
    }
  }
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
