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
