import { fetchMenuRange } from "@/lib/aromi";
import { addDays, mondayOf, todayInHelsinki } from "@/lib/dates";
import { transformWeek } from "@/lib/transform";
import type { WeekData } from "@/lib/types";
import { WeekView } from "./week-view";

// Sivu renderöidään joka pyynnöllä, koska "tänään" vaihtuu. Aromin haku pysyy
// silti välimuistissa: revalidate = 0 ei kumoa fetchin omaa force-cachea,
// toisin kuin dynamic = "force-dynamic" tekisi.
export const revalidate = 0;

export default async function Page() {
  const today = todayInHelsinki();
  const monday = mondayOf(today);

  let week: WeekData | null = null;
  try {
    const apiData = await fetchMenuRange(monday, addDays(monday, 4));
    week = transformWeek(apiData, monday, today);
  } catch (err) {
    // Aromin katkos ei saa kaataa sivua — asiakaspuoli jatkaa tallennetusta
    // listasta tai näyttää virheilmoituksen.
    console.error("Aromi-haku epäonnistui palvelimella:", err);
  }

  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Kouluruoka</p>
        <h1>Meilahden ala-aste</h1>
      </header>

      <WeekView initialData={week} serverToday={today} />

      <footer>
        <div className="key">
          <span>
            <b className="mark veg">Veg</b> Vegaaninen
          </span>
          <span>
            <b className="mark heart">♥</b> Parempi valinta
          </span>
        </div>
        <p>
          Ruokalista haetaan Helsingin kaupungin Aromi-palvelusta. Tarkat
          allergeeni- ja erityisruokavaliotiedot löydät{" "}
          <a
            href="https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/"
            target="_blank"
            rel="noopener"
          >
            Aromin omalta sivulta
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
