/**
 * Phase Vocoder — time-stretch ohne Tonhöhen-Versatz.
 *
 * Klassisches Verfahren: STFT mit fixer Analyse-Schrittweite (Ha),
 * synthetisiert mit Schrittweite Hs = Ha · (Dauer-Verhältnis). Die Phase wird
 * pro Bin relativ zum erwarteten Phasenschritt propagiert (Identity-Phase-
 * Vocoder), Transienten bleiben durch die Synthesefenster erhalten.
 *
 * Warum nicht WSOLA/SOLA: Korrelations-Kornplatzierung ist bei periodischem
 * Material (Haltetöne, Pads, Orgel) blind — jedes Vielfache der Periode hat
 * Korrelation ≈ 1, die Körner hüpfen zufällig ±½ Periode, der Output war
 * energieerhaltend, aber phasenzufällig (gemessen: 2 s 432 Hz Sinus,
 * kohärente Amplitudenmessung ≈ 0.01). Der Phase Vocoder hat dieses
 * Problem strukturell nicht.
 *
 * Komplexität: O(frames · N · log N) — unabhängig von der Tonhöhe,
 * sample-genaue Ausgabelänge.
 */

import { fft, hann } from './fft'

const FRAME = 2048
const ANALYSIS_HOP = 512

function principalArg(x: number): number {
  // auf (−π, π] wrappen
  while (x <= -Math.PI) x += 2 * Math.PI
  while (x > Math.PI) x -= 2 * Math.PI
  return x
}

function ifft(re: Float32Array, im: Float32Array): void {
  for (let i = 0; i < re.length; i++) im[i] = -im[i]
  fft(re, im)
  const n = re.length
  for (let i = 0; i < n; i++) {
    re[i] /= n
    im[i] = -im[i] / n
  }
}

export function timeStretchChannels(
  channels: Float32Array[],
  stretch: number,
  onProgress?: (p: number) => void,
): Float32Array[] {
  if (Math.abs(stretch - 1) < 1e-3) return channels.map((c) => c.slice())

  const inputLen = channels[0]?.length ?? 0
  if (inputLen === 0) return channels.map(() => new Float32Array(0))
  const outLen = Math.max(FRAME, Math.round(inputLen * stretch))
  // +2 Frames: deckt den Output-End-Rand auch bei Expansion (s > 1) ab,
  // Lesen über inputLen hinaus liefert dank ?? 0 Nullen → sauberes Ausschwingen.
  const totalFrames = Math.max(1, Math.floor((inputLen - FRAME) / ANALYSIS_HOP) + 3)

  const anaWin = hann(FRAME)
  const synWin = hann(FRAME)

  // Normalisierung: Summe der Synthesefenster² am jeweiligen Output-Index
  const norm = new Float32Array(outLen + FRAME)
  for (let f = 0; f < totalFrames; f++) {
    const outStart = Math.round(f * ANALYSIS_HOP * stretch)
    for (let i = 0; i < FRAME; i++) norm[outStart + i] += synWin[i] * synWin[i]
  }

  const outs = channels.map(() => new Float32Array(outLen + FRAME))

  const re = new Float32Array(FRAME)
  const im = new Float32Array(FRAME)
  const binFreq = (2 * Math.PI) / FRAME
  const expectedPhaseInc = ANALYSIS_HOP * binFreq

  // pro Kanal: vorherige Phase (Analyse) und Synthese-Phase
  for (let ch = 0; ch < channels.length; ch++) {
    const src = channels[ch]
    const dst = outs[ch]
    const prevPhase = new Float32Array(FRAME / 2 + 1)
    const synthPhase = new Float32Array(FRAME / 2 + 1)

    for (let f = 0; f < totalFrames; f++) {
      const inPos = f * ANALYSIS_HOP
      const outStart = Math.round(f * ANALYSIS_HOP * stretch)

      // Analyse-Frame laden (windowed)
      for (let i = 0; i < FRAME; i++) {
        re[i] = (src[inPos + i] ?? 0) * anaWin[i]
        im[i] = 0
      }
      fft(re, im)

      // Phase pro positiver Frequenz propagieren
      for (let k = 0; k <= FRAME / 2; k++) {
        const mag = Math.hypot(re[k], im[k])
        const phase = Math.atan2(im[k], re[k])
        const delta = principalArg(phase - prevPhase[k] - k * expectedPhaseInc)
        // tatsächliche Kreisfrequenz pro Sample
        const trueFreq = (k * expectedPhaseInc + delta) / ANALYSIS_HOP
        if (f === 0) {
          synthPhase[k] = phase
        } else {
          synthPhase[k] += trueFreq * ANALYSIS_HOP * stretch
        }
        prevPhase[k] = phase
        const sp = synthPhase[k]
        re[k] = mag * Math.cos(sp)
        im[k] = mag * Math.sin(sp)
      }
      // negative Frequenzen hermitesch ergänzen
      for (let k = 1; k < FRAME / 2; k++) {
        re[FRAME - k] = re[k]
        im[FRAME - k] = -im[k]
      }

      ifft(re, im)

      for (let i = 0; i < FRAME; i++) {
        dst[outStart + i] += re[i] * synWin[i]
      }
      if (onProgress && f % 64 === 0) onProgress(f / totalFrames)
    }
  }

  return channels.map((_, ch) => {
    const dst = outs[ch]
    const trimmed = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const n = norm[i]
      trimmed[i] = n > 1e-6 ? dst[i] / n : 0
    }
    return trimmed
  })
}
