import { ArrowUpRight, CalendarDays } from "lucide-react";
import { displayName } from "./client";

const dayLabel = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// A pair of engraved ribbons. Only their parent moves, once, on entry.
const contours = Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  return {
    left: 3 + 91 * t + "%",
    top: 51 - 15 * Math.sin(t * Math.PI * 2.2) + "%",
    width: 17 + 11 * Math.sin(t * Math.PI) + "%",
    height: 68 + 49 * Math.sin(t * Math.PI) + "%",
    transform: "translate(-50%, -50%) rotate(" + (-51 + t * 106) + "deg)",
    borderColor:
      t < 0.43
        ? "var(--print-blue)"
        : t < 0.62
          ? "var(--print-brass)"
          : "var(--print-rust)",
  };
});

export function SignalPrint() {
  return (
    <div className="signal-print" aria-hidden="true">
      <div className="engraving">
        {contours.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </div>
    </div>
  );
}

export function ActivityStrip({ overview, openAttempt }) {
  const { activity, last_result: last } = overview;
  const count = activity.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(1, ...activity.map((d) => d.count));
  return (
    <section className="activity-strip" aria-label="Assessment activity">
      <div className="activity-stat">
        <h2>Graded submissions</h2>
        <strong>{count}</strong>
        <small>Last 14 days</small>
      </div>
      <div className="activity-plot">
        <details>
          <summary>
            <CalendarDays size={14} /> Daily submissions <span>UTC</span>
          </summary>
          <dl>
            {activity.map((d) => (
              <div key={d.day}>
                <dt>{dayLabel.format(d.day * 1000)}</dt>
                <dd>{d.count}</dd>
              </div>
            ))}
          </dl>
        </details>
        <div className="day-bars" aria-hidden="true">
          {activity.map((d) => (
            <div
              key={d.day}
              title={dayLabel.format(d.day * 1000) + " · " + d.count}
            >
              <i style={{ height: (100 * d.count) / peak + "%" }} />
            </div>
          ))}
        </div>
        <div className="plot-axis">
          <span>{dayLabel.format(activity[0].day * 1000)}</span>
          <span>{dayLabel.format(activity.at(-1).day * 1000)}</span>
        </div>
      </div>
      <div className="last-debrief">
        <h2>Last result</h2>
        {last ? (
          <>
            <strong>
              {last.score}
              <small> / {last.total}</small>
            </strong>
            <button
              className="result-link"
              onClick={() => openAttempt(last.id)}
            >
              {displayName(last.kind)} review <ArrowUpRight size={14} />
            </button>
          </>
        ) : (
          <p>Your first result will appear here.</p>
        )}
      </div>
    </section>
  );
}
