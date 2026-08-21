export type RawAudio = {
  sampleRate: number
  channels: Float32Array[]
}

export function bufferToRaw(buffer: AudioBuffer): RawAudio {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice())
  }
  return { sampleRate: buffer.sampleRate, channels }
}

export function rawToBuffer(
  ctx: AudioContext | OfflineAudioContext,
  raw: RawAudio,
): AudioBuffer {
  const length = raw.channels[0]?.length ?? 0
  const out = ctx.createBuffer(Math.max(1, raw.channels.length), Math.max(1, length), raw.sampleRate)
  for (let c = 0; c < raw.channels.length; c++) out.getChannelData(c).set(raw.channels[c])
  return out
}

export function mixMono(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0
  const out = new Float32Array(n)
  const ch = channels.length
  if (!ch) return out
  for (let c = 0; c < ch; c++) {
    const data = channels[c]
    for (let i = 0; i < n; i++) out[i] += data[i]
  }
  if (ch > 1) {
    const inv = 1 / ch
    for (let i = 0; i < n; i++) out[i] *= inv
  }
  return out
}
