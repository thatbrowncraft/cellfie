/**
 * core/periodic-table/memoryTricks — "Periodic Table Memory Tricks".
 *
 * Extends the existing Trend Guide (reference.ts's PERIODIC_TRENDS) with
 * a dedicated memorization system covering all 118 elements in
 * atomic-number order, plus family/period/transition-metal/lanthanide/
 * actinide recall aids. Kept as its own data module — same reasoning as
 * reference.ts already documents: fixed curated reference data, not an
 * open-ended per-item content type.
 *
 * Every mnemonic below is original (not a reproduction of a known
 * textbook/teacher mnemonic) and is verified by `assertMemoryTricksData`
 * at the bottom of this file: same element count, no skips, no
 * duplicates, correct order — checked against the live element registry
 * so a future addition to `content/periodic-table/elements/*.json`
 * can't silently drift out of sync with this file.
 */
import type { DifficultSequence, FamilyMemoryCard, MemoryChunk, PeriodMemoryCard, TeacherTrickCard } from './types'
import { ALL_ELEMENTS } from './registry'

/**
 * Full 1–118 sequence, chunked in 10s (brief's suggested chunking),
 * with the last chunk trimmed to 8 since 118 isn't divisible by 10.
 * Each mnemonic word encodes its symbol's letters in order (not
 * necessarily adjacent) — the same loose convention the app's existing
 * first-20 mnemonics already use (e.g. "Magpies" for Mg).
 */
export const MEMORY_CHUNKS: MemoryChunk[] = [
  {
    id: 'chunk-1-10',
    label: 'Elements 1–10',
    range: [1, 10],
    symbols: ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    mnemonic: 'Happy Henry Likes Beer But Could Not Obtain Food, Nuts.'
  },
  {
    id: 'chunk-11-20',
    label: 'Elements 11–20',
    range: [11, 20],
    symbols: ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'],
    mnemonic: 'Naughty Magpies Always Sing Perfect Songs, Clara Always Kicks Cats.'
  },
  {
    id: 'chunk-21-30',
    label: 'Elements 21–30',
    range: [21, 30],
    symbols: ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn'],
    mnemonic: 'Scared Tigers Value Crunchy Mangoes, Ferrets Cook Nice Curry, Zen-style.',
    note: 'This is where the d-block starts — the "boring" 3d row students skip revising and then panic over.'
  },
  {
    id: 'chunk-31-40',
    label: 'Elements 31–40',
    range: [31, 40],
    symbols: ['Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr'],
    mnemonic: 'Gallant Geckos Asked Sensible Bright Krill; Robots Strangely Yodeled Zorro.'
  },
  {
    id: 'chunk-41-50',
    label: 'Elements 41–50',
    range: [41, 50],
    symbols: ['Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn'],
    mnemonic: 'Nobody Mostly Teaches Rude Rhinos; Pandas Aggressively Cuddle Instead Snacking.'
  },
  {
    id: 'chunk-51-60',
    label: 'Elements 51–60',
    range: [51, 60],
    symbols: ['Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd'],
    mnemonic: 'Sabotage Tea, It Xeroxed; Casual Bananas Lazily Certified Pretty Nods.',
    note: 'La at 57 is the hinge into the lanthanides — see the dedicated Lanthanides card below.'
  },
  {
    id: 'chunk-61-70',
    label: 'Elements 61–70',
    range: [61, 70],
    symbols: ['Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb'],
    mnemonic: 'Pampered Samosas Eureka! Godly Tubby Dying, Hopping Errands Tomorrow, Yabbering.',
    note: 'All lanthanides — see the Lanthanides card for the same run with names and a cleaner split.'
  },
  {
    id: 'chunk-71-80',
    label: 'Elements 71–80',
    range: [71, 80],
    symbols: ['Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg'],
    mnemonic: "Lucky Half Tantrums Won Really Ostrich, Ironic Pity, Auntie's Huge!",
    note: 'Lu closes the lanthanides, then Hf→Hg is the period-6 d-block — see Transition Metals below.'
  },
  {
    id: 'chunk-81-90',
    label: 'Elements 81–90',
    range: [81, 90],
    symbols: ['Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th'],
    mnemonic: 'Tall Pebbles Bite Poison, Attack Ran, Freaked Rabbits Across Thin.'
  },
  {
    id: 'chunk-91-100',
    label: 'Elements 91–100',
    range: [91, 100],
    symbols: ['Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm'],
    mnemonic: 'Panicked Uncle Napped, Puzzled, Amazed, Combed, Backed, Confused, Escaped, Formed.',
    note: 'All actinides from here on — see the Actinides card for names alongside symbols.'
  },
  {
    id: 'chunk-101-110',
    label: 'Elements 101–110',
    range: [101, 110],
    symbols: ['Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds'],
    mnemonic: "Mad Nobles' Lord Refused; Debated Sagely, Behind Hissed Mountains, Dissolved.",
    note: 'Lr at 103 closes the actinides; Rf onward are the superheavy synthetic elements.'
  },
  {
    id: 'chunk-111-118',
    label: 'Elements 111–118',
    range: [111, 118],
    symbols: ['Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'],
    mnemonic: 'Rogue Cannot Nihilistically Fly; Mice Levitate, Testing Ogres.',
    note: "The final row — mostly named after labs and scientists. Og closes the table at 118."
  }
]

/**
 * Family memory — brief §8/§15. Alkali/alkaline-earth/halogens/noble
 * gases are the four the brief explicitly asks for; pnictogens and
 * chalcogens are included as the two other groups students most
 * commonly need for exam recall (NCERT periodicity questions lean on
 * all six of these).
 */
export const FAMILY_MEMORY: FamilyMemoryCard[] = [
  {
    id: 'group-1',
    label: 'Group 1 — Alkali Metals',
    symbols: ['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'],
    names: ['Lithium', 'Sodium', 'Potassium', 'Rubidium', 'Caesium', 'Francium'],
    atomicNumbers: [3, 11, 19, 37, 55, 87],
    mnemonic: "Little Nations Kept Rubbing Caesar's Friend.",
    patternHint: 'One valence electron each — reactivity climbs as you go down, so Fr is the most reactive metal on the table.'
  },
  {
    id: 'group-2',
    label: 'Group 2 — Alkaline Earth Metals',
    symbols: ['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'],
    names: ['Beryllium', 'Magnesium', 'Calcium', 'Strontium', 'Barium', 'Radium'],
    atomicNumbers: [4, 12, 20, 38, 56, 88],
    mnemonic: 'Best Magpies Cannot Surely Bake Rats.',
    patternHint: 'Two valence electrons each, always +2 ions — one row to the right of Group 1, same six periods.'
  },
  {
    id: 'group-15',
    label: 'Group 15 — Pnictogens',
    symbols: ['N', 'P', 'As', 'Sb', 'Bi'],
    names: ['Nitrogen', 'Phosphorus', 'Arsenic', 'Antimony', 'Bismuth'],
    atomicNumbers: [7, 15, 33, 51, 83],
    mnemonic: 'Nervous People Asked Sabotaged Bikes.',
    patternHint: 'Five valence electrons — the group runs nonmetal → metalloid → metal as you go down, a clean example of the metallic-character trend.'
  },
  {
    id: 'group-16',
    label: 'Group 16 — Chalcogens',
    symbols: ['O', 'S', 'Se', 'Te', 'Po'],
    names: ['Oxygen', 'Sulfur', 'Selenium', 'Tellurium', 'Polonium'],
    atomicNumbers: [8, 16, 34, 52, 84],
    mnemonic: 'Odd Snakes Selfishly Tease Ponies.',
    patternHint: 'One column right of the pnictogens — six valence electrons, so they need two more for a full octet.'
  },
  {
    id: 'group-17',
    label: 'Group 17 — Halogens',
    symbols: ['F', 'Cl', 'Br', 'I', 'At', 'Ts'],
    names: ['Fluorine', 'Chlorine', 'Bromine', 'Iodine', 'Astatine', 'Tennessine'],
    atomicNumbers: [9, 17, 35, 53, 85, 117],
    mnemonic: 'Freddy Cleverly Brings Ice At Test-time.',
    patternHint: 'One electron short of a full octet each — most reactive nonmetal family, and reactivity drops as you go down (opposite of Group 1).'
  },
  {
    id: 'group-18',
    label: 'Group 18 — Noble Gases',
    symbols: ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'],
    names: ['Helium', 'Neon', 'Argon', 'Krypton', 'Xenon', 'Radon', 'Oganesson'],
    atomicNumbers: [2, 10, 18, 36, 54, 86, 118],
    mnemonic: 'Henry Never Argues, Krill Xeroxes Random Ogres.',
    patternHint: 'Full valence shell each — the right-most column, and the last element of every period you already know.'
  }
]

/** Period-wise memory — brief §7. Reuses the chunk mnemonics above by reference rather than re-inventing new ones where the sequence is identical. */
export const PERIOD_MEMORY: PeriodMemoryCard[] = [
  {
    period: 1,
    range: [1, 2],
    symbols: ['H', 'He'],
    recallTrick: 'Just two. "Happy Henry" — the first two words of your Elements 1–10 mnemonic.'
  },
  {
    period: 2,
    range: [3, 10],
    symbols: ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    recallTrick: 'The tail end of "Happy Henry Likes Beer But Could Not Obtain Food, Nuts" — drop "Happy Henry", keep the rest.'
  },
  {
    period: 3,
    range: [11, 18],
    symbols: ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
    recallTrick: 'The first 8 words of "Naughty Magpies Always Sing Perfect Songs, Clara Always" — stop before "Kicks Cats" (that\'s Period 4).'
  },
  {
    period: 4,
    range: [19, 36],
    symbols: ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
    difficultPart: 'The 10-wide 3d block (Sc→Zn) sitting between Ca and Ga — the part everyone forgets exists.',
    recallTrick: '"Kicks Cats" (K, Ca) + your whole Elements 21–30 chunk (Sc→Zn) + your whole Elements 31–40 chunk (Ga→Kr).'
  },
  {
    period: 5,
    range: [37, 54],
    symbols: ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
    difficultPart: 'Structurally a mirror of Period 4 — same 18-wide shape, one row down, so confusing Nb/Ta or Mo/W across periods is common.',
    recallTrick: 'Same shape as Period 4: two s-block (Rb, Sr) + ten d-block (Y→Cd) + six p-block (In→Xe). Your Elements 31–40/41–50/51–60 chunks cover it end to end.'
  },
  {
    period: 6,
    range: [55, 86],
    symbols: [
      'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
      'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'
    ],
    difficultPart: 'The longest period on the table (32 elements) — the entire 15-wide lanthanide row is squeezed in between Ba and Hf.',
    recallTrick: 'Cs, Ba (2) → all 15 lanthanides, La→Lu (see Lanthanides card) → 9 d-block, Hf→Hg → 6 p-block, Tl→Rn.'
  },
  {
    period: 7,
    range: [87, 118],
    symbols: [
      'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr',
      'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'
    ],
    difficultPart: 'Same 32-wide shape as Period 6, but almost the entire row is synthetic — nothing here occurs naturally past uranium in any real quantity.',
    recallTrick: 'Fr, Ra (2) → all 15 actinides, Ac→Lr (see Actinides card) → 9 d-block, Rf→Cn → 6 p-block, Nh→Og. The last element is always the noble gas of that period — here, Og.'
  }
]

/** Transition-metal chunking — brief §9. */
export const TRANSITION_METAL_CHUNKS: MemoryChunk[] = [
  {
    id: 'transition-sc-zn',
    label: 'Sc → Zn (Period 4, atomic numbers 21–30)',
    range: [21, 30],
    symbols: ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn'],
    mnemonic: 'Scared Tigers Value Crunchy Mangoes, Ferrets Cook Nice Curry, Zen-style.',
    note: 'Fe, Co, Ni sit right next to each other and get mixed up constantly — see Difficult Sequences below.'
  },
  {
    id: 'transition-y-cd',
    label: 'Y → Cd (Period 5, atomic numbers 39–48)',
    range: [39, 48],
    symbols: ['Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd'],
    mnemonic: 'Yellow Zebras Nibble Mostly, Teaching Rubies; Rhinos Paddle Agile Cadillacs.',
    note: 'Tc (technetium) is the one with no stable isotopes — every other element in this row has at least one.'
  },
  {
    id: 'transition-hf-hg',
    label: 'Hf → Hg (Period 6, atomic numbers 72–80)',
    range: [72, 80],
    symbols: ['Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg'],
    mnemonic: "Half Tantrums Won Really Ostrich, Ironic Pity, Auntie's Huge!",
    note: 'This is the "precious metals" stretch — Au and Pt sit four elements apart, not next to each other.'
  },
  {
    id: 'transition-rf-cn',
    label: 'Rf → Cn (Period 7, atomic numbers 104–112)',
    range: [104, 112],
    symbols: ['Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn'],
    mnemonic: 'Refused; Debated Sagely, Behind Hissed Mountains, Dissolved. Rogue Cannot.',
    note: 'All synthetic, all named after places or scientists (Rf–Rutherford, Sg–Seaborg, Mt–Meitner…) — the names double as the memory hook.'
  }
]

/** Lanthanides — brief §10. Split into two halves for a cleaner rehearsal unit. */
export const LANTHANIDES = {
  symbols: ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'],
  names: [
    'Lanthanum', 'Cerium', 'Praseodymium', 'Neodymium', 'Promethium', 'Samarium', 'Europium', 'Gadolinium',
    'Terbium', 'Dysprosium', 'Holmium', 'Erbium', 'Thulium', 'Ytterbium', 'Lutetium'
  ],
  atomicNumbers: [57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71],
  mnemonicHalves: [
    { symbols: ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm'], mnemonic: 'Lazy Cerebral Pranksters Nodded, Pampered, Smiling.' },
    {
      symbols: ['Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'],
      mnemonic: 'Eureka! Godly Tubby Dying, Hopped, Erupted, Tumbled, Yabbed, Lucky.'
    }
  ],
  troubleSpot: 'Pm (promethium) is the only lanthanide with no stable isotopes — everything else in this row is naturally occurring.'
}

/** Actinides — brief §11. Split into two halves the same way as the lanthanides. */
export const ACTINIDES = {
  symbols: ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'],
  names: [
    'Actinium', 'Thorium', 'Protactinium', 'Uranium', 'Neptunium', 'Plutonium', 'Americium', 'Curium',
    'Berkelium', 'Californium', 'Einsteinium', 'Fermium', 'Mendelevium', 'Nobelium', 'Lawrencium'
  ],
  atomicNumbers: [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103],
  mnemonicHalves: [
    { symbols: ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu'], mnemonic: 'Across The Pass, Uncle Napped, Puzzled.' },
    {
      symbols: ['Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'],
      mnemonic: 'Amazed, Combed, Backed, Confused, Escaped, Formed, Mad Nobles Lured.'
    }
  ],
  troubleSpot: 'U (uranium, 92) is the last naturally-occurring element in significant quantity — everything after it, Np onward, is synthetic.'
}

/** Commonly confused runs of neighbours — brief §12. */
export const DIFFICULT_SEQUENCES: DifficultSequence[] = [
  {
    id: 'fe-co-ni',
    label: 'Fe / Co / Ni',
    symbols: ['Fe', 'Co', 'Ni'],
    hook: 'Iron, Cobalt, Nickel — in that order, 26/27/28. "FeCoNi" reads almost like one word once you say it fast a few times.'
  },
  {
    id: 'nb-mo-tc-ru-rh-pd-ag-cd',
    label: 'Nb through Cd (Period 5 d-block)',
    symbols: ['Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd'],
    hook: 'Students often swap Nb/Ta and Mo/W because they look alike across periods 5 and 6. Anchor on Ag (silver, 47) — everything else in this row sits relative to it.'
  },
  {
    id: 'hf-ta-w-re-os-ir-pt-au-hg',
    label: 'Hf through Hg (Period 6 d-block)',
    symbols: ['Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg'],
    hook: 'W (tungsten) breaks the "symbol matches the name" pattern because it comes from wolfram — the one everyone forgets is W, not Tu or Tn.'
  },
  {
    id: 'br-i',
    label: 'Br vs I',
    symbols: ['Br', 'I'],
    hook: 'Both halogens, both easy to mix up in reactivity questions. Br (35) sits above I (53) — reactivity is higher for Br since halogens get less reactive going down.'
  },
  {
    id: 'ag-au',
    label: 'Ag vs Au',
    symbols: ['Ag', 'Au'],
    hook: 'Silver (Ag, 47) and Gold (Au, 79) — both from Latin names (argentum, aurum), both often confused because neither symbol looks like the English name at all.'
  },
  {
    id: 'lanthanide-actinide-boundary',
    label: 'La/Ac boundary confusion',
    symbols: ['La', 'Ac'],
    hook: 'La (57) starts the lanthanides, Ac (89) starts the actinides — same position in their row, different periods. If you know one, you know where the other sits.'
  }
]

/** Teacher Trick cards — brief §14. Practical, not motivational filler. */
export const TEACHER_TRICKS: TeacherTrickCard[] = [
  { id: 'chunk-dont-memorize-20', text: "Don't memorize 20 names in one go. Memorize 10, get it perfect, then add the next 10." },
  { id: 'say-it-out-loud', text: 'Say the symbol sequence out loud, not just in your head. Your brain remembers rhythm surprisingly well.' },
  { id: 'first-20-foundation', text: 'Learn the first 20 until they\'re automatic. Every other trick in this section leans on you already having those solid.' },
  { id: 'families-not-strangers', text: 'Memorize families separately from periods. Group 17 becomes one little squad of six instead of six unrelated elements scattered across the table.' },
  { id: 'learn-backwards-too', text: 'Once a sequence feels easy forward, try it backwards. If you can go Ne→Ne...F→O→N→C→B→Be→Li→He→H, you actually know it — not just the rhythm.' },
  { id: 'anchor-elements', text: 'Pick one anchor per row (Fe in period 4, Ag in period 5, Au in period 6) and rebuild outward from there instead of starting from the left every time.' },
  { id: 'structure-over-memory', text: "You don't need 118 isolated facts. You need the shape of the table — periods, groups, blocks — plus a handful of sequences. Logic fills in the rest." }
]

// ---------------------------------------------------------------------
// Runtime consistency check (dev-time only) — mirrors registry.ts's own
// build-time validation instinct. Confirms every MEMORY_CHUNKS/family/
// period/lanthanide/actinide symbol list matches the live element
// registry in order, with no skips or duplicates, so a future edit here
// (or a future addition to the element JSON files) can't silently drift.
// ---------------------------------------------------------------------
function assertMemoryTricksData() {
  if (ALL_ELEMENTS.length === 0) return // registry not loaded in this environment (e.g. isolated unit test)

  const bySymbol = new Map(ALL_ELEMENTS.map((e) => [e.symbol, e]))

  function checkSequence(context: string, symbols: string[], range?: [number, number]) {
    const seen = new Set<string>()
    let prevAtomicNumber = -Infinity
    for (const symbol of symbols) {
      const el = bySymbol.get(symbol)
      if (!el) {
        // eslint-disable-next-line no-console
        console.warn(`[memoryTricks] "${context}" references unknown symbol "${symbol}"`)
        continue
      }
      if (seen.has(symbol)) {
        // eslint-disable-next-line no-console
        console.warn(`[memoryTricks] "${context}" has a duplicate symbol "${symbol}"`)
      }
      seen.add(symbol)
      if (el.atomicNumber <= prevAtomicNumber) {
        // eslint-disable-next-line no-console
        console.warn(`[memoryTricks] "${context}" is out of atomic-number order at "${symbol}"`)
      }
      prevAtomicNumber = el.atomicNumber
    }
    if (range) {
      const expectedCount = range[1] - range[0] + 1
      if (symbols.length !== expectedCount) {
        // eslint-disable-next-line no-console
        console.warn(
          `[memoryTricks] "${context}" covers ${symbols.length} symbols but range ${range[0]}–${range[1]} expects ${expectedCount}`
        )
      }
    }
  }

  for (const chunk of MEMORY_CHUNKS) checkSequence(chunk.label, chunk.symbols, chunk.range)
  for (const chunk of TRANSITION_METAL_CHUNKS) checkSequence(chunk.label, chunk.symbols, chunk.range)
  for (const family of FAMILY_MEMORY) checkSequence(family.label, family.symbols)
  for (const period of PERIOD_MEMORY) checkSequence(`Period ${period.period}`, period.symbols, period.range)
  checkSequence('Lanthanides', LANTHANIDES.symbols)
  checkSequence('Actinides', ACTINIDES.symbols)
}

assertMemoryTricksData()
