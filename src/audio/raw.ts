export type RawAudio = {
  sampleRate: number
  channels: Float32Array[]
}

export function copyChannels(buffer: {
  numberOfChannels: number
  getChannelData(channel: number): Float32Array
}): Float32Array[] {
  const out: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.push(buffer.getChannelData(c).slice())
  }
  return out
}

export function rawToBuffer(
  ctx: BaseAudioContext,
  raw: RawAudio,
): AudioBuffer {
  const length = raw.channels[0]?.length ?? 0
  const numCh = Math.max(1, Math.min(32, raw.channels.length))
  const out = ctx.createBuffer(numCh, Math.max(1, length), raw.sampleRate)
  for (let c = 0; c < Math.min(numCh, raw.channels.length); c++) {
    out.getChannelData(c).set(raw.channels[c])
  }
  return out
}

export function mixMono(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0
  const out = new Float32Array(n)
  const ch = channels.length
  if (!ch || !n) return out
  for (let c = 0; c < ch; c++) {
    const data = channels[c]
    const len = Math.min(n, data.length)
    for (let i = 0; i < len; i++) out[i] += data[i]
  }
  if (ch > 1) {
    const inv = 1 / ch
    for (let i = 0; i < n; i++) out[i] *= inv
  }
  return out
}

/** True maximum absolute sample amplitude across all channels. */
export function peakLinear(channels: Float32Array[]): number {
  let max = 0
  for (let c = 0; c < channels.length; c++) {
    const data = channels[c]
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i])
      if (a > max) max = a
    }
  }
  return max
}

export function peakDbfs(channels: Float32Array[]): number {
  const m = peakLinear(channels)
  if (m < 1e-9) return -120
  return 20 * Math.log10(m)
}
