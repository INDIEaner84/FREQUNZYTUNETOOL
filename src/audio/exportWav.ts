export type WavBits = 16 | 24

const MAX_RIFF_BYTES = 0xffffffff

function writeStr(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}

function tpdf(): number {
  return Math.random() + Math.random() - 1
}

function clampSample(s: number): number {
  if (s > 1) return 1
  if (s < -1) return -1
  return s
}

/**
 * Pure PCM RIFF/WAVE encoder (16-bit with TPDF dither or 24-bit linear PCM).
 * Runs identically in browser main thread, Web Workers, and Node.js tests.
 */
export function encodeWavBytes(
  channels: Float32Array[],
  sampleRate: number,
  bits: WavBits = 24,
): ArrayBuffer {
  const numCh = channels.length
  if (numCh < 1 || numCh > 32) {
    throw new RangeError(`Ungültige Kanalanzahl für WAV-Export: ${numCh}`)
  }
  const sr = Math.round(sampleRate)
  if (!Number.isFinite(sr) || sr < 1) {
    throw new RangeError(`Ungültige Abtastrate für WAV-Export: ${sampleRate}`)
  }
  const len = channels[0]?.length ?? 0
  const bytesPerSample = bits === 24 ? 3 : 2
  const blockAlign = numCh * bytesPerSample
  const dataSize = len * blockAlign
  const header = 44
  if (header + dataSize > MAX_RIFF_BYTES) {
    throw new RangeError('Audiodatei überschreitet das 4-GB-Limit des WAV-Formats.')
  }

  const out = new ArrayBuffer(header + dataSize)
  const view = new DataView(out)

  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numCh, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bits, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let o = 44
  if (bits === 16) {
    const max = 32767
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = clampSample(channels[c][i] ?? 0)
        let v = Math.round(s * max + tpdf())
        if (v > max) v = max
        if (v < -32768) v = -32768
        view.setInt16(o, v, true)
        o += 2
      }
    }
  } else {
    const max = 8388607
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = clampSample(channels[c][i] ?? 0)
        let v = Math.round(s * max)
        if (v > max) v = max
        if (v < -8388608) v = -8388608
        view.setUint8(o, v & 0xff)
        view.setUint8(o + 1, (v >> 8) & 0xff)
        view.setUint8(o + 2, (v >> 16) & 0xff)
        o += 3
      }
    }
  }
  return out
}

export function encodeWav(buffer: AudioBuffer, bits: WavBits = 24): Blob {
  const chans: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    chans.push(buffer.getChannelData(c))
  }
  const bytes = encodeWavBytes(chans, buffer.sampleRate, bits)
  return new Blob([bytes], { type: 'audio/wav' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeStem(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[^\w\u00C0-\u024f-]+/g, '_').slice(0, 80) || 'track'
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
