import type { AnalysisResult } from './detectPitch'
import type { WavBits } from './exportWav'
import type { LoudnessReport } from './loudness'
import { copyChannels, rawToBuffer } from './raw'

type ProgressFn = (p: number, label: string) => void

let worker: Worker | null = null
let jobId = 0
const activeJobs = new Map<number, (reason: Error) => void>()

function makeAbortError(message = 'Vorgang abgebrochen'): Error {
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./processWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export function resetWorker(): void {
  const pending = [...activeJobs.values()]
  activeJobs.clear()
  if (worker) {
    worker.terminate()
    worker = null
  }
  const abortErr = makeAbortError()
  for (const rejectJob of pending) {
    rejectJob(abortErr)
  }
}

export function analyzeInWorker(
  buffer: AudioBuffer,
  onProgress?: ProgressFn,
): Promise<{ analysis: AnalysisResult; loudness: LoudnessReport }> {
  const id = ++jobId
  const channels = copyChannels(buffer)
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const cleanup = () => {
      activeJobs.delete(id)
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
    const onMsg = (e: MessageEvent) => {
      const data = e.data as {
        type: string
        id: number
        p?: number
        label?: string
        analysis?: AnalysisResult
        loudness?: LoudnessReport
        message?: string
      }
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
    activeJobs.set(id, (reason) => {
      cleanup()
      reject(reason)
    })
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage(
      { type: 'analyze', id, sampleRate: buffer.sampleRate, channels },
      channels.map((c) => c.buffer),
    )
  })
}

export function processInWorker(
  ctx: BaseAudioContext,
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
    const cleanup = () => {
      activeJobs.delete(id)
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
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
    activeJobs.set(id, (reason) => {
      cleanup()
      reject(reason)
    })
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage(
      { type: 'process', id, sampleRate: buffer.sampleRate, channels, ratio, preserveTempo, lufs, truePeak },
      channels.map((c) => c.buffer),
    )
  })
}

export function encodeWavInWorker(buffer: AudioBuffer, bits: WavBits): Promise<Blob> {
  const id = ++jobId
  const channels = copyChannels(buffer)
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const cleanup = () => {
      activeJobs.delete(id)
      w.removeEventListener('message', onMsg)
      w.removeEventListener('error', onErr)
    }
    const onMsg = (e: MessageEvent) => {
      const data = e.data as {
        type: string
        id: number
        wavBytes?: ArrayBuffer
        message?: string
      }
      if (data.id !== id) return
      if (data.type === 'wav' && data.wavBytes) {
        cleanup()
        resolve(new Blob([data.wavBytes], { type: 'audio/wav' }))
      }
      if (data.type === 'error') {
        cleanup()
        reject(new Error(data.message || 'WAV-Export fehlgeschlagen'))
      }
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Worker-Fehler beim WAV-Export'))
    }
    activeJobs.set(id, (reason) => {
      cleanup()
      reject(reason)
    })
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr)
    w.postMessage(
      { type: 'encodeWav', id, sampleRate: buffer.sampleRate, channels, bits },
      channels.map((c) => c.buffer),
    )
  })
}
