"""
One-time content migration for Comparison Studio (brief §22-25, §23A).

Adds a `genZNote` field to every curated comparison JSON under
src/content/comparisons/, inserted right after `overview` (mirroring
where `genZNote` sits after `quickTags` on organism content — see
scripts/add-genz-notes.py). 17 of these lines are carried over verbatim
from the old core/comparison/microcopy.ts id-keyed table (now removed);
the remaining ~38 are new, one per file, written to the same brief
(short, witty, scientifically accurate, never inside definitions/
principles/procedures).

Safe to re-run: a file that already has a non-empty genZNote is left
untouched, so this only ever fills gaps.
"""
import json
import collections
import pathlib

NOTES = {
    # --- Carried over verbatim from the old core/comparison/microcopy.ts table ---
    "comp-elisa-vs-pcr": "Different targets. Different vibes. Same goal: finding the answer.",
    "comp-grampos-vs-gramneg": "The cell wall has entered the chat.",
    "comp-autoclave-vs-hot-air-oven": "Steam sprints. Dry heat marathons.",
    "comp-selective-vs-differential-media": "One's a bouncer, one's a stylist.",
    "comp-exotoxins-vs-endotoxins": "One leaves on purpose. One only shows up when the party\u2019s over.",
    "comp-cocci-vs-bacilli": "Round versus rod. Pick a lane.",
    "comp-sterilization-vs-disinfection": "One kills everything. One just kills enough.",
    "comp-catalase-test-vs-coagulase-test": "Bubbles first, clotting second.",
    "comp-saureus-vs-sepidermidis": "Same genus. Very different reputations.",
    "comp-dna-viruses-vs-rna-viruses": "One proofreads its homework. One does not.",
    "comp-lytic-vs-lysogenic-infection": "Burn it down now, or move in quietly.",
    "comp-primary-vs-secondary-immune-response": "Your immune system remembers everything.",
    "comp-planktonic-vs-biofilm-associated-bacteria": "Alone it\u2019s easy prey. Together it\u2019s a fortress.",
    "comp-antigenic-drift-vs-antigenic-shift": "Small changes versus a full plot twist.",
    "comp-mic-vs-mbc": "Stopped growing is not the same as dead.",
    "comp-conventional-pcr-vs-qpcr": "One tells you yes or no. One tells you how much.",
    "comp-short-read-vs-long-read-sequencing": "Short and precise, or long and messy \u2014 pick your trade-off.",

    # --- New lines, one per remaining curated comparison ---
    "comp-16s-rrna-sequencing-vs-shotgun-metagenomics": "One zooms in on a single gene. One opens the whole crowd.",
    "comp-active-vs-passive-immunity": "Borrowed protection vs built-from-scratch immunity.",
    "comp-aerobic-vs-anaerobic-bacteria": "One needs the air. One really, really doesn't.",
    "comp-amplicon-sequencing-vs-shotgun-metagenomics": "Same sample, very different reading list.",
    "comp-bacterial-capsule-vs-biofilm": "A raincoat versus a whole gated community.",
    "comp-blood-agar-vs-chocolate-agar": "One shows you hemolysis. One just wants everyone to grow.",
    "comp-calbicans-vs-cglabrata": "Same genus, but one shrugs off azoles way more often.",
    "comp-cestodes-vs-nematodes": "Flat and segmented versus round and not.",
    "comp-culture-dependent-vs-culture-independent-microbiome-analysis": "Grow it first, or just read its DNA and skip the wait.",
    "comp-definitive-host-vs-intermediate-host": "Where the parasite grows up vs where it just passes through.",
    "comp-dermatophytes-vs-candida": "Keratin specialists versus the opportunist that goes anywhere warm and moist.",
    "comp-dimorphic-vs-nondimorphic-fungi": "One has two forms depending on temperature. One just picks a lane.",
    "comp-direct-vs-indirect-viral-detection": "Find the virus itself, or find the evidence it left behind.",
    "comp-disk-diffusion-vs-broth-microdilution": "A ring on a plate versus an actual number.",
    "comp-ecoli-vs-kpneumoniae": "Both Enterobacterales, only one bothers to move.",
    "comp-enterobacterales-vs-nonfermenting-gnb": "Sugar fermenters versus the gram-negatives that just won't.",
    "comp-enveloped-vs-nonenveloped-viruses": "One dissolves in soap. One really doesn't care.",
    "comp-flow-cytometry-vs-fluorescence-microscopy": "Count thousands of cells fast, or actually look at a few closely.",
    "comp-humoral-vs-cellmediated-immunity": "Antibodies handle the outside. T cells handle what's already inside.",
    "comp-intrinsic-vs-acquired-resistance": "Born resistant versus resistant because it picked up the memo.",
    "comp-macconkey-agar-vs-emb-agar": "Pink colonies versus a green metallic sheen \u2014 same lactose story, different tell.",
    "comp-mhc-class-i-vs-class-ii": "Everyone's cells report in. Only some cells brief the responders.",
    "comp-monoclonal-vs-polyclonal-antibodies": "One very specific antibody clone versus a whole team of them.",
    "comp-normal-microbiota-vs-pathogenic-microorganisms": "Same neighborhood, very different intentions.",
    "comp-oxidase-test-vs-catalase-test": "One bubbles. One changes color. Both save you a guess.",
    "comp-paeruginosa-vs-abaumannii": "Two non-fermenters hospitals really don't want to see on a culture.",
    "comp-prokaryotic-vs-eukaryotic-cells": "No nucleus versus an actual address for the DNA.",
    "comp-protozoa-vs-helminths": "Single-celled troublemakers versus the multicellular kind.",
    "comp-qpcr-vs-digital-pcr": "One estimates quantity. One counts molecules one by one.",
    "comp-rtpcr-vs-rtqpcr": "Detects the RNA, or detects it and tells you how much.",
    "comp-sanger-sequencing-vs-ngs": "One read at a time versus millions in parallel.",
    "comp-staphylococci-vs-streptococci": "Grapes versus chains \u2014 the arrangement gives it away.",
    "comp-spyogenes-vs-sagalactiae": "Group A or Group B \u2014 one bacitracin disk tells you which.",
    "comp-superficial-vs-systemic-mycoses": "Skin-deep versus a whole-body problem.",
    "comp-transformation-vs-transduction": "DNA picked up from the environment versus DNA delivered by a virus.",
    "comp-trophozoite-vs-cyst": "The active troublemaker versus the one just waiting it out.",
    "comp-western-blot-vs-mass-spectrometry-protein-detection": "One confirms a protein you already suspect. One finds proteins you didn't know to look for.",
    "comp-yeasts-vs-molds": "Round and single-celled versus long, branching, and fuzzy."
}

ROOT = pathlib.Path("src/content/comparisons")
missing = []
updated = 0
skipped = 0

for path in sorted(ROOT.glob("*.json")):
    comp_id = path.stem
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw, object_pairs_hook=collections.OrderedDict)

    if isinstance(data.get("genZNote"), str) and data["genZNote"].strip():
        skipped += 1
        continue

    note = NOTES.get(comp_id)
    if not note:
        missing.append(comp_id)
        continue

    new_data = collections.OrderedDict()
    inserted = False
    for key, value in data.items():
        new_data[key] = value
        if key == "overview" and not inserted:
            new_data["genZNote"] = note
            inserted = True
    if not inserted:
        # No `overview` field on this file — fall back to inserting right
        # after `tags`, matching where the field would otherwise sit.
        new_data = collections.OrderedDict()
        for key, value in data.items():
            new_data[key] = value
            if key == "tags" and not inserted:
                new_data["genZNote"] = note
                inserted = True
        if not inserted:
            new_data["genZNote"] = note

    path.write_text(json.dumps(new_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    updated += 1

print(f"Updated {updated} comparison files. Skipped {skipped} (already had genZNote).")
if missing:
    print("MISSING NOTES FOR:", missing)
