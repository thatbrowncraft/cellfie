/**
 * core/world-explorer/countries — every country plotted on the World
 * Explorer globe.
 *
 * DELIBERATELY not "all ~195 sovereign states", and deliberately NOT a
 * GeoJSON/TopoJSON country-boundary dataset. Two separate scope
 * decisions, both disclosed rather than silently shipped:
 *
 * 1. Coverage: brief §10 asks for "all major countries represented on
 *    the globe" plus "quality > volume" — not an exhaustive gazetteer.
 *    This list covers India, every one of India's direct neighbours,
 *    the G20 members, and a representative spread of major countries
 *    across every continent so the globe never looks empty from any
 *    rotation. It intentionally does not include every UN member state.
 *    Adding a country here is a one-line addition; it does not require
 *    touching the globe component or the detail page.
 *
 * 2. Shape data: real country boundary polygons (even simplified) are a
 *    meaningfully large dataset (hundreds of KB to multiple MB) that
 *    would have to be fetched or bundled and kept in sync with a
 *    mapping library — see `core/world-explorer/projection.ts`'s doc
 *    comment for the full reasoning. Each country here is a single
 *    (lat, lon) point (its capital, or a reasonable centroid for
 *    countries without one obvious point), projected onto the globe as
 *    a labelled marker. This is the "quality over volume, ship a clean
 *    foundation that can grow" version, not the final word on how
 *    World Explorer should look — a future pass could swap in real
 *    coastlines without touching this file's shape (id/name/continent/
 *    capital/currency stay meaningful regardless of how they're drawn).
 *
 * `capital`, `currency`, `flagEmoji`, and `languages` are exactly the
 * kind of STABLE fact brief §9 asks to keep separate from anything that
 * changes often (population, current leadership, trade figures) — see
 * `CountryProfile` in `types.ts` for where that faster-changing
 * information lives, sourced and dated per item, never presented as
 * permanently true.
 */
import type { GlobeCountry } from './types'

export const GLOBE_COUNTRIES: GlobeCountry[] = [
  // --- South Asia (India + every direct neighbour) ---
  { id: 'india', name: 'India', lat: 28.6139, lon: 77.209, continent: 'Asia', capital: 'New Delhi', currency: 'Indian Rupee (₹)', flagEmoji: '🇮🇳', languages: ['Hindi', 'English', '21 other scheduled languages'], hasDeepProfile: true },
  { id: 'pakistan', name: 'Pakistan', lat: 33.6844, lon: 73.0479, continent: 'Asia', capital: 'Islamabad', currency: 'Pakistani Rupee', flagEmoji: '🇵🇰', languages: ['Urdu', 'English'], hasDeepProfile: true },
  { id: 'nepal', name: 'Nepal', lat: 27.7172, lon: 85.324, continent: 'Asia', capital: 'Kathmandu', currency: 'Nepalese Rupee', flagEmoji: '🇳🇵', languages: ['Nepali'], hasDeepProfile: true },
  { id: 'bhutan', name: 'Bhutan', lat: 27.4728, lon: 89.639, continent: 'Asia', capital: 'Thimphu', currency: 'Ngultrum', flagEmoji: '🇧🇹', languages: ['Dzongkha'], hasDeepProfile: true },
  { id: 'bangladesh', name: 'Bangladesh', lat: 23.8103, lon: 90.4125, continent: 'Asia', capital: 'Dhaka', currency: 'Bangladeshi Taka', flagEmoji: '🇧🇩', languages: ['Bengali'], hasDeepProfile: true },
  { id: 'sri-lanka', name: 'Sri Lanka', officialName: 'Democratic Socialist Republic of Sri Lanka', lat: 6.9271, lon: 79.8612, continent: 'Asia', capital: 'Sri Jayawardenepura Kotte (official) / Colombo (commercial)', currency: 'Sri Lankan Rupee', flagEmoji: '🇱🇰', languages: ['Sinhala', 'Tamil'], hasDeepProfile: true },
  { id: 'maldives', name: 'Maldives', lat: 4.1755, lon: 73.5093, continent: 'Asia', capital: 'Malé', currency: 'Maldivian Rufiyaa', flagEmoji: '🇲🇻', languages: ['Dhivehi'], hasDeepProfile: true },
  { id: 'afghanistan', name: 'Afghanistan', lat: 34.5553, lon: 69.2075, continent: 'Asia', capital: 'Kabul', currency: 'Afghan Afghani', flagEmoji: '🇦🇫', languages: ['Pashto', 'Dari'], hasDeepProfile: true },
  { id: 'myanmar', name: 'Myanmar', lat: 19.7633, lon: 96.0785, continent: 'Asia', capital: 'Naypyidaw', currency: 'Myanmar Kyat', flagEmoji: '🇲🇲', languages: ['Burmese'], hasDeepProfile: true },

  // --- East & Southeast Asia ---
  { id: 'china', name: 'China', officialName: "People's Republic of China", lat: 39.9042, lon: 116.4074, continent: 'Asia', capital: 'Beijing', currency: 'Renminbi (Yuan)', flagEmoji: '🇨🇳', languages: ['Mandarin Chinese'], hasDeepProfile: true },
  { id: 'japan', name: 'Japan', lat: 35.6762, lon: 139.6503, continent: 'Asia', capital: 'Tokyo', currency: 'Japanese Yen', flagEmoji: '🇯🇵', languages: ['Japanese'], hasDeepProfile: true },
  { id: 'south-korea', name: 'South Korea', officialName: 'Republic of Korea', lat: 37.5665, lon: 126.978, continent: 'Asia', capital: 'Seoul', currency: 'South Korean Won', flagEmoji: '🇰🇷', languages: ['Korean'], hasDeepProfile: true },
  { id: 'north-korea', name: 'North Korea', officialName: "Democratic People's Republic of Korea", lat: 39.0392, lon: 125.7625, continent: 'Asia', capital: 'Pyongyang', currency: 'North Korean Won', flagEmoji: '🇰🇵', languages: ['Korean'], hasDeepProfile: true },
  { id: 'indonesia', name: 'Indonesia', lat: -6.2088, lon: 106.8456, continent: 'Asia', capital: 'Jakarta', currency: 'Indonesian Rupiah', flagEmoji: '🇮🇩', languages: ['Indonesian'], hasDeepProfile: true },
  { id: 'thailand', name: 'Thailand', lat: 13.7563, lon: 100.5018, continent: 'Asia', capital: 'Bangkok', currency: 'Thai Baht', flagEmoji: '🇹🇭', languages: ['Thai'], hasDeepProfile: true },
  { id: 'vietnam', name: 'Vietnam', lat: 21.0278, lon: 105.8342, continent: 'Asia', capital: 'Hanoi', currency: 'Vietnamese Dong', flagEmoji: '🇻🇳', languages: ['Vietnamese'], hasDeepProfile: true },
  { id: 'malaysia', name: 'Malaysia', lat: 3.139, lon: 101.6869, continent: 'Asia', capital: 'Kuala Lumpur', currency: 'Malaysian Ringgit', flagEmoji: '🇲🇾', languages: ['Malay'], hasDeepProfile: true },
  { id: 'singapore', name: 'Singapore', lat: 1.3521, lon: 103.8198, continent: 'Asia', capital: 'Singapore', currency: 'Singapore Dollar', flagEmoji: '🇸🇬', languages: ['English', 'Malay', 'Mandarin', 'Tamil'], hasDeepProfile: true },
  { id: 'philippines', name: 'Philippines', lat: 14.5995, lon: 120.9842, continent: 'Asia', capital: 'Manila', currency: 'Philippine Peso', flagEmoji: '🇵🇭', languages: ['Filipino', 'English'], hasDeepProfile: true },

  // --- West & Central Asia ---
  { id: 'saudi-arabia', name: 'Saudi Arabia', lat: 24.7136, lon: 46.6753, continent: 'Asia', capital: 'Riyadh', currency: 'Saudi Riyal', flagEmoji: '🇸🇦', languages: ['Arabic'], hasDeepProfile: true },
  { id: 'uae', name: 'United Arab Emirates', lat: 24.4539, lon: 54.3773, continent: 'Asia', capital: 'Abu Dhabi', currency: 'UAE Dirham', flagEmoji: '🇦🇪', languages: ['Arabic'], hasDeepProfile: true },
  { id: 'qatar', name: 'Qatar', lat: 25.2854, lon: 51.531, continent: 'Asia', capital: 'Doha', currency: 'Qatari Riyal', flagEmoji: '🇶🇦', languages: ['Arabic'], hasDeepProfile: true },
  { id: 'kuwait', name: 'Kuwait', lat: 29.3759, lon: 47.9774, continent: 'Asia', capital: 'Kuwait City', currency: 'Kuwaiti Dinar', flagEmoji: '🇰🇼', languages: ['Arabic'], hasDeepProfile: true },
  { id: 'iraq', name: 'Iraq', lat: 33.3152, lon: 44.3661, continent: 'Asia', capital: 'Baghdad', currency: 'Iraqi Dinar', flagEmoji: '🇮🇶', languages: ['Arabic', 'Kurdish'], hasDeepProfile: true },
  { id: 'iran', name: 'Iran', lat: 35.6892, lon: 51.389, continent: 'Asia', capital: 'Tehran', currency: 'Iranian Rial', flagEmoji: '🇮🇷', languages: ['Persian'], hasDeepProfile: true },
  { id: 'israel', name: 'Israel', lat: 31.7683, lon: 35.2137, continent: 'Asia', capital: 'Jerusalem', currency: 'Israeli New Shekel', flagEmoji: '🇮🇱', languages: ['Hebrew', 'Arabic'], hasDeepProfile: true },
  { id: 'turkey', name: 'Turkey', lat: 39.9334, lon: 32.8597, continent: 'Asia', capital: 'Ankara', currency: 'Turkish Lira', flagEmoji: '🇹🇷', languages: ['Turkish'], hasDeepProfile: true },

  // --- Europe ---
  { id: 'russia', name: 'Russia', officialName: 'Russian Federation', lat: 55.7558, lon: 37.6173, continent: 'Europe', capital: 'Moscow', currency: 'Russian Ruble', flagEmoji: '🇷🇺', languages: ['Russian'], hasDeepProfile: true },
  { id: 'united-kingdom', name: 'United Kingdom', officialName: 'United Kingdom of Great Britain and Northern Ireland', lat: 51.5072, lon: -0.1276, continent: 'Europe', capital: 'London', currency: 'Pound Sterling', flagEmoji: '🇬🇧', languages: ['English'], hasDeepProfile: true },
  { id: 'france', name: 'France', lat: 48.8566, lon: 2.3522, continent: 'Europe', capital: 'Paris', currency: 'Euro', flagEmoji: '🇫🇷', languages: ['French'], hasDeepProfile: true },
  { id: 'germany', name: 'Germany', lat: 52.52, lon: 13.405, continent: 'Europe', capital: 'Berlin', currency: 'Euro', flagEmoji: '🇩🇪', languages: ['German'], hasDeepProfile: true },
  { id: 'italy', name: 'Italy', lat: 41.9028, lon: 12.4964, continent: 'Europe', capital: 'Rome', currency: 'Euro', flagEmoji: '🇮🇹', languages: ['Italian'], hasDeepProfile: true },
  { id: 'spain', name: 'Spain', lat: 40.4168, lon: -3.7038, continent: 'Europe', capital: 'Madrid', currency: 'Euro', flagEmoji: '🇪🇸', languages: ['Spanish'], hasDeepProfile: true },
  { id: 'netherlands', name: 'Netherlands', lat: 52.3676, lon: 4.9041, continent: 'Europe', capital: 'Amsterdam', currency: 'Euro', flagEmoji: '🇳🇱', languages: ['Dutch'], hasDeepProfile: true },
  { id: 'switzerland', name: 'Switzerland', lat: 46.948, lon: 7.4474, continent: 'Europe', capital: 'Bern', currency: 'Swiss Franc', flagEmoji: '🇨🇭', languages: ['German', 'French', 'Italian', 'Romansh'], hasDeepProfile: true },
  { id: 'sweden', name: 'Sweden', lat: 59.3293, lon: 18.0686, continent: 'Europe', capital: 'Stockholm', currency: 'Swedish Krona', flagEmoji: '🇸🇪', languages: ['Swedish'], hasDeepProfile: true },
  { id: 'norway', name: 'Norway', lat: 59.9139, lon: 10.7522, continent: 'Europe', capital: 'Oslo', currency: 'Norwegian Krone', flagEmoji: '🇳🇴', languages: ['Norwegian'], hasDeepProfile: true },
  { id: 'poland', name: 'Poland', lat: 52.2297, lon: 21.0122, continent: 'Europe', capital: 'Warsaw', currency: 'Polish Złoty', flagEmoji: '🇵🇱', languages: ['Polish'], hasDeepProfile: true },
  { id: 'greece', name: 'Greece', lat: 37.9838, lon: 23.7275, continent: 'Europe', capital: 'Athens', currency: 'Euro', flagEmoji: '🇬🇷', languages: ['Greek'], hasDeepProfile: true },
  { id: 'portugal', name: 'Portugal', lat: 38.7223, lon: -9.1393, continent: 'Europe', capital: 'Lisbon', currency: 'Euro', flagEmoji: '🇵🇹', languages: ['Portuguese'], hasDeepProfile: true },
  { id: 'ukraine', name: 'Ukraine', lat: 50.4501, lon: 30.5234, continent: 'Europe', capital: 'Kyiv', currency: 'Ukrainian Hryvnia', flagEmoji: '🇺🇦', languages: ['Ukrainian'], hasDeepProfile: true },

  // --- Africa ---
  { id: 'egypt', name: 'Egypt', lat: 30.0444, lon: 31.2357, continent: 'Africa', capital: 'Cairo', currency: 'Egyptian Pound', flagEmoji: '🇪🇬', languages: ['Arabic'], hasDeepProfile: true },
  { id: 'nigeria', name: 'Nigeria', lat: 9.0765, lon: 7.3986, continent: 'Africa', capital: 'Abuja', currency: 'Nigerian Naira', flagEmoji: '🇳🇬', languages: ['English'], hasDeepProfile: true },
  { id: 'south-africa', name: 'South Africa', lat: -25.7479, lon: 28.2293, continent: 'Africa', capital: 'Pretoria (administrative) / Cape Town (legislative) / Bloemfontein (judicial)', currency: 'South African Rand', flagEmoji: '🇿🇦', languages: ['11 official languages'], hasDeepProfile: true },
  { id: 'kenya', name: 'Kenya', lat: -1.2921, lon: 36.8219, continent: 'Africa', capital: 'Nairobi', currency: 'Kenyan Shilling', flagEmoji: '🇰🇪', languages: ['Swahili', 'English'], hasDeepProfile: true },
  { id: 'ethiopia', name: 'Ethiopia', lat: 9.032, lon: 38.7469, continent: 'Africa', capital: 'Addis Ababa', currency: 'Ethiopian Birr', flagEmoji: '🇪🇹', languages: ['Amharic'], hasDeepProfile: true },
  { id: 'morocco', name: 'Morocco', lat: 33.9716, lon: -6.8498, continent: 'Africa', capital: 'Rabat', currency: 'Moroccan Dirham', flagEmoji: '🇲🇦', languages: ['Arabic', 'Berber'], hasDeepProfile: true },
  { id: 'ghana', name: 'Ghana', lat: 5.6037, lon: -0.187, continent: 'Africa', capital: 'Accra', currency: 'Ghanaian Cedi', flagEmoji: '🇬🇭', languages: ['English'], hasDeepProfile: true },

  // --- North America ---
  { id: 'united-states', name: 'United States', officialName: 'United States of America', lat: 38.9072, lon: -77.0369, continent: 'North America', capital: 'Washington, D.C.', currency: 'US Dollar', flagEmoji: '🇺🇸', languages: ['English'], hasDeepProfile: true },
  { id: 'canada', name: 'Canada', lat: 45.4215, lon: -75.6972, continent: 'North America', capital: 'Ottawa', currency: 'Canadian Dollar', flagEmoji: '🇨🇦', languages: ['English', 'French'], hasDeepProfile: true },
  { id: 'mexico', name: 'Mexico', lat: 19.4326, lon: -99.1332, continent: 'North America', capital: 'Mexico City', currency: 'Mexican Peso', flagEmoji: '🇲🇽', languages: ['Spanish'], hasDeepProfile: true },
  { id: 'cuba', name: 'Cuba', lat: 23.1136, lon: -82.3666, continent: 'North America', capital: 'Havana', currency: 'Cuban Peso', flagEmoji: '🇨🇺', languages: ['Spanish'], hasDeepProfile: true },

  // --- South America ---
  { id: 'brazil', name: 'Brazil', lat: -15.8267, lon: -47.9218, continent: 'South America', capital: 'Brasília', currency: 'Brazilian Real', flagEmoji: '🇧🇷', languages: ['Portuguese'], hasDeepProfile: true },
  { id: 'argentina', name: 'Argentina', lat: -34.6037, lon: -58.3816, continent: 'South America', capital: 'Buenos Aires', currency: 'Argentine Peso', flagEmoji: '🇦🇷', languages: ['Spanish'], hasDeepProfile: true },
  { id: 'chile', name: 'Chile', lat: -33.4489, lon: -70.6693, continent: 'South America', capital: 'Santiago', currency: 'Chilean Peso', flagEmoji: '🇨🇱', languages: ['Spanish'], hasDeepProfile: true },
  { id: 'colombia', name: 'Colombia', lat: 4.711, lon: -74.0721, continent: 'South America', capital: 'Bogotá', currency: 'Colombian Peso', flagEmoji: '🇨🇴', languages: ['Spanish'], hasDeepProfile: true },

  // --- Oceania ---
  { id: 'australia', name: 'Australia', lat: -35.2809, lon: 149.13, continent: 'Oceania', capital: 'Canberra', currency: 'Australian Dollar', flagEmoji: '🇦🇺', languages: ['English'], hasDeepProfile: true },
  { id: 'new-zealand', name: 'New Zealand', lat: -41.2865, lon: 174.7762, continent: 'Oceania', capital: 'Wellington', currency: 'New Zealand Dollar', flagEmoji: '🇳🇿', languages: ['English', 'Māori'], hasDeepProfile: true }
]

export function getGlobeCountryById(id: string): GlobeCountry | undefined {
  return GLOBE_COUNTRIES.find((c) => c.id === id)
}

export function searchGlobeCountries(query: string): GlobeCountry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return GLOBE_COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.capital.toLowerCase().includes(q) || c.continent.toLowerCase().includes(q)
  )
}
