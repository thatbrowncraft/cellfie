"""
Comparison Studio content check: genZNote coverage report.

Run this any time new comparison JSON files are added to
src/content/comparisons/ to see which ones still need a Cellfie
subtitle written for them.

    python3 scripts/check-comparison-genznotes.py

This is a reporting tool only:
- It never edits any file.
- It never fails the build — always exits 0, so it's safe to run
  locally or wire into CI as an informational step without gating
  anything (genZNote is a warn-not-fail field in registry.ts, and this
  script matches that policy).
- It has no hardcoded per-comparison content (unlike the one-time
  scripts/add-comparison-genznotes.py migration script) — it just
  tells you what's missing so a human can author the line, per the
  rule that curated microcopy is never auto-generated (brief §25).
"""
import json
import pathlib

ROOT = pathlib.Path("src/content/comparisons")

missing = []
present = 0

for path in sorted(ROOT.glob("*.json")):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  [skip] {path.name} — invalid JSON ({e})")
        continue

    note = data.get("genZNote")
    if isinstance(note, str) and note.strip():
        present += 1
    else:
        title = f"{data.get('itemA', {}).get('name', '?')} vs {data.get('itemB', {}).get('name', '?')}"
        missing.append((path.name, title))

total = present + len(missing)
print(f"genZNote coverage: {present}/{total} curated comparisons\n")

if missing:
    print(f"Missing genZNote in {len(missing)} file(s):")
    for filename, title in missing:
        print(f"  - {filename}  ({title})")
else:
    print("All curated comparisons have a genZNote. Nothing to do.")
