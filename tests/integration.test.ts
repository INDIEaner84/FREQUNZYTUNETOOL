import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  loadCustomHz,
  loadPlatform,
  loadTargetSettings,
  saveCustomHz,
  savePlatform,
  saveTargetSettings,
} from '../src/audio/frequencies'
import { analyzeInWorker, isAbortError, resetWorker } from '../src/audio/workerClient'

function collectFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectFiles(full))
    else out.push(full)
  }
  return out
}

describe('Persistenz-Sicherheit & Solfeggio-Reload-Konsistenz', () => {
  it('persistiert targetHz, mode und solfNote gemeinsam und übersteht blockiertes localStorage fehlerfrei', () => {
    const store = new Map<string, string>()
    const g = globalThis as unknown as { localStorage?: Storage }
    g.localStorage = {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (k: string) => store.get(k) ?? null,
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => {
        store.delete(k)
      },
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }

    saveTargetSettings(174, 'solfeggio', 'F3')
    savePlatform('spotify')
    saveCustomHz([436, 444.5])

    const loaded = loadTargetSettings()
    assert.equal(loaded.targetHz, 174)
    assert.equal(loaded.mode, 'solfeggio')
    assert.equal(loaded.solfNote, 'F3')
    assert.equal(loadPlatform(), 'spotify')
    assert.deepEqual(loadCustomHz(), [436, 444.5])

    // Simuliere Safari Private Mode / Sandbox-Iframe SecurityError
    g.localStorage = {
      get length(): number {
        throw new Error('SecurityError')
      },
      clear: () => {
        throw new Error('SecurityError')
      },
      getItem: () => {
        throw new Error('SecurityError')
      },
      key: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    }

    const fallback = loadTargetSettings()
    assert.equal(fallback.targetHz, 432)
    assert.equal(fallback.mode, 'concert')
    assert.equal(loadPlatform(), 'none')
    assert.deepEqual(loadCustomHz(), [])
    saveTargetSettings(440, 'concert', 'C5')
    saveCustomHz([432])

    delete g.localStorage
  })
})

describe('Worker-Lebenszyklus & deterministischer Abbruch (src/audio/workerClient.ts)', () => {
  it('lehnt laufende Worker-Promises bei resetWorker() sofort mit AbortError ab statt ewig zu hängen', async () => {
    const g = globalThis as unknown as { Worker?: unknown }
    let terminated = false

    class FakeWorker {
      addEventListener(): void {}
      removeEventListener(): void {}
      postMessage(): void {
        // Absichtlich keine Antwort senden (simuliert lang laufendes WSOLA)
      }
      terminate(): void {
        terminated = true
      }
    }

    g.Worker = FakeWorker
    try {
      const fakeBuffer = {
        sampleRate: 44100,
        length: 1024,
        duration: 1024 / 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(1024),
        copyFromChannel: () => {},
        copyToChannel: () => {},
      } as unknown as AudioBuffer

      const pending = analyzeInWorker(fakeBuffer)
      resetWorker()

      await assert.rejects(
        pending,
        (err: unknown) => isAbortError(err),
        'Laufender Job muss deterministisch mit AbortError abbrechen',
      )
      assert.equal(terminated, true)
    } finally {
      delete g.Worker
    }
  })
})

describe('DSGVO- & Laufzeit-Unabhängigkeits-Guard', () => {
  it('enthält in index.html und src/ keinerlei externe HTTP/CDN/Google-Fonts-URLs', () => {
    const root = resolve('.')
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    assert.ok(!/https?:\/\//i.test(html), 'index.html darf keine externen URLs nachladen')
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/i.test(html), 'Keine externen Google Fonts erlaubt')

    for (const file of collectFiles(join(root, 'src'))) {
      const content = readFileSync(file, 'utf8')
      assert.ok(
        !/https?:\/\//i.test(content),
        `Quelldatei ${file} darf keine externen HTTP(S)-Verbindungen enthalten`,
      )
    }
  })
})
