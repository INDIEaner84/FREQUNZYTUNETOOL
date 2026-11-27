# FREQUNZY Tune Tool

Web-App, die den **Kammerton** eines Stücks erkennt (typisch A4 = 440 Hz) und die Musik auf eine Ziel-Frequenz umstimmt — 432 Hz, 528 Hz, historische Stimmlagen oder jede selbst eingegebene Frequenz. Optional wird die Lautheit auf die veröffentlichten Ziele von **Spotify**, **Apple Music**, YouTube, Amazon Music, Tidal und Deezer gebracht.

Alles läuft zu 100 % lokal im Browser — ohne Uploads, ohne externe Schriftarten-CDNs und ohne Telemetrie.

## Funktionen

- **Stimmung erkennen** — sample-rate-adaptives 12-TET-Spektralhistogramm mit Log-Magnituden-Parabelinterpolation schätzt A4 in Hertz und Cent zu 440 (44,1 kHz bis 192 kHz)
- **Tonart** — stimmungskompensierte Schätzung (Dur/Moll) aus dem Chromatik-Profil
- **Ziel-Kammerton** — Presets 415 / 421,6 / 430,54 / 432 / 435 / 440 / 442 / 444 / 528 Hz
- **Solfeggio** — 174–963 Hz, Ausrichtung einer konkreten Note (z. B. C5 = 528 Hz) inkl. konsistenter A4-Äquivalenzanzeige
- **Eigene Frequenz** — einmal eintippen, bleibt lokal gespeichert
- **Sofort-Vorschau** — Zielstimmung hören, ohne zu rendern (leicht anderes Tempo)
- **Tempo halten** (50-%-COLA-WSOLA im Web Worker) oder Anti-Aliasing-Resampling ohne Artefakte
- **A/B** — Original / Vorschau / Ergebnis an derselben Stelle, gecachtes Waveform-Seek, Loop, Lautstärke
- **Plattform-Mastering** — integrierte Lautheit nach ITU-R BS.1770-4 / EBU R128, 4×-Polyphasen-Sinc-True-Peak-Messung und Lookahead-True-Peak-Limiter
- **Export** — WAV 24-bit oder 16-bit mit TPDF-Dither (asynchron im Web Worker)
- **Tastatur** — Leertaste, 1/2/3 (bzw. A/V/B), ← →, L

DRM-Streams von Spotify oder Apple Music können nicht direkt gelesen werden. Dateien aus der eigenen Mediathek (Downloads, Käufe, Aufnahmen) per Drag-and-Drop laden.

## Start & Entwicklung

```bash
npm install
npm run dev
```

Prüfung & Produktions-Build:

```bash
npm run typecheck   # Strikte TypeScript-Prüfung (App, Tests, Vite-Konfig)
npm test            # 18 deterministische DSP- & Integrations-Tests
npm run build       # Typecheck + Produktions-Bundle in dist/
npm run preview     # Lokale Vorschau des Produktions-Builds
```

## Dokumentation

- [`docs/AUDIT_1013_GESAMT_REIFEGRAD_INTEGRATION_DEPENDENCY.md`](docs/AUDIT_1013_GESAMT_REIFEGRAD_INTEGRATION_DEPENDENCY.md) — Vollständiger Reifegrad-, Integrations- und Dependency-Audit inkl. Vorher/Nachher-Messnachweisen
- [`docs/LIZENZEN.md`](docs/LIZENZEN.md) — Lizenz- und Datenschutz-Übersicht sowie Checkliste vor kommerziellem Vertrieb

## Hinweise

Die Kammerton-Erkennung arbeitet robust bei tonaler Musik mit klarem Harmonieraster innerhalb von ±50 Cent um 440 Hz. Stark atonales oder geräuschhaftes Material senkt die Konfidenz. Sehr große Pitch-Shifts (z. B. A4 = 528 Hz) klingen mit reinem Anti-Aliasing-Resampling natürlicher als mit starker Zeitstreckung.
