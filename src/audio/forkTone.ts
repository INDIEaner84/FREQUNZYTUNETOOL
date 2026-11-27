/**
 * Reiner Sinus für Klanggabel-Vorhörton (wie im Original-PWA
 * evoluteur/healing-frequencies, MIT). Kurze Ramps statt harter Kanten,
 * Auto-Stop nach 10 s, maximal ein Ton gleichzeitig.
 */
export class ForkTone {
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  private timer: number | null = null
  currentHz: number | null = null

  constructor(private readonly getContext: () => AudioContext) {}

  /** Spielt hz; erneuter Aufruf mit demselben Wert stoppt den Ton. Gibt zurück, ob jetzt gespielt wird. */
  toggle(hz: number): boolean {
    if (this.currentHz === hz) {
      this.stop()
      return false
    }
    this.stop()
    const ctx = this.getContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(hz, ctx.currentTime)
    const gain = ctx.createGain()
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    this.osc = osc
    this.gain = gain
    this.currentHz = hz
    this.timer = window.setTimeout(() => this.stop(), 10_000)
    return true
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    const osc = this.osc
    const gain = this.gain
    if (osc && gain) {
      const ctx = osc.context
      const t = ctx.currentTime
      try {
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
        osc.stop(t + 0.14)
      } catch {
        try {
          osc.stop()
        } catch {
          /* bereits gestoppt */
        }
      }
    }
    this.osc = null
    this.gain = null
    this.currentHz = null
  }
}
