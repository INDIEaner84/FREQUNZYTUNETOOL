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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToNoteName(midi: number): string {
  const n = Math.round(midi)
  const name = NOTE_NAMES[((n % 12) + 12) % 12]
  const oct = Math.floor(n / 12) - 1
  return `${name}${oct}`
}

/** Equal-tempered frequency of a named note at a given A4. */
export function noteFreqAtA4(noteName: string, a4: number): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/)
  if (!match) return a4
  const name = match[1]
  const oct = parseInt(match[2], 10)
  const idx = NOTE_NAMES.indexOf(name)
  const midi = (oct + 1) * 12 + idx
  const a4midi = 69
  return a4 * Math.pow(2, (midi - a4midi) / 12)
}

export function hzToCents(from: number, to: number): number {
  if (from <= 0 || to <= 0) return 0
  return 1200 * Math.log2(to / from)
}

export function formatHz(hz: number, digits = 2): string {
  if (!Number.isFinite(hz)) return '—'
  return hz.toFixed(digits)
}

export function nearestPreset(hz: number): PitchPreset | null {
  let best: PitchPreset | null = null
  let bestAbs = Infinity
  for (const p of CONCERT_PRESETS) {
    const d = Math.abs(p.hz - hz)
    if (d < bestAbs) {
      bestAbs = d
      best = p
    }
  }
  if (best && bestAbs <= 1.5) return best
  return null
}

export const CUSTOM_STORAGE_KEY = 'frequnzy.customHz'
export const LAST_TARGET_KEY = 'frequnzy.lastTarget'
export const LAST_PLATFORM_KEY = 'frequnzy.lastPlatform'

export function loadCustomHz(): number[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is number => typeof n === 'number' && n > 20 && n < 20000)
  } catch {
    return []
  }
}

export function saveCustomHz(list: number[]) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list.slice(0, 12)))
}
