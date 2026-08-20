export const TIME_ZONE = "Europe/Helsinki";
export const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];

// Kaikki päivämäärät ovat "YYYY-MM-DD"-merkkijonoja ja laskenta tehdään
// UTC:ssä, jolloin aikavyöhyke ei pääse siirtämään päivää. Ainoa kohta jossa
// vyöhykkeellä on merkitystä on "mikä päivä Suomessa on nyt".

export function todayInHelsinki(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // Jos ajoympäristöstä puuttuu aikavyöhyketuki, UTC+3 osuu kesäaikaan.
    return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

export function toUTCDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(ymd: string, days: number): string {
  const date = toUTCDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = maanantai, 6 = sunnuntai. */
export function weekdayIndex(ymd: string): number {
  return (toUTCDate(ymd).getUTCDay() + 6) % 7;
}

export function mondayOf(ymd: string): string {
  return addDays(ymd, -weekdayIndex(ymd));
}

export function isoWeekNumber(ymd: string): number {
  const thursday = toUTCDate(addDays(mondayOf(ymd), 3));
  const firstThursday = toUTCDate(
    addDays(mondayOf(`${thursday.getUTCFullYear()}-01-04`), 3),
  );
  return (
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * 86400 * 1000),
    )
  );
}

export function formatDay(ymd: string): string {
  const date = toUTCDate(ymd);
  return `${date.getUTCDate()}.${date.getUTCMonth() + 1}.`;
}

export function dayNum(ymd: string): number {
  return Number(ymd.slice(8, 10));
}

export function monthNum(ymd: string): string {
  return String(Number(ymd.slice(5, 7)));
}
