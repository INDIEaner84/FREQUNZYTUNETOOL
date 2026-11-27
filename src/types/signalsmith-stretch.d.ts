declare module 'signalsmith-stretch' {
  export interface SignalsmithStretchOptions {
    numberOfInputs?: number
    numberOfOutputs?: number
    outputChannelCount?: number[]
    processorOptions?: Record<string, unknown>
  }

  export interface StretchNode {
    /** Current playback position within the input buffer (seconds) */
    inputTime: number
    connect(destination: AudioNode): void
    schedule(change: {
      output?: number
      active?: boolean
      input?: number
      rate?: number
      semitones?: number
      tonalityHz?: number
      formantSemitones?: number
      formantCompensation?: boolean
      formantBaseHz?: number
      loopStart?: number
      loopEnd?: number
    }): Promise<void>
    /** Add buffers (one Float32Array per channel). Resolves to the new end time in seconds. */
    addBuffers(channelData: Float32Array[]): Promise<number>
    dropBuffers(toSeconds?: number): Promise<{ start: number; end: number } | undefined>
    start(when?: number): Promise<void>
    stop(when?: number): Promise<void>
    latency(): Promise<number>
    configure(config: { blockMs?: number | null; intervalMs?: number; splitComputation?: boolean; preset?: 'default' | 'cheaper' }): Promise<void>
  }

  function SignalsmithStretch(
    audioContext: BaseAudioContext,
    options?: SignalsmithStretchOptions,
  ): Promise<StretchNode>

  export default SignalsmithStretch
}
