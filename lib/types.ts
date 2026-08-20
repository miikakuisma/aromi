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
  /** Vain tiedoksi. Asiakas muotoilee otsikon itse dayNum/monthNum-funktioilla. */
  label: string;
  /**
   * Vain tiedoksi. Asiakas laskee kuluvan päivän itse, koska tallennettu lista
   * voi olla eiliseltä — silloin tämä kenttä korostaisi väärän päivän.
   */
  isToday: boolean;
  options: DayOption[];
}

/** GET /api/week — verkkosivu lukee tätä. */
export interface WeekData {
  restaurant: string;
  week: number;
  start: string;
  end: string;
  /**
   * Vain tiedoksi. Asiakas laskee kuluvan päivän itse samasta syystä kuin
   * WeekDay.isToday kohdalla.
   */
  today: string;
  days: WeekDay[];
}
