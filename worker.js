// Aromi Menu Parser — Puter Worker

const API_BASE = "https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/PKeMenu/api/Common/Restaurant/RestaurantMeals";
const RESTAURANT_ID = "d0b180f3-9496-4d03-a59e-b485573ad054";
const REQUEST_BODY = {
  DinerGroupId: "7c7f4abb-5459-48bc-b211-72573511a250",
  DietGroupId: "0943dc9b-5775-4fd2-b319-571cefb15fd5",
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
