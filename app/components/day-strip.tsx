import { dayNum } from "@/lib/dates";
import type { WeekDay } from "@/lib/types";

export function DayStrip({
  days,
  today,
  onSelect,
}: {
  days: WeekDay[];
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <ol className="strip">
      {days.map((d) => {
        const cls = [
          d.options.length ? "" : "empty",
          d.date === today ? "now" : "",
          d.date < today ? "past" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={d.date}>
            <button className={cls} onClick={() => onSelect(d.date)}>
              <span className="wd">{d.weekday}</span>
              <span className="dn">{dayNum(d.date)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
