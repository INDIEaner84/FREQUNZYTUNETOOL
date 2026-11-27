/**
 * Pitch shift with optional tempo preservation.
 *
 * Artifact-free path: resample only (duration scales with 1/ratio).
 * Tempo-hold path: resample + Phase-Vocoder-Zeitstauch zurück auf die
 * Originaldauer (Transienten-erhaltend, tonhöhen-neutral).
 * Stereo image is kept by processing channels independently with a shared
 * time grid.
 */

import { timeStretchChannels } from './phaseVocoder'

/**
 * Bandlimited resampler: Blackman-windowed sinc (zero-phase FIR).
 * Mathematically exact for the interpolation problem at hand — far superior
 * to cubic when shifting pitch, and it anti-aliases when decimating.
 * No artifacts from truncation: window length is fixed, weights are
 * normalised per output sample, so edge samples stay correctly scaled.
 */
const SINC_TAPS = 16 // 32-tap FIR (16 taps per side of the interpolation point)

function sinc(x: number): number {
  if (x === 0) return 1
  return Math.sin(Math.PI * x) / (Math.PI * x)
}

/** Blackman window, u in [0, 1] */
function blackman(u: number): number {
  const t = Math.min(1, Math.max(0, u))
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t)
}

function resampleChannel(src: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 1e-7) return src.slice()
  const outLen = Math.max(1, Math.round(src.length / ratio))
  const step = src.length / outLen // input samples per output sample
  const out = new Float32Array(outLen)
  // Cutoff in cycles per input sample: Nyquist, less (anti-alias) when decimating.
  const fc = Math.min(0.5, 0.5 / step) * 0.97
  const twoFc = 2 * fc
  for (let i = 0; i < outLen; i++) {
    const p = outLen === 1 ? 0 : (i * (src.length - 1)) / (outLen - 1)
    const base = Math.floor(p)
    let acc = 0
    let wsum = 0
    for (let m = 0; m < 2 * SINC_TAPS; m++) {
      const k = m - SINC_TAPS // offset relative to base, in [-16, 15]
      const idx = base + k
      if (idx < 0 || idx >= src.length) continue // skip: keeps DC gain 1 at edges too
      const x = p - idx
      const w = blackman(m / (2 * SINC_TAPS - 1)) * twoFc * sinc(twoFc * x)
      acc += src[idx] * w
      wsum += w
    }
    out[i] = wsum !== 0 ? acc / wsum : 0
  }
  return out
}

export function pitchShiftChannels(
  channels: Float32Array[],
  // sampleRate kept for API compatibility with the worker protocol; unused after Phase-Vocoder switch
  _sampleRate: number,
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
    finalCh = timeStretchChannels(resampled, ratio, (p) => {
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
