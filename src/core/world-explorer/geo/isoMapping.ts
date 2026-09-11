/**
 * core/world-explorer/geo/isoMapping — the "clean mapping layer between
 * the geographic dataset and the existing Cellfie country IDs" the
 * Real World globe brief (§3) asks for.
 *
 * `world-atlas`'s TopoJSON features are keyed by ISO 3166-1 numeric
 * country codes (e.g. `356` for India) as their GeoJSON `id`, not by
 * name and not by Cellfie's own slug ids (`'india'`). This file is the
 * ONLY place that translation lives — `GLOBE_COUNTRIES` in
 * `../countries.ts` stays the single source of truth for
 * id/name/capital/currency/etc. (brief §3: "the existing country
 * registry/data should remain the source of truth. Do not create a
 * second unrelated country database").
 *
 * Deliberately only the 58 countries already in `GLOBE_COUNTRIES` are
 * mapped here. `world-atlas` ships boundary data for ~180 countries;
 * the rest render as plain, non-interactive landmass in the Real World
 * globe (see `Globe.tsx`) rather than being force-matched onto
 * something Cellfie doesn't actually have a profile for.
 *
 * Codes below are the standard, stable ISO 3166-1 numeric assignments
 * (the same numbering UN statistics and most geo datasets use) — they
 * don't change over time the way e.g. calling codes or currency
 * details can, so unlike `CountryProfile`'s fast-changing facts this
 * table needs no "as of" date.
 */
export const GLOBE_COUNTRY_ISO_NUMERIC: Record<string, number> = {
  afghanistan: 4,
  india: 356,
  pakistan: 586,
  nepal: 524,
  bhutan: 64,
  bangladesh: 50,
  'sri-lanka': 144,
  maldives: 462,
  myanmar: 104,
  china: 156,
  japan: 392,
  'south-korea': 410,
  'north-korea': 408,
  indonesia: 360,
  thailand: 764,
  vietnam: 704,
  malaysia: 458,
  singapore: 702,
  philippines: 608,
  'saudi-arabia': 682,
  uae: 784,
  qatar: 634,
  kuwait: 414,
  iraq: 368,
  iran: 364,
  israel: 376,
  turkey: 792,
  russia: 643,
  'united-kingdom': 826,
  france: 250,
  germany: 276,
  italy: 380,
  spain: 724,
  netherlands: 528,
  switzerland: 756,
  sweden: 752,
  norway: 578,
  poland: 616,
  greece: 300,
  portugal: 620,
  ukraine: 804,
  egypt: 818,
  nigeria: 566,
  'south-africa': 710,
  kenya: 404,
  ethiopia: 231,
  morocco: 504,
  ghana: 288,
  'united-states': 840,
  canada: 124,
  mexico: 484,
  cuba: 192,
  brazil: 76,
  argentina: 32,
  chile: 152,
  colombia: 170,
  australia: 36,
  'new-zealand': 554
}

/** Reverse lookup, built once: ISO numeric code (normalized to a plain-integer string, e.g. "4" not "004") -> Cellfie GlobeCountry id. */
const ISO_NUMERIC_TO_GLOBE_COUNTRY: ReadonlyMap<string, string> = new Map(
  Object.entries(GLOBE_COUNTRY_ISO_NUMERIC).map(([id, code]) => [String(code), id])
)

/**
 * Normalizes a TopoJSON/GeoJSON feature `id` — which may arrive as a
 * number, a zero-padded string, or an un-padded string depending on the
 * dataset — into the same plain-integer-string form used as keys above,
 * so lookups never miss on a formatting difference alone.
 */
function normalizeIsoNumeric(featureId: string | number | undefined | null): string | null {
  if (featureId === undefined || featureId === null) return null
  const n = Number(featureId)
  return Number.isFinite(n) ? String(n) : null
}

/** Returns the matching Cellfie `GlobeCountry` id for a world-atlas feature id, or `undefined` if this feature isn't one of the 58 countries Cellfie currently covers. */
export function getGlobeCountryIdForIsoNumeric(featureId: string | number | undefined | null): string | undefined {
  const normalized = normalizeIsoNumeric(featureId)
  if (!normalized) return undefined
  return ISO_NUMERIC_TO_GLOBE_COUNTRY.get(normalized)
}
