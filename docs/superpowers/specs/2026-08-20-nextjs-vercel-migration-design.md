# Aromi: Puter → Next.js on Vercel

**Date:** 2026-08-20
**Status:** Approved, ready for implementation planning

## Context

The project serves the Meilahti primary school lunch menu (Helsinki's Aromi
system) to two consumers: a TRMNL e-ink display and a mobile web page.

Current deployment is entirely on Puter:

| File | Role |
|---|---|
| `worker.js` | Puter Worker. Fetches Aromi, exposes `/api/menu` and `/api/week`. |
| `index.html` | Self-contained page: inline CSS, inline vanilla JS, week view. |
| `sw.js` | Hand-written service worker. Precaches shell + Google Fonts. |
| `manifest.json` | PWA manifest. |
| `icons/` | App icons, rendered from `icon.svg` by `render.sh`. |
| `TRMNL plugin.html` | Liquid template for the e-ink display. |

The page reaches the worker cross-origin via a hardcoded `WORKER_URL`
(`https://aromi.puter.work`). TRMNL polls the same worker.

## Goals

1. Run the whole thing as one Next.js 16 app on Vercel — page and API together,
   same origin.
2. Keep the two API response shapes byte-for-byte identical, so
   `TRMNL plugin.html` needs no edits.
3. Preserve the deliberate offline-first behaviour of the current page.
4. Improve first paint: server-render the current week instead of showing a
   skeleton while client JS fetches.

## Non-goals

- No visual redesign. The existing CSS carries over essentially verbatim.
- No change to `TRMNL plugin.html`.
- No support for schools other than Meilahti (the README already documents how
  to repoint the constants).

## Decisions

These were settled during brainstorming; recording the rationale so they are not
relitigated mid-implementation.

| Decision | Choice | Why |
|---|---|---|
| UI port | Hybrid: server component fetches, client island handles interaction | Real menu in the first paint, while keeping localStorage/offline behaviour that a pure server render cannot provide |
| Language | TypeScript | Aromi returns loosely-structured data (`PartOfMealIndexNumber`, `DietDetails` as a comma string); types make the parsing safe to change |
| PWA | Keep, via `@serwist/turbopack` | Next 16 defaults to Turbopack; the common `@serwist/next` is webpack-only |
| Puter | Full replacement | One deployment target, one copy of the Aromi logic |

**Language of prose in code:** the existing codebase comments and all
user-facing strings are Finnish. New code follows the same convention —
Finnish comments, Finnish UI strings. This spec and the implementation plan are
English.

## Architecture

```
app/
  layout.tsx          <html lang="fi">, metadata, next/font wiring
  page.tsx            server component — fetch week 0, render <WeekView>
  week-view.tsx       'use client' — nav, localStorage, stale banner, render
  globals.css         existing CSS, verbatim except font-family vars
  manifest.ts         replaces manifest.json
  sw.ts               Serwist service worker source
  api/
    menu/route.ts     TRMNL:  { date, meals }
    week/route.ts     web:    { restaurant, week, start, end, today, days[5] }
lib/
  aromi.ts            constants, fetchMenuRange, splitDishes
  dates.ts            todayInHelsinki, toUTCDate, addDays, weekdayIndex,
                      mondayOf, isoWeekNumber, formatDay
  transform.ts        transformMenu, transformWeek
  types.ts            AromiDish, AromiMeal, AromiDay, MenuData, WeekData
public/
  icons/              moved from ./icons (render.sh paths updated)
TRMNL plugin.html     untouched
docs/superpowers/specs/
```

Removed at the end of the migration: `worker.js`, `index.html`, `sw.js`,
`manifest.json`, top-level `icons/`.

### Data layer

`lib/` is the single source of Aromi knowledge, shared by the API routes and the
server-rendered page. The logic is a direct port of `worker.js` — same
constants, same `splitDishes` main/side split on `PartOfMealIndexNumber`, same
UTC-based date arithmetic with `Europe/Helsinki` used only to answer "what day
is it in Finland right now".

`fetchMenuRange(start, end)` issues the Aromi POST with
`next: { revalidate: 3600 }`. Cache keys include the date range, so entries
expire naturally as weeks roll over.

### Rendering

`app/page.tsx` (server):

1. `todayInHelsinki()` → `mondayOf(today)`.
2. `fetchMenuRange(monday, monday+4)` → `transformWeek(...)`.
3. On success render `<WeekView initialData={week} serverToday={today} />`.
4. On failure catch, log, and render `<WeekView initialData={null} serverToday={today} />`.
   Aromi being down must never produce a 500.

The static chrome stays on the server. `page.tsx` renders the `.eyebrow` /
`<h1>` header text and the whole `<footer>` (diet key, Aromi link) as plain
server-rendered markup — none of it is interactive, so none of it belongs in the
client bundle.

`app/week-view.tsx` (`'use client'`, still server-rendered during SSR) owns
everything that changes: the week navigation, the day strip, the week label, the
stale banner, the day sections, and the loading/error states. It is a port of
the render functions in `index.html`, converted from string templates to JSX.
The manual `esc()` helper disappears; JSX escapes by default.

Two correctness details:

- **`today` comes in as a prop from the server, and is recomputed client-side in
  an effect after mount.** Computing it during render on both sides risks a
  hydration mismatch across midnight. The existing rule — never trust a *cached*
  `today` — is preserved, because the effect overrides any stored value.
- **No fetch on mount when `offset === 0` and `initialData` is present.** The
  server data is already fresh. Fetching is triggered only by week navigation,
  `visibilitychange` after 10 minutes, and the `online` event.

localStorage handling (`aromi:week:<monday>` keys, `savedAt` timestamps,
28-day pruning, stale banner wording) ports unchanged.

### API routes

Both return the exact JSON shapes documented in the README. Headers match the
current worker:

- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: public, max-age=120` on success, `no-store` on error
- `Access-Control-Allow-Origin: *` — kept so the live Puter page keeps working
  during cutover, and harmless afterwards
- Errors return HTTP 502 with `{ "error": "<message>" }`

Default Node.js runtime. `/api/week` reads `?offset=` exactly as today.

### Fonts

`next/font/google` self-hosts Familjen Grotesk and Newsreader, exposing them as
CSS variables consumed by `--display` and `--body` in `globals.css`. This
removes two `preconnect`s plus a render-blocking external stylesheet, and
deletes the entire `FONT_CACHE` half of the old service worker — fonts become
ordinary precached build assets.

### PWA

`@serwist/turbopack` generates the precache manifest from real build output, so
hashed chunk names are handled automatically.

The one rule that must survive explicitly: **`/api/*` is `NetworkOnly`.** The
menu is never service-worker-cached, because `?offset=0` denotes a different
week on different days and a cached response would show last week's menu as this
week's. localStorage keyed by the week's Monday remains the only menu
persistence.

`app/manifest.ts` reproduces the current manifest. `start_url` and `scope`
become `/` (were `./`).

### Testing

The project currently has none. Vitest, covering the pure functions that are
most likely to break silently:

- `lib/dates.ts` — `isoWeekNumber` at year boundaries (a 53-week year, Jan 1
  falling in the previous ISO year), `mondayOf` across a Sunday, `addDays`
  across a DST transition.
- `lib/transform.ts` — `splitDishes` main/side split, deduplication of
  `DietDetails`, `transformWeek` returning five days when Aromi returns fewer,
  `transformMenu` stripping trailing dots from `MealName`.

Tested against a captured Aromi response fixture so the suite does not depend on
the live service.

### Tooling baseline

npm, matching the developer's existing setup (no lockfile exists today, so
nothing is being migrated). Pinned starting points: `next@16.3.1`,
`react@19.2.8`, `@serwist/turbopack@9.5.12`, TypeScript 5, Vitest. Node 22.

## Deployment and cutover

1. Deploy to Vercel.
2. Repoint the TRMNL plugin's polling URL from
   `https://aromi.puter.work/api/menu` to `https://<project>.vercel.app/api/menu`.
   This is a setting in the TRMNL plugin UI, not a code change.
3. Puter stays live until step 2 is confirmed working.
4. Rewrite the README for Vercel: file table, setup steps, technologies. The
   Aromi API documentation and the "adopting another school" section carry over
   unchanged.

## Risks

**`@serwist/turbopack` is the less-travelled Serwist integration.** If it does
not work cleanly with Next 16.3, the fallback is `@serwist/cli` run as a
`postbuild` script — bundler-agnostic and unaffected by Turbopack. Decide within
one attempt rather than fighting it.

Everything else is well-trodden: an App Router page, two route handlers, and a
set of pure functions ported from working code.
