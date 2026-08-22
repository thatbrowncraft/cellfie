import json
import collections
import pathlib

NOTES = {
    # --- Bacteria (42) ---
    "acinetobacter-baumannii": "Oxidase-negative, drug-resistant, and weirdly good at surviving on dry hospital surfaces \u2014 basically the coccobacillus version of a cockroach.",
    "bacillus-anthracis": "Big Gram-positive rod, impressive spores, and absolutely not the organism you want casually turning up in your sample.",
    "bacillus-cereus": "Motile and beta-hemolytic where B. anthracis is neither \u2014 the fried-rice one, not the bioterrorism one.",
    "bacillus-subtilis": "Basically the textbook Bacillus: Gram-positive rod, spore-former, catalase-positive and very happy to survive bad conditions.",
    "bacteroides-fragilis": "An anaerobe that tolerates bile just fine, which is exactly backwards from what you'd expect \u2014 and exactly why it shows up in intra-abdominal infections.",
    "bordetella-pertussis": "Three clinical stages, one very memorable cough, and a name that's basically the disease's biography.",
    "borrelia-burgdorferi": "A spirochete that needs its tick attached for over a day before bothering to transmit \u2014 patience as a virulence factor.",
    "campylobacter-jejuni": "Comma-shaped, microaerophilic, and oddly fond of 42\u00b0C \u2014 the poultry-loving cause of your gastroenteritis, and occasionally of Guillain-Barr\u00e9.",
    "clostridioides-difficile": "Colonization alone doesn't count \u2014 it's the toxin that does the damage, and the spores that shrug off alcohol-based hand sanitizer.",
    "clostridium-botulinum": "Blocks acetylcholine release. Tetanus toxin blocks the opposite thing. Same genus, opposite kind of paralysis.",
    "clostridium-perfringens": "Double-zone hemolysis and a generation time fast enough to explain how gas gangrene gets so bad so quickly.",
    "clostridium-tetani": "That terminal spore gives the classic drumstick appearance. Tiny structure, very memorable exam question.",
    "corynebacterium-diphtheriae": "The toxin isn't even the bacterium's own gene \u2014 it's a phage's. No phage, no diphtheria, no matter how many Chinese-letter clusters you see.",
    "enterococcus-faecalis": "Grows in bile, grows in 6.5% salt \u2014 most streptococci would've given up by now.",
    "enterococcus-faecium": "E. faecalis's cousin, mostly known these days for being the one more likely to shrug off vancomycin.",
    "escherichia-coli": "Usually a normal gut resident, but some strains really said: let me ruin your week.",
    "haemophilus-influenzae": "Needs both X and V factors just to grow \u2014 high-maintenance in a way that conveniently doubles as an identification test.",
    "helicobacter-pylori": "A urease-producing, helical rod that decided the human stomach was a fine place to live. Ulcers and gastric cancer risk say otherwise.",
    "klebsiella-pneumoniae": "Big capsule, mucoid colonies, and \u2014 unusually for an Enterobacterales member \u2014 doesn't even bother moving.",
    "listeria-monocytogenes": "Multiplies in the fridge. Genuinely. Cold storage is not the safety net you think it is.",
    "moraxella-catarrhalis": "Looks like Neisseria on Gram stain, fails to ferment a single carbohydrate, and still ends up causing your sinus infection.",
    "mycobacterium-tuberculosis": "Slow-growing, acid-fast and extremely patient. This organism does not believe in rushing anything.",
    "mycoplasma-pneumoniae": "No cell wall at all, which is exactly why every beta-lactam you throw at it does nothing.",
    "neisseria-gonorrhoeae": "Ferments glucose and stops there. Its meningitis-causing cousin ferments maltose too \u2014 one sugar test, two very different diseases.",
    "neisseria-meningitidis": "The maltose-fermenting Neisseria, and the one with the capsule your vaccine is actually targeting.",
    "nocardia-asteroides": "Partially acid-fast \u2014 enough to make you think Mycobacterium, not enough to actually be one.",
    "proteus-mirabilis": "Urease turns urine alkaline, alkaline urine grows staghorn stones \u2014 one biochemical reaction, one entire urology consult.",
    "pseudomonas-aeruginosa": "Non-fermenter, oxidase-positive and annoyingly adaptable. Basically the lab organism that refuses to be boring.",
    "salmonella-enterica": "H2S-positive, non-lactose-fermenting, and motile \u2014 the exact opposite biochemical profile of the Shigella sitting right next to it on your identification chart.",
    "serratia-marcescens": "DNase positive when most of its Enterobacterales relatives aren't, and occasionally red enough to look like it's bleeding on the agar.",
    "shigella-flexneri": "Non-motile and H2S-negative \u2014 remember it as Salmonella's quieter, stiller opposite.",
    "staphylococcus-aureus": "Golden colonies, clusters of cocci and a talent for causing problems when given the opportunity.",
    "staphylococcus-epidermidis": "Coagulase-negative and novobiocin-sensitive \u2014 the catheter-and-prosthetic-device specialist that mostly waits for an opening.",
    "staphylococcus-saprophyticus": "Also coagulase-negative, but novobiocin-resistant \u2014 the one biochemical fact that saves you on the exam.",
    "streptococcus-agalactiae": "Group B strep. Bacitracin-resistant, unlike Group A sitting one letter away on the alphabet and one test away on the plate.",
    "streptococcus-pneumoniae": "Alpha-hemolytic, optochin-sensitive, and encapsulated enough that the vaccine had to target the capsule itself.",
    "streptococcus-pyogenes": "Beta-hemolytic, bacitracin-sensitive, and responsible for a sore throat that occasionally comes back later as rheumatic fever.",
    "treponema-pallidum": "Can't be grown in a dish at all \u2014 one of the few major bacterial pathogens still diagnosed almost entirely without a culture plate.",
    "vibrio-cholerae": "Comma-shaped, wildly motile, and the reason oral rehydration solution exists.",
    "vibrio-parahaemolyticus": "Vibrio cholerae's saltier relative \u2014 needs added salt to grow, and comes from the seafood you probably shouldn't have eaten raw.",
    "yersinia-enterocolitica": "Grows at fridge temperatures well enough that cold enrichment is an actual isolation technique built around it.",
    "yersinia-pestis": "Bipolar staining gives it a 'safety pin' look, and it's non-motile \u2014 unusual enough among Yersinia to be worth remembering.",
    # --- Fungi (11) ---
    "aspergillus-flavus": "Yellow-green colonies and a side gig producing aflatoxin \u2014 one of the more legitimately carcinogenic things a mold has ever done.",
    "aspergillus-fumigatus": "Look for the classic conidial head under the microscope. The morphology is basically giving you the answer.",
    "aspergillus-niger": "Colonies literally black \u2014 the one Aspergillus you can call by color alone and be right.",
    "blastomyces-dermatitidis": "Broad-based budding is the tell. Narrow-based budding means you're looking at something else entirely.",
    "candida-albicans": "Yeast when it wants to keep things simple, hyphae when things get complicated.",
    "candida-auris": "Multidrug-resistant, hard to identify with routine methods, and stubbornly persistent on hospital surfaces \u2014 everything you don't want in an outbreak organism.",
    "cryptococcus-gattii": "C. neoformans's relative, except this one goes after immunocompetent hosts too \u2014 the exception that makes the rule worth stating.",
    "cryptococcus-neoformans": "India ink stain reveals a capsule so wide it practically introduces itself.",
    "histoplasma-capsulatum": "Mold in the environment, yeast once it's inside a macrophage \u2014 thermal dimorphism as a survival strategy.",
    "sporothrix-schenckii": "Rose thorn, lymphatic spread, cigar-shaped yeast on culture \u2014 the gardener's disease with a very specific origin story.",
    "trichophyton-rubrum": "Human-adapted, wine-red on the reverse of the culture plate, and behind more athlete's foot than you'd like to think about.",
    # --- Protozoa (11) ---
    "balantidium-coli": "The only ciliate that bothers parasitizing humans, and the biggest protozoan parasite you'll ever meet.",
    "cryptosporidium-parvum": "Acid-fast oocysts that shrug off routine chlorination \u2014 which is exactly why it keeps showing up in waterborne outbreaks.",
    "cystoisospora-belli": "Bigger oocysts than Cryptosporidium, and \u2014 unusually for a diarrheal pathogen \u2014 it comes with peripheral eosinophilia.",
    "entamoeba-histolytica": "An amoeba with a serious digestive agenda. Remember the trophozoite, cyst and erythrophagocytosis.",
    "giardia-duodenalis": "That pear-shaped trophozoite with two nuclei is basically impossible to unsee once you've learned it.",
    "leishmania-donovani": "Goes systemic instead of staying at the skin \u2014 hepatosplenomegaly is the giveaway that separates it from its cutaneous relatives.",
    "plasmodium-falciparum": "Multiple ring forms per red cell, banana-shaped gametocytes, and the species responsible for almost all the severe malaria.",
    "plasmodium-vivax": "Forms dormant hypnozoites in the liver \u2014 the entire reason vivax malaria keeps relapsing months later.",
    "toxoplasma-gondii": "Cats are the only definitive host. Everyone else \u2014 you included \u2014 is just a very confused intermediate host.",
    "trichomonas-vaginalis": "Jerky motility, an undulating membrane, and notably no cyst stage \u2014 it only ever exists as the trophozoite.",
    "trypanosoma-cruzi": "Transmitted by the kissing bug's feces, not its bite \u2014 the wound just happens to be where you accidentally rub it in.",
    # --- Viruses (15) ---
    "dengue-virus": "Get infected with a second, different serotype and your risk of severe disease actually goes up \u2014 your own antibodies end up helping the virus.",
    "epstein-barr-virus": "Sets up lifelong latency in B cells and, decades later, gets linked to cancers most acute viruses would never touch.",
    "hepatitis-a-virus": "No chronic phase, no lasting liver damage in most cases \u2014 the hepatitis virus that actually goes away.",
    "hepatitis-b-virus": "An enveloped DNA virus with a very distinctive replication strategy. Small genome, complicated life.",
    "hepatitis-c-virus": "Direct-acting antivirals now cure most infections outright \u2014 a genuine good-news story next to hepatitis B, which mostly just gets suppressed.",
    "herpes-simplex-virus-1": "Goes quiet in a sensory ganglion and reactivates whenever it feels like it \u2014 latency as a long-term lifestyle choice.",
    "hiv-1": "Conical capsid, reverse transcriptase, genome integration \u2014 the retrovirus playbook, executed thoroughly enough to need lifelong treatment.",
    "human-papillomavirus": "Some genotypes just cause warts. Others cause cancer. Same virus family, very different stakes.",
    "influenza-a-virus": "A segmented genome means two strains can swap segments entirely \u2014 that's antigenic shift, and it's why pandemics happen.",
    "measles-virus": "Koplik spots show up before the rash does \u2014 a pathognomonic early warning if you know to look for it.",
    "mumps-virus": "Bilateral parotid swelling is basically the diagnosis handing itself to you.",
    "rabies-lyssavirus": "Bullet-shaped, nearly always fatal once symptoms start \u2014 which is exactly why post-exposure prophylaxis has to happen before that point.",
    "respiratory-syncytial-virus": "Fuses infected cells together into syncytia \u2014 hence the name, and hence the bronchiolitis in infants.",
    "sars-cov-2": "The spike protein does the receptor binding and doubles as the vaccine's entire target.",
    "varicella-zoster-virus": "One virus, two diseases \u2014 chickenpox the first time, shingles whenever it decides to reactivate later."
}

ROOT = pathlib.Path("src/content/organisms")
missing = []
updated = 0

for path in sorted(ROOT.glob("*.json")):
    organism_id = path.stem
    note = NOTES.get(organism_id)
    if not note:
        missing.append(organism_id)
        continue

    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw, object_pairs_hook=collections.OrderedDict)

    new_data = collections.OrderedDict()
    inserted = False
    for key, value in data.items():
        new_data[key] = value
        if key == "quickTags" and not inserted:
            new_data["genZNote"] = note
            inserted = True
    if not inserted:
        new_data["genZNote"] = note

    path.write_text(json.dumps(new_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    updated += 1

print(f"Updated {updated} organism files.")
if missing:
    print("MISSING NOTES FOR:", missing)
