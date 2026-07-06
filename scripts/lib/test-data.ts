/**
 * Everything that marks a row as load-test data, plus lightweight
 * "realistic-ish" generators. No external data-gen dependency — this is
 * throwaway tooling, not app code, so hand-rolled arrays are enough.
 */

// Both the account number AND surname carry this prefix (belt-and-braces:
// cleanup can match on either column, and it's unmistakable in the UI too).
export const TEST_MARKER = "ZZTEST_";

export function testAccountNumber(index: number): string {
  return `${TEST_MARKER}${String(index).padStart(6, "0")}`;
}

export function testSurname(realSurname: string): string {
  return `${TEST_MARKER}${realSurname}`;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function shuffled<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const FIRST_NAMES = [
  "Sean", "Aoife", "Conor", "Siobhan", "Liam", "Niamh", "Cian", "Roisin",
  "Padraig", "Orla", "Declan", "Ciara", "Eoin", "Sinead", "Fionn", "Grainne",
  "Darragh", "Aisling", "Ronan", "Emer", "Cormac", "Maeve", "Tadhg", "Nessa",
  "Colm", "Sorcha", "Brendan", "Caoimhe", "Fintan", "Deirdre", "Diarmuid",
  "Eimear", "Ruairi", "Nuala", "Oisin", "Roisin", "Cathal", "Aine", "Barry",
  "Laoise",
] as const;

const SURNAMES = [
  "Murphy", "Kelly", "Byrne", "Ryan", "OSullivan", "Walsh", "OBrien",
  "Gallagher", "Doyle", "McCarthy", "Kennedy", "Lynch", "Murray", "Quinn",
  "Moore", "McLoughlin", "Carroll", "Connolly", "Daly", "OConnor", "Duffy",
  "Brennan", "Doherty", "Nolan", "Hughes", "Farrell", "Fitzgerald", "Kavanagh",
  "Power", "Maguire", "Whelan", "Reilly", "Sheridan", "Higgins", "Flynn",
  "Healy", "Curran", "Dunne", "Boyle", "Hayes",
] as const;

const STREET_NAMES = [
  "Oak Grove", "Elm Park", "The Hollows", "Riverside Walk", "Church Road",
  "Meadow Vale", "Abbey Court", "St. Brigid's Terrace", "Willow Drive",
  "Castle View", "Orchard Lane", "Glenview Road", "Priory Court", "Mill Lane",
  "Sycamore Crescent", "The Green", "Ashfield Park", "Cherry Orchard Ave",
  "Beechwood Close", "Fairways Grove", "Sunnyside Road", "Harbour View",
  "Cluain Mhuire", "Parklands", "The Paddocks", "Woodview Terrace",
] as const;

const TOWNS = [
  "Tallaght, Dublin 24", "Blanchardstown, Dublin 15", "Swords, Co. Dublin",
  "Clondalkin, Dublin 22", "Finglas, Dublin 11", "Balbriggan, Co. Dublin",
  "Lucan, Co. Dublin", "Tullamore, Co. Offaly", "Naas, Co. Kildare",
  "Portlaoise, Co. Laois", "Drogheda, Co. Louth", "Navan, Co. Meath",
  "Athlone, Co. Westmeath", "Mullingar, Co. Westmeath", "Newbridge, Co. Kildare",
] as const;

const EIRCODE_ROUTING_KEYS = [
  "D01", "D02", "D04", "D06", "D11", "D15", "D22", "D24", "A94", "K34",
  "K45", "N39", "R32", "W23", "W91",
] as const;

const EIRCODE_CHARS = "ACDEFHKNPRTVWXY0123456789";

export function randomName(): { firstName: string; realSurname: string } {
  return { firstName: pick(FIRST_NAMES), realSurname: pick(SURNAMES) };
}

export function randomAddress(): string {
  const houseNumber = randomInt(1, 180);
  return `${houseNumber} ${pick(STREET_NAMES)}, ${pick(TOWNS)}`;
}

export function randomEircode(): string {
  let unique = "";
  for (let i = 0; i < 4; i++) {
    unique += EIRCODE_CHARS[randomInt(0, EIRCODE_CHARS.length - 1)];
  }
  return `${pick(EIRCODE_ROUTING_KEYS)} ${unique}`;
}

export function randomIrishMobile(): string {
  const prefix = pick(["083", "085", "086", "087", "089"]);
  let rest = "";
  for (let i = 0; i < 7; i++) rest += randomInt(0, 9);
  return `${prefix}${rest}`;
}

export function randomPpsn(): string {
  let digits = "";
  for (let i = 0; i < 7; i++) digits += randomInt(0, 9);
  const letter = String.fromCharCode(65 + randomInt(0, 25));
  return `${digits}${letter}`;
}

export function randomDateOfBirth(): string {
  const year = randomInt(1950, 2005);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const usedLoanReferences = new Set<string>();

/**
 * Same "LN-YYMMDD-XXXX" shape as the app's own generateLoanReference (see
 * src/lib/loans.ts), but retries on collision so it's guaranteed unique
 * across an entire seed run. A plain 4-char random suffix collides often
 * at 2000+ loans generated in one batch (birthday paradox over a ~1.68M
 * combination space) — the app itself never hits this since real loans
 * are created one at a time, but a bulk seed easily does.
 */
export function uniqueLoanReference(createdAt: Date): string {
  const ymd = createdAt.toISOString().slice(2, 10).replace(/-/g, "");
  for (;;) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const ref = `LN-${ymd}-${rand}`;
    if (!usedLoanReferences.has(ref)) {
      usedLoanReferences.add(ref);
      return ref;
    }
  }
}
