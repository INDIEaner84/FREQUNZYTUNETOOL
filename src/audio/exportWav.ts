export type WavBits = 16 | 24

function writeStr(view: DataView, offset: number, s: string) {
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

export function encodeWav(buffer: AudioBuffer, bits: WavBits = 24): Blob {
  const numCh = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const len = buffer.length
  const bytesPerSample = bits === 24 ? 3 : 2
  const blockAlign = numCh * bytesPerSample
  const dataSize = len * blockAlign
  const header = 44
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

  const chans = [...Array(numCh)].map((_, c) => buffer.getChannelData(c))
  let o = 44
  if (bits === 16) {
    const max = 32767
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = clampSample(chans[c][i])
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
        const s = clampSample(chans[c][i])
        let v = Math.round(s * max + tpdf())
        if (v > max) v = max
        if (v < -8388608) v = -8388608
        view.setUint8(o, v & 0xff)
        view.setUint8(o + 1, (v >> 8) & 0xff)
        view.setUint8(o + 2, (v >> 16) & 0xff)
        o += 3
      }
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

export function encodeWav16(buffer: AudioBuffer): Blob {
  return encodeWav(buffer, 16)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
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
