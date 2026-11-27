export type TargetMode = 'concert' | 'solfeggio'

export type PitchPreset = {
  hz: number
  name: string
  desc: string
  tag?: string
}

export const CONCERT_PRESETS: PitchPreset[] = [
  { hz: 415, name: 'Barock', desc: 'Historischer Kammerton, ca. einen Halbton tiefer', tag: 'A4' },
  { hz: 421.6, name: 'Klassik', desc: 'Annäherung an Mozart-Zeit', tag: 'A4' },
  { hz: 430.54, name: 'Scientific', desc: 'C4 = 256 Hz · physikalischer Ton', tag: 'A4' },
  { hz: 432, name: 'Verdi', desc: 'Naturton · Pythagoras · weit verbreitet', tag: 'A4' },
  { hz: 435, name: 'Diapason', desc: 'Pariser Norm 1859', tag: 'A4' },
  { hz: 440, name: 'ISO 16', desc: 'Internationaler Standard seit 1955', tag: 'A4' },
  { hz: 442, name: 'Orchester', desc: 'Berlin, Wien und viele moderne Häuser', tag: 'A4' },
  { hz: 444, name: 'Brillant', desc: 'Heller, präsenter Kammerton', tag: 'A4' },
  { hz: 528, name: 'A = 528', desc: 'Gesamtes Stück auf A4 = 528 Hz', tag: 'A4' },
]

export type SolfeggioPreset = PitchPreset & { note: string }

/** Solfeggio: shift so the named note equals the frequency (not A4). */
export const SOLFEGGIO_PRESETS: SolfeggioPreset[] = [
  { hz: 174, name: '174 Hz', desc: 'Fundament · Schmerz', note: 'F3', tag: 'Solfeggio' },
  { hz: 285, name: '285 Hz', desc: 'Feld · Regeneration', note: 'C#4', tag: 'Solfeggio' },
  { hz: 396, name: '396 Hz', desc: 'Befreiung von Angst', note: 'G4', tag: 'Solfeggio' },
  { hz: 417, name: '417 Hz', desc: 'Veränderung · Lösung', note: 'G#4', tag: 'Solfeggio' },
  { hz: 528, name: '528 Hz', desc: 'Transformation · „Miracle“', note: 'C5', tag: 'Solfeggio' },
  { hz: 639, name: '639 Hz', desc: 'Verbindung · Herz', note: 'D#5', tag: 'Solfeggio' },
  { hz: 741, name: '741 Hz', desc: 'Ausdruck · Reinigung', note: 'F#5', tag: 'Solfeggio' },
  { hz: 852, name: '852 Hz', desc: 'Intuition · Klarheit', note: 'G#5', tag: 'Solfeggio' },
  { hz: 963, name: '963 Hz', desc: 'Krone · Bewusstsein', note: 'B5', tag: 'Solfeggio' },
]

export type PlatformId =
  | 'none'
  | 'spotify'
  | 'apple'
  | 'youtube'
  | 'amazon'
  | 'tidal'
  | 'deezer'

export type PlatformProfile = {
  id: PlatformId
  name: string
  lufs: number | null
  truePeak: number | null
  desc: string
  hint: string
}

export const PLATFORM_PROFILES: PlatformProfile[] = [
  {
    id: 'none',
    name: 'Original',
    lufs: null,
    truePeak: null,
    desc: 'Keine Lautheit',
    hint: 'Dynamik und Pegel bleiben unverändert.',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    lufs: -14,
    truePeak: -1,
    desc: '−14 LUFS · −1 dBTP',
    hint: 'Loudness Normalization. Tracks lauter als −14 LUFS werden leiser geregelt.',
  },
  {
    id: 'apple',
    name: 'Apple Music',
    lufs: -16,
    truePeak: -1,
    desc: 'Sound Check −16 LUFS',
    hint: 'Apple Digital Masters: True Peak −1 dBTP, Sound Check zielt auf −16 LUFS.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    lufs: -14,
    truePeak: -1,
    desc: '−14 LUFS · −1 dBTP',
    hint: 'YouTube normalisiert auf ca. −14 LUFS integrated.',
  },
  {
    id: 'amazon',
    name: 'Amazon Music',
    lufs: -14,
    truePeak: -2,
    desc: '−14 LUFS · −2 dBTP',
    hint: 'Konservativer True-Peak für verlustbehaftete Codecs.',
  },
  {
    id: 'tidal',
    name: 'Tidal',
    lufs: -14,
    truePeak: -1,
    desc: '−14 LUFS · HiFi',
    hint: 'Ziel laut Tidal Mastering-Empfehlung.',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    lufs: -15,
    truePeak: -1,
    desc: '−15 LUFS',
    hint: 'Deezer ReplayGain / Lautheitsziel ca. −15 LUFS.',
  },
]

const SEMITONE_BY_NOTE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

/** Equal-tempered frequency of a named note (e.g. 'C5', 'F#5', 'Bb4') at a given A4. */
export function noteFreqAtA4(noteName: string, a4: number): number {
  const match = noteName.trim().match(/^([A-G](?:#|b)?)(-?\d+)$/)
  if (!match) return a4
  const idx = SEMITONE_BY_NOTE[match[1]]
  if (idx === undefined) return a4
  const oct = parseInt(match[2], 10)
  const midi = (oct + 1) * 12 + idx
  const a4midi = 69
  return a4 * Math.pow(2, (midi - a4midi) / 12)
}

export function computePitchRatio(
  sourceA4: number,
  targetHz: number,
  mode: TargetMode,
  solfNote: string,
): number {
  if (!Number.isFinite(sourceA4) || sourceA4 <= 0 || !Number.isFinite(targetHz) || targetHz <= 0) {
    return 1
  }
  if (mode === 'solfeggio') {
    return targetHz / noteFreqAtA4(solfNote, sourceA4)
  }
  return targetHz / sourceA4
}

export function hzToCents(from: number, to: number): number {
  if (from <= 0 || to <= 0) return 0
  return 1200 * Math.log2(to / from)
}

export function formatHz(hz: number, digits = 2): string {
  if (!Number.isFinite(hz)) return '—'
  return hz.toFixed(digits)
}

export function nearestPreset(hz: number, maxDiffHz = 1.5): PitchPreset | null {
  let best: PitchPreset | null = null
  let bestAbs = Infinity
  for (const p of CONCERT_PRESETS) {
    const d = Math.abs(p.hz - hz)
    if (d < bestAbs) {
      bestAbs = d
      best = p
    }
  }
  if (best && bestAbs <= maxDiffHz) return best
  return null
}

export function exactPreset(hz: number): PitchPreset | null {
  return nearestPreset(hz, 0.05)
}

export const CUSTOM_STORAGE_KEY = 'frequnzy.customHz'
export const LAST_TARGET_KEY = 'frequnzy.lastTarget'
export const LAST_MODE_KEY = 'frequnzy.lastMode'
export const LAST_SOLF_NOTE_KEY = 'frequnzy.lastSolfNote'
export const LAST_PLATFORM_KEY = 'frequnzy.lastPlatform'

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    /* private mode / quota / sandboxed iframe */
  }
}

export function loadCustomHz(): number[] {
  try {
    const raw = safeGetItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 20 && n <= 20000)
  } catch {
    return []
  }
}

export function saveCustomHz(list: number[]): void {
  safeSetItem(CUSTOM_STORAGE_KEY, JSON.stringify(list.slice(0, 12)))
}

export type PersistedTarget = {
  targetHz: number
  mode: TargetMode
  solfNote: string
}

export function loadTargetSettings(): PersistedTarget {
  const rawHz = safeGetItem(LAST_TARGET_KEY)
  const parsedHz = rawHz ? parseFloat(rawHz) : 432
  const targetHz = Number.isFinite(parsedHz) && parsedHz >= 20 && parsedHz <= 20000 ? parsedHz : 432

  const rawMode = safeGetItem(LAST_MODE_KEY)
  const mode: TargetMode = rawMode === 'solfeggio' ? 'solfeggio' : 'concert'

  const rawNote = safeGetItem(LAST_SOLF_NOTE_KEY)
  const matchingSolf = SOLFEGGIO_PRESETS.find((p) => Math.abs(p.hz - targetHz) < 0.05)
  const solfNote =
    rawNote && /^([A-G](?:#|b)?)(-?\d+)$/.test(rawNote)
      ? rawNote
      : matchingSolf?.note ?? 'C5'

  return { targetHz, mode, solfNote }
}

export function saveTargetSettings(targetHz: number, mode: TargetMode, solfNote: string): void {
  safeSetItem(LAST_TARGET_KEY, String(targetHz))
  safeSetItem(LAST_MODE_KEY, mode)
  safeSetItem(LAST_SOLF_NOTE_KEY, solfNote)
}

export function loadPlatform(): PlatformId {
  const s = safeGetItem(LAST_PLATFORM_KEY)
  return (PLATFORM_PROFILES.some((p) => p.id === s) ? s : 'none') as PlatformId
}

export function savePlatform(platform: PlatformId): void {
  safeSetItem(LAST_PLATFORM_KEY, platform)
}
