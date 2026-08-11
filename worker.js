// Aromi Menu Parser — Puter Worker
//
// GET /api/menu          Tämän päivän ruokalista (TRMNL-plugin käyttää tätä)
// GET /api/week[?offset] Koko viikon ruokalista (verkkosivu käyttää tätä)

// Meilahden ala-aste, Aromi-portaali KeMenu054, ruokailijaryhmä "Ala-Aste"
const API_BASE = "https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/api/Common/Restaurant/RestaurantMeals";
const RESTAURANT_ID = "737d9be1-762c-48d9-a8a7-732567590165";
const DINER_GROUP_ID = "178ca380-3d70-4ee8-b1b6-277aefa17455";
const DIET_GROUP_ID = "bfe0b425-95a6-47b3-8b4f-adc80ab28a1b";

const RESTAURANT_NAME = "Meilahden ala-aste";
const TIME_ZONE = "Europe/Helsinki";
const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];

const REQUEST_BODY = {
  DinerGroupId: DINER_GROUP_ID,
  DietGroupId: DIET_GROUP_ID,
  SuitabilityDietIds: [],
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
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

// --- Päivämäärät ------------------------------------------------------------
// Kaikki päivämäärät ovat "YYYY-MM-DD"-merkkijonoja ja laskenta tehdään UTC:ssä,
// jolloin aikavyöhyke ei pääse siirtämään päivää. Ainoa kohta jossa vyöhykkeellä
// on merkitystä on "mikä päivä Suomessa on nyt".

function todayInHelsinki() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // Jos ajoympäristöstä puuttuu aikavyöhyketuki, UTC+3 osuu Suomen kesäaikaan.
    return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

function toUTCDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(ymd, days) {
  const date = toUTCDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// 0 = maanantai, 6 = sunnuntai
function weekdayIndex(ymd) {
  return (toUTCDate(ymd).getUTCDay() + 6) % 7;
}

function mondayOf(ymd) {
  return addDays(ymd, -weekdayIndex(ymd));
}

function isoWeekNumber(ymd) {
  const thursday = toUTCDate(addDays(mondayOf(ymd), 3));
  const firstThursday = toUTCDate(addDays(mondayOf(`${thursday.getUTCFullYear()}-01-04`), 3));
  return 1 + Math.round((thursday - firstThursday) / (7 * 86400 * 1000));
}

function formatDay(ymd) {
  const date = toUTCDate(ymd);
  return `${date.getUTCDate()}.${date.getUTCMonth() + 1}.`;
}

// --- Aromi ------------------------------------------------------------------

async function fetchMenuRange(startYmd, endYmd) {
  const url = `${API_BASE}?Id=${RESTAURANT_ID}&StartDate=${startYmd}T00:00:00&EndDate=${endYmd}T00:00:00`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(REQUEST_BODY),
  });

  if (!response.ok) {
    throw new Error(`Aromi API returned ${response.status}`);
  }

  return response.json();
}

// Aromi jakaa annoksen osiin: pienin PartOfMealIndexNumber on pääruoka, loput
// lisukkeita. Siitä saadaan sivulle kaksitasoinen esitys ilman arvailua.
function splitDishes(dishes) {
  const sorted = [...dishes].sort(
    (a, b) =>
      a.PartOfMealIndexNumber - b.PartOfMealIndexNumber ||
      a.DishIndexNumber - b.DishIndexNumber
  );
  if (sorted.length === 0) return { main: [], sides: [], diets: "" };

  const mainPart = sorted[0].PartOfMealIndexNumber;
  const mainDishes = sorted.filter((d) => d.PartOfMealIndexNumber === mainPart);

  const diets = [
    ...new Set(
      mainDishes
        .flatMap((d) => (d.DietDetails || "").split(","))
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];

  return {
    main: mainDishes.map((d) => d.DishName),
    sides: sorted.filter((d) => d.PartOfMealIndexNumber !== mainPart).map((d) => d.DishName),
    diets: diets.join(", "),
  };
}

// --- /api/menu (TRMNL) ------------------------------------------------------

function transformMenu(apiData) {
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

// --- /api/week (verkkosivu) -------------------------------------------------

function transformWeek(apiData, monday, today) {
  const byDate = new Map();
  if (Array.isArray(apiData)) {
    for (const day of apiData) {
      byDate.set(String(day.Date).slice(0, 10), day);
    }
  }

  const days = [];
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

// --- Reitit -----------------------------------------------------------------

router.get("/api/menu", async () => {
  try {
    const today = todayInHelsinki();
    const apiData = await fetchMenuRange(today, today);
    return jsonResponse(transformMenu(apiData));
  } catch (err) {
    return jsonResponse({ error: err.message }, 502);
  }
});

router.get("/api/week", async ({ request }) => {
  try {
    const offset = Number(new URL(request.url).searchParams.get("offset")) || 0;
    const today = todayInHelsinki();
    const monday = addDays(mondayOf(today), offset * 7);
    const apiData = await fetchMenuRange(monday, addDays(monday, 4));
    return jsonResponse(transformWeek(apiData, monday, today));
  } catch (err) {
    return jsonResponse({ error: err.message }, 502);
  }
});
