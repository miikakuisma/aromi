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
