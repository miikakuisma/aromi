// Aromi Menu Parser — Puter Worker

// Meilahden ala-aste, Aromi-portaali KeMenu054, ruokailijaryhmä "Ala-Aste"
const API_BASE = "https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/api/Common/Restaurant/RestaurantMeals";
const RESTAURANT_ID = "737d9be1-762c-48d9-a8a7-732567590165";
const DINER_GROUP_ID = "178ca380-3d70-4ee8-b1b6-277aefa17455";
const DIET_GROUP_ID = "bfe0b425-95a6-47b3-8b4f-adc80ab28a1b";

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
