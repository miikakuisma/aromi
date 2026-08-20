import { dayNum, monthNum } from "@/lib/dates";
import type { WeekData } from "@/lib/types";
import { DietMarks } from "./diet-marks";

export function DayList({ data, today }: { data: WeekData; today: string }) {
  const anyFood = data.days.some((d) => d.options.length);

  if (!anyFood) {
    return (
      <div className="state">
        <p>Tällä viikolla ei ole ruokailua.</p>
      </div>
    );
  }

  return (
    <>
      {data.days.map((d, i) => {
        const isToday = d.date === today;
        const past = d.date < today;
        const cls = ["day", isToday ? "today" : "", past ? "past" : ""]
          .filter(Boolean)
          .join(" ");

        // Jos tänään ei ole ruokailua, kerro milloin seuraava on.
        const upcoming = data.days.find(
          (n) => n.date > d.date && n.options.length,
        );

        return (
          <section
            key={d.date}
            className={cls}
            id={`d-${d.date}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <h2 className="dayhead">
              <span>
                {d.weekday} {dayNum(d.date)}.{monthNum(d.date)}.
              </span>
              {isToday && <span className="tag">Tänään</span>}
            </h2>

            {d.options.length > 0 ? (
              d.options.map((o, j) => (
                <div className="opt" key={j}>
                  <p className="main">
                    {o.main.join(" ja ")}
                    <DietMarks diets={o.diets} />
                  </p>
                  {o.sides.length > 0 && (
                    <p className="sides">{o.sides.join(" · ")}</p>
                  )}
                </div>
              ))
            ) : (
              <>
                <p className="none">Ei kouluruokailua</p>
                {isToday && upcoming && (
                  <p className="next">
                    Seuraava ruokailu{" "}
                    <b>
                      {upcoming.weekday} {dayNum(upcoming.date)}.
                      {monthNum(upcoming.date)}.
                    </b>
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
