import type { AnalysisResult } from './detectPitch'
import type { LoudnessReport } from './loudness'
import { rawToBuffer } from './raw'

type ProgressFn = (p: number, label: string) => void

let worker: Worker | null = null
let jobId = 0

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./processWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export function resetWorker() {
  worker?.terminate()
  worker = null
}

function copyChannels(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c).slice())
  return out
}

export function analyzeInWorker(
  buffer: AudioBuffer,
  onProgress?: ProgressFn,
): Promise<{ analysis: AnalysisResult; loudness: LoudnessReport }> {
  const id = ++jobId
  const channels = copyChannels(buffer)
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type: string; id: number; p?: number; label?: string; analysis?: AnalysisResult; loudness?: LoudnessReport; message?: string }
      if (data.id !== id) return
      if (data.type === 'progress') onProgress?.(data.p ?? 0, data.label ?? '')
      if (data.type === 'analysis' && data.analysis && data.loudness) {
        cleanup()
        resolve({ analysis: data.analysis, loudness: data.loudness })
      }
      if (data.type === 'error') {
        cleanup()
        reject(new Error(data.message || 'Analyse fehlgeschlagen'))
      }
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Worker-Fehler bei der Analyse'))
    }
    const cleanup = () => {
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage({ type: 'analyze', id, sampleRate: buffer.sampleRate, channels }, channels.map((c) => c.buffer))
  })
}

export function processInWorker(
  ctx: AudioContext,
  buffer: AudioBuffer,
  ratio: number,
  preserveTempo: boolean,
  lufs: number | null,
  truePeak: number | null,
  onProgress?: ProgressFn,
): Promise<{ buffer: AudioBuffer; loudness: LoudnessReport }> {
  const id = ++jobId
  const channels = copyChannels(buffer)
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const onMsg = (e: MessageEvent) => {
      const data = e.data as {
        type: string
        id: number
        p?: number
        label?: string
        channels?: Float32Array[]
        sampleRate?: number
        loudness?: LoudnessReport
        message?: string
      }
      if (data.id !== id) return
      if (data.type === 'progress') onProgress?.(data.p ?? 0, data.label ?? '')
      if (data.type === 'processed' && data.channels && data.loudness && data.sampleRate) {
        cleanup()
        const out = rawToBuffer(ctx, { sampleRate: data.sampleRate, channels: data.channels })
        resolve({ buffer: out, loudness: data.loudness })
      }
      if (data.type === 'error') {
        cleanup()
        reject(new Error(data.message || 'Umwandlung fehlgeschlagen'))
      }
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Worker-Fehler bei der Umwandlung'))
    }
    const cleanup = () => {
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage(
      { type: 'process', id, sampleRate: buffer.sampleRate, channels, ratio, preserveTempo, lufs, truePeak },
      channels.map((c) => c.buffer),
    )
  })
}

export { rawToBuffer }
