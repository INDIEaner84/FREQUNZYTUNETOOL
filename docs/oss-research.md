# Open-Source-Landkarte: Audio, Frequenzen, Klangqualität

Recherche (Stand 2026-11-26) für FREQUNZY: Sound-Bearbeitung, Frequenzmanipulation,
Qualitätsverbesserung, „wissenschaftliche“/Solfeggio-Frequenzen.
Lizenz-Ampel **für dieses Projekt** (Browser-Web-App):

- 🟢 **MIT/BSD/ISC** — direkt einbettbar
- 🟡 **LGPL** — ok als dynamisch gelinkte/WASM-Komponente; nicht statisch in geschlossenen Builds
- 🔴 **GPL/AGPL** — nur mit kompatibler Projektlizenz oder als separater Prozess/CLI

## 1. Pitch-Shifting & Time-Stretching

| Projekt | Lizenz | Ansatz | Ampel / Status hier |
|---|---|---|---|
| **Signalsmith Stretch** (npm `signalsmith-stretch@1.3.2`) | MIT | Hybrid-Spektral, Pitch+Zeit simultan, WASM/AudioWorklet | 🟢 **Integriert** (HQ-Pfad, Standard) — `src/audio/signalsmith.ts` |
| **Rubber Band** (Robin Lee) | GPL-2+ / kommerziell | Phase Vocoder R3 (multiband) | 🔴 nur via Audacity/Ardour oder kommerzielle Lizenz |
| **SoundTouch** (Olli Parviainen) + `soundtouch-rs`, `SoundTouchJS` | LGPL-2.1 | WSOLA + Resampling | 🟡 alternativ denkbar; WSOLA-Pfad hier **mit Phase Vocoder ersetzt** (s. §7) |
| **SBSMS** (in Audacity) | GPL | Sinusoidal + Residual | 🔴 |
| **Paulstretch** | GPL | Phase-Randomisierung | 🔴 extrem-Stretching only |
| **libsamplerate / libsoxr** | BSD / LGPL | Ausgezeichnetes Resampling (Sinc) | 🟡 Referenz; im Browser hier Blackman-sinc-FIR implementiert |

- SoX: `sox in.wav out.wav pitch -31.77` (≈ 440→432) und FFmpeg `rubberband`-Filter als CLI-Alternative.
- SoundTouch-README: `-pitch=-0.318` für 440→432 Hz (⅓ Halbton).

## 2. Kammerton-/Pitch-Erkennung & Analyse

| Projekt | Lizenz | Bemerkung | Ampel |
|---|---|---|---|
| **Essentia** (MTG/UPF) — `essentia`, `essentia.js` | AGPL | `TuningFrequency`-Descriptor, HPCP/Chroma, Key/Scale; WASM für Browser | 🔴 nur als separater Prozess (sonst AGPL-Kaskade) |
| **librosa** (Python) | ISC | `pyin`, Chroma, CQT; Standard für MIR | 🟢 als Analyse-Sidecar/Batch |
| **aubio** | GPL | Echtzeit-Pitch/Onset/Tempo | 🔴/🟡 (CLI) |
| **CREPE / torchcrepe** | MIT | Neuronales F0-Tracking, sehr robust | 🟢 Sidecar; TorchCrepe auf CPU brauchbar |
| **SwiftF0** (Preprint 08/2025) | wissenschaftlich | ~42× schneller als CREPE, 95k Parameter | 🟡 Beobachtung |
| **Basic Pitch** (Spotify) | Apache-2.0 | Polyphonie→MIDI, TF.js-Build verfügbar | 🟢 falls Transkription gewünscht |
| **Praat** (+ Parselmouth) | GPL | Wissenschaftlicher Standard (F0, Formanten) | 🟡 CLI |
| **Sonic Visualiser** + Vamp | MIT | Interaktive Analyse, Spektrogramme | 🟢 Begleit-Tool |
| **Meyda** (JS) | MIT | Web-Audio-Features (Chroma, MFCC, zentroid) | 🟢 einbettobar |
| **Spek / Friture / Jaaa** | div. | Spektrum-Viewer (GUI) | 🟢 Begleit-Tools |
| Aktuell implementiert | Eigencode | Spektrales 12-TET-Histogramm, Key-Estimation, EBU-R128-Meter | ✅ bleibt, ohne Fremdabhängigkeit |

## 3. Editoren & DAWs (GUI)

- **Audacity** (GPL) / **Tenacity** (GPL-Fork) — Change Pitch/Tempo, Spektrogramm, Rauschunterdrückung [Change Pitch nutzt Rubber Band/SBSMS seit 3.5]
- **Ardour 9** (GPL) — volle DAW, LV2/VST3
- **LMMS / Zrythm / Qtractor / Rosegarden / Kwave** (GPL) — je nach Fokus
- **SoX** (GPL, CLI) — Batch: `pitch`, Spektrogramm, Statistiken
- ⚠️ **ocenaudio** = Freeware, **nicht** Open Source; **REW** = Freeware, nicht OSS; **Scala** = Freeware, nicht OSS.

## 4. Mastering, Loudness, Qualität

- **Matchering** (GPL-3.0, sergree/matchering) — Referenz-Matching-Mastering (RMS/FR/Peak/Stereo-Width); Python/Docker/CLI. 🔴 nur als separater Prozess — z. B. `matchering target.wav reference.wav out.wav`. Es gibt HTTP-Sidecars (`audio-mastering-sidecar`, GPL-3).
- **libebur128** (MIT) / **pyloudnorm** (MIT) — unabhängige BS.1770-Meter zur Verifikation eigener Messung. ✅ **Verifiziert 2026-11-26** (siehe §9).
- **FFmpeg `loudnorm`** (LGPL/GPL) — EBU-R128 1-/2-Pass; **ffmpeg-normalize** (npm), **ffmpeg.wasm** für Browser.
- **Grisey** (GPL-3) — Metering-Plugin (LUFS/True-Peak/Spektrum), VST3/CLAP. **LSP Plugins / x42** (LV2, Linux).
- **loudgate** (MIT) — STFT-Wiener-Denoise + R128-Mastering als CLI/Mini-GUI.
- **Resampling:** libsamplerate (BSD), libsoxr (LGPL).

## 5. Rauschunterdrückung & Restoration (AI)

- **RNNoise** (BSD) — winziges GRU-Modell, Echtzeit, ~10 ms Latenz, Browser/WASM-tauglich. Für **Sprache**, nicht Musik.
- **DeepFilterNet 3** (MIT/Apache) — State of the Art Open-Source-Speech-Enhancement, 48 kHz; **entfernt bei Musik auch Obertöne** (nur Sprache geeignet). 🟢/🔴 je nach Einsatz.
- **resemble-enhance** (MIT) — Denoise + Bandbreitenerweiterung (Flow-Matching), 44.1 kHz Sprache.
- **VoiceFixer** (CC BY 4.0) — Sprach-Super-Resolution.
- **AudioSR / Versatile Audio Super-Resolution** (MIT) — jedes Audio (Musik/Sprache/FX) → 48 kHz, 2–16 kHz Bandbreite → 24 kHz; auch als Audacity-OpenVINO-Plugin. **Musik-tauglichste** "Qualitäts-Verbesserungs"-Option.
- **noisereduce** (MIT, Python) — klassisches spektrales Gating.
- ⚠️ Alle AI-Enhancer: für Musik nur mit Vorsicht; klassisches Wiener/Spectral-Gating ist sicherer.
- **UVR / Demucs / Spleeter / Open-Unmix** (alle MIT) — Stem-Separation; nützlich, um vor dem Retuning Vocals/Drums getrennt zu bearbeiten. **Demucs htdemucs_6s** = 6 Stems (Vocals, Drums, Bass, Other, Guitar, Piano).

## 6. Wissenschaftliche Frequenzen / Solfeggio / Mikrotonal

| Ressource | Lizenz | Inhalt | Status hier |
|---|---|---|---|
| **evoluteur/healing-frequencies** | MIT © 2026 Olivier Giulieri | Frequenzen: Solfeggio (174–2172), Heilungsforks 128/256/512/1024, Schumann 7.83, Ohm 68/136/272/544, Chakras, Kosmische Oktave/Planeten, Organe, Mineralien, DNA-Nukleotide, Tesla 3-6-9, Angel Numbers, Otto | 🟢 **Integriert** als Daten-Port (`src/audio/tuningForks.ts`), Sinuston-Vorhör + Ziel-Ausrichtung, Attribution im UI + `THIRD_PARTY_NOTICES.md` |
| **SYQEL/HZP** (Hz Player) | Open Source (C#/WPF) | Realtime 440→Solfeggio-Konvertierung beim Abspielen | Referenz-UX; nicht direkt portierbar |
| **Scale Workshop** | Open Source | Mikrotonale Skalen entwerfen/exportieren (.scl/.kbm/.tun) | Begleit-Tool |
| **Tune.js** | MIT | 3.000+ historische Stimmungen (Scala-Archiv) als JS/Web-Audio | 🟢 einbettobar, falls Temperamente gewünscht |
| **Surge XT** | GPL | Synth mit vollem Microtuning (.scl/.kbm, MTS-ESP) | 🔴 als Plugin-Host relevant |
| **Scala** | Freeware (nicht OSS) | De-facto-Standard .scl/.kbm | Tooling |
| **Csound + csound_tuning** | LGPL/GPL-3 | Scalatuning/MTS-ESP Opcodes | 🟡 |
| **HZP-Konvertierungs-Tabelle** | — | 432/528/639/741/852/963 als Abspiel-Ziele | semantisch identisch zur Solfeggio-/Fork-Funktion hier |

- Mathematische Verortung: jede Gabel-Frequenz hat eine exakte 12-TET-Näherung; Versatz in Cent = `1200 · log2(f / f_12TET(note))`. Die App zeigt ihn pro Eintrag an (`nearestNoteToHz`). Nicht geraten, nicht rundet.
- Hinweis: „Heilwirkung“ von Solfeggio etc. ist esoterische Tradition, keine medizinische Wissenschaft; im UI als solche gekennzeichnet.

## 7. Qualitäts-Debugging in diesem Repo (was praktisch gefunden & behoben wurde)

1. **WSOLA degenerierte zu Resampling bei Shifts < 4 %** (`seek = 0`): a) 440→432-Render lief als 440 Hz wieder heraus; b) mit Korrelationssuche: Perioden-Locks → Phasenjitter bei Haltetönen. → **Ersetzt durch Phase Vocoder** (STFT, Identity-Phase-Propagation) mit exakter OLA-Normalisierung (`src/audio/phaseVocoder.ts`). Gemessen: 432 Hz Sinus, Resample+Stretch → A@432 = 0.600 (vorher 0.02), Länge exakt Input, Peak < 0.7.
2. **Kubische Interpolation** als Resampler → ersetzt durch **Blackman-windowed Sinc-FIR** (32 Tap, DC-Gain 1 auch an Rändern, Anti-Alias beim Decimieren). A@432 = 0.6000, A@440-Residuum < 0.01.
3. **Kammerton-Anzeige** um Halbton-Verschiebung (4 Nachkommastellen) erweitert; Verhältnis/Cent mit voller Gleitkomma-Genauigkeit.

4. **BS.1770-Meter** benutzte RBJ-Shelf-Näherung statt der ITU-De-Man-Biquads, dividierte die Kanal-Energie durch die Kanalzahl (falsch: BS.1770 summiert G_i · z_i), verlor einen Randblock (off-by-one) und approximierte True-Peak nur linear. → **Korrigiert**: De-Man-Koeffizienten (1681.97 Hz / +3.9998 dB / Q 0.7072; Highpass 38.1355 Hz / Q 0.5003), kein Division durch Kanalzahl, `s + block <= n`, Zero-Padding < 400 ms Signale, True-Peak via Blackman-Sinc-Kandidaten. **Kreuzvalidiert gegen pyloudnorm** (`filter_class='DeMan'`): Übereinstimmung auf 0,001 LU an 7 Testsignalen (1-kHz-Sinus, weißes Rauschen, Multitonal, Asymmetrie L/R, dynamisches Programm mit Gating, tiefbasslastig, Stille).

## 8. Loudness-Verifikation (2026-11-26, pyloudnorm 0.1.x, Python 3.11)

Testdateien: 48 kHz PCM16. Eigener Meter (`node /tmp/meter_node.mjs` auf Bundle von `loudness.ts`) vs. `pyloudnorm` DeMan/K-weighting:

| Signal | Eigen (LUFS) | pyloudnorm DeMan | pyloudnorm K-weighting |
|---|---|---|---|
| 1 kHz Sinus 0.1 FS | −19.993 | −19.993 | −20.035 |
| Weißes Rauschen 0.05 | −19.871 | −19.871 | −19.914 |
| Multitonal (440/554/659/220) | −9.405 | −9.405 | −9.447 |
| Asymmetrisch L −20 dBFS / R −40 dBFS | −22.961 | −22.961 | −23.002 |
| Dynamisch (8 s laut / 12 s leise), Gating | −14.055 | −14.055 | −14.096 |
| Tiefbass 30 Hz + 1 kHz | −14.684 | −14.684 | −14.696 |
| Stille | −70.0 (Gate-Floor) | −inf | −inf |

Abweichung ≤ 0.001 LU (DeMan, bit-identisches Biquad-Design) und ≤ 0.06 LU zur RBJ-Näherung. True-Peak: 12-kHz-Sinus bei voller Aussteuerung wird mit −0.91 dBTP erkannt (Sample-Peak −3.93 dBFS → Intersample-Overshoot korrekt erfasst).

## 9. Integrationsempfehlung / Fahrplan

Kurz: alles mit 🟢 ist oder kann ohne Lizenzrisiken eingebaut werden; 🔴 gehört in externe Prozesse
(CLI/Docker), nicht ins Bundle. Die App liefert bereits: Sinc-Resampler, Phase Vocoder,
Signalsmith-HQ-Pfad, Klanggabel-Katalog, Präzisions-Anzeigen, R128-Mastering.

Nächste sinnvolle Schritte (optional, bewusst nicht ungefragt eingebaut):

- ~~Referenz-Meter-Verifikation~~ ✅ erledigt (2026-11-26, siehe §8); optional als CI-Vergleich automatisieren.
- **Essentia.js** als optionaler Analyse-Modus hinter einem Toggle, falls AGPL-Lizenzierung des Projekts akzeptabel (oder Essentia als Sidecar).
- **AudioSR** als optionaler Sidecar „Qualität anheben" (Musik tauglich); **DeepFilterNet** nur für Sprachcontent.
- **Matchering** als optionaler Sidecar „Mastering nach Referenz".
- **Basic Pitch (TF.js)** für polyphone Transkription als Export-Feature.
- **Tune.js** für historische Temperamente (Pythagoreisch, mitteltönig, wohltemperiert) als dritter Zielmodus.
