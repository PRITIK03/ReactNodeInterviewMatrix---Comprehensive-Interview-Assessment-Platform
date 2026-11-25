import React, { lazy, Suspense, useEffect, useState } from "react";
import { api, date } from "./client";
import { Status, Score, Form, Panel } from "./ui";
const Editor = lazy(() => import("./PythonEditor"));
export default function Attempt({ item: a, refresh, leave }) {
  const cacheKey = "matrix-draft/" + a.id + "/" + a.version;
  const [values, set] = useState(() => {
      try {
        return a.status === "open" && a.expires > Date.now() / 1000
          ? {
              ...a.answers,
              ...JSON.parse(sessionStorage.getItem(cacheKey) || "{}"),
            }
          : a.answers;
      } catch {
        return a.answers;
      }
    }),
    [index, select] = useState(0),
    [notice, notify] = useState(""),
    [clock, tick] = useState(Date.now() / 1000);
  useEffect(() => {
    const i = setInterval(() => tick(Date.now() / 1000), 1000);
    return () => clearInterval(i);
  }, []);
  const q = a.questions[index],
    key = "/attempts/" + a.id,
    writable = a.status === "open" && a.expires > clock;
  const [advice, setAdvice] = useState(null);
  const pack = () =>
    Object.entries(values)
      .filter(([, v]) => v?.trim())
      .map(([question_id, value]) => ({ question_id, value }));
  useEffect(() => {
    try {
      if (writable) sessionStorage.setItem(cacheKey, JSON.stringify(values));
      else sessionStorage.removeItem(cacheKey);
    } catch {
      /* Draft stays in memory. */
    }
  }, [values, writable, cacheKey]);
  const save = async () => {
    try {
      await api(key + "/draft", "PUT", {
        answers: pack(),
        replace_snapshot: true,
      });
      notify("Draft saved on server");
    } catch {
      notify("Server unavailable. Draft retained in this tab.");
    }
  };
  const change = (v) => {
    set((prev) => ({ ...prev, [q.id]: v }));
    notify("Unsaved changes");
  };
  return (
    <Panel
      title={a.kind === "coding" ? "Python assessment" : "Aptitude assessment"}
    >
      <button className="quiet" onClick={leave}>
        ← Workspace
      </button>{" "}
      <Status>{writable ? "in progress" : a.status}</Status>
      {a.feedback && (
        <article>
          <h3>Skill breakdown</h3>
          {Object.entries(a.feedback.section_scores).map(([s, v]) => (
            <p key={s}>
              {s} · {v}%
            </p>
          ))}
          {a.feedback.recommendations.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </article>
      )}
      {a.status === "complete" && a.kind === "coding" && (
        <details>
          <summary>Optional code coaching</summary>
          <Form
            label="Request feedback"
            submit={async () =>
              setAdvice(
                await api(key + "/coaching", "POST", { share_source: true }),
              )
            }
          >
            <label className="option">
              <input type="checkbox" required />
              Share my first solution with Gemini for practice feedback.
            </label>
          </Form>
          {advice && (
            <p>
              {advice.observation} {advice.next_step}
            </p>
          )}
        </details>
      )}
      {a.status === "complete" ? (
        <>
          <h3>Assessment result</h3>
          <Score {...a} />
          <p>
            Server-graded against assessment version{" "}
            <code>{a.version.slice(0, 12)}</code>.
          </p>
          {a.case_results.map((r, i) => (
            <p key={i}>
              Question {a.questions.findIndex((q) => q.id === r.question) + 1} ·{" "}
              {r.hidden ? "Hidden test" : "Public example"} {r.position + 1}{" "}
              <Status>{r.status}</Status>
            </p>
          ))}
        </>
      ) : (
        <>
          <p>
            Deadline {date(a.expires)} ·{" "}
            {Math.max(0, Math.ceil((a.expires - clock) / 60))} minutes remaining
          </p>
          <nav>
            {a.questions.map((x, i) => (
              <button
                className={i === index ? "" : "quiet"}
                key={x.id}
                onClick={() => select(i)}
              >
                {i + 1}
                {values[x.id] ? " ✓" : ""}
              </button>
            ))}
          </nav>
          <h3>{q.prompt}</h3>
          <p>{q.description}</p>
          {q.options ? (
            q.options.map((opt) => (
              <label key={opt} className="option">
                <input
                  type="radio"
                  disabled={!writable}
                  checked={values[q.id] === opt}
                  onChange={() => change(opt)}
                />
                {opt}
              </label>
            ))
          ) : (
            <>
              <pre>
                Example input{"\n"}
                {q.example.input}
                {"\n"}Expected output{"\n"}
                {q.example.output}
              </pre>
              {writable ? (
                <Suspense fallback={<p>Loading Python editor…</p>}>
                  <Editor
                    key={q.id}
                    initial={values[q.id] || ""}
                    onChange={change}
                    onSave={save}
                  />
                </Suspense>
              ) : (
                <pre>{values[q.id]}</pre>
              )}
            </>
          )}
          {writable && (
            <button className="quiet" onClick={save}>
              Save draft
            </button>
          )}{" "}
          <span role="status">{notice}</span>
          {(writable ||
            a.status === "runner_unavailable" ||
            a.status === "grading") && (
            <Form
              label="Submit for scoring"
              submit={async () => {
                await api(key + "/submit", "POST", { answers: pack() });
                try {
                  sessionStorage.removeItem(cacheKey);
                } catch {
                  /* Storage disabled */
                }
                refresh();
              }}
            >
              <p>
                {pack().length} of {a.questions.length} answered. Submission
                locks your answers.
              </p>
            </Form>
          )}
        </>
      )}
    </Panel>
  );
}
