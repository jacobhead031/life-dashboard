// Country names for the visited-countries map. Entries are free text, so two
// spellings of one place ("USA", "United States") must count as one country.

// The atlas (world-atlas, Natural Earth) abbreviates some names; these are the readable versions.
const NICE: Record<string, string> = {
  "United States of America": "United States",
  "Dominican Rep.": "Dominican Republic",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Dem. Rep. Congo": "DR Congo",
  "Central African Rep.": "Central African Republic",
  "Eq. Guinea": "Equatorial Guinea",
  "S. Sudan": "South Sudan",
  "W. Sahara": "Western Sahara",
  "N. Cyprus": "Northern Cyprus",
  "Antigua and Barb.": "Antigua and Barbuda",
  "St. Vin. and Gren.": "St. Vincent and the Grenadines",
  "Cayman Is.": "Cayman Islands",
  "Turks and Caicos Is.": "Turks and Caicos",
  "U.S. Virgin Is.": "US Virgin Islands",
  "British Virgin Is.": "British Virgin Islands",
  "Fr. Polynesia": "French Polynesia",
  "Solomon Is.": "Solomon Islands",
  "Cook Is.": "Cook Islands",
  "Marshall Is.": "Marshall Islands",
  "Falkland Is.": "Falkland Islands",
  "Faeroe Is.": "Faroe Islands",
  "Macedonia": "North Macedonia",
  "eSwatini": "Eswatini",
  "Cabo Verde": "Cape Verde",
};

/** Readable name for an atlas country name. */
export const niceCountry = (atlasName: string) => NICE[atlasName] ?? atlasName;

// Common ways of typing a country → the readable name above (all lowercase, no accents).
const ALIASES: Record<string, string> = {
  "usa": "united states", "us": "united states", "u.s.": "united states", "u.s.a.": "united states",
  "united states of america": "united states", "america": "united states", "the united states": "united states",
  "uk": "united kingdom", "u.k.": "united kingdom", "england": "united kingdom", "scotland": "united kingdom",
  "wales": "united kingdom", "northern ireland": "united kingdom", "great britain": "united kingdom", "britain": "united kingdom",
  "czech republic": "czechia", "holland": "netherlands", "the netherlands": "netherlands",
  "uae": "united arab emirates", "the bahamas": "bahamas", "korea": "south korea", "turkiye": "turkey",
  "macedonia": "north macedonia", "swaziland": "eswatini", "burma": "myanmar", "ivory coast": "cote d'ivoire",
  "cabo verde": "cape verde", "bosnia": "bosnia and herzegovina", "drc": "dr congo", "vatican city": "vatican",
  "st lucia": "saint lucia", "st. lucia": "saint lucia", "turks and caicos islands": "turks and caicos",
  "the dominican republic": "dominican republic", "dominican": "dominican republic",
};

/** One key per real country, whatever the spelling, case or accents. */
export function countryKey(name: string): string {
  const k = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return ALIASES[k] ?? k;
}

/** How many different countries a list of entry names covers (two trips to France = 1). */
export const distinctCountries = (names: string[]) => new Set(names.map(countryKey).filter(Boolean)).size;
