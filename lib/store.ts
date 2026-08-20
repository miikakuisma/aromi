import {
  TIME_ZONE,
  addDays,
  dayNum,
  mondayOf,
  monthNum,
  todayInHelsinki,
  toUTCDate,
} from "./dates";
import type { WeekData } from "./types";

const STORE_PREFIX = "aromi:week:";

export interface StoredWeek {
  savedAt: number;
  data: WeekData;
}

/**
 * Mitä maanantaita offset tarkoittaa juuri nyt. Tämä on avain jolla tallennettu
 * viikko tunnistetaan: "offset 0" osoittaa eri viikkoon eri päivinä, joten
 * pelkällä offsetilla säilötty lista näkyisi ensi maanantaina väärin.
 */
export function expectedMonday(offset: number): string {
  return addDays(mondayOf(todayInHelsinki()), offset * 7);
}

export function storeWeek(data: WeekData): void {
  try {
    localStorage.setItem(
      STORE_PREFIX + data.start,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    /* privaattitila tai täysi kiintiö — ei kriittistä */
  }
}

export function readWeek(start: string): StoredWeek | null {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + start);
    return raw ? (JSON.parse(raw) as StoredWeek) : null;
  } catch {
    return null;
  }
}

/** Selailu menneisiin viikkoihin kerryttäisi tallennettuja listoja loputtomiin. */
export function pruneStore(): void {
  try {
    const monday = toUTCDate(expectedMonday(0)).getTime();
    const doomed: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORE_PREFIX)) continue;
      const start = toUTCDate(key.slice(STORE_PREFIX.length)).getTime();
      if (Number.isNaN(start) || Math.abs(start - monday) > 28 * 86400 * 1000) {
        doomed.push(key);
      }
    }

    // Poistetaan vasta silmukan jälkeen: removeItem kesken iteroinnin
    // siirtäisi loppujen avainten indeksejä.
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ohitetaan */
  }
}

export function savedAtLabel(ts: number): string {
  const when = new Date(ts);
  const time = new Intl.DateTimeFormat("fi-FI", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);

  const today = todayInHelsinki();
  if (day === today) return `tänään klo ${time}`;
  if (day === addDays(today, -1)) return `eilen klo ${time}`;
  return `${dayNum(day)}.${monthNum(day)}. klo ${time}`;
}
