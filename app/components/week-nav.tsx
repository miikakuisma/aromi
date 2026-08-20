import { dayNum, monthNum } from "@/lib/dates";
import type { WeekData } from "@/lib/types";

export function WeekNav({
  data,
  onPrev,
  onNext,
}: {
  data: WeekData | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <nav className="weeknav" aria-label="Viikon valinta">
      <button className="arrow" onClick={onPrev} aria-label="Edellinen viikko">
        ‹
      </button>
      {/* Paikanvaraaja on sitova välilyönti: tavallinen välilyönti romahtaisi
          pois eikä varaisi tilaa, jolloin lista hyppäisi latauksen valmistuttua. */}
      <p aria-live="polite">
        {data ? `Viikko ${data.week}` : "\u00A0"}
        <span className="range">
          {data
            ? `${dayNum(data.start)}.${monthNum(data.start)}.–${dayNum(data.end)}.${monthNum(data.end)}.`
            : "\u00A0"}
        </span>
      </p>
      <button className="arrow" onClick={onNext} aria-label="Seuraava viikko">
        ›
      </button>
    </nav>
  );
}
