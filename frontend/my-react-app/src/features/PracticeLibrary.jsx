import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Clock3,
  CodeXml,
  ListChecks,
  Shapes,
  SlidersHorizontal,
  ScanLine,
} from "lucide-react";
import { Feedback } from "./ui";

import { displayName } from "./client";
const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
const logoCompanies = new Set([
  "accenture",
  "amazon",
  "infosys",
  "tcs",
  "wipro",
]);
const localArt = import.meta.glob("../local-art/python.png", {
  eager: true,
  import: "default",
});
function focusHeading(element) {
  element?.focus({ preventScroll: true });
}
function Specimen({ kind }) {
  if (kind === "coding")
    return (
      <span className="source-specimen" aria-hidden="true">
        <code>
          <b>def</b> trace(items):
        </code>
        <code>
          {"    "}
          <b>for</b> item <b>in</b> items:
        </code>
        <code>
          {"        "}
          <b>yield</b> item
        </code>
      </span>
    );
  return (
    <span className="answer-sheet" aria-hidden="true">
      <span className="sheet-rule">
        <ScanLine size={18} />
      </span>
      <span className="sheet-line">
        <i />
        {["A", "B", "C", "D"].map((x) => (
          <b key={x}>{x}</b>
        ))}
      </span>
      {[1, 3, 0].map((marked, row) => (
        <span className="sheet-line" key={row}>
          <b>{row + 1}</b>
          {[0, 1, 2, 3].map((n) => (
            <i key={n} className={n === marked ? "marked" : ""} />
          ))}
        </span>
      ))}
    </span>
  );
}

export default function PracticeLibrary({
  catalog,
  companyKey,
  kindKey,
  start,
  starting,
}) {
  if (!catalog.data)
    return (
      <Feedback resource={catalog} loading="Loading practice assessments…" />
    );
  const companies = [...new Set(catalog.data.map((v) => v.company))];
  if (!companies.length)
    return <p className="empty">No published practice assessments yet.</p>;
  const company =
    companies.find((name) => encodeURIComponent(name) === companyKey) ||
    companies[0];
  const assessments = catalog.data.filter((v) => v.company === company);
  const kinds = [...new Set(assessments.map((v) => v.kind))];
  const kind = kinds.find((name) => encodeURIComponent(name) === kindKey) || "";
  const href = "#assessments/" + encodeURIComponent(company);
  const versions = assessments
    .filter((v) => v.kind === kind)
    .sort(
      (a, b) =>
        (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3) ||
        a.level.localeCompare(b.level),
    );
  return (
    <div className="library">
      <nav className="companies" aria-label="Company">
        <span className="company-label">Company</span>
        {companies.map((name) => (
          <a
            key={name}
            href={"#assessments/" + encodeURIComponent(name)}
            aria-label={displayName(name)}
            aria-current={name === company ? "true" : undefined}
          >
            {logoCompanies.has(name) ? (
              <img alt={displayName(name)} src={"/logos/" + name + ".png"} />
            ) : (
              displayName(name)
            )}
          </a>
        ))}
      </nav>
      {kind ? (
        <section key={company + kind} className="level-panel">
          <a className="back-link" href={href}>
            <ChevronLeft size={16} /> {displayName(company)} assessments
          </a>
          <h2 tabIndex={-1} ref={focusHeading}>
            {displayName(kind)}
          </h2>
          <div className="level-list">
            {versions.map((v) => (
              <button
                key={v.id}
                className={"level-choice " + v.level}
                disabled={starting}
                onClick={() => start(v.id)}
                aria-label={
                  "Start " + displayName(v.level) + " " + displayName(kind)
                }
              >
                <span className="level-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{displayName(v.level)}</strong>
                <span className="level-fact">
                  <ListChecks />
                  {v.question_count} questions
                </span>
                <span className="level-fact">
                  <Clock3 />
                  {v.minutes} min
                </span>
                <span className="level-start">
                  Start <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="track-grid" key={company}>
          {kinds.map((k) => {
            const Icon =
              k === "coding"
                ? CodeXml
                : k === "aptitude"
                  ? Shapes
                  : SlidersHorizontal;
            const editions = assessments.filter((v) => v.kind === k);
            const minutes = [...new Set(editions.map((v) => v.minutes))].sort(
              (a, b) => a - b,
            );
            const duration =
              minutes.length === 1
                ? minutes[0]
                : minutes[0] + "–" + minutes.at(-1);
            return (
              <a
                className="track"
                data-kind={k}
                key={k}
                href={href + "/" + encodeURIComponent(k)}
                aria-label={displayName(k)}
              >
                <span className="track-cover">
                  <span className="track-symbol" aria-hidden="true">
                    {k === "coding" && localArt["../local-art/python.png"] ? (
                      <img alt="" src={localArt["../local-art/python.png"]} />
                    ) : (
                      <Icon size={22} />
                    )}
                  </span>
                  <Specimen kind={k} />
                  <strong>{displayName(k)}</strong>
                </span>
                <span className="track-footer">
                  <span>
                    {editions.length}{" "}
                    {editions.length === 1 ? "level" : "levels"}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    {duration} min
                  </span>
                  <ArrowUpRight size={19} />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
