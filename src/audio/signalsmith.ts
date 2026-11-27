/**
 * Signalsmith Stretch (MIT, © Geraint Luff / Signalsmith Audio,
 * https://signalsmith-audio.co.uk/code/stretch) — hybride spektrale Engine,
 * Pitch-Shift + Time-Map werden simultan verarbeitet (statt Resample +
 * Zeitstauchen hintereinander). Läuft hier offline über einen
 * OfflineAudioContext.
 *
 * Warum offline: Die Node arbeitet in Echtzeit-Blöcken; im Offline-Modus wird
 * derselbe Code synchron und sample-genau gerendert. Die Latenz-Kompensation
 * ist intern, daher entspricht Output-Frame 0 dem Input-Frame 0.
 */
import SignalsmithStretch from 'signalsmith-stretch'

/** Frames angehängt, damit Filter-Tail und Pipeline-Latenz sauber ausklingen. */
const TAIL_FRAMES = 8192

/**
 * Tempo-erhaltendes Rendering mit der Signalsmith-Engine.
 * Liefert exakt buffer.length Frames pro Kanal (der Tail wird verworfen).
 * Wirft, wenn AudioWorklet/OfflineAudioContext nicht verfügbar sind —
 * Aufrufer fällt dann auf den nativen Phase Vocoder (Worker) zurück.
 */
export async function renderTempoPreservedHQ(
  buffer: AudioBuffer,
  ratio: number,
  onProgress?: (p: number) => void,
): Promise<Float32Array[]> {
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error('OfflineAudioContext wird in diesem Browser nicht unterstützt.')
  }
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const sampleRate = buffer.sampleRate

  const offline = new OfflineAudioContext(channels, frames + TAIL_FRAMES, sampleRate)
  const node = await SignalsmithStretch(offline, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [channels],
  })

  const data: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    // Kopie, damit der ursprüngliche Buffer nicht verändert wird
    data.push(Float32Array.from(buffer.getChannelData(c)))
  }
  await node.addBuffers(data)
  node.connect(offline.destination)

  // rate = 1 → Dauer bleibt gleich; semitones = exakter Versatz (fraktioniert,
  // z. B. −0.318 ct für 440→432 Hz). Das ist der ganze Trick: EIN Schritt
  // statt Resample+Stretch-Doppeltransformation.
  const semitones = 12 * Math.log2(ratio)
  await node.schedule({ active: true, input: 0, output: 0, rate: 1, semitones })

  onProgress?.(0.35)
  const rendered = await offline.startRendering()
  onProgress?.(0.9)

  const out: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    out.push(Float32Array.from(rendered.getChannelData(c).subarray(0, frames)))
  }
  onProgress?.(1)
  return out
}
