import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, isoWeekNumber } from "./dates";
import {
  expectedMonday,
  pruneStore,
  readWeek,
  savedAtLabel,
  storeWeek,
} from "./store";
import type { WeekData } from "./types";

function createFakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

function weekData(start: string): WeekData {
  return {
    restaurant: "Meilahden ala-aste",
    week: isoWeekNumber(start),
    start,
    end: addDays(start, 4),
    today: start,
    days: [],
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createFakeStorage());
  vi.useFakeTimers();
  // Keskiviikko 19.8.2026 klo 9.00 Suomen aikaa.
  vi.setSystemTime(new Date("2026-08-19T06:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("expectedMonday", () => {
  it("palauttaa kuluvan viikon maanantain", () => {
    expect(expectedMonday(0)).toBe("2026-08-17");
  });

  it("siirtyy viikoittain", () => {
    expect(expectedMonday(1)).toBe("2026-08-24");
    expect(expectedMonday(-1)).toBe("2026-08-10");
  });
});

describe("storeWeek ja readWeek", () => {
  it("tallentaa ja lukee saman viikon", () => {
    const data = weekData("2026-08-17");
    storeWeek(data);
    const saved = readWeek("2026-08-17");
    expect(saved?.data).toEqual(data);
    expect(saved?.savedAt).toBe(Date.now());
  });

  it("palauttaa null tuntemattomalle viikolle", () => {
    expect(readWeek("2026-08-24")).toBeNull();
  });

  it("palauttaa null rikkinäiselle merkinnälle", () => {
    localStorage.setItem("aromi:week:2026-08-17", "{ ei json");
    expect(readWeek("2026-08-17")).toBeNull();
  });
});

describe("pruneStore", () => {
  it("säilyttää lähiviikot ja poistaa kaukaiset", () => {
    storeWeek(weekData("2026-08-17")); // kuluva
    storeWeek(weekData("2026-08-31")); // +2 vk
    storeWeek(weekData("2026-05-04")); // kaukana menneisyydessä
    storeWeek(weekData("2026-12-07")); // kaukana tulevaisuudessa

    pruneStore();

    expect(readWeek("2026-08-17")).not.toBeNull();
    expect(readWeek("2026-08-31")).not.toBeNull();
    expect(readWeek("2026-05-04")).toBeNull();
    expect(readWeek("2026-12-07")).toBeNull();
  });

  it("poistaa avaimet joiden päivämäärää ei voi lukea", () => {
    localStorage.setItem("aromi:week:roskaa", "{}");
    pruneStore();
    expect(localStorage.getItem("aromi:week:roskaa")).toBeNull();
  });

  it("ei koske muiden sovellusten avaimiin", () => {
    localStorage.setItem("jokin-muu", "arvo");
    pruneStore();
    expect(localStorage.getItem("jokin-muu")).toBe("arvo");
  });
});

describe("savedAtLabel", () => {
  it("sanoo tänään", () => {
    expect(savedAtLabel(Date.parse("2026-08-19T04:42:00Z"))).toMatch(
      /^tänään klo \d{1,2}[.:]\d{2}$/,
    );
  });

  it("sanoo eilen", () => {
    expect(savedAtLabel(Date.parse("2026-08-18T04:42:00Z"))).toMatch(
      /^eilen klo \d{1,2}[.:]\d{2}$/,
    );
  });

  it("sanoo päivämäärän vanhemmalle", () => {
    expect(savedAtLabel(Date.parse("2026-08-05T04:42:00Z"))).toMatch(
      /^5\.8\. klo \d{1,2}[.:]\d{2}$/,
    );
  });
});
