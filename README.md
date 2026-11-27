# FREQUNZY Tune Tool

Web-App, die den **Kammerton** eines Stücks erkennt (typisch A4 = 440 Hz) und die Musik auf eine Ziel-Frequenz umstimmt — 432 Hz, 528 Hz, historische Stimmlagen oder jede selbst eingegebene Frequenz. Optional wird die Lautheit auf die veröffentlichten Ziele von **Spotify**, **Apple Music**, YouTube, Amazon Music, Tidal und Deezer gebracht.

Alles läuft lokal im Browser. Es wird nichts hochgeladen.

## Funktionen

- **Stimmung erkennen** — spektrales 12-TET-Histogramm schätzt A4 in Hertz und Cent zu 440
- **Tonart** — grobe Schätzung (Dur/Moll) aus dem Chromatik-Profil
- **Ziel-Kammerton** — Presets 415 / 432 / 435 / 440 / 442 / 444 / 528 Hz u. a. (mit exaktem Cent-Abstand zu 440 im Tooltip)
- **Solfeggio** — 174–963 Hz, Ausrichtung einer konkreten Note (z. B. C5 = 528 Hz)
- **Klanggabeln** — 100+ wissenschaftliche/esoterische Referenzfrequenzen (Solfeggio vollständig, Heilungs-/Chakra-/Organ-/Mineral-/DNA-Gabeln, Schumann 7,83 Hz, Ohm, Kosmische Oktave, Tesla 3-6-9, Angel Numbers, Otto) aus [evoluteur/healing-frequencies](https://github.com/evoluteur/healing-frequencies) (MIT). Jede Gabel als reiner Sinuston vorhörbar; Klick richtet die nächstliegende Note exakt darauf aus (Solfeggio-Mechanik, Cent-Abstand zur 12-TET-Stufe wird live angezeigt)
- **Eigene Frequenz** — einmal eintippen, bleibt gespeichert
- **Sofort-Vorschau** — Zielstimmung hören, ohne zu rendern (leicht anderes Tempo)
- **Tempo halten, zwei Engines**
  - **Signalsmith Stretch** (MIT, WASM) — hybride spektrale Engine, Pitch-Shift und Zeit-Map simultan statt Resample + Zeitstauch; Standard („Auto (HQ)“), mit automatischem Fallback
  - **Phase Vocoder** (nativ im Worker, ohne WASM) — STFT mit Identity-Phase-Propagation, ersetzt den früheren WSOLA-Pfad (der bei Shifts < 4 % den Pitch-Versatz faktisch zurücknahm)
- **Resampling ohne Artefakte** — Blackman-fensterter Sinc-FIR (bandlimitiert, anti-aliased), ersetzt kubische Interpolation
- **Präzisions-Anzeige** — Verhältnis (6 Dezimalen), Cent-Versatz (2), Halbton-Versatz (4), Konfidenz, 12-TET-Cent jeder Gabel
- **A/B** — Original / Vorschau / Ergebnis an derselben Stelle, Waveform-Seek, Loop, Lautstärke
- **Plattform-Mastering** — integrierte Lautheit (EBU R128 / ITU-R BS.1770, De-Man-Biquads, auf ≤ 0,001 LU gegen pyloudnorm verifiziert) und bandlimitierter True-Peak
- **Export** — WAV 24-bit oder 16-bit mit TPDF-Dither; Dateiname trägt Engine (`_hq` / `_vocoder` / `_asetrate`)
- **Tastatur** — Leertaste, 1/2/3, ← →, L

DRM-Streams von Spotify oder Apple Music können nicht direkt gelesen werden. Dateien aus der eigenen Mediathek (Downloads, Käufe, Aufnahmen) per Drag-and-Drop laden.

## Start

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Dokumentation

- `docs/oss-research.md` — Open-Source-Landkarte (Pitch/Stretch, Analyse, Mastering, Restoration, wissenschaftliche Frequenzen) inkl. Lizenz-Ampel für dieses Projekt
- `THIRD_PARTY_NOTICES.md` — Lizenzen und Attribution der verwendeten Fremdkomponenten (Signalsmith Stretch, healing-frequencies-Daten)

## Hinweise

Die Kammerton-Erkennung arbeitet robust bei tonaler Musik mit klarem Harmonieraster. Stark atonales oder geräuschhaftes Material senkt die Konfidenz. Große Pitch-Shifts (z. B. A4 = 528 Hz) klingen mit „Tempo halten“ körniger — dann Resampling ohne Tempo-Korrektur wählen oder den Signalsmith-HQ-Pfad nutzen (Standard). Die Klanggabel-Zuordnungen (Organe, Chakras …) sind esoterische Tradition, keine medizinische Wissenschaft — sie sind hier als Frequenz-Referenz mit exakter 12-TET-Verortung gedacht.
