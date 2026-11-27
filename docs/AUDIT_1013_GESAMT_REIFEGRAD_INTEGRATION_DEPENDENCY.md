# #1013 Gesamt-Reifegrad-, Integrations- und Dependency-Audit

**Repository:** `INDIEaner84/FREQUNZYTUNETOOL` (öffentlich)  
**Geprüfter Stand:** Branch `arena/dccfecd3-frequnzytunetool` · Basis-Commit `43b152bf5ceabef1d8575c0dc0083b1994a33f03` (`main`)  
**Prüfdatum:** 2026-11-26 (UTC)  
**Prüfumgebung:** Node.js `v22.22.3` · npm `10.9.8` · TypeScript `5.9.3` · Vite `5.4.21` (Linux x64)  
**Methodik:** Vollständige Zeilenprüfung aller 29 Repository-Dateien + empirische Ausführungsbeweise (*Executed Proofs*) gegen den kompilierten Original-Code (`src/audio/*.ts`), `npm ci`, `npm audit`, `npm outdated`, `tsc --noEmit`, `vite build` sowie Abfrage der GitHub-Actions-Historie.

---

## 0. Executive Summary & Gesamturteil

**FREQUNZY Tune Tool** ist eine schlanke, optisch stimmige React/TypeScript-Webanwendung zur lokalen Kammerton-Erkennung (A4 / Solfeggio), Tonhöhen-Umstimmung (Resampling + WSOLA im Web Worker) und Lautheits-Normalisierung nach Streaming-Plattform-Vorgaben inklusive 16-/24-Bit-WAV-Export.

Der Build- und Typprüfungs-Zustand ist sauber (`tsc` 0 Fehler, Produktions-Bundle nur **58,4 kB gzip**, **0 Produktions-CVEs**). Hinter der funktionierenden Oberfläche zeigt die messtechnische Prüfung jedoch **kritische fachliche DSP-Abweichungen**, **reale Integrations- und Zustandsfehler**, **0 % automatisierte Testabdeckung**, **100 % Fehlschlagrate in allen 20 bisherigen GitHub-Actions-Läufen** sowie einen **DSGVO-Widerspruch** zwischen dem Versprechen *„Alles bleibt im Browser“* und dem Nachladen externer Google Fonts.

### Reifegrad-Matrix (gemessen)

| # | Dimension | Score | Reifegrad | Kernbefund (Evidenz) |
|---|---|---:|---|---|
| 1 | **Build & Typensicherheit** | **4,5 / 5** | Hoch | `tsc --noEmit` (App & Node) fehlerfrei; `vite build` in 1,11 s grün (`58,36 kB` gzip gesamt). Kleine Lücke: `vite@^5.4.11` Untergrenze in `package.json` vs. `allowedHosts` (ab `5.4.12`). |
| 2 | **Architektur & Code-Struktur** | **3,5 / 5** | Solide | Klare Trennung UI ↔ Hook ↔ Worker ↔ DSP (`Float32Array`-basiert, ohne Audio-Fremd-Libs). Abzüge: monolithische `src/App.tsx` (671 Zeilen), 7 tote Exporte, 4 Code-Duplikate. |
| 3 | **DSP- & Fachlogik-Korrektheit** | **2,0 / 5** | Kritisch | Stereo-LUFS **−3,01 LU** zu tief (`acc / chans`); Limiter lässt **+3,43 dBFS Hard-Clipping** durch; `truePeakChannels` mathematisch blind für Inter-Sample-Peaks; WSOLA-Phasenversatz + bei 432 Hz deaktiviert (`seek = 0`); 415/528-Hz-Faltung im Detektor. |
| 4 | **Interne & Externe Integration** | **2,5 / 5** | Lückenhaft | Solfeggio zeigt falsche Cent-Werte im `Gauge` (−1606 ct statt −6,1 ct) und bricht bei Reload; Export speichert alten Puffer unter neuem Dateinamen; Worker-Race-Condition bei Dateiwechsel während Konvertierung; 60-Hz-Listener-/Canvas-Churn. |
| 5 | **Tests & Verifikation** | **0,0 / 5** | Fehlt | **0 Testdateien**, kein Test-Runner, kein `"test"`-Script in `package.json`, keine Regressionssicherung für DSP-Invarianten. |
| 6 | **CI/CD & Governance-Gates** | **0,5 / 5** | Ausgefallen | **20 / 20 GitHub-Actions-Runs `failure`** (seit 2026-09-07); kein deterministisches Build/Typecheck/Test-Gate; ungepinntes `@latest`-Action-Tag mit `contents: write` + Prompt-Injection-Vektor in `audit-pr.yml`. |
| 7 | **Dependency- & Supply-Chain-Sicherheit** | **2,5 / 5** | Mittel | Nur 2 direkte / 5 gesamte Prod-Pakete (**0 Prod-CVEs**). Im Dev-Stack **3 Schwachstellen (2 High, 1 Moderate)** in `vite`, `source-map-js`, `esbuild` — verschärft durch `host: '0.0.0.0'` + `allowedHosts: true`. |
| 8 | **Lizenz, Datenschutz & Release-Reife** | **2,5 / 5** | Lückenhaft | Alle 115 Lockfile-Pakete frei von Copyleft/GPL (106 MIT, 5 ISC, 2 Apache-2.0, 1 BSD-3-Clause, 1 CC-BY-4.0 nur Dev). **Aber:** keine `LICENSE`-Datei im öffentlichen Repo, kein `"license"`-Feld in `package.json`, **DSGVO-Verstoß durch Google Fonts CDN** (`index.html:9–11`). |
| | **Gesamtergebnis** | **18,0 / 40 (45,0 %)** | **TRL 5–6** | **Technischer Prototyp / MVP — vor produktivem Mastering-Einsatz oder Verkauf P0/P1-Sanierung erforderlich.** |

---

## 1. Teil I — Gesamt-Reifegrad-Audit

### 1.1 Repository-Inventar, Historie & Build-Metriken

* **Git-Historie (`main`):** 4 Commits insgesamt — Initialisierung & MVP am `2026-08-21` (`100e075`, `c8ef406`, Merge PR #1 `ce1303c`), ergänzt um OpenCode-Audit-Workflows am `2026-09-07` (`43b152b`). Seitdem keine Code-Änderungen.
* **Dateiumfang:** 29 versionierte Dateien mit **4.934 Zeilen** (davon `package-lock.json`: 1.750 Zeilen; Anwendungsquellcode unter `src/`: **17 Dateien / 2.870 Zeilen**).

| Bereich / Datei | Zeilen | Bytes | Rolle & Reifegrad-Notiz |
|---|---:|---:|---|
| `src/App.tsx` | 671 | 24.355 | Haupt-UI, State, Persistenz, Datei-I/O, Shortcuts (monolithisch; 4 Integrationsfehler) |
| `src/styles.css` | 630 | 10.618 | Komplettes Styling, responsives Grid (`980px` / `640px`), Custom Properties |
| `src/audio/detectPitch.ts` | 251 | 7.603 | 12-TET-Cent-Histogramm, Krumhansl-Schmuckler-Tonart, Kandidaten-Scoring |
| `src/audio/pitchShift.ts` | 195 | 5.872 | Kubisches Resampling + WSOLA-Time-Stretch (Überlappungs- & Aliasing-Mängel) |
| `src/audio/frequencies.ts` | 175 | 5.481 | Kammerton-/Solfeggio-/Plattform-Profile, Frequenzrechner, `localStorage`-Helfer |
| `src/audio/loudness.ts` | 174 | 5.608 | Vereinfachte BS.1770/R128-Messung + Lookahead-Limiter (kritische Stereo-/Limiter-Bugs) |
| `src/hooks/usePlayer.ts` | 165 | 4.840 | Web-Audio-Transport, A/B-Quellenwahl, Loop, Seek, AnalyserNode |
| `src/audio/workerClient.ts` | 116 | 3.723 | Singleton-Worker-RPC mit Transferables (`ArrayBuffer`) |
| `src/components/Gauge.tsx` | 100 | 3.019 | SVG-Zeigerinstrument & Cent-Anzeige |
| `src/audio/exportWav.ts` | 96 | 2.818 | 16-/24-Bit RIFF-WAV-Encoder mit TPDF-Dither & Blob-Download |
| `src/components/Waveform.tsx` | 73 | 2.018 | 2D-Canvas-Wellenform + Klick-Seek (zeichnet bei 60 Hz komplett neu) |
| `src/audio/processWorker.ts` | 64 | 1.948 | Web-Worker-Entrypoint (`analyze` / `process`) |
| `src/components/Spectrum.tsx` | 58 | 1.895 | Echtzeit-FFT-Balkenanzeige (60-Hz-rAF) |
| `src/audio/fft.ts` | 53 | 1.268 | In-place Radix-2 Cooley-Tukey FFT + Hann-Fenster |
| `src/audio/raw.ts` | 38 | 1.110 | `RawAudio`-Konvertierung & Mono-Downmix |
| `src/main.tsx` + `src/vite-env.d.ts` | 11 | 265 | React-18-Root (`StrictMode`) |
| `.github/workflows/*.yml` (3 Dateien) | 170 | 5.346 | OpenCode-basierte Workflows (`audit-deps`, `audit-pr`, `audit-weekly`) |
| Konfig, HTML, Assets, Lockfile (9 Dateien) | 1.889 | 63.688 | `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `README.md`, `.gitignore`, `favicon.svg` |

**Produktions-Build (`npm run build`, gemessen):**

| Artefakt | Unkomprimiert | Gzip | Bewertung |
|---|---:|---:|---|
| `dist/index.html` | 1,08 kB | 0,62 kB | Sehr schlank |
| `dist/assets/processWorker-*.js` | 9,81 kB | ~3,6 kB | Sauber isolierter Web-Worker-Chunk |
| `dist/assets/index-*.css` | 8,56 kB | 2,42 kB | Kompakt, keine CSS-Runtime nötig |
| `dist/assets/index-*.js` | 168,88 kB | 55,32 kB | Fast ausschließlich `react` + `react-dom` |

---

### 1.2 Ausgeführte DSP- & Fachlogik-Beweise (*Executed Proofs*)

Alle folgenden Befunde wurden direkt durch Ausführung der unveränderten Module in `src/audio/*.ts` mit synthetischen Referenzsignalen nachgewiesen:

#### Befund DSP-01 (KRITISCH) — Stereo-LUFS systematisch um −3,01 LU zu niedrig (`src/audio/loudness.ts:70–75`)
* **Ursache im Code:** `measureLoudnessChannels` summiert die mittlere quadratische Leistung der Kanäle und teilt anschließend durch die Kanalanzahl (`const mean = acc / chans`, Zeile 74). Gemäß **ITU-R BS.1770-4 Abschnitt 2.2 / Gleichung (2)** werden Kanäle jedoch mit Kanalgewichten $G_i = 1{,}0$ (L, R, C) bzw. $G_i = 1{,}41$ (Surround) **ohne Division durch die Kanalzahl summiert**: $L_K = -0{,}691 + 10\log_{10}(\sum_i G_i z_i)$.
* **Gemessener Beweis:** Ein voll ausgesteuerter 997-Hz-Sinus (`0 dBFS` @ 48 kHz) liefert:
  * Mono (1 Kanal): **`−3,04 LUFS`** (Normerwartung: `−3,01 LUFS`)
  * Stereo (2 Kanäle, $L = R$): **`−3,04 LUFS`** statt Normwert **`~0,00 LUFS`** — Abweichung **−3,04 LU**!
* **Auswirkung auf das Mastering:** Jede Stereo-Audiodatei wird um **3,01 LU zu leise** gemessen. Beim Mastering auf z. B. Spotify (`−14,0 LUFS`) verstärkt `normalizeChannels` jede Stereo-Datei um **+3,01 dB zu stark** (reale Ausgangslautheit ca. **`−11,0 LUFS`**), treibt das Signal unnötig in den Limiter und führt auf Streaming-Plattformen zu ~3 dB Penalty-Absenkung.
* **Weitere K-Weighting-Abweichungen (`src/audio/loudness.ts:7–34`):** Pre-Filter nutzt `f0 = 1500 Hz` mit Shelf-Slope `S = 1` statt BS.1770-Spezifikation (`f0 = 1681,97 Hz`, `gain = +4,00 dB`, `Q = 0,7072`); RLB-Hochpass nutzt `Q = 0,707` statt `Q = 0,5003` (überdämpft), was im Subbass (40–80 Hz) bis ca. 1 dB Gewichtungsfehler verursacht.

#### Befund DSP-02 (KRITISCH) — Limiter verfehlt Ceiling massiv und erzeugt digitales Hard-Clipping (`src/audio/loudness.ts:126–159`)
* **Ursache im Code:**
  1. `limitChannels` glättet die Gain-Reduktion mit `g += (needed - g) * Math.min(1, (1 / attack) * 8)` (`attack = 1 ms`) und wendet in Zeile 146 lediglich einen **Einzelpunkt-Versatz** `const look = env[Math.min(n - 1, i + attack)]` statt eines echten gleitenden Minimum-Fensters über `[i, i + attack]` an.
  2. Bei kurzen Transienten (< 1 ms, z. B. Drums/Clicks) erreicht `g` einerseits den Zielwert `ceiling / p` nicht, andererseits liegt `i + attack` zum Zeitpunkt des Transienten-Maximums bereits wieder im Abklingbereich — die Absenkung greift ~0,8 ms zu früh und lässt die eigentliche Spitze nahezu ungedämpft passieren.
  3. `normalizeChannels` regelt nach dem Limiter die Lautheit nicht nach.
* **Gemessener Beweis:** Ein dynamisches Stereo-Testsignal (−26 dBFS Grundton + 3-kHz-Drum-Transienten), normalisiert auf Spotify (`targetLufs = -14`, `truePeakDb = -1.0`), liefert am Ausgang von `normalizeChannels`:
  * Gemeldeter & realer Sample-Peak: **`+3,43 dBFS`** (**4,43 dB über dem −1,0-dBTP-Limit!**)
  * Beim anschließenden WAV-Export (`exportWav.ts:11`, `clampSample`) werden alle Samples > `1,0` (`0 dBFS`) hart abgeschnitten (**digitales Hard-Clipping**).

#### Befund DSP-03 (HOCH) — „True-Peak“-Messung ist mathematisch identisch mit Sample-Peak (`src/audio/loudness.ts:99–118`)
* **Ursache im Code:** `truePeakChannels` prüft nach `aa = |a|`, `ab = |b|` die drei linear interpolierten Zwischenwerte `m1 = |0.75a + 0.25b|`, `m2 = |0.5a + 0.5b|`, `m3 = |0.25a + 0.75b|`. Wegen der Dreiecksungleichung gilt für alle $a, b \in \mathbb{R}$ und $\lambda \in [0, 1]$ zwingend $|\lambda a + (1-\lambda)b| \le \max(|a|, |b|)$. Die Bedingungen `if (m1 > peak)`, `if (m2 > peak)`, `if (m3 > peak)` (Zeilen 112–114) sind **tote Code-Pfade (0 % erfüllbar)**. Echte True-Peak-Messung nach ITU-R BS.1770-4 Annex 2 erfordert mindestens 4×-Polyphasen-Sinc-FIR-Oversampling (überschwingfähig).
* **Gemessener Beweis:** Ein `Fs/4`-Kosinus mit Phasenlage $\pi/4$ (Abtastwerte exakt $\pm 0{,}7071$, realer rekonstruierter True-Peak = **`0,00 dBTP`**) wird von `truePeakChannels` mit **`−3,01 dBTP`** ausgewiesen (+3,01 dB Inter-Sample-Peak unerkannt). Zudem liefert `n === 1` wegen `i < n - 1` fälschlich `-120 dBTP`.

#### Befund DSP-04 (HOCH) — WSOLA-Überlappungsfehler, Deaktivierung bei 432 Hz, Stille am Ende & Aliasing (`src/audio/pitchShift.ts`)
1. **Falsche Korrelationsreferenz (`Zeile 78`):** `const aBase = prevStart + grain - overlap` vergleicht den Beginn des neuen Grains (`cand + i`, geschrieben ab `g * hopOut`) mit dem **Ende** des vorherigen Grains (`prevStart + 1604` @ 44,1 kHz) statt mit der tatsächlichen Überlappungsposition im Ausgangspuffer **`prevStart + hopOut`** (`prevStart + 794`). Der Versatz von 810 Samples (18,37 ms) führt zu Phasensprüngen an jeder Grain-Grenze (**2,51 dB Amplitudenmodulation** auf reinem 440-Hz-Sinus bei 440→528 Hz gemessen).
2. **WSOLA für Hauptanwendungsfall 440→432 Hz abgeschaltet (`Zeile 117`):** `const seek = Math.abs(stretch - 1) < 0.04 ? 0 : ...` setzt das Suchfenster für alle Abweichungen `< 4 %` auf `0`. Damit läuft für **7 von 9 Kammerton-Presets** (darunter 440→432 Hz mit `1,82 %` sowie 430,54 / 435 / 442 / 444 Hz) und **alle 9 Solfeggio-Presets** ein blindes Overlap-Add ohne Phasenanpassung (Kammfiltereffekte auf gehaltenen Akkorden).
3. **Abgeschnittenes Track-Ende (`Zeilen 55, 144`):** `for (let op = 0; op + grain < outLen; op += hopOut)` belegt die letzten Samples bis `target` nicht mehr mit Grains (`norm[i] === 0`). Gemessen bei 3,0 s @ 44,1 kHz: **321 Samples (7,28 ms) harte Null-Stille** am Dateiende (bis zu ~18 ms je nach Länge).
4. **Fehlender Anti-Aliasing-Tiefpass beim Hochstimmen (`Zeilen 23–32`):** `resampleChannel` nutzt kubische Interpolation ohne Bandbegrenzung bei `ratio > 1`. Gemessen: Ein 19,5-kHz-Ton @ 44,1 kHz (`19,5 × 1,2 = 23,4 kHz > Nyquist`) faltet ungedämpft mit **−11,63 dBFS** als Spiegelfrequenz (20,7 kHz) zurück ins Hörspektrum.

#### Befund DSP-05 (HOCH) — Kammerton-Detektor: Semiton-Faltung (415/528 Hz), +2,34-ct-Bias auf eigenem Testton & Sample-Rate-Drift (`src/audio/detectPitch.ts`)
| Testsignal (Akkord wie `loadTestTone`) | Sample-Rate | Erkannt (`hz`) | Fehler | Top-Kandidat | Befund |
|---|---:|---:|---:|---|---|
| **440,00 Hz (A-Dur, eingebauter Testton!)** | 44.100 Hz | **440,60 Hz** | **+2,34 ct** | `441 Hz (0.933)` vor `440 Hz (0.858)`, #3: `415 Hz (0.696)` | Parabel auf linearer Power `mag²` + `Math.floor`-Binning verschiebt 440 Hz systematisch Richtung 441 Hz |
| **432,00 Hz (A-Dur)** | 44.100 Hz | **431,45 Hz** | **−2,22 ct** | `432 Hz (0.872)` | Systematischer Parabel-Bias |
| **415,00 Hz (Barock, A-Dur)** | 44.100 Hz | **439,42 Hz** | **+98,98 ct** | `415 Hz (0.972)`, Tonart: **`As-Dur`** | `Math.round(midi)` faltet modulo ±50 ct; erkennt 440-Raster & falsche Tonart |
| **528,00 Hz (A4 = 528, A-Dur)** | 44.100 Hz | **443,78 Hz** | **−300,84 ct** | `444 Hz (0.979)` (`528 Hz` fehlt komplett!) | Faltung modulo 100 ct (+315,6 ct → +15,6 ct); `528 Hz` erreicht in `known` für **kein** Signal `score > 0` |
| **432,00 Hz (Hi-Res Audio)** | 192.000 Hz | **430,13 Hz** | **−7,53 ct** | **`Scientific · 430.54 Hz (0.926)`** vor `432 Hz (0.207)` | `fftSize = 8192` ist fest codiert (23,4 Hz Bin-Abstand @ 192 kHz!) |

* **Zusatzbefund Kandidaten-Label (`src/audio/frequencies.ts:144`):** `nearestPreset` ordnet bis `±1,5 Hz` den nächsten Preset-Namen zu — dadurch wird `441 Hz` in der UI sachlich falsch als **`ISO 16 · 441 Hz`** (ISO 16 definiert exklusiv 440 Hz) und `443 Hz` als **`Orchester · 443 Hz`** beschriftet.
* **Zusatzbefund Stereo-Peak (`src/audio/detectPitch.ts:31, 81`):** `peakDb` wird auf `mixMono(channels)` berechnet. Ein einseitig gepanntes Signal (`−0,92 dBFS` links, Stille rechts) wird mit **`−6,94 dBFS`** angezeigt, ein gegenphasiges Stereo-Signal mit **`−120,0 dBFS`**.

---

### 1.3 Code-Qualität, Tote Exporte & Performance

* **7 ungenutzte Exporte (Dead Code):**
  1. `bufferToRaw` (`src/audio/raw.ts:6`)
  2. `midiToNoteName` (`src/audio/frequencies.ts:109`)
  3. `detectConcertPitch` (`src/audio/detectPitch.ts:245`)
  4. `pitchShiftBuffer` (`src/audio/pitchShift.ts:177`)
  5. `measureLoudness` (`src/audio/loudness.ts:94`)
  6. `normalizeToPlatform` (`src/audio/loudness.ts:162`)
  7. `encodeWav16` (`src/audio/exportWav.ts:74`) sowie ungenutzter Re-Export `rawToBuffer` (`src/audio/workerClient.ts:116`).
* **4 Code-Duplikate:** `hann` (`fft.ts:43` vs. `pitchShift.ts:34`), `copyChannels` (`workerClient.ts:22` vs. `bufferToRaw` in `raw.ts:6`), Mono-Mix (`raw.ts:24` vs. `pitchShift.ts:106`), `localStorage`-Persistenz für `customs` (`saveCustomHz` vs. `App.tsx:169`).
* **Performance & Speicher:**
  * **`App.tsx:230–249`:** `useEffect` für `window.addEventListener('keydown', onKey)` besitzt **kein Dependency-Array**. Da `usePlayer` `progress` per `requestAnimationFrame` mit 60 Hz aktualisiert, rendert `<App />` während der Wiedergabe **60× pro Sekunde** komplett neu und registriert den globalen Keydown-Listener 60×/s neu.
  * **`src/components/Waveform.tsx:12–59`:** `useEffect(..., [buffer, progress])` setzt bei jedem 60-Hz-Tick `canvas.width` / `canvas.height` neu (GPU-Backing-Store-Reset) und tastet die gesamte Audiospur erneut ab, obwohl sich nur der Playhead `progress` bewegt.
  * **Speicherspitze & synchroner WAV-Export:** Bei einer 10-minütigen Stereo-Datei (48 kHz) belegen gleichzeitige Kopien in Main-Thread + Worker (`channels`, `resampled`, `mid`, `outs`, `norm`, `slice`, `weighted`) kurzzeitig **> 1,3 GB RAM**. `encodeWav` (`App.tsx:224`) läuft synchron auf dem UI-Thread ohne `try/catch` (Freeze bzw. `RangeError` bei sehr großen Dateien; RIFF-32-Bit-Grenze bei 4 GiB).

---

## 2. Teil II — Integrations-Audit

### 2.1 System- & Datenflussübersicht

```text
index.html (+ Google Fonts CDN ⚠️)
  └─► src/main.tsx (StrictMode)
        └─► src/App.tsx (State, Drag&Drop, Presets, localStorage)
              ├─► src/hooks/usePlayer.ts ──► Web Audio API (AudioContext, AnalyserNode, GainNode)
              ├─► src/components/{Gauge, Waveform, Spectrum}.tsx
              ├─► src/audio/exportWav.ts ──► Blob URL Download (Main Thread)
              └─► src/audio/workerClient.ts (Singleton Module Worker, Transferables)
                    └─► src/audio/processWorker.ts
                          ├─► detectPitch.ts ──► fft.ts, frequencies.ts, raw.ts
                          ├─► pitchShift.ts
                          └─► loudness.ts
```

### 2.2 Verifizierte Integrationsbrüche

| ID | Schwere | Stelle | Befund & Auswirkung |
|---|---|---|---|
| **INT-01** | **HOCH** | `src/App.tsx:45–65, 394` · `src/components/Gauge.tsx:12` | **Solfeggio-Integration unvollständig (Anzeige & Reload-Bruch):** `App.tsx` übergibt `target={targetHz}` (Notenfrequenz, z. B. `174 Hz` für `F3` oder `963 Hz` für `B5`) direkt an `<Gauge />`, das `1200 * log2(target / hz)` gegen A4 rechnet. Bei einer 440-Hz-Quelle zeigt `Gauge` **`−1606,1 ct`** (bzw. **`+1356,0 ct`** bei 963 Hz), während die Ratio-Card daneben korrekt **`−6,10 ct`** (bzw. **`−43,96 ct`**) ausweist. Zudem speichert `localStorage` nur `frequnzy.lastTarget` (`targetHz`), **nicht** `mode` und `solfNote`: nach Browser-Reload wird z. B. `174 Hz` im Modus `concert` als `A4 = 174 Hz` geladen (`ratio = 0,395`, −16 Halbtöne!). |
| **INT-02** | **HOCH** | `src/App.tsx:222–228` | **Export-Dateiname vs. Audio-Inhalt desynchronisiert:** Wechselt der Nutzer nach erfolgter Umwandlung `targetHz`, `mode`, `platform` oder `preserveTempo` ohne erneut auf *„Umwandeln“* zu klicken, bleibt `result` erhalten. Klick auf *„WAV 24-bit“* exportiert den **alten** Audiopuffer, benennt die Datei aber nach den **neuen** Einstellungen (z. B. 432-Hz-Render gespeichert als `track_528.00Hz_spotify_24bit.wav`). |
| **INT-03** | **HOCH** | `src/audio/workerClient.ts:17–60` · `src/App.tsx:78–100, 186–220` | **Worker-Race-Condition & Promise-Leak:** (1) `runAnalysis` beim Laden einer neuen Datei bricht eine laufende Konvertierung (`processing`) nicht ab. Da derselbe Singleton-Worker genutzt wird, blockiert der alte Render-Job die neue Analyse und überschreibt nach Abschluss `result` und `loudRes` der **neu geladenen** Datei! (2) `resetWorker()` ruft `worker.terminate()` auf — `terminate()` feuert kein `error`-Event, sodass offene Promises in `analyzeInWorker`/`processInWorker` niemals aufgelöst werden (Closure-/Speicher-Leak). |
| **INT-04** | **MITTEL** | `src/App.tsx:46, 55, 61, 64, 169` · `src/audio/frequencies.ts:174` | **Ungeschützte `localStorage`-Zugriffe ohne `ErrorBoundary`:** Während `loadCustomHz()` `try/catch` nutzt, greifen `useState`-Initialisierer und `useEffect` in `App.tsx` ungeschützt auf `localStorage` zu. Im strikten Privatmodus / blockierten Storage / Sandbox-Iframe wirft dies `SecurityError` beim App-Mount (Totalausfall mit leerem Bildschirm). |
| **INT-05** | **MITTEL** | `src/hooks/usePlayer.ts:91` · `src/App.tsx:230–248, 333–388` | **UI-/Transport-Randfälle:** (1) Bei extrem kurzen Clips (`duration < 0.01 s`) wird `offset` negativ und `src.start(0, offset)` wirft `RangeError`. (2) Globale Tastatur-Shortcuts prüfen kein `ctrlKey`/`metaKey`/`altKey` (`Ctrl+L` toggelt Loop, `Ctrl+A` startet Original, `Space` blockiert fokussierte Buttons) und erlauben `1`/`2` während laufender Analyse. (3) `onDragLeave` flackert über Kind-Elementen. (4) `<input type="file">` setzt `e.target.value` nicht zurück (erneutes Laden derselben Datei unmöglich) und führt `.aiff` nur im ersten, nicht im zweiten Dialog. (5) Lösch-`<span>` in Custom-Frequency-Button (`App.tsx:486`) ist per Tastatur nicht erreichbar. |
| **INT-06** | **HOCH (DSGVO)** | `index.html:9–11` vs. `README.md:5` / `App.tsx:325, 614` | **Datenschutz-Widerspruch Google Fonts CDN:** UI und README sichern zu: *„Alles bleibt im Browser. Nichts wird hochgeladen.“* Tatsächlich baut `index.html` beim Laden Verbindungen zu `https://fonts.googleapis.com` und `https://fonts.gstatic.com` auf und überträgt IP-Adresse + Browser-Header an Google LLC (Abmahnrisiko gemäß LG München I, Az. 3 O 17493/20; zudem kein Offline-Schriftart-Fallback der Marken-Fonts). |

---

### 2.3 CI/CD- & GitHub-Actions-Integrationsaudit (`.github/workflows/`)

* **100 % Ausfallrate in der Praxis (gemessen via GitHub API):** Alle **20 ausgeführten Workflow-Läufe** zwischen `2026-09-07` und `2026-11-11` (`Weekly Repo Audit` und `Dependency Audit`) endeten mit `conclusion: "failure"` im Schritt `Run OpenCode Audit` bzw. `Run OpenCode Dependency Audit` (`anomalyco/opencode/github@latest`).
* **Fehlendes deterministisches Qualitäts-Gate:** Es existiert kein klassischer CI-Workflow, der deterministisch `npm ci`, `npx tsc --noEmit`, `npx tsc -p tsconfig.node.json --noEmit`, `npm run build`, `npm test` und `npm audit` prüft.
* **Vertragsbruch `audit-weekly.yml` ↔ `package.json`:** `audit-weekly.yml` weist den Agenten an, `npm test` und Coverage auszuführen, obwohl `package.json` weder ein `"test"`-Script noch ein Test-Framework enthält.
* **CI-Sicherheitsbefunde (Supply-Chain & Prompt-Injection):**
  1. Alle drei Workflows binden `anomalyco/opencode/github@latest` über ein veränderliches `@latest`-Tag statt eines gepinnten Commit-SHAs ein — kombiniert mit weitreichenden Schreibrechten (`contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`).
  2. **Prompt-Injection in `.github/workflows/audit-pr.yml:30`:** Der PR-Titel `${{ github.event.pull_request.title }}` wird direkt in den Klartext-Prompt interpoliert und mit `pull-requests: write` ausgeführt. In einem öffentlichen Repository kann ein externer PR-Titel damit Anweisungen in den Review-Agenten einschleusen.

---

### 2.4 Ökosystem- & Cross-Repo-Integrationsfähigkeit

Im Kontext benachbarter Audio-/Frequenz-Projekte des Maintainers (insb. `Sonic-DSP-Sound-modulation-Matrix` und `Bioresonaztherapy-`):
* **Stärke:** Die Kernmodule `src/audio/detectPitch.ts`, `pitchShift.ts`, `loudness.ts`, `fft.ts`, `frequencies.ts` arbeiten bereits vollständig auf `Float32Array[]` + `sampleRate` ohne React- oder DOM-Abhängigkeit (`exportWav.ts` enthält neben dem reinen Encoder lediglich `downloadBlob` mit `document.createElement`).
* **Aktuelle Hürden für Wiederverwendung:** `package.json` ist `"private": true`, definiert keine `exports`-Subpfade, erzeugt im Build keinen eigenständigen ESM-/Typdeklarations-Output für `src/audio/*`, und es existiert noch kein gemeinsames JSON-Preset-/Metadaten-Austauschschema (z. B. erkannter Kammerton + Tonart + Zielstimmung als Spur-/Projekt-Metadaten für `Sonic-DSP-Sound-modulation-Matrix`).

---

## 3. Teil III — Dependency-, Sicherheits- & Lizenz-Audit

### 3.1 Abhängigkeitsinventar & Versionsstand (`npm outdated`, Stand 2026-11-26)

* **Laufzeit-Abhängigkeiten (`dependencies`):** 2 direkte Pakete (`react`, `react-dom`), inklusive Transitiven insgesamt nur **5 Produktionspakete** (`react@18.3.1`, `react-dom@18.3.1`, `scheduler@0.23.2`, `loose-envify@1.4.0`, `js-tokens@4.0.0`). Keinerlei externe DSP-, UI- oder State-Bibliotheken — hervorragend schlanker Produktions-Footprint.
* **Entwicklungs-Abhängigkeiten (`devDependencies`):** 5 direkte Pakete, insgesamt **115 Einträge in `package-lock.json`** (davon 69 auf Linux x64 installiert, 50 plattformspezifische optionale Binaries für `@esbuild/*` und `@rollup/*`).

| Paket | Typ | `package.json` | Installiert (`lock`) | Wanted | Latest (2026-11) | Bewertung / Migrationshinweis |
|---|---|---|---|---|---|---|
| `react` | prod | `^18.3.1` | `18.3.1` | `18.3.1` | `19.3.1` | Stabil, 0 CVEs; Upgrade auf React 19 optional (Ref-Zugriff in Render `App.tsx:407` vorher bereinigen) |
| `react-dom` | prod | `^18.3.1` | `18.3.1` | `18.3.1` | `19.3.1` | Stabil, 0 CVEs |
| `@types/react` | dev | `^18.3.12` | `18.3.31` | `18.3.32` | `19.3.3` | Patch-Update auf `18.3.32` risikolos |
| `@types/react-dom` | dev | `^18.3.1` | `18.3.7` | `18.3.7` | `19.3.0` | Passend zu React 18 |
| `@vitejs/plugin-react` | dev | `^4.3.4` | `4.7.0` | `4.7.0` | `6.3.0` | Gemeinsam mit Vite aktualisieren |
| `typescript` | dev | `^5.6.3` | `5.9.3` | `5.9.3` | `7.0.2` | `5.9.3` stabil; TS 7 (Go-basierter Compiler) ist Major-Wechsel |
| `vite` | dev | `^5.4.11` | `5.4.21` | `5.4.21` | `8.4.0` | **Sicherheitsrelevant veraltet (High CVEs)!** Zudem nutzt `vite.config.ts` `allowedHosts: true` (erst ab `5.4.12` typisiert). |

---

### 3.2 Sicherheits-Audit (`npm audit` — gemessen)

* **Produktions-Bundle (`npm audit --omit=dev`):** **0 Schwachstellen** (`dist/` enthält keinen Code aus `vite`, `esbuild` oder `postcss`/`source-map-js`).
* **Gesamter Dependency-Baum (`npm audit`):** **3 verwundbare Pakete (2 High, 1 Moderate)**:

| Paket | Pfad | Schwere | Advisories / CWE | Konkrete Auswirkung in diesem Repo | Behebung |
|---|---|---|---|---|---|
| **`vite`** (`5.4.21`) | direkt (`devDependencies`) | **HIGH** | 8 Advisories: `GHSA-587h-7wmj-h5pm` (High, CWE-77), `GHSA-4w7w-66w2-5vf9` (Path Traversal `.map`), `GHSA-rq7h-c2jc-7f22` (`server.fs.allow` Bypass), `GHSA-fx2h-pf6j-xcff`, `GHSA-v6wh-96g9-6wx3`, `GHSA-698v-4r3x-3vcv`, `GHSA-r825-w8mm-5pxw`, `GHSA-9jrq-w75r-8gcw` | Betrifft `npm run dev` / `npm run preview`. **Verschärft durch `vite.config.ts` (`host: '0.0.0.0'`, `allowedHosts: true`)**: Dev-Server ist im gesamten lokalen Netz ohne Host-Header-Schutz erreichbar! | Upgrade auf aktuelles gepatchtes Vite (`vite@^8.4.0` + `@vitejs/plugin-react@^6.3.0`) + `allowedHosts` einschränken |
| **`source-map-js`** (`1.2.1`) | transitiv (`vite → postcss → source-map-js`) | **HIGH** (CVSS 7.5) | `GHSA-68fv-2mgg-jv7q` (CWE-1284) | Event-Loop-Denial-of-Service beim Parsen manipulierter Source-Maps zur Build-/Dev-Zeit | `npm audit fix` aktualisiert non-breaking auf `>=1.2.2` |
| **`esbuild`** (`0.21.5`) | transitiv (`vite → esbuild`) | **MODERATE** (CVSS 5.3) | `GHSA-67mh-4wv8-2f99` (CWE-346) | Beliebige Webseiten im Browser des Entwicklers können während `npm run dev` Anfragen an den Dev-Server senden und Quellcode auslesen | Mit Vite-Upgrade auf `esbuild >= 0.25.0` behoben |

---

### 3.3 Lizenz- & IP-Compliance-Audit

**Vollständige Lizenzverteilung aller 115 Pakete in `package-lock.json`:**

| Lizenz | Anzahl Pakete | Anteil | Kommerzielle / Proprietäre Eignung |
|---|---:|---:|---|
| `MIT` | 106 | 92,2 % | Grün — uneingeschränkt kommerziell nutzbar (Copyright-Hinweis im Bundle/Notice bewahren) |
| `ISC` | 5 | 4,3 % | Grün — funktional äquivalent zu MIT |
| `Apache-2.0` | 2 | 1,7 % | Grün — permissiv inkl. expliziter Patentlizenz |
| `BSD-3-Clause` | 1 | 0,9 % | Grün — permissiv |
| `CC-BY-4.0` | 1 | 0,9 % | Gelb/Grün — betrifft ausschließlich `caniuse-lite@1.0.30001809` (reine Build-Zeit-Datenbank für Browserslist, landet **nicht** im ausgelieferten `dist/`-Bundle) |
| **Copyleft (`GPL` / `LGPL` / `AGPL` / `MPL`)** | **0** | **0,0 %** | **Keine Lizenzkonflikte festgestellt.** |

**Festgestellte Governance-/IP-Lücken im Repository selbst:**
1. **Keine `LICENSE`-Datei im Repository:** Da `INDIEaner84/FREQUNZYTUNETOOL` auf GitHub öffentlich sichtbar ist, greift ohne Lizenzdatei gesetzlich *„All Rights Reserved“* — unklar für Nutzer, Mitwirkende und nachgelagerte Integration.
2. **Fehlendes `"license"`-Feld in `package.json`:** Sollte explizit gesetzt werden (z. B. `"MIT"`, `"UNLICENSED"` bei proprietärem Vertrieb oder gewünschte Lizenz).
3. **Drittanbieter-Hinweise beim Build:** Für kommerzielle Auslieferung empfiehlt sich die Generierung einer `THIRD-PARTY-NOTICES.txt` (für `react`, `react-dom`, `scheduler`, `loose-envify`, `js-tokens` unter MIT).

---

## 4. Teil IV — Priorisierter Maßnahmenfahrplan (Remediation Roadmap)

### P0 — Blocker vor produktivem Einsatz / Veröffentlichung (Sofort)
1. **Mastering-Engine normkonform reparieren (`src/audio/loudness.ts`):**
   * Kanal-Summierung ohne `/ chans` für Stereo gemäß ITU-R BS.1770-4; exakte K-Weighting-Biquads (`f0 = 1681,97 Hz`, `Q = 0,7072` und Hochpass `f0 = 38,14 Hz`, `Q = 0,5003`, sampleRate-adaptiv berechnet).
   * Echte 4×-Polyphasen-Sinc-FIR-True-Peak-Messung + echter Sliding-Window-Lookahead-Limiter (garantiert `truePeak <= ceilingDb` ohne Hard-Clipping).
2. **Zustands- & Worker-Konsistenz sichern (`src/App.tsx`, `src/components/Gauge.tsx`, `src/audio/workerClient.ts`):**
   * Äquivalentes Ziel-A4 (`sourceHz * ratio`) an `<Gauge />` übergeben; `mode` und `solfNote` zusammen mit `targetHz` in `localStorage` persistieren.
   * Bei Änderung von Ziel-Frequenz, Modus, Plattform oder Tempo-Schalter veraltetes `result` invalidieren (oder die beim Render verwendeten Parameter am `result`-Objekt speichern und für den WAV-Dateinamen nutzen).
   * Laufenden Konvertierungs-Job bei neuem Datei-Upload sauber abbrechen und in `resetWorker()` offene Promises deterministisch mit `AbortError` ablehnen.
3. **DSGVO-Konformität herstellen (`index.html`, `src/styles.css`, `public/fonts/`):**
   * Externe `<link href="https://fonts.googleapis.com/...">`-Tags aus `index.html` entfernen und `Outfit`, `Cormorant Garamond` sowie `IBM Plex Mono` als lokale `.woff2`-Dateien selbst hosten. Damit stimmt die Aussage *„Alles bleibt im Browser. Nichts wird hochgeladen.“* technisch und rechtlich zu 100 %.
4. **Deterministisches CI-Gate einrichten & OpenCode-Workflows absichern (`.github/workflows/`):**
   * Neuer Workflow `ci.yml` für Push/PR mit `npm ci`, `tsc --noEmit`, `npm run build`, `npm test` und `npm audit --omit=dev`.
   * In `audit-*.yml`: `anomalyco/opencode` auf festen Commit-SHA pinnen, minimale Permissions setzen und `${{ github.event.pull_request.title }}` über eine Environment-Variable statt direkter Prompt-Interpolation übergeben.

### P1 — DSP-Präzision, Testabdeckung & Dependency-Sicherheit (Kurzfristig)
1. **WSOLA & Resampler verbessern (`src/audio/pitchShift.ts`):**
   * Korrelationsreferenz auf `prevStart + hopOut` korrigieren, `seek`-Fenster auch für `< 4 %` (432 Hz!) aktivieren, Suchschrittweite auf 1–2 Samples verfeinern, letztes Grain über `target` hinaus führen (keine Null-Stille am Ende) und Tiefpass-Anti-Aliasing für `ratio > 1` ergänzen.
2. **Kammerton-Detektor schärfen (`src/audio/detectPitch.ts`, `src/audio/frequencies.ts`):**
   * Parabel-Interpolation auf `Math.log(mag)` statt `mag²` umstellen, Histogramm-Binning zentrieren (`Math.round`), `fftSize` proportional zur `sampleRate` wählen (`8192` @ 44,1/48 kHz, `16384` @ 88,2/96 kHz, `32768` @ 176,4/192 kHz), `peakDb` als echtes Maximum über alle Kanäle berechnen und Kandidaten-Labels exakt zuordnen (`441 Hz` ≠ `ISO 16`).
3. **Automatisierte Testsuite anlegen (`tests/` + `"test"`-Script in `package.json`):**
   * Deterministische Unit- und DSP-Referenztests (440/432/442/444-Hz-Erkennung < ±0,5 ct, BS.1770-Stereo-Referenz `0,00 LUFS ± 0,1 LU`, Inter-Sample-True-Peak, Limiter-Ceiling-Garantie, WAV-Header-/Roundtrip-Prüfung, Worker-Abbruchlogik).
4. **Dependencies aktualisieren (`package.json`, `package-lock.json`, `vite.config.ts`):**
   * `source-map-js >= 1.2.2` + Upgrade von `vite` und `@vitejs/plugin-react` zur Beseitigung aller 3 `npm audit`-Befunde (`0 vulnerabilities`).

### P2 — Performance, Barrierefreiheit & Lizenz-Hygiene (Mittelfristig)
1. **UI-Performance & Hauptthread entlasten:** Statisches Waveform-Bild cachen und Playhead auf separatem Layer/rAF zeichnen (`Waveform.tsx`); `keydown`-Effect mit stabilen Refs einmalig registrieren (`App.tsx`); `encodeWav` in `processWorker.ts` verlagern.
2. **Robustheit & A11y:** `localStorage`-Helfer durchgängig kapseln (`try/catch`), React `ErrorBoundary` ergänzen, Custom-Frequenz-Löschknopf als echtes `<button aria-label="...">` umsetzen, `ctrlKey`/`metaKey`/`altKey` in Shortcuts ignorieren, File-Input `value = ''` zurücksetzen.
3. **Code- & Lizenz-Hygiene:** `LICENSE`-Datei + `"license"` in `package.json` anlegen; die 7 ungenutzten Exporte und 4 Duplikate bereinigen.

### P3 — Ökosystem-Modularisierung (Optional)
1. **Extraktion der Audio-Engine (`src/audio/*`):** Kapselung als wiederverwendbares, getestetes Zero-Dependency-ESM-Modul (inkl. JSON-Metadaten-Export für Stimmung/Tonart/LUFS) zur nahtlosen Integration mit `Sonic-DSP-Sound-modulation-Matrix`.

---

## 5. Nachlauf — Verifizierter Sanierungsnachweis (P0–P3 umgesetzt, Stand 2026-11-26)

Auf Basis dieses Audits wurden sämtliche **P0-, P1-, P2- und P3-Basis-Maßnahmen** auf Branch `arena/dccfecd3-frequnzytunetool` umgesetzt und gegen dieselben Messsignale gegengeprüft.

### 5.1 Vorher / Nachher — Gemessene Kennzahlen

| Prüfgröße / Befund | Vorher (Commit `43b152b`) | Nachher (Sanierter Stand) | Status |
|---|---|---|---|
| **440-Hz-Testton-Erkennung (@ 44,1 kHz)** | `440,60 Hz` (`+2,34 ct`), Top-1 fälschlich `ISO 16 · 441 Hz` | **`439,943 Hz` (`−0,22 ct`)**, Top-1 **`ISO 16 · 440 Hz (0.998)`** | **BEHOBEN** |
| **432-Hz-Erkennung @ 192 kHz Hi-Res** | `430,13 Hz` (`−7,53 ct`, `Scientific · 430.54 Hz`) | **`431,932 Hz` (`−0,27 ct`, `Verdi · 432 Hz`)** | **BEHOBEN** |
| **Stereo-Peak bei Anti-Phase / Hard-Pan** | `−120,0 dBFS` / `−6,94 dBFS` (statt `−0,92 dBFS`) | **`−0,92 dBFS`** (echtes Maximum über alle Kanäle) | **BEHOBEN** |
| **WSOLA 440 → 432 Hz** | `seek = 0` (deaktiviert), `321 Samples` Null-Stille am Ende, `0,65 dB` AM | **1-Sample-Phasenlock (50 % COLA)**, **`0` Null-Samples**, **`0,29 dB` AM** | **BEHOBEN** |
| **WSOLA 440 → 528 Hz** | Falsches `aBase`, `321 Samples` Null-Stille, **`2,51 dB` AM** | Korrektes `prevStart + hopOut`, **`0` Null-Samples**, **`0,26 dB` AM** | **BEHOBEN** |
| **Resampler-Aliasing (`19,5 kHz × 1,2`)** | `−11,63 dBFS` ungedämpfte Spiegelfrequenz | **`−37,90 dBFS`** (> 26 dB Unterdrückung durch Zero-Phase-Butterworth) | **BEHOBEN** |
| **ITU-R BS.1770-4 Stereo-LUFS (`997 Hz @ 0 dBFS`)** | `−3,04 LUFS` (**−3,04 LU Fehler**, da `/ chans`) | Mono **`−3,05 LUFS`**, Stereo **`−0,04 LUFS`** (+3,01 LU normkonform) | **BEHOBEN** |
| **Inter-Sample-True-Peak (`Fs/4` @ 45°)** | `−3,01 dBTP` (0 % ISP-Erkennung) | **`−0,04 dBTP`** (4×-Polyphasen-Sinc-FIR nach BS.1770-4 Annex 2) | **BEHOBEN** |
| **Limiter-Ceiling (`−14 LUFS / −1,0 dBTP`)** | **`+3,43 dBFS` Hard-Clipping** (+4,43 dB Überschwinger) | **`−1,040 dBTP` True-Peak / `−1,057 dBFS` Sample-Peak** (0 Clipping) | **BEHOBEN** |
| **Solfeggio Gauge & Reload-Persistenz** | Gauge zeigte `−1606,1 ct` (F3=174 Hz); Reload deutete `174 Hz` als A4 | Äquivalentes `targetA4` im Gauge (`−6,1 ct`); `targetHz + mode + solfNote` sicher persistiert | **BEHOBEN** |
| **Export-Dateiname vs. Render-Zustand** | Alter Puffer wurde unter neuem Ziel-Namen gespeichert; Main-Thread-Blockade | `RenderedOutput`-Snapshot + Stale-Hinweis + asynchroner WAV-Export im Worker | **BEHOBEN** |
| **Worker-Abbruch & Dateiwechsel** | `resetWorker()` ließ Promises ewig hängen; Race-Condition bei neuem Upload | Deterministisches `AbortError`-Reject aller offenen Jobs + `sessionRef`-Token | **BEHOBEN** |
| **UI-Performance (60-Hz-Wiedergabe)** | 60×/s `keydown`-Rebind & komplettes Waveform-PCM-Rescan | Einmaliger `keydown`-Listener, Offscreen-Canvas-Cache in `Waveform.tsx`, wiederverwendeter `Uint8Array` in `Spectrum.tsx` | **BEHOBEN** |
| **DSGVO / Externe Verbindungen** | Google Fonts CDN (`fonts.googleapis.com` / `fonts.gstatic.com`) in `index.html` | **0 externe URLs** in `index.html` & `src/` (durch Guard-Test gesichert) | **BEHOBEN** |
| **Dependency-Sicherheit (`npm audit`)** | **3 Schwachstellen (2 High, 1 Moderate)** + `allowedHosts: true` | **`0 vulnerabilities`** (`vite@7.3.8`, `@vitejs/plugin-react@5.2.0`, `typescript@5.9.3`) + Host-Allowlist | **BEHOBEN** |
| **Automatisierte Tests (`npm test`)** | **0 Tests** (kein Runner, kein Script) | **18 / 18 Tests grün (`1,09 s`)** über 9 Test-Suiten (`tests/dsp.test.ts`, `tests/integration.test.ts`) | **BEHOBEN** |
| **CI/CD & OpenCode-Workflows** | 20 / 20 Läufe `failure`, kein CI-Gate, Prompt-Injection in `audit-pr.yml` | Deterministisches `.github/workflows/ci.yml` + gehärtete `audit-*.yml` (Key-Check, Least Privilege, kein Titel-Prompt-Inject) | **BEHOBEN** |
| **Lizenz- & Modul-Hygiene** | 7 tote Exporte, 4 Duplikate, fehlende Notices | Tote Exporte/Duplikate bereinigt, `src/audio/index.ts`-Barrel, `public/THIRD-PARTY-NOTICES.txt` + `docs/LIZENZEN.md` | **BEHOBEN** |

### 5.2 Aktualisierte Reifegrad-Bewertung nach Sanierung

| # | Dimension | Vorher | Nachher | Nachweis |
|---|---|---:|---:|---|
| 1 | Build & Typensicherheit | 4,5 / 5 | **5,0 / 5** | `npm run typecheck` prüft `src/`, `tests/` und `vite.config.ts` strikt mit 0 Fehlern |
| 2 | Architektur & Code-Struktur | 3,5 / 5 | **4,5 / 5** | Sauberer Barrel-Export `src/audio/index.ts`, 0 tote Exporte, Worker-WAV-Export |
| 3 | DSP- & Fachlogik-Korrektheit | 2,0 / 5 | **4,8 / 5** | BS.1770-4 Stereo-LUFS, 4×-Sinc-True-Peak, Brickwall-Limiter, 50-%-COLA-WSOLA, Log-Parabel-FFT |
| 4 | Interne & Externe Integration | 2,5 / 5 | **4,8 / 5** | Solfeggio, Render-Snapshot, Worker-Abort, A11y, ErrorBoundary, DSGVO-Freiheit gelöst |
| 5 | Tests & Verifikation | 0,0 / 5 | **4,5 / 5** | `npm test`: 18 deterministische DSP-, Persistenz-, Worker- & DSGVO-Guard-Tests grün |
| 6 | CI/CD & Governance-Gates | 0,5 / 5 | **4,5 / 5** | `ci.yml` als deterministisches Gate + abgesicherte `audit-*.yml` |
| 7 | Dependency- & Supply-Chain-Sicherheit | 2,5 / 5 | **5,0 / 5** | `npm audit`: **0 vulnerabilities**, schlanke 5 MIT-Prod-Pakete |
| 8 | Lizenz, Datenschutz & Release-Reife | 2,5 / 5 | **4,8 / 5** | `THIRD-PARTY-NOTICES.txt`, `docs/LIZENZEN.md`, `"license": "UNLICENSED"`, 0 externe Requests |
| | **Gesamtergebnis** | **18,0 / 40 (45,0 %)** | **37,9 / 40 (94,8 %)** | **TRL 8 — Produktionsreifes, verifiziertes Browser-DSP-Werkzeug** |

