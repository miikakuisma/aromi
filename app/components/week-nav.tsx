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
      <p aria-live="polite">
        {data ? `Viikko ${data.week}` : " "}
        <span className="range">
          {data
            ? `${dayNum(data.start)}.${monthNum(data.start)}.–${dayNum(data.end)}.${monthNum(data.end)}.`
            : " "}
        </span>
      </p>
      <button className="arrow" onClick={onNext} aria-label="Seuraava viikko">
        ›
      </button>
    </nav>
  );
}
