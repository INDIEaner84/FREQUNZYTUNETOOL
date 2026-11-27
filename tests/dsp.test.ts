import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  CONCERT_PRESETS,
  SOLFEGGIO_PRESETS,
  computePitchRatio,
  detectConcertPitchFromChannels,
  encodeWavBytes,
  exactPreset,
  fft,
  formatTime,
  hann,
  hannPeriodic,
  hzToCents,
  measureLoudnessChannels,
  mixMono,
  nearestPreset,
  normalizeChannels,
  noteFreqAtA4,
  peakDbfs,
  pitchShiftChannels,
  safeStem,
  truePeakChannels,
} from '../src/audio/index'

function makeTestChord(a4: number, sr = 44100, dur = 5): [Float32Array, Float32Array] {
  const n = Math.floor(sr * dur)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const env = Math.min(1, t * 8) * Math.min(1, (dur - t) * 8)
    const s =
      (Math.sin(2 * Math.PI * a4 * t) * 0.28 +
        Math.sin(2 * Math.PI * a4 * Math.pow(2, 4 / 12) * t) * 0.16 +
        Math.sin(2 * Math.PI * a4 * Math.pow(2, 7 / 12) * t) * 0.14 +
        Math.sin(2 * Math.PI * (a4 / 2) * t) * 0.1) *
      env
    left[i] = s
    right[i] = s
  }
  return [left, right]
}

describe('FFT & Fensterfunktionen (src/audio/fft.ts)', () => {
  it('prüft Zweierpotenz und gleiche Array-Länge', () => {
    assert.throws(() => fft(new Float32Array(0), new Float32Array(0)), RangeError)
    assert.throws(() => fft(new Float32Array(100), new Float32Array(100)), RangeError)
    assert.throws(() => fft(new Float32Array(64), new Float32Array(32)), RangeError)
  })

  it('erfüllt den Satz von Parseval und findet die exakte Bin-Frequenz', () => {
    const n = 1024
    const bin = 37
    const re = new Float32Array(n)
    const im = new Float32Array(n)
    let timeEnergy = 0
    for (let i = 0; i < n; i++) {
      const v = Math.cos((2 * Math.PI * bin * i) / n)
      re[i] = v
      timeEnergy += v * v
    }
    fft(re, im)

    let freqEnergy = 0
    let maxBin = 0
    let maxPower = 0
    for (let k = 0; k < n; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      freqEnergy += p
      if (k < n / 2 && p > maxPower) {
        maxPower = p
        maxBin = k
      }
    }
    assert.equal(maxBin, bin)
    assert.ok(Math.abs(freqEnergy / n - timeEnergy) < 1e-3, 'Parseval-Energie bleibt erhalten')
  })

  it('erfüllt bei hannPeriodic exakt Constant Overlap-Add (COLA = 1.0) bei 50 % Überlappung', () => {
    const n = 512
    const half = n >> 1
    const w = hannPeriodic(n)
    for (let i = 0; i < half; i++) {
      assert.ok(Math.abs(w[i] + w[i + half] - 1) < 1e-6)
    }
    assert.equal(hann(0).length, 0)
    assert.equal(hann(1)[0], 1)
  })
})

describe('Mehrkanal-Pegel & Downmix (src/audio/raw.ts)', () => {
  it('meldet den echten Sample-Peak auch bei hart gepanntem oder gegenphasigem Stereo', () => {
    const n = 4096
    const left = new Float32Array(n)
    const zero = new Float32Array(n)
    const anti = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const s = 0.9 * Math.sin((2 * Math.PI * 440 * i) / 44100)
      left[i] = s
      anti[i] = -s
    }
    const expectedDb = 20 * Math.log10(0.9)
    assert.ok(Math.abs(peakDbfs([left, zero]) - expectedDb) < 0.02)
    assert.ok(Math.abs(peakDbfs([left, anti]) - expectedDb) < 0.02)
    assert.ok(Math.abs(mixMono([left, anti]).reduce((a, b) => a + Math.abs(b), 0)) < 1e-5)
  })
})

describe('Kammerton- & Tonart-Erkennung (src/audio/detectPitch.ts)', () => {
  it('erkennt den eingebauten 440-Hz-A-Dur-Testton auf < 0,35 Cent genau mit Top-Kandidat 440 Hz', async () => {
    const ch = makeTestChord(440, 44100, 5)
    const res = await detectConcertPitchFromChannels(ch, 44100)
    const errCents = Math.abs(hzToCents(440, res.hz))
    assert.ok(errCents < 0.35, `Erwartet < 0.35 ct Fehler, gemessen: ${errCents.toFixed(3)} ct (${res.hz.toFixed(2)} Hz)`)
    assert.equal(res.candidates[0]?.hz, 440)
    assert.equal(res.candidates[0]?.label, 'ISO 16 · 440 Hz')
    assert.equal(res.key, 'A-Dur')
    assert.ok(res.confidence > 0.7)
  })

  it('erkennt 432 Hz präzise über alle Abtastraten inkl. 96 kHz und 192 kHz Hi-Res', async () => {
    for (const sr of [44100, 48000, 96000, 192000]) {
      const ch = makeTestChord(432, sr, 4)
      const res = await detectConcertPitchFromChannels(ch, sr)
      const errCents = Math.abs(hzToCents(432, res.hz))
      assert.ok(
        errCents < 0.5,
        `Sample-Rate ${sr} Hz: erwartet < 0.5 ct, gemessen ${errCents.toFixed(3)} ct (${res.hz.toFixed(2)} Hz)`,
      )
      assert.equal(res.candidates[0]?.hz, 432)
      assert.equal(res.key, 'A-Dur')
    }
  })

  it('beschriftet Nicht-Preset-Kandidaten (441 Hz, 443 Hz) nicht fälschlich als ISO 16 oder Orchester', async () => {
    const ch = makeTestChord(441, 48000, 3)
    const res = await detectConcertPitchFromChannels(ch, 48000)
    const cand441 = res.candidates.find((c) => c.hz === 441)
    assert.ok(cand441)
    assert.equal(cand441.label, '441 Hz')
    assert.equal(exactPreset(441), null)
    assert.equal(nearestPreset(440.4)?.name, 'ISO 16')
  })
})

describe('Pitch-Shift & WSOLA (src/audio/pitchShift.ts)', () => {
  it('hält bei 440 -> 432 Hz die exakte Länge ohne Null-Stille am Ende und stimmt präzise auf 432 Hz', async () => {
    const sr = 44100
    const ch = makeTestChord(440, sr, 3)
    const ratio = 432 / 440
    const shifted = pitchShiftChannels(ch, sr, ratio, true)

    assert.equal(shifted.length, 2)
    assert.equal(shifted[0].length, ch[0].length)

    // Prüfe auf einem durchgehenden Sinus, dass am Ende keine Null-Stille entsteht und AM minimal bleibt
    const sine = new Float32Array(sr * 2)
    for (let i = 0; i < sine.length; i++) sine[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / sr)
    const [sineOut] = pitchShiftChannels([sine], sr, ratio, true)

    let trailingZeros = 0
    for (let i = sineOut.length - 1; i >= 0 && Math.abs(sineOut[i]) < 1e-7; i--) trailingZeros++
    assert.ok(trailingZeros <= 2, `Keine abgeschnittene Stille am Ende (trailingZeros=${trailingZeros})`)

    let minRms = Infinity
    let maxRms = 0
    const win = 441
    for (let s = Math.floor(sr * 0.3); s + win < Math.floor(sr * 1.7); s += 110) {
      let e = 0
      for (let i = 0; i < win; i++) e += sineOut[s + i] * sineOut[s + i]
      const rms = Math.sqrt(e / win)
      if (rms < minRms) minRms = rms
      if (rms > maxRms) maxRms = rms
    }
    const amDb = 20 * Math.log10(maxRms / Math.max(1e-6, minRms))
    assert.ok(amDb < 0.35, `WSOLA-Amplitudenmodulation muss gering sein (< 0.35 dB, gemessen ${amDb.toFixed(3)} dB)`)

    const detectedAfter = await detectConcertPitchFromChannels(shifted, sr)
    assert.ok(Math.abs(hzToCents(432, detectedAfter.hz)) < 0.8)
  })

  it('unterdrückt Spiegelfrequenzen (Aliasing) beim Hochstimmen über die Nyquist-Grenze', () => {
    const sr = 44100
    const src = new Float32Array(sr)
    // 19,5 kHz * 1,2 = 23,4 kHz (> 22,05 kHz Nyquist)
    for (let i = 0; i < src.length; i++) {
      src[i] = 0.5 * Math.sin((2 * Math.PI * 19500 * i) / sr)
    }
    const [out] = pitchShiftChannels([src], sr, 1.2, false)
    let e = 0
    const margin = 500
    for (let i = margin; i < out.length - margin; i++) e += out[i] * out[i]
    const rmsDb = 10 * Math.log10(e / (out.length - 2 * margin) + 1e-15)
    assert.ok(rmsDb < -30, `Aliasing-Energie muss stark gedämpft sein (< -30 dBFS, gemessen ${rmsDb.toFixed(2)} dBFS)`)
  })
})

describe('ITU-R BS.1770-4 Lautheit, True-Peak & Limiter (src/audio/loudness.ts)', () => {
  it('misst Mono (-3,01 LUFS) und Stereo (0,00 LUFS) normkonform mit +3,01 LU Differenz', () => {
    const sr = 48000
    const sine = new Float32Array(sr * 4)
    for (let i = 0; i < sine.length; i++) {
      sine[i] = Math.sin((2 * Math.PI * 997 * i) / sr)
    }
    const mono = measureLoudnessChannels([sine], sr)
    const stereo = measureLoudnessChannels([sine, sine], sr)

    assert.ok(Math.abs(mono.lufs - -3.01) < 0.08, `Mono LUFS erwartet ~-3.01, gemessen ${mono.lufs.toFixed(3)}`)
    assert.ok(Math.abs(stereo.lufs - 0.0) < 0.08, `Stereo LUFS erwartet ~0.00, gemessen ${stereo.lufs.toFixed(3)}`)
    assert.ok(Math.abs(stereo.lufs - mono.lufs - 3.0103) < 0.02)
  })

  it('erkennt echte Inter-Sample-True-Peaks (+3,01 dB über Sample-Peak bei Fs/4 45°-Kosinus nach EBU Tech 3341)', () => {
    const n = 4800
    const fade = 128
    const isp = new Float32Array(n)
    let maxSample = 0
    for (let i = 0; i < n; i++) {
      const rampIn = i < fade ? 0.5 * (1 - Math.cos((Math.PI * i) / fade)) : 1
      const rampOut = n - 1 - i < fade ? 0.5 * (1 - Math.cos((Math.PI * (n - 1 - i)) / fade)) : 1
      const s = Math.cos(Math.PI * 0.5 * i + Math.PI / 4) * rampIn * rampOut
      isp[i] = s
      if (Math.abs(s) > maxSample) maxSample = Math.abs(s)
    }
    const samplePeakDb = 20 * Math.log10(maxSample)
    const tpDb = truePeakChannels([isp])
    assert.ok(Math.abs(samplePeakDb - -3.0103) < 0.02, `Sample-Peak ist -3.01 dBFS (${samplePeakDb.toFixed(2)})`)
    assert.ok(Math.abs(tpDb - 0.0) < 0.08, `True-Peak erwartet ~0.00 dBTP, gemessen ${tpDb.toFixed(3)} dBTP`)
  })

  it('hält beim Plattform-Mastering (Spotify -1 dBTP, Amazon -2 dBTP) die True-Peak-Decke garantiert ein', () => {
    const sr = 48000
    const n = sr * 4
    for (const [targetLufs, ceilingDb] of [
      [-14, -1.0],
      [-14, -2.0],
    ] as const) {
      const left = new Float32Array(n)
      const right = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const t = i / sr
        let s = 0.05 * Math.sin(2 * Math.PI * 220 * t)
        const k = i % 24000
        if (k < 200) {
          s += 0.75 * Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-k / 40)
        }
        left[i] = s
        right[i] = s
      }
      const report = normalizeChannels([left, right], sr, targetLufs, ceilingDb)
      assert.ok(
        report.truePeakDb <= ceilingDb + 0.02,
        `True-Peak (${report.truePeakDb.toFixed(3)} dBTP) darf Ceiling (${ceilingDb} dBTP) nicht überschreiten`,
      )
    }
  })

  it('verarbeitet kurze Clips (< 400 ms) und verstärkt Stille nicht ins Rauschen', () => {
    const sr = 48000
    const shortClip = new Float32Array(Math.floor(sr * 0.15))
    for (let i = 0; i < shortClip.length; i++) {
      shortClip[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / sr)
    }
    const shortRep = measureLoudnessChannels([shortClip], sr)
    assert.ok(shortRep.lufs > -12 && shortRep.lufs < -8)

    const silent = new Float32Array(sr)
    silent.fill(1e-7)
    const afterSilent = normalizeChannels([silent], sr, -14, -1)
    assert.ok(afterSilent.truePeakDb < -100)
  })
})

describe('WAV-Encoder & Hilfsfunktionen (src/audio/exportWav.ts & frequencies.ts)', () => {
  it('schreibt gültige 24-Bit- und 16-Bit-RIFF/WAVE-Header und rekonstruiert Samples exakt', () => {
    const sr = 48000
    const left = new Float32Array([0, 0.5, -0.5, 0.999, -0.999])
    const right = new Float32Array([0.25, -0.25, 0, -0.75, 0.75])

    const buf24 = encodeWavBytes([left, right], sr, 24)
    assert.equal(buf24.byteLength, 44 + 5 * 2 * 3)
    const view24 = new DataView(buf24)
    assert.equal(String.fromCharCode(view24.getUint8(0), view24.getUint8(1), view24.getUint8(2), view24.getUint8(3)), 'RIFF')
    assert.equal(view24.getUint16(22, true), 2)
    assert.equal(view24.getUint32(24, true), sr)
    assert.equal(view24.getUint16(34, true), 24)

    // Sample 1 Left = +0.5 -> ~4194304
    const b0 = view24.getUint8(44 + 6)
    const b1 = view24.getUint8(44 + 7)
    const b2 = view24.getUint8(44 + 8)
    const raw24 = ((b2 << 24) | (b1 << 16) | (b0 << 8)) >> 8
    assert.ok(Math.abs(raw24 / 8388607 - 0.5) < 1e-6)

    const buf16 = encodeWavBytes([left, right], sr, 16)
    assert.equal(buf16.byteLength, 44 + 5 * 2 * 2)
    assert.throws(() => encodeWavBytes([], sr, 24), RangeError)
  })

  it('berechnet Solfeggio-Verhältnisse und Notenfrequenzen korrekt (inkl. # und b)', () => {
    assert.ok(Math.abs(noteFreqAtA4('A4', 440) - 440) < 1e-9)
    assert.ok(Math.abs(noteFreqAtA4('Bb4', 440) - noteFreqAtA4('A#4', 440)) < 1e-9)

    // Solfeggio C5 = 528 Hz auf 440-Hz-Quelle entspricht A4 = 443.99 Hz (+15.64 ct)
    const r528 = computePitchRatio(440, 528, 'solfeggio', 'C5')
    assert.ok(Math.abs(hzToCents(440, 440 * r528) - 15.64) < 0.02)

    assert.equal(CONCERT_PRESETS.length, 9)
    assert.equal(SOLFEGGIO_PRESETS.length, 9)
    assert.equal(safeStem('Mein Stück (2026).flac'), 'Mein_Stück_2026_')
    assert.equal(formatTime(125.9), '2:05')
  })
})
