import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import Gauge from './components/Gauge'
import Waveform from './components/Waveform'
import Spectrum from './components/Spectrum'
import { type AnalysisResult } from './audio/detectPitch'
import { type LoudnessReport, measureLoudnessChannels, normalizeChannels } from './audio/loudness'
import { downloadBlob, encodeWav, formatTime, safeStem, type WavBits } from './audio/exportWav'
import { analyzeInWorker, processInWorker, resetWorker } from './audio/workerClient'
import { usePlayer } from './hooks/usePlayer'
import {
  CONCERT_PRESETS,
  LAST_PLATFORM_KEY,
  LAST_TARGET_KEY,
  PLATFORM_PROFILES,
  SOLFEGGIO_PRESETS,
  formatHz,
  hzToCents,
  loadCustomHz,
  nearestNoteToHz,
  noteFreqAtA4,
  saveCustomHz,
  semitoneShift,
  type PlatformId,
} from './audio/frequencies'
import { FORK_SETS, FORK_ATTRIBUTION } from './audio/tuningForks'
import { renderTempoPreservedHQ } from './audio/signalsmith'
import { ForkTone } from './audio/forkTone'

type TargetMode = 'concert' | 'solfeggio' | 'forks'
type EngineMode = 'auto' | 'signalsmith' | 'vocoder'

const ENGINE_STORAGE_KEY = 'frequnzy.engine'

export default function App() {
  const player = usePlayer()
  const [fileName, setFileName] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [result, setResult] = useState<AudioBuffer | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loudOrig, setLoudOrig] = useState<LoudnessReport | null>(null)
  const [loudRes, setLoudRes] = useState<LoudnessReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProg, setAnalyzeProg] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [processProg, setProcessProg] = useState(0)
  const [processLabel, setProcessLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [wavBits, setWavBits] = useState<WavBits>(24)
  const [helpOpen, setHelpOpen] = useState(false)
  const cancelRef = useRef(false)

  const [targetHz, setTargetHz] = useState(() => {
    const s = localStorage.getItem(LAST_TARGET_KEY)
    const n = s ? parseFloat(s) : 432
    return Number.isFinite(n) ? n : 432
  })
  const [mode, setMode] = useState<TargetMode>('concert')
  const [solfNote, setSolfNote] = useState('C5')
  const [customInput, setCustomInput] = useState('')
  const [customs, setCustoms] = useState<number[]>(() => loadCustomHz())
  const [platform, setPlatform] = useState<PlatformId>(() => {
    const s = localStorage.getItem(LAST_PLATFORM_KEY)
    return (PLATFORM_PROFILES.some((p) => p.id === s) ? s : 'none') as PlatformId
  })
  const [preserveTempo, setPreserveTempo] = useState(true)
  const [engine, setEngine] = useState<EngineMode>(() => {
    const s = localStorage.getItem(ENGINE_STORAGE_KEY)
    return s === 'signalsmith' || s === 'vocoder' ? s : 'auto'
  })
  const [usedEngine, setUsedEngine] = useState<'signalsmith' | 'vocoder' | null>(null)
  const [forkSetId, setForkSetId] = useState<string>('solfeggio-full')
  const [forkToneHz, setForkToneHz] = useState<number | null>(null)
  const forkToneRef = useRef<ForkTone | null>(null)

  useEffect(() => {
    localStorage.setItem(LAST_TARGET_KEY, String(targetHz))
  }, [targetHz])
  useEffect(() => {
    localStorage.setItem(LAST_PLATFORM_KEY, platform)
  }, [platform])
  useEffect(() => {
    localStorage.setItem(ENGINE_STORAGE_KEY, engine)
  }, [engine])
  // Klanggabel-Vorhörton beim Unmount stoppen (kein angebrochener 10-s-Ton nach Verlassen der Seite)
  useEffect(() => () => forkToneRef.current?.stop(), [])

  const sourceHz = analysis?.hz ?? 440
  const ratio = useMemo(() => {
    if (mode === 'solfeggio') return targetHz / noteFreqAtA4(solfNote, sourceHz)
    return targetHz / sourceHz
  }, [mode, solfNote, targetHz, sourceHz])

  const cents = hzToCents(sourceHz, sourceHz * ratio)
  const alreadyTuned = !!analysis && Math.abs(cents) < 4
  const longFile = (buffer?.duration ?? 0) > 8 * 60

  const runAnalysis = useCallback(async (decoded: AudioBuffer, name: string) => {
    setError(null)
    setResult(null)
    setLoudRes(null)
    setAnalysis(null)
    setLoudOrig(null)
    player.stop()
    setFileName(name)
    setBuffer(decoded)
    setAnalyzing(true)
    setAnalyzeProg(0)
    try {
      const { analysis: tuning, loudness } = await analyzeInWorker(decoded, (p) => setAnalyzeProg(p))
      setAnalysis(tuning)
      setLoudOrig(loudness)
    } catch (e) {
      console.error(e)
      setError('Datei konnte nicht analysiert werden.')
    } finally {
      setAnalyzing(false)
      setAnalyzeProg(1)
    }
  }, [player])

  const loadFile = useCallback(
    async (file: File) => {
      try {
        const ctx = player.ctx()
        if (ctx.state === 'suspended') await ctx.resume()
        const arr = await file.arrayBuffer()
        const decoded = await ctx.decodeAudioData(arr.slice(0))
        await runAnalysis(decoded, file.name)
      } catch (e) {
        console.error(e)
        setError('Datei konnte nicht gelesen werden. Bitte WAV, MP3, OGG, FLAC oder M4A verwenden.')
        setBuffer(null)
        setFileName(null)
      }
    },
    [player, runAnalysis],
  )

  const loadTestTone = useCallback(async () => {
    const ctx = player.ctx()
    if (ctx.state === 'suspended') await ctx.resume()
    const sr = 44100
    const dur = 5
    const buf = ctx.createBuffer(2, sr * dur, sr)
    const a4 = 440
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < d.length; i++) {
        const t = i / sr
        const env = Math.min(1, t * 8) * Math.min(1, (dur - t) * 8)
        d[i] =
          (Math.sin(2 * Math.PI * a4 * t) * 0.28 +
            Math.sin(2 * Math.PI * a4 * Math.pow(2, 4 / 12) * t) * 0.16 +
            Math.sin(2 * Math.PI * a4 * Math.pow(2, 7 / 12) * t) * 0.14 +
            Math.sin(2 * Math.PI * (a4 / 2) * t) * 0.1) *
          env
      }
    }
    await runAnalysis(buf, 'Testton_A440_Durakkord.wav')
  }, [player, runAnalysis])

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) void loadFile(f)
  }

  const addCustom = () => {
    const n = parseFloat(customInput.replace(',', '.'))
    if (!Number.isFinite(n) || n < 20 || n > 20000) {
      setError('Bitte eine Frequenz zwischen 20 und 20 000 Hz eingeben.')
      return
    }
    setError(null)
    setTargetHz(n)
    setMode('concert')
    const next = [n, ...customs.filter((x) => Math.abs(x - n) > 0.01)].slice(0, 12)
    setCustoms(next)
    saveCustomHz(next)
    setCustomInput('')
  }

  const removeCustom = (hz: number) => {
    const next = customs.filter((x) => x !== hz)
    setCustoms(next)
    saveCustomHz(next)
  }

  const toggleForkTone = (hz: number) => {
    if (!forkToneRef.current) forkToneRef.current = new ForkTone(() => player.ctx())
    const playing = forkToneRef.current.toggle(hz)
    setForkToneHz(playing ? hz : null)
  }

  /** Klanggabel als Ziel: Note (12-TET, A4=440) so wählen, dass sie exakt auf hz liegt. */
  const applyForkAsTarget = (hz: number) => {
    const nn = nearestNoteToHz(hz)
    setTargetHz(hz)
    setSolfNote(nn.name)
    setMode('solfeggio')
  }

  const playOriginal = () => {
    if (!buffer) return
    void player.play(buffer, 'original', 1, player.frac())
  }
  const playPreview = () => {
    if (!buffer) return
    void player.play(buffer, 'preview', ratio, player.frac())
  }
  const playResult = () => {
    if (!result) return
    void player.play(result, 'result', 1, player.frac())
  }

  const onSeek = (frac: number) => {
    player.seek(frac)
    if (player.playing === 'original' && buffer) void player.play(buffer, 'original', 1, frac)
    else if (player.playing === 'preview' && buffer) void player.play(buffer, 'preview', ratio, frac)
    else if (player.playing === 'result' && result) void player.play(result, 'result', 1, frac)
  }

  const convert = async () => {
    if (!buffer || !analysis) return
    setError(null)
    setProcessing(true)
    setProcessProg(0)
    setResult(null)
    setUsedEngine(null)
    player.stop()
    cancelRef.current = false
    const profile = PLATFORM_PROFILES.find((p) => p.id === platform)!

    // HQ-Pfad: Signalsmith Stretch (offline, WASM) — Fallback auf Phase Vocoder
    if (preserveTempo && engine !== 'vocoder') {
      try {
        setProcessLabel('Signalsmith (HQ) rendert …')
        setProcessProg(0.08)
        const shifted = await renderTempoPreservedHQ(buffer, ratio, (p) => setProcessProg(0.08 + p * 0.72))
        if (cancelRef.current) {
          setProcessing(false)
          return
        }
        let loudness = measureLoudnessChannels(shifted, buffer.sampleRate)
        if (profile.lufs !== null && profile.truePeak !== null) {
          setProcessLabel('Mastering')
          setProcessProg(0.86)
          loudness = normalizeChannels(shifted, buffer.sampleRate, profile.lufs, profile.truePeak)
        }
        const ctx = player.ctx()
        const outBuf = ctx.createBuffer(buffer.numberOfChannels, shifted[0].length, buffer.sampleRate)
        for (let c = 0; c < shifted.length; c++) outBuf.getChannelData(c).set(shifted[c])
        setResult(outBuf)
        setLoudRes(loudness)
        setUsedEngine('signalsmith')
        setProcessProg(1)
        setProcessLabel('Fertig · Signalsmith HQ')
        setProcessing(false)
        return
      } catch (e) {
        if (cancelRef.current) {
          setProcessing(false)
          return
        }
        console.warn('Signalsmith-Rendering fehlgeschlagen, Fallback auf Phase Vocoder:', e)
      }
    }

    try {
      const ctx = player.ctx()
      const out = await processInWorker(
        ctx,
        buffer,
        ratio,
        preserveTempo,
        profile.lufs,
        profile.truePeak,
        (p, label) => {
          setProcessProg(p)
          setProcessLabel(label)
        },
      )
      if (cancelRef.current) return
      setResult(out.buffer)
      setLoudRes(out.loudness)
      setUsedEngine(preserveTempo ? 'vocoder' : null)
      setProcessProg(1)
      setProcessLabel('Fertig')
    } catch (e) {
      if (cancelRef.current) return
      console.error(e)
      setError('Umwandlung fehlgeschlagen. Versuche „Tempo nicht halten“ oder eine kürzere Datei.')
    } finally {
      setProcessing(false)
    }
  }

  const cancelProcess = () => {
    cancelRef.current = true
    resetWorker()
    setProcessing(false)
    setProcessLabel('Abgebrochen')
  }

  const download = () => {
    if (!result || !fileName) return
    const blob = encodeWav(result, wavBits)
    const plat = platform === 'none' ? '' : `_${platform}`
    const engineTag = preserveTempo ? (usedEngine === 'vocoder' ? '_vocoder' : '_hq') : '_asetrate'
    downloadBlob(blob, `${safeStem(fileName)}_${formatHz(targetHz, 2)}Hz${plat}${engineTag}_${wavBits}bit.wav`)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (player.playing) player.pause()
        else if (result) playResult()
        else if (buffer) playOriginal()
      } else if (e.key === '1' || e.key === 'a' || e.key === 'A') playOriginal()
      else if (e.key === '2' || e.key === 'v' || e.key === 'V') playPreview()
      else if (e.key === '3' || e.key === 'b' || e.key === 'B') playResult()
      else if (e.key === 'l' || e.key === 'L') player.toggleLoop()
      else if (e.key === 'ArrowLeft') onSeek(Math.max(0, player.frac() - 0.05))
      else if (e.key === 'ArrowRight') onSeek(Math.min(1, player.frac() + 0.05))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const profile = PLATFORM_PROFILES.find((p) => p.id === platform)!
  const waveBuf = player.playing === 'result' && result ? result : buffer
  const now =
    (waveBuf ? player.progress * waveBuf.duration : 0)

  return (
    <div className="app">
      <div className="grain" aria-hidden />
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>FREQUNZY</h1>
            <p className="tag">Kammerton erkennen · umstimmen · plattformfertig mastern</p>
          </div>
        </div>
        <button className="ghost" type="button" onClick={() => setHelpOpen((v) => !v)}>
          {helpOpen ? 'Schließen' : 'So funktioniert’s'}
        </button>
      </header>

      {helpOpen && (
        <aside className="help">
          <p>
            Lade eine Datei aus deiner Bibliothek. DRM-Streams von Spotify oder Apple Music können nicht direkt
            geöffnet werden — Datei zuerst exportieren oder speichern.
          </p>
          <p>
            Das Tool schätzt <strong>Kammerton A4</strong> und verschiebt im Verhältnis Ziel⁄erkannt. Solfeggio richtet
            eine Note aus (z. B. C5 = 528 Hz). <strong>Vorschau</strong> hört die Zielstimmung sofort (leicht anderes
            Tempo). <strong>Umwandeln</strong> rendert tempo-stabil und optional nach LUFS-Vorgabe.
          </p>
          <p>
            Tastatur: Leertaste Play/Pause · 1 Original · 2 Vorschau · 3 Ergebnis · ← → spulen · L Loop. Alles bleibt
            im Browser.
          </p>
        </aside>
      )}

      <main className="layout">
        <section
          className={`stage ${drag ? 'dragging' : ''} ${buffer ? 'has-file' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          {!buffer ? (
            <div className="drop">
              <label className="drop-hit">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void loadFile(f)
                  }}
                />
                <span className="drop-kicker">Audio laden</span>
                <span className="drop-title">Datei hierher ziehen</span>
                <span className="drop-sub">WAV · MP3 · FLAC · OGG · M4A — eigene Dateien, nicht DRM-Streams</span>
              </label>
              <button type="button" className="ghost" onClick={() => void loadTestTone()}>
                Testton A4 = 440 Hz
              </button>
            </div>
          ) : (
            <>
              <div className="filebar">
                <div>
                  <div className="fname">{fileName}</div>
                  <div className="fmeta">
                    {analysis
                      ? `${formatTime(analysis.duration)} · ${analysis.sampleRate} Hz · ${analysis.channels} ch · Peak ${analysis.peakDb.toFixed(1)} dBFS`
                      : 'Analysiere …'}
                    {loudOrig && ` · ${loudOrig.lufs.toFixed(1)} LUFS`}
                    {analysis?.key && ` · ${analysis.key}`}
                  </div>
                </div>
                <label className="ghost sm">
                  Andere Datei
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void loadFile(f)
                    }}
                  />
                </label>
              </div>
              <Gauge
                hz={analysis?.hz ?? null}
                target={targetHz}
                confidence={analysis?.confidence ?? 0}
                centsFrom440={analysis?.centsFrom440 ?? 0}
                analyzing={analyzing}
              />
              {alreadyTuned && (
                <div className="badge">Bereits nahe der Zielstimmung ({cents.toFixed(1)} ct) — Vorschau reicht oft</div>
              )}
              {longFile && (
                <div className="badge warn">Lange Datei: Umwandeln läuft im Hintergrund, Vorschau ist sofort hörbar</div>
              )}
              <Waveform buffer={waveBuf} progress={player.progress} onSeek={onSeek} />
              <Spectrum analyser={player.analyserRef.current} active={player.playing !== null} />
              <div className="transport">
                <span className="time">
                  {formatTime(now)} / {formatTime(waveBuf?.duration ?? 0)}
                </span>
                <button type="button" className="ghost sm" disabled={!buffer || analyzing} onClick={playOriginal}>
                  {player.playing === 'original' ? 'Original ·' : 'Original'}
                </button>
                <button type="button" className="ghost sm" disabled={!buffer || analyzing} onClick={playPreview}>
                  {player.playing === 'preview' ? 'Vorschau ·' : 'Vorschau'}
                </button>
                <button type="button" className="ghost sm" disabled={!result} onClick={playResult}>
                  {player.playing === 'result' ? 'Ergebnis ·' : 'Ergebnis'}
                </button>
                <button type="button" className="ghost sm" disabled={!player.playing} onClick={player.pause}>
                  Pause
                </button>
                <button type="button" className={`ghost sm ${player.loop ? 'on' : ''}`} onClick={player.toggleLoop}>
                  Loop
                </button>
                <label className="vol">
                  <span>Vol</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={player.volume}
                    onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                  />
                </label>
              </div>
              {analyzing && (
                <div className="prog">
                  <div style={{ width: `${analyzeProg * 100}%` }} />
                  <span>Kammerton wird ermittelt …</span>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel">
          <div className="tabs">
            <button type="button" className={mode === 'concert' ? 'on' : ''} onClick={() => setMode('concert')}>
              Kammerton A4
            </button>
            <button type="button" className={mode === 'solfeggio' ? 'on' : ''} onClick={() => setMode('solfeggio')}>
              Solfeggio
            </button>
            <button type="button" className={mode === 'forks' ? 'on' : ''} onClick={() => setMode('forks')}>
              Klanggabeln
            </button>
          </div>

          {mode === 'concert' && (
            <div className="presets">
              {CONCERT_PRESETS.map((p) => (
                <button
                  key={p.hz}
                  type="button"
                  className={`chip ${Math.abs(targetHz - p.hz) < 0.05 && mode === 'concert' ? 'active' : ''}`}
                  onClick={() => {
                    setTargetHz(p.hz)
                    setMode('concert')
                  }}
                  title={`${p.hz} Hz = ${hzToCents(440, p.hz) >= 0 ? '+' : ''}${hzToCents(440, p.hz).toFixed(4)} Cent vs. A4 = 440 Hz`}
                >
                  <strong>{p.hz % 1 === 0 ? p.hz : p.hz.toFixed(2)}</strong>
                  <em>{p.name}</em>
                  <span>{p.desc}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'solfeggio' && (
            <div className="presets">
              {SOLFEGGIO_PRESETS.map((p) => (
                <button
                  key={p.hz}
                  type="button"
                  className={`chip ${Math.abs(targetHz - p.hz) < 0.05 && mode === 'solfeggio' ? 'active' : ''}`}
                  onClick={() => {
                    setTargetHz(p.hz)
                    setSolfNote(p.note)
                    setMode('solfeggio')
                  }}
                  title={`${p.note} exakt auf ${p.hz} Hz: ${hzToCents(noteFreqAtA4(p.note, 440), p.hz) >= 0 ? '+' : ''}${hzToCents(noteFreqAtA4(p.note, 440), p.hz).toFixed(4)} Cent vs. 12-TET (A4 = 440)`}
                >
                  <strong>{p.hz}</strong>
                  <em>
                    {p.name} · {p.note}
                  </em>
                  <span>{p.desc}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'forks' && (
            <div className="forks">
              <div className="fork-set-row">
                <select
                  className="fork-select"
                  value={forkSetId}
                  onChange={(e) => setForkSetId(e.target.value)}
                  aria-label="Frequenz-Set wählen"
                >
                  {FORK_SETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="fork-count">
                  {FORK_SETS.find((s) => s.id === forkSetId)?.entries.length ?? 0} Frequenzen
                </span>
              </div>
              {FORK_SETS.filter((s) => s.id === forkSetId).map((set) => (
                <div key={set.id}>
                  {set.note && <p className="hint dim fork-note">{set.note}</p>}
                  <div className="presets forks-grid">
                    {set.entries.map((e) => {
                      const nn = nearestNoteToHz(e.hz)
                      const active = Math.abs(targetHz - e.hz) < 0.05
                      const playing = forkToneHz === e.hz
                      const hzLabel = Number.isInteger(e.hz) ? String(e.hz) : e.hz.toFixed(2)
                      return (
                        <div
                          key={`${e.hz}-${e.name}`}
                          role="button"
                          tabIndex={0}
                          className={`chip fork ${active ? 'active' : ''}`}
                          onClick={() => applyForkAsTarget(e.hz)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault()
                              applyForkAsTarget(e.hz)
                            }
                          }}
                          title={`Klick: ${nn.name} exakt auf ${hzLabel} Hz ausrichten (Solfeggio-Mechanik, ${nn.cents >= 0 ? '+' : ''}${nn.cents.toFixed(2)} ct vs. 12-TET)`}
                        >
                          <div className="fork-head">
                            <strong>{hzLabel}</strong>
                            <button
                              type="button"
                              className={`fork-play ${playing ? 'on' : ''}`}
                              aria-label={playing ? 'Ton stoppen' : `${hzLabel} Hz als Sinus hören`}
                              aria-pressed={playing}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                toggleForkTone(e.hz)
                              }}
                            >
                              {playing ? '■' : '▶'}
                            </button>
                          </div>
                          <span className="fork-name">{e.name}</span>
                          <span className="fork-meta">
                            ≈ {nn.name} {nn.cents >= 0 ? '+' : ''}
                            {nn.cents.toFixed(2)} ct vs. 12-TET
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p className="attr">
                Frequenz- &amp; Namensdaten:{' '}
                <a href={FORK_ATTRIBUTION.url} target="_blank" rel="noreferrer">
                  {FORK_ATTRIBUTION.name}
                </a>{' '}
                · {FORK_ATTRIBUTION.license} © {FORK_ATTRIBUTION.year} {FORK_ATTRIBUTION.holder} · Ohne Heilversprechen —
                die „Bedeutung“ ist Tradition, nicht Naturwissenschaft. Klick auf eine Frequenz richtet die nächstliegende
                Note exakt darauf aus.
              </p>
            </div>
          )}

          <div className="custom-row">
            <label className="field">
              <span>Eigene Frequenz (einmal eintippen, bleibt gespeichert)</span>
              <div className="inline">
                <input
                  inputMode="decimal"
                  placeholder="z. B. 436 oder 528"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCustom()
                  }}
                />
                <button type="button" className="solid" onClick={addCustom}>
                  Übernehmen
                </button>
              </div>
            </label>
          </div>
          {customs.length > 0 && (
            <div className="custom-list">
              {customs.map((hz) => (
                <button
                  key={hz}
                  type="button"
                  className={`chip mini ${Math.abs(targetHz - hz) < 0.01 ? 'active' : ''}`}
                  onClick={() => {
                    setTargetHz(hz)
                    setMode('concert')
                  }}
                >
                  {formatHz(hz, 2)} Hz
                  <span
                    className="x"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeCustom(hz)
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="ratio-card">
            <div>
              <span className="k">Verhältnis</span>
              <strong>{ratio.toFixed(6)}</strong>
            </div>
            <div title="1200 · log₂(Ziel ÷ Quelle) — exakter Versatz in Cent">
              <span className="k">Verschiebung</span>
              <strong>
                {cents >= 0 ? '+' : ''}
                {cents.toFixed(2)} ct
              </strong>
            </div>
            <div title="log₂(ratio) · 12 — Halbton-Verschiebung (fraktioniert)">
              <span className="k">In Halbtönen</span>
              <strong>
                {semitoneShift(sourceHz, sourceHz * ratio) >= 0 ? '+' : ''}
                {semitoneShift(sourceHz, sourceHz * ratio).toFixed(4)} HT
              </strong>
            </div>
            <div>
              <span className="k">Quelle A4</span>
              <strong>{analysis ? `${formatHz(analysis.hz, 2)} Hz` : '—'}</strong>
            </div>
            {analysis?.nearest && (
              <div>
                <span className="k">Nächstes Raster</span>
                <strong>
                  {analysis.nearest.name} ({analysis.nearest.hz} Hz)
                </strong>
              </div>
            )}
            {analysis && (
              <div>
                <span className="k">Konfidenz</span>
                <strong>{Math.round(analysis.confidence * 100)} %</strong>
              </div>
            )}
            {analysis?.key && (
              <div>
                <span className="k">Tonart</span>
                <strong>
                  {analysis.key}
                  {analysis.keyConfidence > 0.15 ? '' : ' ?'}
                </strong>
              </div>
            )}
          </div>

          {analysis && analysis.candidates.length > 0 && (
            <div className="cands">
              {analysis.candidates.slice(0, 4).map((c) => (
                <button
                  key={c.hz}
                  type="button"
                  className="cand"
                  onClick={() => {
                    setTargetHz(c.hz)
                    setMode('concert')
                  }}
                  title="Als Ziel setzen"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <label className="toggle">
            <input type="checkbox" checked={preserveTempo} onChange={(e) => setPreserveTempo(e.target.checked)} />
            <span>
              Tempo halten
              <small>
                {preserveTempo
                  ? engine === 'vocoder'
                    ? 'Phase Vocoder (nativ, Worker): identische Dauer, tonhöhen-neutral — Vorschau ignoriert das und ist sofort da'
                    : 'Signalsmith Stretch (HQ, MIT): simultane Pitch-/Zeit-Map statt Resample+Stretch — Dauer bleibt gleich'
                  : 'Nur Resampling (Blackman-sinc, anti-alias) — maximal sauber, Tempo ändert sich leicht'}
              </small>
            </span>
          </label>
          {preserveTempo && (
            <div className="bits engine-row" role="group" aria-label="Pitch-Engine wählen">
              <span>Engine</span>
              <button type="button" className={engine === 'auto' ? 'on' : ''} onClick={() => setEngine('auto')} title="Signalsmith HQ, bei Fehler automatisch Phase Vocoder">
                Auto (HQ)
              </button>
              <button type="button" className={engine === 'signalsmith' ? 'on' : ''} onClick={() => setEngine('signalsmith')} title="Signalsmith Stretch — Hybrid-Spektral, Pitch und Zeit simultan">
                Signalsmith HQ
              </button>
              <button type="button" className={engine === 'vocoder' ? 'on' : ''} onClick={() => setEngine('vocoder')} title="Phase Vocoder im Worker — nativ, kein WASM nötig, gut für moderate Shifts">
                Phase Vocoder
              </button>
            </div>
          )}

          <h2>Streaming-Mastering</h2>
          <p className="hint">
            Lautheit und True-Peak nach veröffentlichten Vorgaben. Spotify &amp; Apple Music streamen nicht hierher —
            Dateien aus der Mediathek laden.
          </p>
          <div className="plats">
            {PLATFORM_PROFILES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`plat ${platform === p.id ? 'active' : ''}`}
                onClick={() => setPlatform(p.id)}
              >
                <strong>{p.name}</strong>
                <span>{p.desc}</span>
              </button>
            ))}
          </div>
          <p className="hint dim">{profile.hint}</p>

          {error && <div className="err">{error}</div>}

          <div className="actions">
            <button
              type="button"
              className="solid lg"
              disabled={!buffer || analyzing || processing}
              onClick={() => void convert()}
            >
              {processing ? processLabel : 'Umwandeln'}
            </button>
            {processing && (
              <button type="button" className="ghost" onClick={cancelProcess}>
                Abbrechen
              </button>
            )}
            <button type="button" className="gold" disabled={!result} onClick={download}>
              WAV {wavBits}-bit
            </button>
          </div>
          <div className="bits">
            <span>Export</span>
            <button type="button" className={wavBits === 24 ? 'on' : ''} onClick={() => setWavBits(24)}>
              24-bit
            </button>
            <button type="button" className={wavBits === 16 ? 'on' : ''} onClick={() => setWavBits(16)}>
              16-bit + Dither
            </button>
          </div>

          {processing && (
            <div className="prog">
              <div style={{ width: `${processProg * 100}%` }} />
              <span>
                {processLabel} · {Math.round(processProg * 100)} %
              </span>
            </div>
          )}

          {loudRes && result && (
            <div className="report">
              <div>
                <span className="k">Ergebnis LUFS</span>
                <strong>{loudRes.lufs.toFixed(1)}</strong>
              </div>
              <div>
                <span className="k">True Peak</span>
                <strong>{loudRes.truePeakDb.toFixed(1)} dBTP</strong>
              </div>
              <div>
                <span className="k">Dauer</span>
                <strong>{formatTime(result.duration)}</strong>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        <span>FREQUNZY Tune Tool</span>
        <span>A4-Raster · Solfeggio · EBU R128 · Worker-DSP</span>
        <span>Dateien bleiben im Browser. Nichts wird hochgeladen.</span>
      </footer>
    </div>
  )
}
