# FREQUNZY Tune Tool

Web-App, die den **Kammerton** eines Stücks erkennt (typisch A4 = 440 Hz) und die Musik auf eine Ziel-Frequenz umstimmt — 432 Hz, 528 Hz, historische Stimmlagen oder jede selbst eingegebene Frequenz. Optional wird die Lautheit auf die veröffentlichten Ziele von **Spotify**, **Apple Music**, YouTube, Amazon Music, Tidal und Deezer gebracht.

Alles läuft lokal im Browser. Es wird nichts hochgeladen.

## Funktionen

- **Stimmung erkennen** — spektrales 12-TET-Histogramm schätzt A4 in Hertz und Cent zu 440
- **Tonart** — grobe Schätzung (Dur/Moll) aus dem Chromatik-Profil
- **Ziel-Kammerton** — Presets 415 / 432 / 435 / 440 / 442 / 444 / 528 Hz u. a.
- **Solfeggio** — 174–963 Hz, Ausrichtung einer konkreten Note (z. B. C5 = 528 Hz)
- **Eigene Frequenz** — einmal eintippen, bleibt gespeichert
- **Sofort-Vorschau** — Zielstimmung hören, ohne zu rendern (leicht anderes Tempo)
- **Tempo halten** (WSOLA im Worker) oder reines Resampling ohne Artefakte
- **A/B** — Original / Vorschau / Ergebnis an derselben Stelle, Waveform-Seek, Loop, Lautstärke
- **Plattform-Mastering** — integrierte Lautheit (EBU R128 / ITU-R BS.1770) und True-Peak
- **Export** — WAV 24-bit oder 16-bit mit TPDF-Dither
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

## Hinweise

Die Kammerton-Erkennung arbeitet robust bei tonaler Musik mit klarem Harmonieraster. Stark atonales oder geräuschhaftes Material senkt die Konfidenz. Große Pitch-Shifts (z. B. A4 = 528 Hz) klingen mit „Tempo halten“ körniger — dann Resampling ohne Tempo-Korrektur wählen.
