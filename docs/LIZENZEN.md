# Lizenzen & Datenschutz-Status — FREQUNZY Tune Tool

Kurzfassung: **Sämtlicher DSP- und Anwendungscode unter `src/` ist eine eigenständige Implementierung ohne Audio-Fremdbibliotheken. Alle 5 Laufzeit-Pakete (`react`, `react-dom`, `scheduler`, `loose-envify`, `js-tokens`) stehen unter der MIT-Lizenz. Zur Laufzeit werden keinerlei externe CDNs, Schriftarten oder Analyse-Dienste kontaktiert.**

## 1. Stand der Projektbestandteile

| Bestandteil | Herkunft | Lizenz | Verkaufs-/Betriebsstatus |
| --- | --- | --- | --- |
| App- & UI-Code (`src/*.tsx`, `src/components/`, `src/hooks/`, `src/styles.css`) | eigene Implementierung | Projektlizenz (`UNLICENSED` / alle Rechte vorbehalten, bis vom Inhaber anders festgelegt) | unkritisch |
| DSP-Engine (`src/audio/fft.ts`, `detectPitch.ts`, `pitchShift.ts`, `loudness.ts`, `exportWav.ts`, `frequencies.ts`, `raw.ts`) | eigene Implementierung, keine Fremdbibliothek | Projektlizenz | unkritisch |
| Laufzeit-Dependencies (`react`, `react-dom` + 3 Transitive) | npm | `MIT` | kommerziell frei nutzbar; Lizenzhinweis liegt unter `public/THIRD-PARTY-NOTICES.txt` (wird nach `dist/` kopiert) |
| Build-/Dev-Dependencies (`vite`, `typescript`, `@vitejs/plugin-react` + Transitive) | npm | `MIT`, `ISC`, `Apache-2.0`, `BSD-3-Clause`, `CC-BY-4.0` (`caniuse-lite` nur zur Build-Zeit) | nicht im ausgelieferten `dist/`-Bundle enthalten |
| Audio-Samples / Medien-Assets | **keine im Repo** (Testton wird mathematisch zur Laufzeit synthetisiert) | — | unkritisch |
| Externe CDNs, Google Fonts, Telemetrie | **keine** (durch automatisierten Test in `tests/integration.test.ts` abgesichert) | — | DSGVO-konform, 100 % lokal |

## 2. Checkliste vor kommerziellem Verkauf / Release

- [x] `"license": "UNLICENSED"` in `package.json` gesetzt (kein unbeabsichtigtes Open-Source-Release)
- [x] Drittanbieter-Lizenzhinweise in `public/THIRD-PARTY-NOTICES.txt` hinterlegt (landet automatisch in `dist/`)
- [x] Keine externen URLs zur Laufzeit (`fonts.googleapis.com` / `fonts.gstatic.com` entfernt)
- [x] Keine unlizenzierten Audio- oder Font-Assets im Repository
- [x] `npm audit` meldet `0 vulnerabilities`
- [ ] Vor Übergabe/Veröffentlichung endgültigen Lizenzvertrag bzw. gewünschte `LICENSE`-Datei durch den Rechteinhaber ergänzen
