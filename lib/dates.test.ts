import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  dayNum,
  formatDay,
  isoWeekNumber,
  mondayOf,
  monthNum,
  todayInHelsinki,
  weekdayIndex,
} from "./dates";

describe("addDays", () => {
  it("siirtyy kuukauden yli", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("ei hyppää kesäajan vaihtuessa", () => {
    // EU siirtyy kesäaikaan 29.3.2026. UTC-pohjainen laskenta ei saa horjua.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("siirtyy taaksepäin vuoden yli", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("weekdayIndex", () => {
  it("maanantai on 0 ja sunnuntai 6", () => {
    expect(weekdayIndex("2026-08-17")).toBe(0);
    expect(weekdayIndex("2026-08-23")).toBe(6);
  });
});

describe("mondayOf", () => {
  it("palauttaa maanantain sellaisenaan", () => {
    expect(mondayOf("2026-08-17")).toBe("2026-08-17");
  });

  it("palauttaa sunnuntailta saman viikon maanantain", () => {
    expect(mondayOf("2026-08-23")).toBe("2026-08-17");
  });
});

describe("isoWeekNumber", () => {
  it("laskee tavallisen viikon", () => {
    expect(isoWeekNumber("2026-08-17")).toBe(34);
  });

  it("laskee 53-viikkoisen vuoden vaihteen", () => {
    // 31.12.2020 ja 1.1.2021 kuuluvat molemmat vuoden 2020 viikkoon 53.
    expect(isoWeekNumber("2020-12-31")).toBe(53);
    expect(isoWeekNumber("2021-01-01")).toBe(53);
    expect(isoWeekNumber("2021-01-04")).toBe(1);
  });

  it("laskee vuodenvaihteen jossa 1.1. kuuluu viikkoon 1", () => {
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });

  it("laskee vuoden 2026 viimeisen viikon", () => {
    expect(isoWeekNumber("2027-01-01")).toBe(53);
  });
});

describe("formatDay, dayNum ja monthNum", () => {
  it("muotoilevat ilman etunollia", () => {
    expect(formatDay("2026-08-05")).toBe("5.8.");
    expect(dayNum("2026-08-05")).toBe(5);
    expect(monthNum("2026-08-05")).toBe("8");
  });
});

describe("todayInHelsinki", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("käyttää Suomen kesäaikaa (UTC+3)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T22:30:00Z"));
    expect(todayInHelsinki()).toBe("2026-08-20");
  });

  it("käyttää Suomen talviaikaa (UTC+2)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T23:30:00Z"));
    expect(todayInHelsinki()).toBe("2026-01-16");
  });
});
