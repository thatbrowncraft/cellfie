/**
 * core/laboratory/microcopy — Laboratory-scoped Gen Z one-liners.
 *
 * `core/dashboard/humor.ts` originally scoped this style of copy to the
 * Dashboard only. Laboratory now gets its own dedicated set, applied
 * consistently across the hub page, every section header, and every
 * individual protocol/media/test/equipment/formula/calculator detail
 * page — one short line under each title, per the design direction for
 * this module specifically. Nothing here touches Dashboard's copy or any
 * other module; `DASHBOARD_HUMOR` in `core/dashboard/humor.ts` is
 * untouched and still Dashboard-only.
 *
 * Tone target: witty and scientifically *relevant* (a real pun/callback
 * to what the content actually is), never a generic motivational quote,
 * and never undermining the scientific content itself — the line sits
 * under the title as flavor, not instead of the real explanation.
 *
 * Extensibility: `getItemTagline` falls back to the item's category-level
 * line (`SECTION_TAGLINES`) if a specific id isn't in `ITEM_TAGLINES` yet —
 * so a Tier 2 protocol/media/test dropped in later never renders with no
 * line at all, it just inherits its section's line until someone writes
 * it a bespoke one.
 */
import type { LaboratoryCategory } from './types'

/** Shown directly under "Laboratory" on the hub page itself. */
export const LAB_HUB_TAGLINE = "Where 'trust me bro' goes to die. Cite your reagents."

/** One line per top-level Laboratory section, shown under each section header/card. */
export const SECTION_TAGLINES: Record<LaboratoryCategory, string> = {
  protocol: 'Step-by-step, because "just wing it" is not a valid SOP.',
  concept: 'The vocabulary that keeps you from getting cooked in viva.',
  media: "Agar's version of a five-star meal, made to spec.",
  'biochemical-test': 'Tiny color changes with big identification energy.',
  biosafety: "The chapter where 'it's probably fine' is banned.",
  equipment: 'The squad that does the actual heavy lifting.',
  formula: 'Equations that owe you nothing but the truth.'
}

/** Shown under the Calculator Hub section heading. */
export const CALCULATOR_HUB_TAGLINE = 'Vibes are not a valid unit of measurement.'

/** Shown under the Unit Converter section heading. */
export const UNIT_CONVERTER_TAGLINE = 'Because µL and mL mix-ups end careers, not just experiments.'

/** Shown under the "Quick Lab Desk" heading on the Laboratory Hub (brief §2-3). */
export const QUICK_DESK_TAGLINE = 'Your digital lab bench — everything within arm\u2019s reach.'

/** Shown under the "Learn by Difficulty" heading on the Laboratory Hub (brief §3). */
export const LEARN_BY_DIFFICULTY_TAGLINE = 'Pick your arc: fresher, comfortable, dangerous, or "publish or perish."'

/** One line per difficulty tier, shown on its own card in "Learn by Difficulty" (brief §23-24). */
export const DIFFICULTY_TAGLINES: Record<'beginner' | 'intermediate' | 'advanced' | 'expert', string> = {
  beginner: 'Foundational moves everyone needs before touching a real culture.',
  intermediate: 'Where "I read about it" turns into "I can actually do it."',
  advanced: 'Specialized techniques with real room to mess up.',
  expert: 'QC, instrumentation, and the stuff that shows up after the degree.'
}

/** Shown next to the "Random Lab Pick" action (brief §24). */
export const RANDOM_PICK_TAGLINE = 'Let the lab decide your fate.'

const ITEM_TAGLINES: Record<string, string> = {
  // Protocols
  'proto-gram-stain': 'Purple or pink — the original main-character test.',
  'proto-simple-stain': 'One dye, zero drama, full clarity.',
  'proto-streak-plate': 'Four quadrants of gradually giving up cells.',
  'proto-spread-plate': "Spreading the news, evenly, on purpose.",
  'proto-serial-dilution': 'Watering it down, one precise pour at a time.',
  'proto-cfu-enumeration': 'Counting dots so math can do the rest.',
  'proto-wet-mount': "Live footage, no filter, no edits.",
  'proto-brightfield-microscopy': 'Zoom, but make it 1000×.',
  'proto-acid-fast-stain': "The stain that laughs at acid-alcohol.",
  'proto-endospore-stain': "Green means it packed survival gear.",
  'proto-pour-plate': "Colonies suspended in agar, no surface required.",

  // Concepts
  'concept-aseptic-technique': "It's giving 'main character keeps their hands clean.'",
  'concept-sterilization-vs-disinfection': 'One kills everything. One just handles business.',
  'concept-selective-differential-media': "Agar that gatekeeps and agar that gossips.",
  'concept-enriched-vs-enrichment-media': 'Similar names, very different homework.',
  'concept-cfu-vs-direct-count': "Alive-and-growing vs. just-technically-there.",
  'concept-mic-vs-mbc': 'Pause the growth vs. end it completely.',
  'concept-bsl-vs-risk-group': "The organism's rap sheet vs. today's actual plan.",
  'concept-bsc-vs-clean-bench': 'One protects you. One protects the sample. Do not mix them up.',
  'concept-accuracy-precision': 'Being right vs. being consistently, confidently wrong.',
  'concept-contamination': "The uninvited guest that ruins the whole plate.",
  'concept-sterilization-indicators': "Proof of work, but for killing spores.",
  'concept-od-vs-cell-concentration': "A vibe check for your culture, not a headcount.",
  'concept-positive-negative-controls': "The receipts your test needs to be believed.",
  'concept-generation-time': "How long until there's twice the chaos.",
  'concept-pure-vs-mixed-culture': "One species, zero roommates.",
  'concept-reproducibility-repeatability': "Getting it right once vs. getting it right everywhere.",

  // Media
  'media-nutrient-agar': 'The plain rice of microbiology media — reliable, unbothered.',
  'media-nutrient-broth': 'Nutrient Agar, but make it a smoothie.',
  'media-tsa': 'The upgraded meal plan for pickier organisms.',
  'media-tsb': 'TSA in liquid form, still generous with the nutrients.',
  'media-macconkey': 'Pink if you ferment, invisible if you don\u2019t.',
  'media-blood-agar': "Bring blood, get judged by hemolysis.",
  'media-mueller-hinton': 'The referee medium for antibiotic showdowns.',
  'media-simmons-citrate': "Blue means yes, green means try again.",
  'media-mannitol-salt-agar': "High salt, low tolerance for anything that isn't Staph.",
  'media-emb': "Green sheen, big E. coli energy.",
  'media-sabouraud-dextrose-agar': "The fungi's favorite low-pH buffet.",

  // Biochemical tests
  'test-catalase': 'Bubbles, but make it diagnostic.',
  'test-oxidase': "Turns purple when it's feeling electric.",
  'test-indole': "Adds a red ring like it's signing its work.",
  'test-citrate': 'Blue if it can live off citrate alone. Iconic behavior.',
  'test-urease': "Turns pink when it's had enough urea.",
  'test-tsi': "One tube, three sugars, way too much personality.",
  'test-methyl-red': 'Stays red if the acid game is strong.',
  'test-voges-proskauer': "Pink means it went the butanediol route instead.",
  'test-motility': "A single stab reveals who actually moves.",
  'test-nitrate-reduction': "Red means yes, zinc settles the arguments.",
  'test-coagulase': "Clumps together, calls itself Staph aureus.",

  // Biosafety
  'safety-aseptic-technique': 'The discipline behind every clean result.',
  'safety-ppe': "The fit check that actually matters.",
  'safety-basic-bsl-concepts': "Containment levels: choose wisely, not by vibes.",
  'safety-biological-waste': 'Trash, but with extra steps and good reason.',
  'safety-sharps-safety': "Sharp objects, zero tolerance for main-character carelessness.",
  'safety-disinfection': 'Good enough for the bench, not for the spores.',
  'safety-sterilization': "The 'kill everything, no exceptions' setting.",
  'safety-spill-response': 'The plan you hope to never need, memorized anyway.',
  'safety-contamination-prevention': 'Keeping the plot twist-free.',
  'safety-bsc-vs-clean-bench': "Wrong cabinet, wrong day — don't be that story.",
  'safety-basic-autoclave-safety': "Steam that means business. Respect it.",
  'safety-risk-assessment': "The homework before the containment level.",
  'safety-chemical-safety': "Read the label before it reads you your rights.",

  // Equipment
  'equip-microscope-brightfield': 'Your eyes, but with superpowers.',
  'equip-autoclave': "The pressure cooker with a body count of one (microbes).",
  'equip-incubator': 'A cozy little apartment for things you want to grow.',
  'equip-centrifuge': "Spin class, but for cells.",
  'equip-micropipette': 'Precision in your fingertips, drama if you misuse it.',
  'equip-ph-meter': "The mood ring for your solutions.",
  'equip-balance-analytical': 'Weighs your reagents, judges your rounding.',
  'equip-bsc-class-ii': "Your personal airflow bodyguard.",
  'equip-slides': 'The stage for your tiniest main characters.',
  'equip-petri-dish': "Home sweet home, agar edition.",
  'equip-test-tubes': 'Small vessels, big responsibility.',
  'equip-erlenmeyer-flasks': "The flask that doesn't spill on you out of spite.",
  'equip-beakers': "Not for precision. Don't @ it.",
  'equip-volumetric-flasks': "The one flask that actually means what it says.",
  'equip-graduated-cylinders': 'The reasonable middle ground of measuring.',
  'equip-micropipette-tips': 'One use, no exceptions, no regrets.',
  'equip-inoculating-loop': 'Tiny loop, massive responsibility.',
  'equip-spreaders': "Distributing the wealth, agar-style.",
  'equip-microcentrifuge-tubes': "Tiny tubes holding your biggest hopes.",
  'equip-spectrophotometer': "Shines a light on your culture's whole personality.",
  'equip-water-bath': "A hot tub, strictly for reagents.",
  'equip-co2-incubator': "A tiny, humid apartment with a very specific atmosphere.",

  // Formulas
  'formula-cfu-ml': "The formula that turns dots into data.",
  'formula-cfu-g': 'CFU/mL\u2019s sibling who deals with solids.',
  'formula-dilution-factor': 'The math behind "just a little bit."',
  'formula-c1v1': 'Concentration algebra that never lies.',
  'formula-molarity': "How much powder equals your dreams.",
  'formula-percent-wv': 'Grams flexing per 100 mL.',
  'formula-percent-vv': 'Liquids flexing per 100 mL.',
  'formula-ppm': 'Very small numbers, very real consequences.',
  'formula-rcf-rpm': "Speed and force, finally on speaking terms.",
  'formula-ph': 'A logarithm with strong opinions about acidity.',
  'formula-mean': 'The average that carries the whole data set.',
  'formula-standard-deviation': "How much your data likes to wander.",
  'formula-cv': 'Spread, but make it a percentage.',
  'formula-beer-lambert': "Light in, concentration out, no vibes involved.",
  'formula-generation-time': "The stopwatch on exponential chaos.",

  // Calculators
  'calc-cfu-ml': "Do the math so your pipetting hand doesn't have to.",
  'calc-cfu-g': "Homogenization's honest accountant.",
  'calc-dilution-factor': "For when '1:10-ish' isn't going to cut it.",
  'calc-c1v1': 'Solves for the blank so you don\u2019t have to algebra at 8am.',
  'calc-molarity-mass': "Tells the scale exactly what to expect.",
  'calc-rcf-rpm': 'Converts speed into force, drama-free.',
  'calc-statistics': "Turns your triplicates into an actual conclusion.",
  'calc-beer-lambert': "Turns a light reading into an actual number."
}

/**
 * Returns the bespoke line for a specific content id if one exists,
 * otherwise falls back to that category's section-level line so newly
 * added Tier 2+ content never renders without a tagline.
 */
export function getItemTagline(id: string, category: LaboratoryCategory): string {
  return ITEM_TAGLINES[id] ?? SECTION_TAGLINES[category]
}

/** Calculators and the Unit Converter live outside `LaboratoryCategory` (they're tools, not content categories), so they get their own lookup with the same fallback shape. */
export function getCalculatorTagline(calculatorId: string): string {
  return ITEM_TAGLINES[calculatorId] ?? CALCULATOR_HUB_TAGLINE
}
