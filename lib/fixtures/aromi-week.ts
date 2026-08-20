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
