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
  'proto-buffer-preparation': 'pKa near your target pH or don\u2019t bother.',
  'proto-ph-meter-calibration': "Two points minimum, or the meter's just guessing.",
  'proto-autoclave-operation': "121\u00b0C, 15 minutes, zero shortcuts.",
  'proto-dna-extraction': "Lyse, purify, hope the ratios look good.",
  'proto-plasmid-miniprep': "Gentle inversions only \u2014 vortexing is a personality flaw here.",
  'proto-agarose-gel-electrophoresis': "Small fragments sprint, big ones jog.",
  'proto-restriction-digestion': "Cuts exactly where the sequence says to.",
  'proto-bacterial-transformation': "Forty-five seconds of heat shock, a lifetime of resistance.",
  'proto-bradford-assay': "Blue means protein. Bluer means more protein.",
  'proto-sds-page': "Denatures everything but the size hierarchy.",
  'proto-western-blot': "Antibodies snitching on one specific protein.",
  'proto-hemocytometer-cell-counting': "Four corners, one honest headcount.",
  'proto-mammalian-cell-passage': "Detach, dilute, don't let it get too crowded.",
  'proto-trypan-blue-viability': "Blue if you're not making it, clear if you are.",
  'proto-cell-cryopreservation': "Slow and cold beats fast and dead.",
  'proto-capsule-stain': "The halo you can only see by staining around it.",
  'proto-negative-stain': "Dyeing the background so the cells can keep their shape.",
  'proto-nucleic-acid-quantification': "One microliter, one very opinionated ratio.",

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
  'concept-si-units-lab-measurements': "Milli, micro, nano \u2014 mind the zeros.",
  'concept-significant-figures': "Only as precise as your instrument, no cap.",
  'concept-lab-notebook-documentation': "If it's not written down, it didn't happen.",
  'concept-sample-labeling-chain-of-custody': "An unlabeled tube is just expensive mystery liquid.",
  'concept-biological-vs-technical-replicates': "Three wells from one flask isn't three data points.",
  'concept-standard-curve': "The ruler your unknowns get measured against.",
  'concept-limit-of-detection-quantification': "Seeing it vs. trusting the number on it.",
  'concept-sensitivity-specificity': "Catching every case vs. never crying wolf.",
  'concept-ppv-npv': "The math that humbles a 'positive' result.",
  'concept-quality-control-vs-quality-assurance': "One catches today's oops. One prevents tomorrow's.",
  'concept-matrix-effect': "Your sample's background noise, quietly lying to you.",
  'concept-batch-effect': "When 'Monday's batch' becomes an uninvited variable.",
  'concept-method-validation': "Proving it works before you trust a single result.",
  'concept-calibration-traceability': "Your instrument's receipts, all the way up the chain.",
  'concept-statistical-power-effect-size': "Enough replicates to actually catch the truth.",
  'concept-nucleic-acid-purity-260-280': "1.8 is the DNA purity flex, 2.0 is RNA's.",
  'concept-restriction-enzymes-sticky-blunt-ends': "Sticky ends want to date. Blunt ends don't.",
  'concept-cell-viability-vs-cell-count': "Alive and counted are not the same headline.",
  'concept-primary-vs-established-cell-lines': "Fresh from the tissue vs. immortal and a little different.",
  'concept-passage-number-cell-culture': "The odometer on your cell line's road trip.",
  'concept-confounding-variables-experimental-design': "The variable you forgot to control, wrecking your conclusion.",

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
  'media-lb-agar': "E. coli's home base for every cloning arc.",
  'media-lb-broth': "LB Agar, but it goes to the gym (shaking incubator).",
  'media-chocolate-agar': "No cocoa, just lysed blood being extra nutritious.",
  'media-xld-agar': "Red with black centers means Salmonella showed up.",
  'media-thioglycollate-broth': "One tube, every oxygen preference welcome.",

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
  'test-gelatin-hydrolysis': "Liquefies protein, then gets cold feet in the fridge.",
  'test-starch-hydrolysis': "Iodine spills the tea on who ate the starch.",
  'test-decarboxylase': "Strips the carboxyl, keeps the alkaline attitude.",

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
  'safety-eyewash-safety-shower': "Fifteen minutes of flushing beats a lifetime of regret.",
  'safety-laboratory-fire-safety': "Know your extinguisher class before you need it.",
  'safety-hand-hygiene': "Gloves off, hands washed, ego optional.",
  'safety-electrical-safety': "Wet hands, live wires, zero chill.",
  'safety-compressed-gas-cylinder-safety': "Unsecured cylinder, unscheduled rocket launch.",
  'safety-exposure-incident-response': "Report first, panic never.",

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
  'equip-bunsen-burner': "Open flame, closed-minded about contamination.",
  'equip-vortex-mixer': "Turns your pellet into peace, fast.",
  'equip-laminar-flow-hood': "Protects the sample, not you \u2014 read the label.",
  'equip-hemocytometer': "A grid that counts cells so you don't have to guess.",
  'equip-gel-electrophoresis-apparatus': "Size sorts your DNA, drama-free (lid closed only).",
  'equip-thermal-cycler': "Heats, cools, repeats \u2014 no real-time gossip included.",
  'equip-microvolume-spectrophotometer': "Reads your DNA's vibe in one microliter.",
  'equip-magnetic-stirrer-hot-plate': "Spins and heats, judges your stir bar choice.",
  'equip-fume-hood': "Sash down, chemicals contained, lungs grateful.",
  'equip-serological-pipette-pipette-aid': "Mouth pipetting died so this could live.",
  'equip-sterilization-indicators': "Tape says exposed. Spores say otherwise. Check both.",

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
  'formula-henderson-hasselbalch': "The buffer math that keeps pH from spiraling.",
  'formula-normality': "Molarity's intense older sibling who counts equivalents.",
  'formula-standard-error-of-mean': "How much your average can be trusted.",
  'formula-limit-of-detection': "The line between 'present' and 'plausible deniability.'",
  'formula-titer': "How dilute can it get before it taps out.",

  // Calculators
  'calc-cfu-ml': "Do the math so your pipetting hand doesn't have to.",
  'calc-cfu-g': "Homogenization's honest accountant.",
  'calc-dilution-factor': "For when '1:10-ish' isn't going to cut it.",
  'calc-c1v1': 'Solves for the blank so you don\u2019t have to algebra at 8am.',
  'calc-molarity-mass': "Tells the scale exactly what to expect.",
  'calc-rcf-rpm': 'Converts speed into force, drama-free.',
  'calc-statistics': "Turns your triplicates into an actual conclusion.",
  'calc-beer-lambert': "Turns a light reading into an actual number.",

  // Physics concepts & formulas (Physics/Chemistry expansion)
  'concept-bohr-model': 'Bohr basically told electrons \'you can only live on these specific floors of the building, no in-between.\'',
  'concept-conservation-of-energy': 'Energy doesn\'t disappear, it just changes outfits — potential to kinetic and back, unless friction steals some for itself.',
  'concept-distance-vs-displacement': 'Distance is your total step count. Displacement only cares where you ended up compared to where you started — it does not care about the scenic route.',
  'concept-electromagnetic-induction': "Lenz's law is physics being petty on purpose — the induced current's whole job is to fight back against whatever change caused it.",
  'concept-heat-vs-temperature': 'Temperature is a status update. Heat is the energy actually being sent between two systems.',
  'concept-newtons-laws-of-motion': 'Law 1: things are lazy. Law 2: push harder, accelerate more (unless it\'s heavy). Law 3: the universe always sends a reply.',
  'concept-photoelectric-effect': 'The photoelectric effect is where light stopped being \'just a wave\' and physics had to admit it also acts like a bunch of tiny energy packets.',
  'concept-radioactive-decay-and-half-life': "Half-life is the ultimate 'it's not you, it's just probability' — no nucleus knows when it'll decay, but the group behavior is completely predictable.",
  'concept-semiconductors-and-pn-junction': "Doping a semiconductor is basically recruiting extra 'carriers' on purpose — n-type brings extra electrons, p-type brings extra empty seats (holes) for them to fill.",
  'concept-simple-harmonic-motion': 'SHM is motion with main character energy — it always circles back to the same equilibrium point, no matter how far it strays.',
  'concept-speed-vs-velocity': 'Speed tells you how fast. Velocity tells you how fast and which way — physics really said direction matters.',
  'concept-work-energy-theorem': "Kinetic energy doesn't just change on its own — work is the receipt showing exactly how much energy was added or removed.",
  'formula-coulombs-law': 'Same shape as the gravity formula, completely different cast of characters — mass swapped for charge, and now repulsion is on the table.',
  'formula-de-broglie-wavelength': 'Every moving object technically has a wavelength — it\'s just that for anything bigger than an electron, that wavelength is too small to matter, ever.',
  'formula-electrical-power': "Three formulas, one concept — power is just how fast electrical energy gets converted, however you choose to calculate it.",
  'formula-equations-of-motion': "Three equations, five variables, pick whichever equation already has the three you know and the one you want — it's a matching game, not a memory test.",
  'formula-gravitational-potential-energy': "PE = mgh only works while you're basically still on Earth's doorstep — go to orbital distances and you need the 'real' gravitational PE formula instead.",
  'formula-kinetic-energy': 'Double the speed, QUADRUPLE the kinetic energy — physics does not do linear scaling here, and exams love testing exactly that.',
  'formula-lens-formula': "The lens formula only works if you commit to ONE sign convention for the entire problem — switching halfway through is where most marks get lost.",
  'formula-mass-energy-equivalence': 'E = mc² is the reason a tiny bit of missing mass in a nucleus can translate into an enormous amount of energy — mass is just very concentrated energy.',
  'formula-momentum': "Momentum conservation is the one law that still holds even when energy 'goes missing' into heat/sound during a crash.",
  'formula-newtons-second-law': "This formula looks innocent until the exam adds friction, an incline, or a pulley — always find the NET force first.",
  'formula-ohms-law': "Ohm's law works great — right up until the component stops behaving like a 'normal' conductor (looking at you, diodes).",
  'formula-universal-law-of-gravitation': 'This formula is why gravity between two people standing near each other is basically zero, but gravity between you and an entire planet is very much not.',

  // Chemistry concepts & formulas (Physics/Chemistry expansion)
  'concept-adsorption-types': 'Physisorption is a loose hangout (weak attraction, easy to leave). Chemisorption is a committed relationship (actual bonds formed, much harder to walk away from).',
  'concept-atom-vs-molecule': 'Same atoms, different relationship status — a lone atom is single, a molecule is atoms that decided to bond (sometimes with their own kind, sometimes not).',
  'concept-atomic-structure-and-quantum-numbers': "Hund's rule is basically 'everyone gets their own seat before anyone has to share' — orbitals fill singly first out of pure electron-electron dislike.",
  'concept-chemical-bonding-and-vsepr': "VSEPR is just electron pairs practicing social distancing — the whole molecule's shape comes from everyone trying to get as far from each other as possible.",
  'concept-colligative-properties': "Colligative properties don't care WHAT you dissolved, only HOW MANY particles you dissolved — quantity over identity, every time.",
  'concept-isomerism': "Isomers are chemistry's way of saying 'same ingredients, different recipe' — the atoms are identical, but how they're arranged changes everything about the molecule's personality.",
  'concept-le-chateliers-principle': "Le Chatelier's principle is chemistry's version of 'whatever you throw at me, I'll push back a little' — equilibrium always leans against the disturbance.",
  'concept-mole-concept': "The mole is chemistry's unit of 'a whole lot of something' — same idea as a dozen, just scaled up to an absolutely enormous number.",
  'concept-periodic-trends': 'The periodic table is basically a trend chart in disguise — most properties just increase or decrease predictably as you scan across or down it, exceptions aside.',
  'concept-ph-and-poh': 'pH being logarithmic is the reason a \'small\' pH drop from 7 to 5 is actually a 100x jump in acidity — the scale is deceptively compact.',
  'concept-redox-reactions': 'OIL RIG never lets you down: Oxidation Is Loss, Reduction Is Gain — and yes, the reducing agent is the one that gets oxidized. That mix-up costs marks every single year.',
  'formula-arrhenius-equation': "The Arrhenius equation is why 'just heat it up' is basically chemistry's universal cheat code for faster reactions — more molecules clear the activation energy bar.",
  'formula-faradays-laws-of-electrolysis': "Faraday's laws are basically an electrochemical receipt — exactly how much charge you pass tells you exactly how much metal you'll get out.",
  'formula-hess-law': "Hess's law says the destination's total energy change doesn't care which route you took to get there — enthalpy is a state function, not a scenic-route function.",
  'formula-ideal-gas-equation': 'PV=nRT will absolutely betray you if you forget the Kelvin conversion — Celsius is not invited to this formula.',
  'formula-molarity-definition': "Molarity and molality look like siblings on paper but behave completely differently once temperature changes — one shifts, one doesn't.",
  'formula-nernst-equation': "The Nernst equation is just Le Chatelier's principle wearing a math costume — push concentrations away from standard conditions, and the voltage responds accordingly.",
  'formula-raoults-law': "Raoult's law is basically 'the more you dilute the solvent with something non-volatile, the less it can evaporate' — vapour pressure drops in direct proportion.",
  'formula-sn2-haloalkane-to-alcohol': 'SN2 is a one-step group project — nucleophile attacks and halide leaves in the SAME motion, no drama, no intermediate, just a clean backside hit.'
}

/**
 * Resolution order (Gen Z note correction pass): a curated item's own
 * `genZNote` — read straight from its JSON — is the preferred source of
 * its displayed line, since JSON is the natural source of truth for a
 * curated item's personality note. `ITEM_TAGLINES` remains as a
 * code-level fallback for legacy content, and `SECTION_TAGLINES` is the
 * last-resort category-level fallback so newly added Tier 2+ content
 * never renders without a line at all.
 *
 * `genZNote` is optional and passed in by the caller (rather than looked
 * up here) so this module stays decoupled from the per-category content
 * types in `core/laboratory/types.ts`.
 */
export function getItemTagline(id: string, category: LaboratoryCategory, genZNote?: string): string {
  return genZNote?.trim() || ITEM_TAGLINES[id] || SECTION_TAGLINES[category]
}

/** Calculators and the Unit Converter live outside `LaboratoryCategory` (they're tools, not content categories), so they get their own lookup with the same fallback shape. */
export function getCalculatorTagline(calculatorId: string): string {
  return ITEM_TAGLINES[calculatorId] ?? CALCULATOR_HUB_TAGLINE
}
