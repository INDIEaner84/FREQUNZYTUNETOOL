/**
 * Klanggabel-/„wissenschaftliche“ Frequenzdaten.
 *
 * Werte und Namen portiert aus evoluteur/healing-frequencies (frequencies.js),
 * abgerufen am 2026-11-26 von https://github.com/evoluteur/healing-frequencies
 *
 * MIT License — Copyright (c) 2026 Olivier Giulieri
 * (vollständiger Text: THIRD_PARTY_NOTICES.md)
 *
 * Die Zuordnungen (Organe, Chakras, DNA …) sind esoterische Tradition,
 * keine medizinische Wissenschaft — hier nur als Frequenz-Referenz gezeigt.
 * Mathematisch sauber: jede Frequenz ist ein absoluter Hz-Wert; die nächste
 * 12-TET-Note + exakter Cent-Abstand wird zur Laufzeit berechnet.
 */

export type ForkEntry = {
  /** Absolute Frequenz in Hz (wie im Original, inkl. Dezimalstellen) */
  hz: number
  /** Name/Beschreibung aus dem Original-Datensatz */
  name: string
}

export type ForkSet = {
  id: string
  name: string
  note?: string
  entries: ForkEntry[]
}

export const FORK_ATTRIBUTION = {
  name: 'evoluteur/healing-frequencies',
  url: 'https://github.com/evoluteur/healing-frequencies',
  license: 'MIT',
  holder: 'Olivier Giulieri',
  year: 2026,
} as const

export const FORK_SETS: ForkSet[] = [
  {
    id: 'solfeggio-full',
    name: 'Solfeggio (vollständig)',
    note: 'Inkl. der selteneren Töne 1074 / 1152 / 2172 Hz',
    entries: [
      { hz: 174, name: 'Physical pain relief & stress relief' },
      { hz: 285, name: 'Tissue restoration & healing' },
      { hz: 396, name: 'Guilt & fear diminishment' },
      { hz: 417, name: 'Trauma healing' },
      { hz: 528, name: 'Relaxation & sleep improvement' },
      { hz: 639, name: 'Improvement in mental balance' },
      { hz: 741, name: 'Detoxification of mind & body' },
      { hz: 852, name: 'Nervousness & anxiety relief' },
      { hz: 963, name: 'Increased positive energy & clarity' },
      { hz: 1074, name: 'Integration & expansion' },
      { hz: 1152, name: 'Spiritual purification' },
      { hz: 2172, name: 'Spiritual enlightenment & ascension' },
    ],
  },
  {
    id: 'healing',
    name: 'Healing (128 / 256 / 512 / 1024)',
    note: 'C4–C6-Serie, medizinische Stimmgabeln',
    entries: [
      { hz: 128, name: 'Blood circulation, sleep & stress relief' },
      { hz: 256, name: 'Cell growth, tissue regeneration & pain relief' },
      { hz: 512, name: 'Mental clarity, concentration & sleep' },
      { hz: 1024, name: "Balancing the body's energy & immune system" },
    ],
  },
  {
    id: 'schumann',
    name: 'Schumann-Resonanz',
    note: 'Elektromagnetische Grundresonanz der Erde',
    entries: [{ hz: 7.83, name: 'Earth’s natural frequency' }],
  },
  {
    id: 'ohm',
    name: 'Ohm-Stimmgabeln',
    note: '68.05 / 136.1 / 272.2 / 544.4 Hz',
    entries: [
      { hz: 68.05, name: 'Low Ohm' },
      { hz: 136.1, name: 'Mid Ohm (≈ OM / Anahata)' },
      { hz: 272.2, name: 'High Ohm' },
      { hz: 544.4, name: 'Ultra High Ohm' },
    ],
  },
  {
    id: 'chakras',
    name: 'Chakras',
    note: 'Wurzel bis Soul Star',
    entries: [
      { hz: 194.18, name: 'Root (Muladhara)' },
      { hz: 210.42, name: 'Sacral (Svadhisthana)' },
      { hz: 126.22, name: 'Solar Plexus (Manipura)' },
      { hz: 136.1, name: 'Heart (Anahata)' },
      { hz: 141.27, name: 'Throat (Vishuddha)' },
      { hz: 221.23, name: 'Third Eye (Ajna)' },
      { hz: 172.06, name: 'Crown (Sahasrara)' },
      { hz: 68.05, name: 'Earth star (Vasundhara)' },
      { hz: 272.2, name: 'Soul star (Vyapini)' },
    ],
  },
  {
    id: 'cosmic',
    name: 'Kosmische Oktave / Planeten',
    note: 'Hans-Cousto-Planetenfrequenzen',
    entries: [
      { hz: 194.18, name: 'Earth' },
      { hz: 210.42, name: 'Moon' },
      { hz: 211.44, name: 'Neptune' },
      { hz: 221.23, name: 'Venus' },
      { hz: 126.22, name: 'Sun' },
      { hz: 140.25, name: 'Pluto' },
      { hz: 141.27, name: 'Mercury' },
      { hz: 144.72, name: 'Mars' },
      { hz: 147.85, name: 'Saturn' },
      { hz: 183.58, name: 'Jupiter' },
      { hz: 207.36, name: 'Uranus' },
    ],
  },
  {
    id: 'organs',
    name: 'Organe',
    note: 'Stimm-Gabel-Frequenzen nach esoterischer Tradition',
    entries: [
      { hz: 110, name: 'Stomach' },
      { hz: 117.3, name: 'Pancreas' },
      { hz: 164.3, name: 'Gall Bladder' },
      { hz: 176, name: 'Colon' },
      { hz: 220, name: 'Lungs' },
      { hz: 281, name: 'Intestines' },
      { hz: 295.8, name: 'Fat Cells' },
      { hz: 315.8, name: 'Brain' },
      { hz: 317.83, name: 'Liver' },
      { hz: 319.88, name: 'Kidneys' },
      { hz: 321.9, name: 'Blood' },
      { hz: 324, name: 'Muscles' },
      { hz: 352, name: 'Bladder' },
      { hz: 418.3, name: 'Bone' },
      { hz: 492.8, name: 'Adrenals' },
    ],
  },
  {
    id: 'minerals',
    name: 'Mineralien & Elemente',
    note: 'Spurenelement-Gabeln',
    entries: [
      { hz: 256, name: 'Sulphur' },
      { hz: 272, name: 'Selenium & Chlorine' },
      { hz: 304, name: 'Potassium' },
      { hz: 312, name: 'Platinum' },
      { hz: 316, name: 'Gold' },
      { hz: 320, name: 'Calcium' },
      { hz: 336, name: 'Molybdenum' },
      { hz: 341, name: 'Magnesium' },
      { hz: 352, name: 'Sodium' },
      { hz: 376, name: 'Silver' },
      { hz: 384, name: 'Chromium' },
      { hz: 400, name: 'Manganese' },
      { hz: 416, name: 'Iron' },
      { hz: 424, name: 'Iodine' },
      { hz: 448, name: 'Silica' },
      { hz: 464, name: 'Copper' },
      { hz: 480, name: 'Phosphorus & Zinc' },
    ],
  },
  {
    id: 'angels',
    name: 'Engel / Angel Numbers',
    note: '111 · 222 · 333 · 444 …',
    entries: [
      { hz: 111, name: 'Holy frequency' },
      { hz: 222, name: 'Energy balancer' },
      { hz: 333, name: 'Angelic frequency' },
      { hz: 444, name: 'Spiritual detoxer' },
      { hz: 555, name: 'Divine change' },
      { hz: 666, name: 'Physical / spiritual balance' },
      { hz: 777, name: 'Divine sound' },
      { hz: 888, name: 'Infinite possibilities' },
      { hz: 999, name: 'Higher self frequency' },
      { hz: 4096, name: "Jacob's ladder" },
      { hz: 4160, name: 'Pillar of light' },
      { hz: 4225, name: 'Stairway to heaven' },
    ],
  },
  {
    id: 'tesla',
    name: 'Tesla 3 · 6 · 9',
    entries: [
      { hz: 333, name: 'Healing, balance & harmony' },
      { hz: 639, name: 'Relationships, connection & communication' },
      { hz: 999, name: 'Spiritual awakening & transformation' },
    ],
  },
  {
    id: 'dna',
    name: 'DNA-Nukleotide',
    note: 'Cytosin · Thymin · Adenin · Guanin',
    entries: [
      { hz: 537.8, name: 'Cytosine' },
      { hz: 543.4, name: 'Thymine' },
      { hz: 545.6, name: 'Adenine' },
      { hz: 550, name: 'Guanine' },
    ],
  },
  {
    id: 'otto',
    name: 'Otto-Stimmgabeln',
    entries: [
      { hz: 32, name: 'Immune system' },
      { hz: 64, name: 'Nervous system' },
      { hz: 128, name: 'Joints mobility' },
    ],
  },
]
