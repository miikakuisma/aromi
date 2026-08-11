// Aromi Menu Parser — Puter Worker

// ─── Aromi-kohde: Meilahden ala-aste (Helsingin kaupungin peruskoulu) ───
// Vaihda nämä arvot toiseen kouluun tarvittaessa. Kaikki arvot löytyvät koulun
// Aromi-sivun DevTools-työkalusta: F12 > Network > lataa sivu ja avaa ruokalista
// > etsi pyyntö "RestaurantMeals" ja klikkaa sitä:
//   - MENU_PORTAL    : pyynnön URL:sta polku ennen /api/... (esim. "KeMenu054")
//   - RESTAURANT_ID  : pyynnön URL:n "Id="-parametri
//   - DINER_GROUP_ID : Request Body -kentän "DinerGroupId"
//   - DIET_GROUP_ID  : Request Body -kentän "DietGroupId"
const MENU_PORTAL = "KeMenu054"; // Meilahden ala-aste
const RESTAURANT_ID = "PASTE_RESTAURANT_ID_HERE";
const DINER_GROUP_ID = "PASTE_DINER_GROUP_ID_HERE";
const DIET_GROUP_ID = "PASTE_DIET_GROUP_ID_HERE";

const API_BASE = `https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/${MENU_PORTAL}/api/Common/Restaurant/RestaurantMeals`;
const REQUEST_BODY = {
  DinerGroupId: DINER_GROUP_ID,
  DietGroupId: DIET_GROUP_ID,
  SuitabilityDietIds: [],
};

function assertConfigured() {
  const missing = [
    ["RESTAURANT_ID", RESTAURANT_ID],
    ["DINER_GROUP_ID", DINER_GROUP_ID],
    ["DIET_GROUP_ID", DIET_GROUP_ID],
  ].filter(([, value]) => !value || value.startsWith("PASTE_"));

  if (missing.length > 0) {
    const names = missing.map(([name]) => name).join(", ");
    throw new Error(
      `Aromi-tunnisteet puuttuvat: ${names}. Täytä arvot worker.js-tiedoston yläreunaan (ohjeet kommenteissa).`
    );
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function normalizeKey(mealName) {
  return mealName
    .replace(/\.+$/, "")
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

function toISODate(date) {
  return date.toISOString().split("T")[0] + "T00:00:00";
}

async function fetchTodayMenu() {
  assertConfigured();

  const today = new Date();
  const dateParam = toISODate(today);

  const url = `${API_BASE}?Id=${RESTAURANT_ID}&StartDate=${dateParam}&EndDate=${dateParam}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(REQUEST_BODY),
  });

  if (!response.ok) {
    throw new Error(`Aromi API returned ${response.status}`);
  }

  return response.json();
}

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

router.get("/api/menu", async () => {
  try {
    const apiData = await fetchTodayMenu();
    const menu = transformMenu(apiData);
    return jsonResponse(menu);
  } catch (err) {
    return jsonResponse({ error: err.message }, 502);
  }
});
