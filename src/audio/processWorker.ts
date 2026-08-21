/// <reference lib="webworker" />

import { detectConcertPitchFromChannels } from './detectPitch'
import { pitchShiftChannels } from './pitchShift'
import { measureLoudnessChannels, normalizeChannels } from './loudness'

type AnalyzeMsg = {
  type: 'analyze'
  id: number
  sampleRate: number
  channels: Float32Array[]
}

type ProcessMsg = {
  type: 'process'
  id: number
  sampleRate: number
  channels: Float32Array[]
  ratio: number
  preserveTempo: boolean
  lufs: number | null
  truePeak: number | null
}

type InMsg = AnalyzeMsg | ProcessMsg

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  try {
    if (msg.type === 'analyze') {
      const analysis = await detectConcertPitchFromChannels(
        msg.channels,
        msg.sampleRate,
        (p) => postMessage({ type: 'progress', id: msg.id, p, label: 'Analyse' }),
        false,
      )
      const loudness = measureLoudnessChannels(msg.channels, msg.sampleRate)
      postMessage({ type: 'analysis', id: msg.id, analysis, loudness })
      return
    }

    if (msg.type === 'process') {
      const shifted = pitchShiftChannels(
        msg.channels,
        msg.sampleRate,
        msg.ratio,
        msg.preserveTempo,
        (p) => postMessage({ type: 'progress', id: msg.id, p: p * 0.78, label: 'Pitch-Shift' }),
      )
      let loudness = measureLoudnessChannels(shifted, msg.sampleRate)
      if (msg.lufs !== null && msg.truePeak !== null) {
        postMessage({ type: 'progress', id: msg.id, p: 0.82, label: 'Mastering' })
        loudness = normalizeChannels(shifted, msg.sampleRate, msg.lufs, msg.truePeak)
      }
      postMessage(
        { type: 'processed', id: msg.id, channels: shifted, sampleRate: msg.sampleRate, loudness },
        shifted.map((c) => c.buffer),
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    postMessage({ type: 'error', id: msg.id, message })
  }
}
