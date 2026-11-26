import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CodeXml,
  CornerDownRight,
  FileText,
  LogIn,
} from "lucide-react";
import { Dialog } from "./ui";
import "./landing.css";

const publicWindows = [
  [20, 40],
  [5, 12],
  [8, 20],
  [60, 65],
];
const sortedWindows = [...publicWindows].sort((a, b) => a[0] - b[0]);

function WindowTrace() {
  const [step, advance] = useState(1);
  const covered = new Set();
  for (const [start, end] of sortedWindows.slice(0, step)) {
    for (let minute = start; minute < end; minute++) covered.add(minute);
  }
  return (
    <div className="window-trace">
      <div className="trace-title">
        <h4>Public example</h4>
        <span>Minutes</span>
      </div>
      <ol aria-label="Availability windows in start-time order">
        {sortedWindows.map(([start, end], i) => (
          <li key={start} data-included={i < step}>
            <span>
              {start}–{end}
            </span>
            <div aria-hidden="true">
              <i
                style={{
                  left: (100 * start) / 65 + "%",
                  width: (100 * (end - start)) / 65 + "%",
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="trace-action">
        <span aria-live="polite">
          {step} of 4 windows · <b>{covered.size} min covered</b>
        </span>
        <button
          type="button"
          onClick={() => advance(step === 4 ? 1 : step + 1)}
        >
          {step === 4 ? "Replay example" : "Trace next window"}{" "}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

const findings = [
  {
    name: "Python",
    detail: "Language used in a project",
    source: "Resume · Projects",
    excerpt: "Built a Python service to reconcile overlapping interview slots.",
    context: "Scheduling service",
    body: "Built a Python service to reconcile overlapping interview slots. Wrote unit tests for empty calendars and adjacent bookings.",
  },
  {
    name: "Coding correctness",
    detail: "Execution against test cases",
    source: "Assessment · Python",
    excerpt: "Merge availability windows. Five of five test cases passed.",
    context: "Execution record",
    body: "Public example: four time windows covered 40 distinct minutes. The submission returned 40. The runner also recorded four passing hidden cases.",
  },
  {
    name: "Quantitative reasoning",
    detail: "Graded aptitude responses",
    source: "Assessment · Aptitude",
    excerpt: "Answered four of five quantitative questions correctly.",
    context: "Section result",
    body: "Four correct answers across five quantitative questions in the assigned assessment. The section score is 80%.",
  },
  {
    name: "Production deployment",
    detail: "Evidence required by the role",
    source: "Evidence gap",
    excerpt: "The submitted materials do not identify a production deployment.",
    context: "Reviewer follow-up",
    body: "Ask the candidate to describe a deployment they worked on. Leave the criterion open until there is evidence to review.",
  },
];

function Ledger() {
  const [highlight, select] = useState(1);
  const [opened, inspect] = useState(null);
  const trigger = useRef(null);
  function close() {
    inspect(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <div className="review-sheet">
      <div className="ledger-title">
        <div>
          <span>Example application</span>
          <h2>Application review</h2>
        </div>
        <div className="role-stamp">
          <span>Role</span>
          <strong>Python engineer</strong>
        </div>
      </div>
      <table aria-label="Example application criteria">
        <thead>
          <tr>
            <th scope="col">Criterion</th>
            <th scope="col">Source excerpt</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f, i) => (
            <tr key={f.name} data-selected={highlight === i}>
              <th scope="row">
                <span className="criterion-title">{f.name}</span>
                <small>{f.detail}</small>
              </th>
              <td>
                <span className="excerpt">{f.excerpt}</span>
              </td>
              <td>
                <button
                  type="button"
                  className="inspect"
                  aria-label={"Inspect evidence for " + f.name}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    select(i);
                    inspect(i);
                  }}
                >
                  Inspect <ArrowUpRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ledger-source">
        <FileText size={14} /> Resume + assessment <span>Human review</span>
      </div>
      {opened !== null && (
        <Dialog title={findings[opened].context} onClose={close}>
          <p className="source-locator">
            {findings[opened].source} · Example application
          </p>
          <blockquote>{findings[opened].body}</blockquote>
          <p>{findings[opened].name}</p>
        </Dialog>
      )}
    </div>
  );
}

function PracticePreview({ workspace }) {
  const [kind, choose] = useState("coding");
  return (
    <section id="practice-preview" className="practice-spread">
      <div className="landing-wrap practice-layout">
        <div className="practice-intro">
          <h2>Inside a timed assessment.</h2>
          <p>
            Choose a track, see the task and its time limit, then open the
            library to start your own attempt.
          </p>
          <div
            role="group"
            aria-label="Preview a practice track"
            className="track-switch"
          >
            {["coding", "aptitude"].map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => choose(k)}
              >
                {k === "coding" ? "Python coding" : "Aptitude"}
              </button>
            ))}
          </div>
          <a className="landing-link" href={workspace}>
            Open workspace <ArrowRight size={17} />
          </a>
        </div>
        <div className="preview-panel" data-kind={kind} key={kind}>
          <div className="preview-meta">
            <span>
              {kind === "coding" ? (
                <CodeXml size={18} />
              ) : (
                <FileText size={16} />
              )}{" "}
              {kind === "coding" ? "Python coding" : "Aptitude"}
            </span>
            <span>
              {kind === "coding" ? "Advanced · 40 min" : "Beginner · 20 min"}
            </span>
          </div>
          <h3>
            {kind === "coding"
              ? "Merge availability windows"
              : "What is 10% of 80?"}
          </h3>
          {kind === "coding" ? (
            <>
              <p>
                Given a list of time windows, print the total number of distinct
                minutes covered.
              </p>
              <WindowTrace />
            </>
          ) : (
            <>
              <p>
                Choose one answer per question. The server scores your
                submission against the published version.
              </p>
              <ul className="option-preview">
                {["8", "10", "12", "14"].map((v, i) => (
                  <li key={v}>
                    <span>{String.fromCharCode(65 + i)}</span>
                    {v}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="preview-foot">
            <CornerDownRight size={15} />
            {kind === "coding"
              ? "1 problem · 1 public example"
              : "15 questions · Multiple choice"}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing({ brand, signedIn, route }) {
  const workspace = signedIn ? "#workspace-entry" : "#signin";
  useEffect(() => {
    const target = route === "practice-preview" ? "practice-preview" : "home";
    document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [route]);
  return (
    <div className="landing" id="home">
      <a
        className="skip-link"
        href="#review-preview"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("landing-main")?.focus();
        }}
      >
        Skip to product overview
      </a>
      <header className="landing-mast">
        <div className="landing-wrap">
          <a
            className="brand-home"
            href="#home"
            aria-label="InterviewMatrix home"
          >
            {brand}
          </a>
          <nav aria-label="Product">
            <a
              href="#review-preview"
              aria-current={
                route !== "practice-preview" ? "location" : undefined
              }
            >
              Review
            </a>
            <a
              href="#practice-preview"
              aria-current={
                route === "practice-preview" ? "location" : undefined
              }
            >
              Practice
            </a>
          </nav>
          <a className="landing-login" href={workspace}>
            <LogIn size={16} />
            {signedIn ? "Workspace" : "Sign in"}
          </a>
        </div>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <section id="review-preview" className="review-spread" data-enter>
          <div className="landing-wrap review-layout">
            <div className="landing-copy">
              <h1>
                <span>See the work</span> <span>behind a</span>{" "}
                <span>score.</span>
              </h1>
              <div className="landing-lead">
                <p>
                  Practise timed interviews in Python and aptitude. Review each
                  application against the work a candidate submits.
                </p>
                <a href={workspace} className="landing-cta">
                  Open workspace <ArrowRight size={22} />
                </a>
              </div>
            </div>
            <Ledger />
          </div>
        </section>
        <PracticePreview workspace={workspace} />
      </main>
      <footer className="landing-wrap landing-foot">
        <a href="#home" className="brand-home">
          {brand}
        </a>
        <a href="#review-preview">Back to overview ↑</a>
      </footer>
    </div>
  );
}
