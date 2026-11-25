import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Clock3,
  CodeXml,
  ListChecks,
  Shapes,
  SlidersHorizontal,
  Terminal,
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
function Cover({ kind }) {
  const coding = kind === "coding";
  return (
    <span className={"cover " + (coding ? "ink" : "iris")} aria-hidden="true">
      {coding ? (
        <span className="terminal-sheet">
          <span className="terminal-bar">
            <i />
            <i />
            <i />
          </span>
          <span className="terminal-body">
            <Terminal />
            <span />
            <span />
            <span />
          </span>
        </span>
      ) : (
        <span className="tiles">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      )}
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
  if (!catalog.data) return <Feedback resource={catalog} />;
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
            const count = assessments.filter((v) => v.kind === k).length;
            return (
              <a
                className="track"
                key={k}
                href={href + "/" + encodeURIComponent(k)}
                aria-label={displayName(k)}
              >
                <Cover kind={k} />
                <span className="track-body">
                  <span
                    className={"track-icon " + (k === "coding" ? "code" : "")}
                  >
                    {k === "coding" && localArt["../local-art/python.png"] ? (
                      <img alt="" src={localArt["../local-art/python.png"]} />
                    ) : (
                      <Icon />
                    )}
                  </span>
                  <span>
                    <strong>{displayName(k)}</strong>
                    <small>
                      {count} {count === 1 ? "level" : "levels"}
                    </small>
                  </span>
                  <ArrowUpRight className="go-icon" />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
