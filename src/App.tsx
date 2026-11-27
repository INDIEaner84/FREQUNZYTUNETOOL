import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import Gauge from './components/Gauge'
import Waveform from './components/Waveform'
import Spectrum from './components/Spectrum'
import { type AnalysisResult } from './audio/detectPitch'
import { type LoudnessReport } from './audio/loudness'
import { downloadBlob, formatTime, safeStem, type WavBits } from './audio/exportWav'
import { analyzeInWorker, encodeWavInWorker, isAbortError, processInWorker, resetWorker } from './audio/workerClient'
import { usePlayer } from './hooks/usePlayer'
import {
  CONCERT_PRESETS,
  PLATFORM_PROFILES,
  SOLFEGGIO_PRESETS,
  computePitchRatio,
  formatHz,
  hzToCents,
  loadCustomHz,
  loadPlatform,
  loadTargetSettings,
  saveCustomHz,
  savePlatform,
  saveTargetSettings,
  type PlatformId,
  type TargetMode,
} from './audio/frequencies'

const ACCEPTED_AUDIO = 'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff'

type RenderedOutput = {
  buffer: AudioBuffer
  loudness: LoudnessReport
  fileName: string
  targetHz: number
  mode: TargetMode
  solfNote: string
  preserveTempo: boolean
  platform: PlatformId
}

export default function App() {
  const player = usePlayer()
  const [fileName, setFileName] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [rendered, setRendered] = useState<RenderedOutput | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loudOrig, setLoudOrig] = useState<LoudnessReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProg, setAnalyzeProg] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [processProg, setProcessProg] = useState(0)
  const [processLabel, setProcessLabel] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [wavBits, setWavBits] = useState<WavBits>(24)
  const [helpOpen, setHelpOpen] = useState(false)
  const sessionRef = useRef(0)

  const initialTarget = useMemo(() => loadTargetSettings(), [])
  const [targetHz, setTargetHz] = useState<number>(initialTarget.targetHz)
  const [mode, setMode] = useState<TargetMode>(initialTarget.mode)
  const [solfNote, setSolfNote] = useState<string>(initialTarget.solfNote)
  const [customInput, setCustomInput] = useState('')
  const [customs, setCustoms] = useState<number[]>(() => loadCustomHz())
  const [platform, setPlatform] = useState<PlatformId>(() => loadPlatform())
  const [preserveTempo, setPreserveTempo] = useState(true)

  useEffect(() => {
    saveTargetSettings(targetHz, mode, solfNote)
  }, [targetHz, mode, solfNote])

  useEffect(() => {
    savePlatform(platform)
  }, [platform])

  const sourceHz = analysis?.hz ?? 440
  const ratio = useMemo(
    () => computePitchRatio(sourceHz, targetHz, mode, solfNote),
    [sourceHz, targetHz, mode, solfNote],
  )
  const effectiveTargetA4 = sourceHz * ratio
  const cents = hzToCents(sourceHz, effectiveTargetA4)
  const alreadyTuned = !!analysis && Math.abs(cents) < 4
  const longFile = (buffer?.duration ?? 0) > 8 * 60

  const result = rendered?.buffer ?? null
  const loudRes = rendered?.loudness ?? null
  const resultStale =
    !!rendered &&
    (Math.abs(rendered.targetHz - targetHz) > 1e-4 ||
      rendered.mode !== mode ||
      (mode === 'solfeggio' && rendered.solfNote !== solfNote) ||
      rendered.preserveTempo !== preserveTempo ||
      rendered.platform !== platform)

  const runAnalysis = useCallback(
    async (decoded: AudioBuffer, name: string) => {
      const token = ++sessionRef.current
      resetWorker()
      setProcessing(false)
      setExporting(false)
      setProcessLabel('')
      setError(null)
      setRendered(null)
      setAnalysis(null)
      setLoudOrig(null)
      player.stop()
      setFileName(name)
      setBuffer(decoded)
      setAnalyzing(true)
      setAnalyzeProg(0)
      try {
        const { analysis: tuning, loudness } = await analyzeInWorker(decoded, (p) => {
          if (sessionRef.current === token) setAnalyzeProg(p)
        })
        if (sessionRef.current !== token) return
        setAnalysis(tuning)
        setLoudOrig(loudness)
      } catch (e) {
        if (isAbortError(e) || sessionRef.current !== token) return
        console.error(e)
        setError('Datei konnte nicht analysiert werden.')
      } finally {
        if (sessionRef.current === token) {
          setAnalyzing(false)
          setAnalyzeProg(1)
        }
      }
    },
    [player],
  )

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

  const playOriginal = useCallback(() => {
    if (!buffer || analyzing) return
    void player.play(buffer, 'original', 1, player.frac())
  }, [buffer, analyzing, player])

  const playPreview = useCallback(() => {
    if (!buffer || analyzing) return
    void player.play(buffer, 'preview', ratio, player.frac())
  }, [buffer, analyzing, player, ratio])

  const playResult = useCallback(() => {
    if (!result) return
    void player.play(result, 'result', 1, player.frac())
  }, [result, player])

  const onSeek = useCallback(
    (frac: number) => {
      player.seek(frac)
      if (player.playing === 'original' && buffer) void player.play(buffer, 'original', 1, frac)
      else if (player.playing === 'preview' && buffer) void player.play(buffer, 'preview', ratio, frac)
      else if (player.playing === 'result' && result) void player.play(result, 'result', 1, frac)
    },
    [player, buffer, ratio, result],
  )

  const convert = async () => {
    if (!buffer || !analysis || !fileName) return
    const token = sessionRef.current
    const snap = {
      fileName,
      targetHz,
      mode,
      solfNote,
      preserveTempo,
      platform,
    }
    setError(null)
    setProcessing(true)
    setProcessProg(0)
    setProcessLabel('Starte …')
    setRendered(null)
    player.stop()

    try {
      const ctx = player.ctx()
      const profile = PLATFORM_PROFILES.find((p) => p.id === snap.platform)!
      const out = await processInWorker(
        ctx,
        buffer,
        ratio,
        snap.preserveTempo,
        profile.lufs,
        profile.truePeak,
        (p, label) => {
          if (sessionRef.current === token) {
            setProcessProg(p)
            setProcessLabel(label)
          }
        },
      )
      if (sessionRef.current !== token) return
      setRendered({
        buffer: out.buffer,
        loudness: out.loudness,
        ...snap,
      })
      setProcessProg(1)
      setProcessLabel('Fertig')
    } catch (e) {
      if (isAbortError(e) || sessionRef.current !== token) return
      console.error(e)
      setError('Umwandlung fehlgeschlagen. Versuche „Tempo nicht halten“ oder eine kürzere Datei.')
    } finally {
      if (sessionRef.current === token) {
        setProcessing(false)
      }
    }
  }

  const cancelProcess = () => {
    resetWorker()
    setProcessing(false)
    setProcessLabel('Abgebrochen')
  }

  const download = async () => {
    if (!rendered || exporting) return
    setError(null)
    setExporting(true)
    try {
      const blob = await encodeWavInWorker(rendered.buffer, wavBits)
      const noteTag = rendered.mode === 'solfeggio' ? `${rendered.solfNote}_` : ''
      const plat = rendered.platform === 'none' ? '' : `_${rendered.platform}`
      const tempo = rendered.preserveTempo ? '' : '_asetrate'
      const outName = `${safeStem(rendered.fileName)}_${noteTag}${formatHz(rendered.targetHz, 2)}Hz${plat}${tempo}_${wavBits}bit.wav`
      downloadBlob(blob, outName)
    } catch (e) {
      if (isAbortError(e)) return
      console.error(e)
      setError(e instanceof Error ? e.message : 'WAV-Export fehlgeschlagen.')
    } finally {
      setExporting(false)
    }
  }

  const keyActionRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyActionRef.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return

    if (e.code === 'Space') {
      if (tag === 'BUTTON' || tag === 'A') return
      e.preventDefault()
      if (player.playing) player.pause()
      else if (result) playResult()
      else if (buffer && !analyzing) playOriginal()
    } else if (e.key === '1' || e.key === 'a' || e.key === 'A') {
      playOriginal()
    } else if (e.key === '2' || e.key === 'v' || e.key === 'V') {
      playPreview()
    } else if (e.key === '3' || e.key === 'b' || e.key === 'B') {
      playResult()
    } else if (e.key === 'l' || e.key === 'L') {
      player.toggleLoop()
    } else if (e.key === 'ArrowLeft') {
      onSeek(Math.max(0, player.frac() - 0.05))
    } else if (e.key === 'ArrowRight') {
      onSeek(Math.min(1, player.frac() + 0.05))
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyActionRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const profile = PLATFORM_PROFILES.find((p) => p.id === platform)!
  const waveBuf = player.playing === 'result' && result ? result : buffer
  const now = waveBuf ? player.progress * waveBuf.duration : 0

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>FREQUNZY</h1>
            <p className="tag">Kammerton erkennen · umstimmen · plattformfertig mastern</p>
          </div>
        </div>
        <button
          className="ghost"
          type="button"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((v) => !v)}
        >
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
            if (!drag) setDrag(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setDrag(false)
          }}
          onDrop={onDrop}
        >
          {!buffer ? (
            <div className="drop">
              <label className="drop-hit">
                <input
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0]
                    e.currentTarget.value = ''
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
                    accept={ACCEPTED_AUDIO}
                    hidden
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0]
                      e.currentTarget.value = ''
                      if (f) void loadFile(f)
                    }}
                  />
                </label>
              </div>
              <Gauge
                hz={analysis?.hz ?? null}
                targetHz={targetHz}
                targetA4={effectiveTargetA4}
                mode={mode}
                solfNote={solfNote}
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
              <Spectrum analyserRef={player.analyserRef} active={player.playing !== null} />
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
                <button
                  type="button"
                  aria-pressed={player.loop}
                  className={`ghost sm ${player.loop ? 'on' : ''}`}
                  onClick={player.toggleLoop}
                >
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
                <div className="prog" role="status">
                  <div style={{ width: `${analyzeProg * 100}%` }} />
                  <span>Kammerton wird ermittelt …</span>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel">
          <div className="tabs" role="tablist" aria-label="Zielstimmungs-Modus">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'concert'}
              className={mode === 'concert' ? 'on' : ''}
              onClick={() => setMode('concert')}
            >
              Kammerton A4
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'solfeggio'}
              className={mode === 'solfeggio' ? 'on' : ''}
              onClick={() => {
                const match = SOLFEGGIO_PRESETS.find((p) => Math.abs(p.hz - targetHz) < 0.05)
                if (!match) {
                  setTargetHz(528)
                  setSolfNote('C5')
                } else {
                  setSolfNote(match.note)
                }
                setMode('solfeggio')
              }}
            >
              Solfeggio
            </button>
          </div>

          {mode === 'concert' ? (
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
                >
                  <strong>{p.hz % 1 === 0 ? p.hz : p.hz.toFixed(2)}</strong>
                  <em>{p.name}</em>
                  <span>{p.desc}</span>
                </button>
              ))}
            </div>
          ) : (
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
                <div
                  key={hz}
                  className={`chip mini ${mode === 'concert' && Math.abs(targetHz - hz) < 0.01 ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="mini-select"
                    onClick={() => {
                      setTargetHz(hz)
                      setMode('concert')
                    }}
                  >
                    {formatHz(hz, 2)} Hz
                  </button>
                  <button
                    type="button"
                    className="x"
                    aria-label={`Frequenz ${formatHz(hz, 2)} Hz entfernen`}
                    onClick={() => removeCustom(hz)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="ratio-card">
            <div>
              <span className="k">Verhältnis</span>
              <strong>{ratio.toFixed(6)}</strong>
            </div>
            <div>
              <span className="k">Verschiebung</span>
              <strong>
                {cents >= 0 ? '+' : ''}
                {cents.toFixed(2)} ct
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
                  ? 'WSOLA-Pitch-Shift, Dauer bleibt gleich — Vorschau ignoriert das und ist sofort da'
                  : 'Nur Resampling — höchste Qualität, Tempo ändert sich leicht'}
              </small>
            </span>
          </label>

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

          {error && (
            <div className="err" role="alert">
              {error}
            </div>
          )}

          {resultStale && !processing && (
            <div className="badge warn stale-note">
              Einstellungen geändert — für aktualisiertes Ergebnis erneut „Umwandeln“ wählen
            </div>
          )}

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
            <button
              type="button"
              className="gold"
              disabled={!rendered || exporting}
              onClick={() => void download()}
            >
              {exporting ? 'Exportiere …' : `WAV ${wavBits}-bit`}
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
            <div className="prog" role="status">
              <div style={{ width: `${processProg * 100}%` }} />
              <span>
                {processLabel} · {Math.round(processProg * 100)} %
              </span>
            </div>
          )}

          {loudRes && rendered && (
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
                <strong>{formatTime(rendered.buffer.duration)}</strong>
              </div>
              <div>
                <span className="k">Gerendertes Ziel</span>
                <strong>
                  {rendered.mode === 'solfeggio'
                    ? `${rendered.solfNote} = ${formatHz(rendered.targetHz, 2)} Hz`
                    : `${formatHz(rendered.targetHz, 2)} Hz`}
                </strong>
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
