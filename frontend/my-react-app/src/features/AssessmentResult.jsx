import {
  Check,
  CircleX,
  Clock3,
  FileCode2,
  ListChecks,
  LockKeyhole,
  Terminal,
} from "lucide-react";
import { Score } from "./ui";

const verdicts = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  time_limit: "Time limit",
  memory_limit: "Memory limit",
  compilation_error: "Compilation error",
  runtime_error: "Runtime error",
  output_limit: "Output limit",
};

export default function AssessmentResult({ attempt, index, select }) {
  const coding = attempt.kind === "coding";
  const question = attempt.questions[index];
  const cases = attempt.case_results.filter((r) => r.question === question.id);
  const ratio =
    attempt.total > 0
      ? Math.min(1, Math.max(0, attempt.score / attempt.total))
      : 0;
  return (
    <div className="result-sheet">
      <header className="result-imprint">
        <div className="result-identity">
          <ListChecks aria-hidden="true" size={28} />
          <h3>Assessment result</h3>
          <small>
            Assessment version <code>{attempt.version.slice(0, 12)}</code>
          </small>
        </div>
        <div className="result-tally">
          <Score {...attempt} />
          <span>{coding ? "test cases passed" : "correct answers"}</span>
          <div className="tally-track" aria-hidden="true">
            <i style={{ "--fraction": ratio }} />
          </div>
        </div>
      </header>
      {coding && (
        <div className="execution-record">
          <label>
            Solution to discuss
            <select
              value={index}
              onChange={(e) => select(Number(e.target.value))}
            >
              {attempt.questions.map((q, i) => (
                <option value={i} key={q.id}>
                  {i + 1}. {q.prompt}
                </option>
              ))}
            </select>
          </label>
          <h4>
            <Terminal size={18} aria-hidden="true" /> Test verdicts
          </h4>
          {cases.length ? (
            <ol className="verdict-strip" aria-label="Test verdicts">
              {cases.map((r) => {
                const Icon =
                  r.status === "passed"
                    ? Check
                    : r.status === "time_limit"
                      ? Clock3
                      : CircleX;
                return (
                  <li key={r.position} data-passed={r.status === "passed"}>
                    <small>
                      {r.hidden ? (
                        <LockKeyhole size={13} aria-hidden="true" />
                      ) : (
                        <Terminal size={13} aria-hidden="true" />
                      )}
                      {r.hidden ? "Hidden test" : "Public example"} ·{" "}
                      {r.position + 1}
                    </small>
                    <span>
                      <Icon size={16} aria-hidden="true" />
                      {verdicts[r.status] ?? r.status.replaceAll("_", " ")}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>No test verdicts were recorded for this solution.</p>
          )}
          <details key={question.id} className="submitted-source">
            <summary>
              <FileCode2 size={17} aria-hidden="true" /> Submitted Python
            </summary>
            <pre tabIndex={0} aria-label="Submitted Python source">
              {attempt.answers[question.id]}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
