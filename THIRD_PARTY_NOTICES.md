# Third-Party Notices

FREQUNZY Tune Tool verwendet folgende externe Komponenten (alle mit erlaubter Nutzung in diesem Projekt):

---

## 1. signalsmith-stretch (npm-Paket)

- **Quelle:** https://signalsmith-audio.co.uk/code/stretch · https://www.npmjs.com/package/signalsmith-stretch
- **Zweck:** High-Quality-Pitch-Shift mit erhaltener Dauer („Tempo halten", HQ-Pfad)
- **Lizenz:** MIT
- **Copyright:** Signalsmith Audio (Geraint Luff)

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. evoluteur/healing-frequencies — Frequenzdaten

- **Quelle:** https://github.com/evoluteur/healing-frequencies (`frequencies.js`, abgerufen 2026-11-26)
- **Zweck:** Frequenztabelle des Reiters „Klanggabeln" (`src/audio/tuningForks.ts`)
- **Lizenz:** MIT
- **Copyright:** (c) 2026 Olivier Giulieri

```
MIT License

Copyright (c) 2026 Olivier Giulieri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. Hinweis zu weiteren, nicht eingebetteten Werkzeugen

`docs/oss-research.md` listet externe Open-Source-Werkzeuge (Matchering, Essentia, Demucs,
DeepFilterNet, …), die **nicht** Bestandteil dieses Bundles sind und ausschließlich
verwendet/aufgerufen werden, wenn sie Nutzer:innen selbst installieren. Für deren Lizenzen
siehe die jeweiligen Projekte. Die DSP-Implementierungen in `src/audio/` (Sinc-Resampler,
Phase Vocoder, BS.1770-Loudness, Kammerton-Erkennung) sind Eigenentwicklungen dieses
Projekts; der Phasenvocoder folgt dem allgemeinen STFT-Verfahren nach Portnoff (1976) bzw.
aequivalenter Standardliteratur.
