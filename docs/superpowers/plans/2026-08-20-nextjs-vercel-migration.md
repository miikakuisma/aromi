# Aromi → Next.js on Vercel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Puter Worker and the standalone `index.html` with one Next.js 16 app on Vercel that serves both the TRMNL API and the mobile week view.

**Architecture:** All Aromi knowledge lives in `lib/`, imported by both the API route handlers and the server-rendered page. `app/page.tsx` fetches the current week on the server so the first paint is the real menu; a `'use client'` island (`app/week-view.tsx`) takes over for week navigation, localStorage caching and the offline banner.

**Tech Stack:** Next.js 16.3.1 (App Router, Turbopack), React 19.2.8, TypeScript 5.9, Vitest 4, `@serwist/turbopack` 9.5.12, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-20-nextjs-vercel-migration-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Package manager:** npm. Node 22.
- **Pinned versions:** `next@16.3.1`, `react@19.2.8`, `react-dom@19.2.8`, `@serwist/turbopack@9.5.12`, `serwist@9.5.12`, `esbuild@^0.28.2`, `vitest@^4.1.11`.
- **TypeScript `^5.9.3` — NOT 7.x.** TypeScript 7 (the Go rewrite) is released but very new; Serwist's peer range is `>=5.0.0` and Next's TS plugin is best-tested on 5.x. Upgrading later is a one-line change.
- **All code comments and all user-facing strings are in Finnish.** This matches the existing codebase. Plan and spec are English; nothing shipped to the browser is.
- **API response shapes must not change.** `TRMNL plugin.html` consumes `{ date, meals[{name, foods}] }` and must keep working untouched.
- **The Aromi fetch uses `cache: "force-cache"` together with `next: { revalidate: 3600 }`.** Per the Next 16.3.1 docs, caching is opt-in and `next.revalidate` alone does **not** cache a POST request.
- **`app/page.tsx` uses `export const revalidate = 0`, NOT `dynamic = "force-dynamic"`.** The docs state `force-dynamic` is equivalent to `fetchCache = "force-no-store"`, which "forces all fetch requests to be re-fetched every request **even if they provide a `force-cache` option**" — it would silently defeat the Aromi cache. `revalidate = 0` renders per request while leaving `force-cache` fetches cached.
- **`/api/*` must never be cached by the service worker.** `?offset=0` means a different week on different days; a cached response would show last week's menu as this week's.
- **Do not touch `TRMNL plugin.html`.**

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/types.ts` | Aromi response types + our own response types |
| `lib/dates.ts` | UTC-based date arithmetic, Helsinki "today", ISO week numbers |
| `lib/aromi.ts` | Aromi constants + `fetchMenuRange` + `splitDishes` |
| `lib/transform.ts` | `transformMenu` (TRMNL) and `transformWeek` (web) |
| `lib/store.ts` | localStorage persistence, `expectedMonday`, `savedAtLabel` |
| `lib/http.ts` | `jsonResponse` helper shared by both route handlers |
| `lib/fixtures/aromi-week.ts` | Hand-written Aromi fixture for deterministic tests |
| `app/layout.tsx` | `<html lang="fi">`, metadata, viewport, next/font wiring |
| `app/page.tsx` | Server component: fetch week 0, render static chrome + `<WeekView>` |
| `app/week-view.tsx` | Client island: offset state, fetching, localStorage, effects |
| `app/components/week-nav.tsx` | Prev/next arrows + week label |
| `app/components/day-strip.tsx` | Five-day strip |
| `app/components/day-list.tsx` | Day sections |
| `app/components/diet-marks.tsx` | Veg / ♥ badges |
| `app/components/states.tsx` | Skeleton, error state, stale banner |
| `app/globals.css` | The existing CSS |
| `app/api/menu/route.ts` | TRMNL endpoint |
| `app/api/week/route.ts` | Web endpoint |
| `app/manifest.ts` | PWA manifest |
| `app/sw.ts` | Serwist service worker source |
| `app/serwist/[path]/route.ts` | Serwist build route |
| `app/~offline/page.tsx` | Offline fallback |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx` (placeholders, replaced in Task 5)

**Interfaces:**
- Consumes: nothing
- Produces: a buildable Next.js app; `npm run build` and `npm test` both succeed

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "aromi",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.3.1",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@types/node": "^26.2.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "typescript": "^5.9.3",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

`jsx` must be `"react-jsx"`, not `"preserve"`. Next 16.3.1 treats it as required
configuration (`writeConfigurationDefaults.js`, "next.js uses the React automatic
runtime") and rewrites the file on every `next build` / `next dev`. The
`.next/dev/types` include is added by the same mechanism.

- [ ] **Step 3: Create `next.config.mjs`**

Serwist is wired in at Task 9; keep this plain for now.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
.next
out
build
.DS_Store
*.tsbuildinfo
next-env.d.ts
.env*.local
.vercel
```

- [ ] **Step 6: Create placeholder `app/layout.tsx`**

```tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder `app/page.tsx`**

```tsx
export default function Page() {
  return <p>Ruokalista</p>;
}
```

- [ ] **Step 8: Install and verify the build**

Run: `npm install && npm run build && npm test`
Expected: install succeeds, build succeeds ("Compiled successfully"), `vitest` reports no test files but exits 0.

If `react-dom@19.2.8` does not exist, run `npm view react-dom version` and pin both `react` and `react-dom` to that same version.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts .gitignore app/
git commit -m "Lisää Next.js-projektin runko"
```

---

### Task 2: Date helpers

**Files:**
- Create: `lib/types.ts`, `lib/dates.ts`
- Test: `lib/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TIME_ZONE: string`, `WEEKDAYS: string[]`
  - `todayInHelsinki(): string`
  - `toUTCDate(ymd: string): Date`
  - `addDays(ymd: string, days: number): string`
  - `weekdayIndex(ymd: string): number`
  - `mondayOf(ymd: string): string`
  - `isoWeekNumber(ymd: string): number`
  - `formatDay(ymd: string): string`
  - `dayNum(ymd: string): number`
  - `monthNum(ymd: string): string`
  - Types: `AromiDish`, `AromiMeal`, `AromiDay`, `MenuMeal`, `MenuData`, `DayOption`, `WeekDay`, `WeekData`

All date strings are `"YYYY-MM-DD"`.

- [ ] **Step 1: Create `lib/types.ts`**

```ts
// --- Aromin vastausmuoto — vain ne kentät joita käytämme ---

export interface AromiDish {
  DishName: string;
  PartOfMealIndexNumber: number;
  DishIndexNumber: number;
  DietDetails?: string;
}

export interface AromiMeal {
  MealName: string;
  Dishes: AromiDish[];
}

export interface AromiDay {
  /** ISO-muotoinen päivä, esim. "2026-08-17T00:00:00". */
  Date: string;
  /** Aromin oma esitysmuoto, esim. "ma 17.8.2026". */
  MenuDate: string;
  Meals: AromiMeal[];
}

// --- Omat vastausmuodot ---

export interface MenuMeal {
  name: string;
  foods: string;
}

/** GET /api/menu — TRMNL-näyttö lukee tätä. */
export interface MenuData {
  date: string | null;
  meals: MenuMeal[];
}

export interface DayOption {
  main: string[];
  sides: string[];
  diets: string;
}

export interface WeekDay {
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
  options: DayOption[];
}

/** GET /api/week — verkkosivu lukee tätä. */
export interface WeekData {
  restaurant: string;
  week: number;
  start: string;
  end: string;
  today: string;
  days: WeekDay[];
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/dates.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./dates"`.

- [ ] **Step 4: Write the implementation**

Create `lib/dates.ts`:

```ts
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
```

Note: `worker.js` subtracted `Date` objects directly (`thursday - firstThursday`). TypeScript's `strict` rejects that, hence `.getTime()`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/dates.ts lib/dates.test.ts
git commit -m "Lisää päivämäärälogiikka ja tyypit testeineen"
```

---

### Task 3: Aromi client and transforms

**Files:**
- Create: `lib/aromi.ts`, `lib/transform.ts`, `lib/fixtures/aromi-week.ts`
- Test: `lib/transform.test.ts`

**Interfaces:**
- Consumes: everything from Task 2 (`lib/dates.ts`, `lib/types.ts`)
- Produces:
  - `RESTAURANT_NAME: string`
  - `fetchMenuRange(startYmd: string, endYmd: string): Promise<AromiDay[]>`
  - `splitDishes(dishes: AromiDish[]): DayOption`
  - `transformMenu(apiData: AromiDay[]): MenuData`
  - `transformWeek(apiData: AromiDay[], monday: string, today: string): WeekData`
  - `aromiWeekFixture: AromiDay[]`

- [ ] **Step 1: Create the test fixture**

Hand-written rather than captured from the live API, so the tests are deterministic and offline. It deliberately exercises: out-of-order dishes, two main dishes in one part, duplicate diet codes, a missing weekday, and a trailing dot in `MealName`.

Create `lib/fixtures/aromi-week.ts`:

```ts
import type { AromiDay } from "../types";

/**
 * Käsin kirjoitettu näyte Aromin vastauksesta viikolle 34/2026.
 * Sisältää tarkoituksella hankalat tapaukset: annososat väärässä
 * järjestyksessä, kaksi pääruokaa samassa osassa, toistuvia ruokavaliokoodeja,
 * puuttuva tiistai ja pisteellä erotettu toinen "Lounas".
 */
export const aromiWeekFixture: AromiDay[] = [
  {
    Date: "2026-08-17T00:00:00",
    MenuDate: "ma 17.8.2026",
    Meals: [
      {
        MealName: "Lounas",
        Dishes: [
          {
            DishName: "Härkäpapupihvit",
            PartOfMealIndexNumber: 1,
            DishIndexNumber: 1,
            DietDetails: "L, M, G, Veg",
          },
          {
            DishName: "Perunasosetta",
            PartOfMealIndexNumber: 2,
            DishIndexNumber: 1,
            DietDetails: "L, M",
          },
          {
            DishName: "Sekaleipää",
            PartOfMealIndexNumber: 3,
            DishIndexNumber: 1,
            DietDetails: "M",
          },
        ],
      },
      {
        MealName: "Lounas.",
        Dishes: [
          {
            DishName: "Kalapuikot",
            PartOfMealIndexNumber: 1,
            DishIndexNumber: 1,
            DietDetails: "L, M",
          },
          {
            DishName: "Perunasosetta",
            PartOfMealIndexNumber: 2,
            DishIndexNumber: 1,
            DietDetails: "L, M",
          },
        ],
      },
    ],
  },
  // Tiistai puuttuu kokonaan — Aromi jättää ruokailemattomat päivät pois.
  {
    Date: "2026-08-19T00:00:00",
    MenuDate: "ke 19.8.2026",
    Meals: [
      {
        MealName: "Lounas",
        Dishes: [
          {
            DishName: "Puuroa",
            PartOfMealIndexNumber: 2,
            DishIndexNumber: 1,
            DietDetails: "M",
          },
          {
            DishName: "Lohikeittoa",
            PartOfMealIndexNumber: 1,
            DishIndexNumber: 2,
            DietDetails: "L, ♥",
          },
          {
            DishName: "Kasviskeittoa",
            PartOfMealIndexNumber: 1,
            DishIndexNumber: 1,
            DietDetails: "L, Veg, ♥",
          },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Write the failing test**

Create `lib/transform.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitDishes } from "./aromi";
import { aromiWeekFixture } from "./fixtures/aromi-week";
import { transformMenu, transformWeek } from "./transform";

describe("splitDishes", () => {
  it("erottaa pääruoan lisukkeista pienimmän osaindeksin perusteella", () => {
    const result = splitDishes(aromiWeekFixture[0].Meals[0].Dishes);
    expect(result.main).toEqual(["Härkäpapupihvit"]);
    expect(result.sides).toEqual(["Perunasosetta", "Sekaleipää"]);
    expect(result.diets).toBe("L, M, G, Veg");
  });

  it("lajittelee annososat ja säilyttää useamman pääruoan", () => {
    const result = splitDishes(aromiWeekFixture[1].Meals[0].Dishes);
    expect(result.main).toEqual(["Kasviskeittoa", "Lohikeittoa"]);
    expect(result.sides).toEqual(["Puuroa"]);
  });

  it("poistaa toistuvat ruokavaliokoodit", () => {
    // "L, Veg, ♥" ja "L, ♥" — L ja ♥ vain kerran.
    const result = splitDishes(aromiWeekFixture[1].Meals[0].Dishes);
    expect(result.diets).toBe("L, Veg, ♥");
  });

  it("palauttaa tyhjän tuloksen tyhjälle listalle", () => {
    expect(splitDishes([])).toEqual({ main: [], sides: [], diets: "" });
  });
});

describe("transformMenu", () => {
  it("palauttaa ensimmäisen päivän ateriat", () => {
    const result = transformMenu(aromiWeekFixture);
    expect(result.date).toBe("ma 17.8.2026");
    expect(result.meals).toEqual([
      {
        name: "Lounas",
        foods: "Härkäpapupihvit, Perunasosetta, Sekaleipää",
      },
      { name: "Lounas", foods: "Kalapuikot, Perunasosetta" },
    ]);
  });

  it("siivoaa aterian nimen lopusta pisteet", () => {
    const result = transformMenu(aromiWeekFixture);
    expect(result.meals[1].name).toBe("Lounas");
  });

  it("palauttaa tyhjän tuloksen kun dataa ei ole", () => {
    expect(transformMenu([])).toEqual({ date: null, meals: [] });
  });
});

describe("transformWeek", () => {
  const week = transformWeek(aromiWeekFixture, "2026-08-17", "2026-08-19");

  it("palauttaa aina viisi päivää", () => {
    expect(week.days).toHaveLength(5);
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("täyttää viikon tiedot", () => {
    expect(week.restaurant).toBe("Meilahden ala-aste");
    expect(week.week).toBe(34);
    expect(week.start).toBe("2026-08-17");
    expect(week.end).toBe("2026-08-21");
    expect(week.today).toBe("2026-08-19");
  });

  it("merkitsee kuluvan päivän", () => {
    expect(week.days.map((d) => d.isToday)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("jättää puuttuvan päivän vaihtoehdot tyhjäksi", () => {
    expect(week.days[1].weekday).toBe("ti");
    expect(week.days[1].options).toEqual([]);
  });

  it("palauttaa päivän molemmat vaihtoehdot", () => {
    expect(week.days[0].options).toHaveLength(2);
    expect(week.days[0].options[0].main).toEqual(["Härkäpapupihvit"]);
    expect(week.days[0].options[1].main).toEqual(["Kalapuikot"]);
  });

  it("muotoilee päivän otsikon", () => {
    expect(week.days[0].label).toBe("17.8.");
    expect(week.days[0].weekday).toBe("ma");
  });

  it("kestää tyhjän vastauksen", () => {
    const empty = transformWeek([], "2026-08-17", "2026-08-19");
    expect(empty.days).toHaveLength(5);
    expect(empty.days.every((d) => d.options.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./aromi"`.

- [ ] **Step 4: Create `lib/aromi.ts`**

```ts
import type { AromiDay, AromiDish, DayOption } from "./types";

// Meilahden ala-aste, Aromi-portaali KeMenu054, ruokailijaryhmä "Ala-Aste".
const API_BASE =
  "https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/api/Common/Restaurant/RestaurantMeals";
const RESTAURANT_ID = "737d9be1-762c-48d9-a8a7-732567590165";
const DINER_GROUP_ID = "178ca380-3d70-4ee8-b1b6-277aefa17455";
const DIET_GROUP_ID = "bfe0b425-95a6-47b3-8b4f-adc80ab28a1b";

export const RESTAURANT_NAME = "Meilahden ala-aste";

const REQUEST_BODY = {
  DinerGroupId: DINER_GROUP_ID,
  DietGroupId: DIET_GROUP_ID,
  SuitabilityDietIds: [],
};

export async function fetchMenuRange(
  startYmd: string,
  endYmd: string,
): Promise<AromiDay[]> {
  const url = `${API_BASE}?Id=${RESTAURANT_ID}&StartDate=${startYmd}T00:00:00&EndDate=${endYmd}T00:00:00`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(REQUEST_BODY),
    // Next.js ei säilö POST-pyyntöä pelkän revalidaten perusteella, vaan
    // välimuisti on erikseen valittava. Osoitteessa on päivämäärät, joten
    // vanhat merkinnät vanhenevat itsestään viikon vaihtuessa.
    cache: "force-cache",
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Aromi API returned ${response.status}`);
  }

  return response.json();
}

// Aromi jakaa annoksen osiin: pienin PartOfMealIndexNumber on pääruoka, loput
// lisukkeita. Siitä saadaan sivulle kaksitasoinen esitys ilman arvailua.
export function splitDishes(dishes: AromiDish[]): DayOption {
  const sorted = [...dishes].sort(
    (a, b) =>
      a.PartOfMealIndexNumber - b.PartOfMealIndexNumber ||
      a.DishIndexNumber - b.DishIndexNumber,
  );
  if (sorted.length === 0) return { main: [], sides: [], diets: "" };

  const mainPart = sorted[0].PartOfMealIndexNumber;
  const mainDishes = sorted.filter(
    (d) => d.PartOfMealIndexNumber === mainPart,
  );

  const diets = [
    ...new Set(
      mainDishes
        .flatMap((d) => (d.DietDetails || "").split(","))
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  return {
    main: mainDishes.map((d) => d.DishName),
    sides: sorted
      .filter((d) => d.PartOfMealIndexNumber !== mainPart)
      .map((d) => d.DishName),
    diets: diets.join(", "),
  };
}
```

- [ ] **Step 5: Create `lib/transform.ts`**

```ts
import { RESTAURANT_NAME, splitDishes } from "./aromi";
import { WEEKDAYS, addDays, formatDay, isoWeekNumber } from "./dates";
import type { AromiDay, MenuData, WeekData, WeekDay } from "./types";

/** GET /api/menu — TRMNL näyttää vain kuluvan päivän. */
export function transformMenu(apiData: AromiDay[]): MenuData {
  if (!Array.isArray(apiData) || apiData.length === 0) {
    return { date: null, meals: [] };
  }

  const dayEntry = apiData[0];

  const meals = dayEntry.Meals.map((meal) => ({
    name: meal.MealName.replace(/\.+$/, ""),
    foods: meal.Dishes.map((dish) => dish.DishName).join(", "),
  }));

  return { date: dayEntry.MenuDate, meals };
}

/** GET /api/week — verkkosivu näyttää maanantaista perjantaihin. */
export function transformWeek(
  apiData: AromiDay[],
  monday: string,
  today: string,
): WeekData {
  const byDate = new Map<string, AromiDay>();
  if (Array.isArray(apiData)) {
    for (const day of apiData) {
      byDate.set(String(day.Date).slice(0, 10), day);
    }
  }

  const days: WeekDay[] = [];
  for (let i = 0; i < 5; i++) {
    const ymd = addDays(monday, i);
    const entry = byDate.get(ymd);

    days.push({
      date: ymd,
      weekday: WEEKDAYS[i],
      label: formatDay(ymd),
      isToday: ymd === today,
      // Aromissa saman päivän vaihtoehdot erotetaan pisteellä ("Lounas",
      // "Lounas."), joten nimeä ei kannata näyttää — järjestys riittää.
      options: entry ? entry.Meals.map((meal) => splitDishes(meal.Dishes)) : [],
    });
  }

  return {
    restaurant: RESTAURANT_NAME,
    week: isoWeekNumber(monday),
    start: monday,
    end: addDays(monday, 4),
    today,
    days,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all `dates` and `transform` tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/aromi.ts lib/transform.ts lib/transform.test.ts lib/fixtures/
git commit -m "Lisää Aromi-haku ja vastausten muunnos testeineen"
```

---

### Task 4: API route handlers

**Files:**
- Create: `lib/http.ts`, `app/api/menu/route.ts`, `app/api/week/route.ts`

**Interfaces:**
- Consumes: `fetchMenuRange`, `transformMenu`, `transformWeek`, `todayInHelsinki`, `mondayOf`, `addDays`
- Produces: `jsonResponse(data: unknown, status?: number): Response`; two live HTTP endpoints

- [ ] **Step 1: Create `lib/http.ts`**

```ts
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Vastaus sisältää kuluvan päivän, joten sitä ei saa säilöä pitkään.
      "Cache-Control": status === 200 ? "public, max-age=120" : "no-store",
      ...CORS_HEADERS,
    },
  });
}
```

- [ ] **Step 2: Create `app/api/menu/route.ts`**

```ts
import { fetchMenuRange } from "@/lib/aromi";
import { todayInHelsinki } from "@/lib/dates";
import { jsonResponse } from "@/lib/http";
import { transformMenu } from "@/lib/transform";

// Reitti lasketaan joka pyynnöllä, koska "tänään" vaihtuu. Aromin haku pysyy
// silti välimuistissa, koska se pyytää sitä itse (cache: "force-cache").
export const revalidate = 0;

export async function GET() {
  try {
    const today = todayInHelsinki();
    const apiData = await fetchMenuRange(today, today);
    return jsonResponse(transformMenu(apiData));
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
}
```

- [ ] **Step 3: Create `app/api/week/route.ts`**

```ts
import { fetchMenuRange } from "@/lib/aromi";
import { addDays, mondayOf, todayInHelsinki } from "@/lib/dates";
import { jsonResponse } from "@/lib/http";
import { transformWeek } from "@/lib/transform";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const offset =
      Number(new URL(request.url).searchParams.get("offset")) || 0;
    const today = todayInHelsinki();
    const monday = addDays(mondayOf(today), offset * 7);
    const apiData = await fetchMenuRange(monday, addDays(monday, 4));
    return jsonResponse(transformWeek(apiData, monday, today));
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
}
```

- [ ] **Step 4: Verify against the live Aromi service**

Run in one terminal: `npm run dev`
Then in another:

```bash
curl -s http://localhost:3000/api/menu | head -c 400; echo
curl -s "http://localhost:3000/api/week?offset=0" | head -c 600; echo
curl -sI http://localhost:3000/api/menu | grep -i -E 'content-type|cache-control|access-control'
```

Expected:
- `/api/menu` returns `{"date":...,"meals":[...]}`. `date` may be `null` and `meals` `[]` during school holidays — that is valid, not a failure.
- `/api/week?offset=0` returns `restaurant`, `week`, `start`, `end`, `today`, and exactly 5 entries in `days`.
- Headers include `content-type: application/json; charset=utf-8`, `cache-control: public, max-age=120`, `access-control-allow-origin: *`.

Compare the `/api/menu` output shape field-by-field against the "API" section of the current `README.md`. Any difference is a bug — `TRMNL plugin.html` depends on it.

- [ ] **Step 5: Commit**

```bash
git add lib/http.ts app/api/
git commit -m "Lisää /api/menu ja /api/week -reitit"
```

---

### Task 5: Styles, fonts, layout and static page chrome

**Files:**
- Create: `app/globals.css`
- Modify: `app/layout.tsx` (replace placeholder), `app/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: a styled page shell with the header and footer; CSS variables `--font-display` and `--font-body`

- [ ] **Step 1: Create `app/globals.css`**

Copy the entire contents of the `<style>` block in the current `index.html` (from `:root {` through the final `:focus-visible { ... }` rule) verbatim, with exactly one change — the two font variables in `:root` become:

```css
  --display: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  --body:    var(--font-body), ui-serif, Georgia, serif;
```

Everything else — the colour tokens, the dark-scheme block, `.wrap`, `.strip`, `.day`, the animations, the reduced-motion block — is unchanged.

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Familjen_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meilahden ala-aste — ruokalista",
  description:
    "Meilahden ala-asteen kouluruokalista viikoittain. Tiedot Helsingin kaupungin Aromi-palvelusta.",
  applicationName: "Ruokalista",
  appleWebApp: {
    capable: true,
    title: "Ruokalista",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    title: "Meilahden ala-aste — ruokalista",
    description: "Mitä koulussa syödään tällä viikolla?",
    locale: "fi_FI",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS 16.4 ja uudemmat lukevat manifestin, vanhemmat tarvitsevat tämän.
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDF2F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1725" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fi" dir="ltr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

If the build rejects the `axes: ["opsz"]` option or the variable-font weight inference, fall back to explicit weights:
`Familjen_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], ... })` and
`Newsreader({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], ... })`.

- [ ] **Step 3: Replace `app/page.tsx` with the static chrome**

The `<header>` element is dropped as a wrapper around the interactive parts — no CSS rule targets `header`, and keeping it would put `<main>` inside `<header>`, which is invalid.

```tsx
export default function Page() {
  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Kouluruoka</p>
        <h1>Meilahden ala-aste</h1>
      </header>

      <footer>
        <div className="key">
          <span>
            <b className="mark veg">Veg</b> Vegaaninen
          </span>
          <span>
            <b className="mark heart">♥</b> Parempi valinta
          </span>
        </div>
        <p>
          Ruokalista haetaan Helsingin kaupungin Aromi-palvelusta. Tarkat
          allergeeni- ja erityisruokavaliotiedot löydät{" "}
          <a
            href="https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/"
            target="_blank"
            rel="noopener"
          >
            Aromin omalta sivulta
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
```

Note the "Powered by Puter" line from the old footer is gone.

- [ ] **Step 4: Verify visually**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: the paper-coloured background, "KOULURUOKA" eyebrow in Familjen Grotesk, the school name as a large heading, and the footer key with the green Veg and red ♥ badges. Toggle the OS to dark mode and confirm the palette flips.

Run: `npm run build`
Expected: succeeds, and the build log shows the two fonts being downloaded.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx
git commit -m "Lisää tyylit, fontit ja sivun kehys"
```

---

### Task 6: localStorage persistence

**Files:**
- Create: `lib/store.ts`
- Test: `lib/store.test.ts`

**Interfaces:**
- Consumes: `addDays`, `mondayOf`, `todayInHelsinki`, `toUTCDate`, `dayNum`, `monthNum`, `TIME_ZONE`, `WeekData`
- Produces:
  - `expectedMonday(offset: number): string`
  - `storeWeek(data: WeekData): void`
  - `readWeek(start: string): StoredWeek | null`
  - `pruneStore(): void`
  - `savedAtLabel(ts: number): string`
  - `interface StoredWeek { savedAt: number; data: WeekData }`

- [ ] **Step 1: Write the failing test**

Create `lib/store.test.ts`:

```ts
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
```

The time separator is asserted as `[.:]` rather than a literal `.` because the exact `fi-FI` separator depends on the ICU version bundled with Node.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./store"`.

- [ ] **Step 3: Create `lib/store.ts`**

```ts
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
```

`pruneStore` uses the indexed `localStorage.key(i)` API rather than `Object.keys(localStorage)` as the original did — `Object.keys` on a `Storage` object is a browser quirk that does not survive being tested against a stub, and collecting keys before deleting avoids shifting indices mid-loop.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all store tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts
git commit -m "Lisää viikkolistojen tallennus selaimeen"
```

---

### Task 7: Presentational components

**Files:**
- Create: `app/components/diet-marks.tsx`, `app/components/day-strip.tsx`, `app/components/week-nav.tsx`, `app/components/day-list.tsx`, `app/components/states.tsx`

**Interfaces:**
- Consumes: `dayNum`, `monthNum` from `@/lib/dates`; `WeekData`, `WeekDay` from `@/lib/types`
- Produces:
  - `<DietMarks diets={string} />`
  - `<DayStrip days={WeekDay[]} today={string} onSelect={(date: string) => void} />`
  - `<WeekNav data={WeekData | null} onPrev={() => void} onNext={() => void} />`
  - `<DayList data={WeekData} today={string} />`
  - `<Skeleton />`, `<ErrorState onRetry={() => void} />`, `<StaleBanner savedAt={number | null} />`

These are plain presentational functions. They carry no `'use client'` directive of their own — they inherit client-ness from `week-view.tsx`, which imports them.

- [ ] **Step 1: Create `app/components/diet-marks.tsx`**

```tsx
/** Sivu näyttää Aromin koodeista vain vegaanisen ja "paremman valinnan". */
export function DietMarks({ diets }: { diets: string }) {
  const list = (diets || "").split(",").map((s) => s.trim());
  const veg = list.includes("Veg");
  const heart = list.includes("♥");

  if (!veg && !heart) return null;

  return (
    <span className="marks">
      {veg && (
        <b className="mark veg" title="Vegaaninen">
          Veg
        </b>
      )}
      {heart && (
        <b className="mark heart" title="Parempi valinta">
          ♥
        </b>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Create `app/components/day-strip.tsx`**

```tsx
import { dayNum } from "@/lib/dates";
import type { WeekDay } from "@/lib/types";

export function DayStrip({
  days,
  today,
  onSelect,
}: {
  days: WeekDay[];
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <ol className="strip">
      {days.map((d) => {
        const cls = [
          d.options.length ? "" : "empty",
          d.date === today ? "now" : "",
          d.date < today ? "past" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={d.date}>
            <button className={cls} onClick={() => onSelect(d.date)}>
              <span className="wd">{d.weekday}</span>
              <span className="dn">{dayNum(d.date)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Create `app/components/week-nav.tsx`**

```tsx
import { dayNum, monthNum } from "@/lib/dates";
import type { WeekData } from "@/lib/types";

export function WeekNav({
  data,
  onPrev,
  onNext,
}: {
  data: WeekData | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <nav className="weeknav" aria-label="Viikon valinta">
      <button className="arrow" onClick={onPrev} aria-label="Edellinen viikko">
        ‹
      </button>
      <p aria-live="polite">
        {data ? `Viikko ${data.week}` : " "}
        <span className="range">
          {data
            ? `${dayNum(data.start)}.${monthNum(data.start)}.–${dayNum(data.end)}.${monthNum(data.end)}.`
            : " "}
        </span>
      </p>
      <button className="arrow" onClick={onNext} aria-label="Seuraava viikko">
        ›
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Create `app/components/day-list.tsx`**

```tsx
import { dayNum, monthNum } from "@/lib/dates";
import type { WeekData } from "@/lib/types";
import { DietMarks } from "./diet-marks";

export function DayList({ data, today }: { data: WeekData; today: string }) {
  const anyFood = data.days.some((d) => d.options.length);

  if (!anyFood) {
    return (
      <div className="state">
        <p>Tällä viikolla ei ole ruokailua.</p>
      </div>
    );
  }

  return (
    <>
      {data.days.map((d, i) => {
        const isToday = d.date === today;
        const past = d.date < today;
        const cls = ["day", isToday ? "today" : "", past ? "past" : ""]
          .filter(Boolean)
          .join(" ");

        // Jos tänään ei ole ruokailua, kerro milloin seuraava on.
        const upcoming = data.days.find(
          (n) => n.date > d.date && n.options.length,
        );

        return (
          <section
            key={d.date}
            className={cls}
            id={`d-${d.date}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <h2 className="dayhead">
              <span>
                {d.weekday} {dayNum(d.date)}.{monthNum(d.date)}.
              </span>
              {isToday && <span className="tag">Tänään</span>}
            </h2>

            {d.options.length > 0 ? (
              d.options.map((o, j) => (
                <div className="opt" key={j}>
                  <p className="main">
                    {o.main.join(" ja ")}
                    <DietMarks diets={o.diets} />
                  </p>
                  {o.sides.length > 0 && (
                    <p className="sides">{o.sides.join(" · ")}</p>
                  )}
                </div>
              ))
            ) : (
              <>
                <p className="none">Ei kouluruokailua</p>
                {isToday && upcoming && (
                  <p className="next">
                    Seuraava ruokailu{" "}
                    <b>
                      {upcoming.weekday} {dayNum(upcoming.date)}.
                      {monthNum(upcoming.date)}.
                    </b>
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Create `app/components/states.tsx`**

```tsx
import { savedAtLabel } from "@/lib/store";

export function Skeleton() {
  return (
    <div className="state skeleton" aria-label="Ladataan ruokalistaa">
      <span style={{ width: "40%" }} />
      <span style={{ width: "85%" }} />
      <span style={{ width: "60%" }} />
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state">
      <p>Ruokalistaa ei juuri nyt saatu haettua.</p>
      <button className="retry" onClick={onRetry}>
        Yritä uudelleen
      </button>
    </div>
  );
}

/** Näkyy vain kun haku epäonnistui ja ruudulla on tallennettu lista. */
export function StaleBanner({ savedAt }: { savedAt: number | null }) {
  if (savedAt === null) return null;
  return (
    <p className="stale" role="status">
      Ei yhteyttä — lista tallennettu {savedAtLabel(savedAt)}.
    </p>
  );
}
```

`StaleBanner` returns `null` instead of using the `hidden` attribute, so the `.stale[hidden] { display: none }` rule in the CSS becomes dead but harmless — leave it in place.

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/components/
git commit -m "Lisää näkymäkomponentit"
```

---

### Task 8: Client island and server fetch

**Files:**
- Create: `app/week-view.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: all of Task 7's components, `lib/store.ts`, `lib/dates.ts`, `lib/aromi.ts`, `lib/transform.ts`
- Produces: `<WeekView initialData={WeekData | null} serverToday={string} />`; a fully working page

- [ ] **Step 1: Create `app/week-view.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayInHelsinki } from "@/lib/dates";
import {
  expectedMonday,
  pruneStore,
  readWeek,
  storeWeek,
} from "@/lib/store";
import type { WeekData } from "@/lib/types";
import { DayList } from "./components/day-list";
import { DayStrip } from "./components/day-strip";
import { ErrorState, Skeleton, StaleBanner } from "./components/states";
import { WeekNav } from "./components/week-nav";

type Status = "ready" | "loading" | "error";

export function WeekView({
  initialData,
  serverToday,
}: {
  initialData: WeekData | null;
  serverToday: string;
}) {
  // Palvelimen laskema päivä ensirenderöintiin, jotta hydraatio täsmää.
  // Selain laskee sen uudelleen heti kiinnittymisen jälkeen.
  const [today, setToday] = useState(serverToday);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<WeekData | null>(initialData);
  const [status, setStatus] = useState<Status>(initialData ? "ready" : "loading");
  const [staleAt, setStaleAt] = useState<number | null>(null);

  const requestId = useRef(0);
  const loadedAt = useRef(initialData ? Date.now() : 0);
  const scrolledFor = useRef<string | null>(null);

  // silent = älä näytä latausluurankoa. Taustapäivitys ei saa tyhjentää ruutua.
  const load = useCallback(
    async (nextOffset: number, { silent = false } = {}) => {
      const myId = ++requestId.current;
      const saved = readWeek(expectedMonday(nextOffset));

      // Tallennettu lista ruudulle heti; verkko korjaa sen perässä.
      if (saved) {
        setData(saved.data);
        setStatus("ready");
        setStaleAt(null);
      } else if (!silent) {
        setStaleAt(null);
        setStatus("loading");
      }

      try {
        const res = await fetch(`/api/week?offset=${nextOffset}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const fresh = (await res.json()) as WeekData & { error?: string };
        if (fresh.error) throw new Error(fresh.error);
        if (myId !== requestId.current) return; // käyttäjä ehti vaihtaa viikkoa

        storeWeek(fresh);
        setData(fresh);
        setStatus("ready");
        setStaleAt(null);
        loadedAt.current = Date.now();
      } catch {
        if (myId !== requestId.current) return;
        if (saved) {
          setStaleAt(saved.savedAt);
        } else {
          setStaleAt(null);
          setStatus("error");
        }
      }
    },
    [],
  );

  useEffect(() => {
    pruneStore();
    setToday(todayInHelsinki());

    // Palvelimen renderöimä sivu voi tulla service workerin välimuistista ja
    // sisältää edellisen viikon listan. Siihen luotetaan vain jos se osuu
    // kuluvaan viikkoon — muuten haetaan kuten ilman alkudataa.
    if (initialData && initialData.start === expectedMonday(0)) return;
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Välilehti voi olla auki yön yli — päivitä kun siihen palataan.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && Date.now() - loadedAt.current > 10 * 60 * 1000) {
        setToday(todayInHelsinki());
        void load(offset, { silent: true });
      }
    };
    // Kotivalikosta avatussa sovelluksessa ei ole selaimen päivityspainiketta,
    // joten yhteyden palatessa lista haetaan itsestään.
    const onOnline = () => void load(offset, { silent: true });

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [load, offset]);

  // Avaa kuluva päivä näkyviin kerran viikkonäkymää kohden — ei joka
  // taustapäivityksellä, jottei sivu nykisi kesken lukemisen.
  useEffect(() => {
    if (!data || status !== "ready") return;
    if (data.start !== expectedMonday(0)) return;
    if (scrolledFor.current === data.start) return;
    scrolledFor.current = data.start;

    const el = document.querySelector<HTMLElement>(".day.today");
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [data, status]);

  const go = (delta: number) => {
    const next = offset + delta;
    setOffset(next);
    void load(next);
  };

  const scrollToDay = (date: string) => {
    const el = document.getElementById(`d-${date}`);
    // Tarkoituksella "instant": osassa selaimista pehmeä vieritys on kytketty
    // pois, jolloin smooth-pyyntö ei tee mitään ja painike jäisi kuolleeksi.
    if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
  };

  return (
    <>
      <WeekNav data={data} onPrev={() => go(-1)} onNext={() => go(1)} />
      {data && (
        <DayStrip days={data.days} today={today} onSelect={scrollToDay} />
      )}
      <StaleBanner savedAt={staleAt} />

      <main id="days">
        {status === "loading" && <Skeleton />}
        {status === "error" && <ErrorState onRetry={() => void load(offset)} />}
        {status === "ready" && data && <DayList data={data} today={today} />}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Modify `app/page.tsx` to fetch on the server**

Add the imports, the `revalidate` export and the data fetch, and drop `<WeekView>` in between the header and footer written in Task 5.

```tsx
import { fetchMenuRange } from "@/lib/aromi";
import { addDays, mondayOf, todayInHelsinki } from "@/lib/dates";
import { transformWeek } from "@/lib/transform";
import type { WeekData } from "@/lib/types";
import { WeekView } from "./week-view";

// Sivu renderöidään joka pyynnöllä, koska "tänään" vaihtuu. Aromin haku pysyy
// silti välimuistissa: revalidate = 0 ei kumoa fetchin omaa force-cachea,
// toisin kuin dynamic = "force-dynamic" tekisi.
export const revalidate = 0;

export default async function Page() {
  const today = todayInHelsinki();
  const monday = mondayOf(today);

  let week: WeekData | null = null;
  try {
    const apiData = await fetchMenuRange(monday, addDays(monday, 4));
    week = transformWeek(apiData, monday, today);
  } catch (err) {
    // Aromin katkos ei saa kaataa sivua — asiakaspuoli jatkaa tallennetusta
    // listasta tai näyttää virheilmoituksen.
    console.error("Aromi-haku epäonnistui palvelimella:", err);
  }

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Kouluruoka</p>
        <h1>Meilahden ala-aste</h1>
      </header>

      <WeekView initialData={week} serverToday={today} />

      <footer>
        <div className="key">
          <span>
            <b className="mark veg">Veg</b> Vegaaninen
          </span>
          <span>
            <b className="mark heart">♥</b> Parempi valinta
          </span>
        </div>
        <p>
          Ruokalista haetaan Helsingin kaupungin Aromi-palvelusta. Tarkat
          allergeeni- ja erityisruokavaliotiedot löydät{" "}
          <a
            href="https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/"
            target="_blank"
            rel="noopener"
          >
            Aromin omalta sivulta
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify the server render**

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3000/ | grep -c 'class="day'
curl -s http://localhost:3000/ | grep -o 'Viikko [0-9]*' | head -1
```

Expected: a non-zero count of `class="day"` elements and a `Viikko NN` label **in the raw HTML** — this is the whole point of the hybrid render. If the count is 0 during a school holiday, confirm `/api/week?offset=0` also returns empty days before treating it as a failure.

- [ ] **Step 4: Verify the interactive behaviour in a browser**

Open `http://localhost:3000` and check each:
1. The week loads with no skeleton flash.
2. `›` and `‹` move between weeks and the label updates.
3. Clicking a day in the strip scrolls to that day's section.
4. Today's card has the orange left border and the "Tänään" tag.
5. In DevTools → Application → Local Storage, keys named `aromi:week:YYYY-MM-DD` appear.
6. In DevTools → Network, switch to Offline, then press `‹` and `›` back to the current week: the stored list renders and the line "Ei yhteyttä — lista tallennettu …" appears under the strip.
7. Check the console for hydration warnings. There must be none.

- [ ] **Step 5: Run the full check**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/week-view.tsx app/page.tsx
git commit -m "Lisää viikkonäkymä ja palvelimella renderöity ensilataus"
```

---

### Task 9: PWA — manifest, icons and service worker

**Files:**
- Move: `icons/` → `public/icons/`
- Create: `app/manifest.ts`, `app/sw.ts`, `app/serwist/[path]/route.ts`, `app/~offline/page.tsx`
- Modify: `package.json`, `next.config.mjs`, `app/layout.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: an installable, offline-capable app; `/manifest.webmanifest`; a service worker at `/serwist/sw.js`

- [ ] **Step 1: Move the icons**

```bash
mkdir -p public
git mv icons public/icons
```

`public/icons/render.sh` needs no edit — it does `cd "$(dirname "$0")"` and uses relative paths throughout.

- [ ] **Step 2: Install Serwist**

```bash
npm i -D @serwist/turbopack@9.5.12 serwist@9.5.12 esbuild
```

- [ ] **Step 3: Create `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meilahden ala-aste — ruokalista",
    short_name: "Ruokalista",
    description:
      "Meilahden ala-asteen kouluruokalista viikoittain. Tiedot Helsingin kaupungin Aromi-palvelusta.",
    lang: "fi",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EDF2F9",
    theme_color: "#EDF2F9",
    categories: ["food", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

Next adds `<link rel="manifest" href="/manifest.webmanifest">` automatically when this file exists — do not add it by hand.

- [ ] **Step 4: Create `app/~offline/page.tsx`**

```tsx
export default function Offline() {
  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Kouluruoka</p>
        <h1>Meilahden ala-aste</h1>
      </header>
      <div className="state">
        <p>Ei verkkoyhteyttä. Ruokalista näkyy taas kun yhteys palaa.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/sw.ts`**

The one non-default part is the `NetworkOnly` rule ahead of `defaultCache`. Serwist matches rules in order, and `defaultCache` contains a `NetworkFirst` handler for `sameOrigin && pathname.startsWith("/api/")` — which would cache the menu and serve last week's list as this week's.

```ts
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Ruokalistaa ei säilötä koskaan. Osoite /api/week?offset=0 tarkoittaa
      // eri viikkoa eri päivinä, joten välimuisti tarjoilisi viime viikon
      // listan tämän viikon kohdalle. Tämän on oltava ennen defaultCachea,
      // jossa /api/ on NetworkFirst.
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
```

- [ ] **Step 6: Create `app/serwist/[path]/route.ts`**

```ts
import { createSerwistRoute } from "@serwist/turbopack";

// Vercel asettaa commitin tunnisteen, joten offline-sivu esisäilötään
// uudelleen jokaisella julkaisulla. Paikallisesti riittää kiinteä arvo.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
```

The Serwist docs show `spawnSync("git", ["rev-parse", "HEAD"])` here. Use the environment variable instead — it works on Vercel without assuming `.git` is present in the build container, and it stays stable across server instances (`crypto.randomUUID()` would not).

- [ ] **Step 7: Wire Serwist into `next.config.mjs`**

```js
import { withSerwist } from "@serwist/turbopack";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSerwist(nextConfig);
```

- [ ] **Step 8: Add `SerwistProvider` to `app/layout.tsx`**

Add the import and wrap the children. Everything else in the file stays as written in Task 5.

```tsx
import { SerwistProvider } from "@serwist/turbopack/react";
```

```tsx
    <html lang="fi" dir="ltr" className={`${display.variable} ${body.variable}`}>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
      </body>
    </html>
```

- [ ] **Step 9: Build and verify**

Run: `npm run build && npm run start`

Then in a browser at `http://localhost:3000`:
1. DevTools → Application → Manifest: name "Meilahden ala-aste — ruokalista", three icons render.
2. DevTools → Application → Service Workers: one activated worker.
3. DevTools → Network, reload, and confirm `/api/week?offset=0` shows **no** "(ServiceWorker)" in its Size column. This is the critical check — if it is served from the worker, the `NetworkOnly` rule is not matching.
4. Go offline and reload: the page shell renders from cache with the stored week.

**If `@serwist/turbopack` fails to build:** stop and report rather than fighting it. The documented fallback is `@serwist/cli` as a `postbuild` script, which is bundler-agnostic. Do not spend more than one attempt.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json next.config.mjs app/ public/
git commit -m "Lisää PWA-tuki Serwistillä"
```

---

### Task 10: Remove Puter and rewrite the README

**Files:**
- Delete: `worker.js`, `index.html`, `sw.js`, `manifest.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: a repository with a single deployment target

- [ ] **Step 1: Delete the Puter-era files**

```bash
git rm worker.js index.html sw.js manifest.json
```

`TRMNL plugin.html`, `screenshot.png` and `.claude/` stay.

- [ ] **Step 2: Verify nothing referenced them**

Run: `grep -rn "puter\|WORKER_URL\|sw\.js\|manifest\.json" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" --exclude-dir=node_modules --exclude-dir=.next . | grep -v package-lock`
Expected: no hits outside `README.md` and `docs/`.

- [ ] **Step 3: Update the README's architecture diagram**

Replace the diagram under "## Miten se toimii" with:

```
                    ┌─────────────────────┐
TRMNL-näyttö  ──────┤                     │
                    │   Next.js / Vercel  ├────►  Aromi API (aromi.hel.fi)
Verkkosivu    ──────┤                     │
                    └─────────────────────┘

GET /api/menu   →  { date, meals }          päivän lista, TRMNL
GET /api/week   →  { week, days[5], … }     koko viikko, verkkosivu
```

And replace the three bullets below it with:

```markdown
- **`lib/`** hakee ruokalistan Aromista ja muuntaa sen yksinkertaiseksi JSONiksi.
- **`TRMNL plugin.html`** renderöi päivän listan e-ink -näytölle Jinja2-templatella.
- **`app/`** on Next.js-sovellus: viikkonäkymä ja molemmat API-reitit samassa
  osoitteessa.
```

- [ ] **Step 4: Replace the file table**

```markdown
| Tiedosto | Kuvaus |
|---|---|
| `app/page.tsx` | Viikkonäkymä, palvelin hakee kuluvan viikon valmiiksi |
| `app/week-view.tsx` | Selainpuoli: viikon vaihto, tallennus, offline-tila |
| `app/api/menu/` | Päivän lista TRMNL:lle |
| `app/api/week/` | Koko viikko verkkosivulle |
| `lib/` | Aromi-haku, päivämäärälogiikka ja muunnokset testeineen |
| `app/sw.ts` | Service worker, säilöö sivupohjan offline-käyttöä varten |
| `public/icons/` | Sovellusikonit — lähde `icon.svg`, siitä renderöidyt PNG:t |
| `TRMNL plugin.html` | Jinja2-template TRMNL-näytölle |
```

- [ ] **Step 5: Replace the "## Asennus" section**

```markdown
## Asennus

### 1. Kehitysympäristö

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # lib/-kansion yksikkötestit
```

### 2. Julkaisu Verceliin

```bash
npx vercel        # esikatselu
npx vercel --prod # tuotanto
```

Ympäristömuuttujia ei tarvita — Aromi-portaalin tunnisteet ovat
`lib/aromi.ts`-tiedostossa.

### 3. TRMNL Plugin

1. Luo [TRMNL Developer](https://usetrmnl.com/plugin/new)-sivulla uusi Private Plugin
2. Strategiaksi valitse **Webhook/Polling** ja syötä oman julkaisusi osoite
   (`https://<projekti>.vercel.app/api/menu`)
3. Kopioi `TRMNL plugin.html` sisältö pluginin **Markup**-kenttään
```

- [ ] **Step 6: Update the offline section**

In "## Sovelluksena puhelimessa", replace the paragraph beginning "Sivupohja päivittyy itsestään" and the `sw.js`/`VERSION` sentence with:

```markdown
Service worker rakennetaan `app/sw.ts`-lähteestä Serwistillä, joka laskee
esisäilötyt tiedostot käännöksen tuloksesta — versionumeroa ei tarvitse
ylläpitää käsin. Fontit tulevat `next/font`-paketin kautta omalta palvelimelta,
joten erillistä fonttivälimuistia ei ole.
```

The paragraph explaining why the menu is never service-worker-cached stays as it is — it is still true, and it is now enforced by the `NetworkOnly` rule in `app/sw.ts`.

- [ ] **Step 7: Update "## Teknologiat"**

```markdown
- [TRMNL](https://trmnl.com/) - e-ink -näyttöalusta
- [Next.js](https://nextjs.org/) - sovelluskehys
- [Vercel](https://vercel.com/) - julkaisualusta
- [Aromi](https://aromi.hel.fi/) - Helsingin kaupungin ruokalistajärjestelmä
```

- [ ] **Step 8: Update the "toisen koulun käyttöönotto" section**

Change the sentence "Muokkaa `worker.js`-tiedoston yläreunan vakioita" to "Muokkaa `lib/aromi.ts`-tiedoston yläreunan vakioita", and `RESTAURANT_NAME` (ja `index.html`-tiedoston otsikot)` to `RESTAURANT_NAME` (ja otsikot `app/page.tsx`- ja `app/layout.tsx`-tiedostoissa)`.

The `## API` and `## Ruokavaliomerkinnät` sections are unchanged — the response shapes did not change.

- [ ] **Step 9: Full verification**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Poista Puter-tiedostot ja päivitä README"
```

---

### Task 11: Deploy and cut over

**Files:**
- Create: `.vercel/` (generated by the CLI, already gitignored)

**Interfaces:**
- Consumes: the finished app
- Produces: a live URL for the TRMNL plugin to poll

- [ ] **Step 1: Deploy a preview**

```bash
npx vercel
```

Accept the defaults; the framework should be auto-detected as Next.js.

- [ ] **Step 2: Verify the preview deployment**

Against the preview URL the CLI prints:

```bash
PREVIEW=<url-from-cli>
curl -s "$PREVIEW/api/menu" | head -c 400; echo
curl -s "$PREVIEW/api/week?offset=0" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["restaurant"], d["week"], len(d["days"]))'
curl -s "$PREVIEW/" | grep -c 'class="day'
curl -s "$PREVIEW/manifest.webmanifest" | head -c 200; echo
```

Expected: the menu JSON, `Meilahden ala-aste <week> 5`, a non-zero day count in the server-rendered HTML, and the manifest JSON.

Then open the preview URL on a phone and confirm the page renders and installs to the home screen.

- [ ] **Step 3: Deploy to production**

```bash
npx vercel --prod
```

- [ ] **Step 4: Verify production**

Repeat the Step 2 checks against the production URL.

- [ ] **Step 5: Repoint TRMNL**

This step is done by hand in the TRMNL UI, not in code:

1. Open the plugin at <https://usetrmnl.com/plugins>
2. Change the polling URL from `https://aromi.puter.work/api/menu` to
   `https://<projekti>.vercel.app/api/menu`
3. Force a refresh and confirm the display shows today's menu
4. `TRMNL plugin.html` itself needs no change

- [ ] **Step 6: Retire Puter**

Only after Step 5 is confirmed working on the device: delete the Puter Worker and the Puter-hosted site from the Puter dashboard.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "Siirry Verceliin" --allow-empty
git push
```

---

## Notes for the implementer

**Things that will bite if changed carelessly:**

1. `cache: "force-cache"` on the Aromi fetch is not decoration. Removing it means every page view and every TRMNL poll hits `aromi.hel.fi`.
2. `export const revalidate = 0` must not be "simplified" to `dynamic = "force-dynamic"`. Per the Next docs they are not equivalent: `force-dynamic` implies `fetchCache = "force-no-store"`, which overrides `force-cache`.
3. The `NetworkOnly` rule in `app/sw.ts` must stay **before** `...defaultCache`.
4. `WeekView` must not fetch on mount when the server already supplied the current week, but it must fetch when the server data is for a different week — that guard is what makes a service-worker-cached HTML page safe.
5. `today` is a prop on first render and state afterwards. Computing it during render on the client would risk a hydration mismatch across midnight.
