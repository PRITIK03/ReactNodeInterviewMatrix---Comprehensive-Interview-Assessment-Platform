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

function fieldArtwork(area) {
  if (area === "Readiness") {
    return (
      <g fill="none" stroke="currentColor">
        {[30, 80, 130].map((y) => (
          <path key={y} d={`M0 ${y}H640`} opacity=".19" strokeDasharray="2 7" />
        ))}
        {Array.from({ length: 16 }, (_, k) => (
          <path
            key={k}
            opacity={0.42 + k / 35}
            strokeWidth={1.15}
            d={Array.from({ length: 240 }, (_, i) => {
              const x = (i * 640) / 239,
                t = x / 640;
              const envelope = 9 + 45 * Math.pow(Math.sin(t * Math.PI), 2);
              const y =
                77 +
                (k - 7.5) * 2.8 +
                envelope *
                  Math.sin(t * 19 + k * 0.12) *
                  Math.cos(t * 5.8 + k * 0.045);
              return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
            }).join(" ")}
          />
        ))}
      </g>
    );
  }
  if (area === "Applications" || area === "Jobs") {
    return (
      <g
        transform={
          area === "Jobs"
            ? "translate(20 -13) rotate(7 300 80)"
            : "rotate(-6 320 90)"
        }
      >
        {[0, 1, 2, 3, 4].map((n) => (
          <g key={n} transform={`translate(${n * 108 - 8} ${24 + n * 8})`}>
            <path
              d="M0 24V10Q0 4 7 4H61L76 18H154Q160 18 160 25V160H0Z"
              fill={["#e6c797", "#dcb786", "#f4dfb5", "#cb9675", "#ecd1aa"][n]}
              stroke="#916f54"
            />
            <path
              d="M0 34H160M15 55H137M15 65H100M15 95H137M15 105H116"
              fill="none"
              stroke="#7a583c"
              opacity=".48"
            />
            <path d="M16 16H46" stroke="#745943" strokeWidth="3" />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g fill="none" stroke="currentColor" transform="translate(335 80)">
      {Array.from({ length: 32 }, (_, i) => (
        <ellipse
          key={i}
          rx="129"
          ry="46"
          transform={`rotate(${i * 5.625})`}
          opacity=".56"
        />
      ))}
    </g>
  );
}
const art = Object.fromEntries(
  ["Readiness", "Applications", "Jobs", "Profile"].map((a) => [
    a,
    fieldArtwork(a),
  ]),
);

export function SignalPrint({ area = "Assessments" }) {
  if (area in art)
    return (
      <div className="area-print" aria-hidden="true">
        <svg
          className="field-art"
          viewBox="0 0 640 160"
          preserveAspectRatio="xMidYMid slice"
        >
          {art[area]}
        </svg>
      </div>
    );
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
