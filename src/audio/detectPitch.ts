import { fft, hann } from './fft'
import { nearestPreset, type PitchPreset } from './frequencies'
import { mixMono } from './raw'

export type TuningCandidate = {
  hz: number
  score: number
  label: string
}

export type AnalysisResult = {
  hz: number
  confidence: number
  centsFrom440: number
  nearest: PitchPreset | null
  candidates: TuningCandidate[]
  duration: number
  sampleRate: number
  channels: number
  peakDb: number
  key: string | null
  keyConfidence: number
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
const MAJOR_NAMES = ['C-Dur', 'Cis-Dur', 'D-Dur', 'Es-Dur', 'E-Dur', 'F-Dur', 'Fis-Dur', 'G-Dur', 'As-Dur', 'A-Dur', 'B-Dur', 'H-Dur']
const MINOR_NAMES = ['c-Moll', 'cis-Moll', 'd-Moll', 'es-Moll', 'e-Moll', 'f-Moll', 'fis-Moll', 'g-Moll', 'as-Moll', 'a-Moll', 'b-Moll', 'h-Moll']

function peakDb(mono: Float32Array): number {
  let m = 0
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i])
    if (a > m) m = a
  }
  if (m < 1e-9) return -120
  return 20 * Math.log10(m)
}

function correlate(chroma: Float64Array, profile: number[], shift: number): number {
  let dot = 0
  let n0 = 0
  let n1 = 0
  for (let i = 0; i < 12; i++) {
    const a = chroma[i]
    const b = profile[(i - shift + 12) % 12]
    dot += a * b
    n0 += a * a
    n1 += b * b
  }
  return dot / (Math.sqrt(n0 * n1) + 1e-12)
}

function estimateKey(chroma: Float64Array): { key: string | null; keyConfidence: number } {
  let best = -Infinity
  let second = -Infinity
  let name: string | null = null
  for (let s = 0; s < 12; s++) {
    const maj = correlate(chroma, MAJOR_PROFILE, s)
    const min = correlate(chroma, MINOR_PROFILE, s)
    if (maj > best) {
      second = best
      best = maj
      name = MAJOR_NAMES[s]
    } else if (maj > second) second = maj
    if (min > best) {
      second = best
      best = min
      name = MINOR_NAMES[s]
    } else if (min > second) second = min
  }
  const conf = best <= 0 ? 0 : Math.max(0, Math.min(1, (best - second) * 2.2))
  return { key: name, keyConfidence: conf }
}

export async function detectConcertPitchFromChannels(
  channels: Float32Array[],
  sampleRate: number,
  onProgress?: (p: number) => void,
  cooperative = false,
): Promise<AnalysisResult> {
  const mono = mixMono(channels)
  const duration = mono.length / sampleRate
  const peak = peakDb(mono)

  const fftSize = 8192
  const window = hann(fftSize)
  const hop = 4096
  const minHz = 70
  const maxHz = 1400
  const minBin = Math.max(1, Math.floor((minHz * fftSize) / sampleRate))
  const maxBin = Math.min(fftSize / 2 - 2, Math.ceil((maxHz * fftSize) / sampleRate))

  const centsBins = 240
  const hist = new Float64Array(centsBins)
  const chroma = new Float64Array(12)
  const wrap = (cents: number) => {
    let x = cents % 100
    if (x < 0) x += 100
    return x
  }

  const starts: number[] = []
  if (mono.length <= fftSize) {
    starts.push(0)
  } else if (duration <= 12) {
    for (let s = 0; s + fftSize < mono.length; s += hop) starts.push(s)
  } else {
    const regions = [0.18, 0.4, 0.62, 0.8]
    const regionLen = Math.min(Math.floor(10 * sampleRate), Math.floor(mono.length / 5))
    for (const r of regions) {
      const origin = Math.min(
        Math.max(0, Math.floor(r * mono.length) - Math.floor(regionLen / 2)),
        Math.max(0, mono.length - regionLen),
      )
      for (let s = origin; s + fftSize < origin + regionLen; s += hop) starts.push(s)
    }
  }

  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)
  let frames = 0

  for (let fi = 0; fi < starts.length; fi++) {
    const s = starts[fi]
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < fftSize; i++) {
      const idx = s + i
      re[i] = (idx < mono.length ? mono[idx] : 0) * window[i]
    }
    fft(re, im)

    const mag: number[] = []
    for (let k = minBin; k <= maxBin; k++) mag[k] = re[k] * re[k] + im[k] * im[k]

    let frameMax = 0
    for (let k = minBin; k <= maxBin; k++) if (mag[k] > frameMax) frameMax = mag[k]
    if (frameMax < 1e-12) continue

    const thresh = frameMax * 0.04
    for (let k = minBin + 1; k < maxBin; k++) {
      const v = mag[k]
      if (v < thresh || v < mag[k - 1] || v < mag[k + 1]) continue
      const alpha = mag[k - 1]
      const beta = v
      const gamma = mag[k + 1]
      const denom = alpha - 2 * beta + gamma
      const delta = denom === 0 ? 0 : (0.5 * (alpha - gamma)) / denom
      const bin = k + delta
      const freq = (bin * sampleRate) / fftSize
      if (freq < minHz || freq > maxHz) continue

      const midi = 69 + 12 * Math.log2(freq / 440)
      const nearest = Math.round(midi)
      const centsOff = (midi - nearest) * 100
      const wrapped = wrap(centsOff + 50)
      const idx = Math.min(centsBins - 1, Math.floor((wrapped / 100) * centsBins))
      const wmag = Math.sqrt(v)
      hist[idx] += wmag
      chroma[((nearest % 12) + 12) % 12] += wmag
    }

    frames++
    if (onProgress && fi % 8 === 0) {
      onProgress(0.15 + (0.7 * fi) / starts.length)
      if (cooperative) await new Promise((r) => setTimeout(r, 0))
    }
  }

  onProgress?.(0.9)

  const kernel = [0.05, 0.15, 0.6, 0.15, 0.05]
  const smooth = new Float64Array(centsBins)
  for (let i = 0; i < centsBins; i++) {
    let acc = 0
    for (let k = -2; k <= 2; k++) {
      const j = (i + k + centsBins) % centsBins
      acc += hist[j] * kernel[k + 2]
    }
    smooth[i] = acc
  }

  let maxVal = 0
  let maxIdx = 0
  let sum = 0
  for (let i = 0; i < centsBins; i++) {
    sum += smooth[i]
    if (smooth[i] > maxVal) {
      maxVal = smooth[i]
      maxIdx = i
    }
  }

  const prev = smooth[(maxIdx - 1 + centsBins) % centsBins]
  const next = smooth[(maxIdx + 1) % centsBins]
  const denom = prev - 2 * maxVal + next
  const d = denom === 0 ? 0 : (0.5 * (prev - next)) / denom
  const peakFrac = (maxIdx + d + 0.5) / centsBins
  let centsWrapped = peakFrac * 100 - 50
  if (centsWrapped > 50) centsWrapped -= 100
  if (centsWrapped < -50) centsWrapped += 100

  const detectedHz = 440 * Math.pow(2, centsWrapped / 1200)
  const mean = sum / centsBins
  const confidence =
    frames < 4 || mean <= 0 ? 0 : Math.max(0, Math.min(1, (maxVal / (mean * 8 + maxVal)) * 1.25))

  const known = [415, 421.6, 430.54, 432, 435, 440, 441, 442, 443, 444, 446, 452, 528]
  const candidates: TuningCandidate[] = known
    .map((hz) => {
      const cents = 1200 * Math.log2(hz / 440)
      let diff = Math.abs(cents - centsWrapped)
      if (diff > 50) diff = 100 - diff
      const score = Math.exp(-((diff / 6) ** 2))
      const preset = nearestPreset(hz)
      return {
        hz,
        score,
        label: preset ? `${preset.name} · ${hz} Hz` : `${hz} Hz`,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  const keying = estimateKey(chroma)
  onProgress?.(1)

  return {
    hz: detectedHz,
    confidence,
    centsFrom440: centsWrapped,
    nearest: nearestPreset(detectedHz),
    candidates,
    duration,
    sampleRate,
    channels: channels.length,
    peakDb: peak,
    key: keying.key,
    keyConfidence: keying.keyConfidence,
  }
}

export async function detectConcertPitch(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): Promise<AnalysisResult> {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c))
  return detectConcertPitchFromChannels(channels, buffer.sampleRate, onProgress, true)
}
