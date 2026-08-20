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
