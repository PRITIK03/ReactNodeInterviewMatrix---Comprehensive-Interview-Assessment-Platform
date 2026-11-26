import React, { lazy, Suspense, useEffect, useState } from "react";
import { api, date } from "./client";
import { Status, Score, Form } from "./ui";
import CodeDiscussion from "./CodeDiscussion";
const Editor = lazy(() => import("./PythonEditor"));
export default function Attempt({ item: a, refresh, leave }) {
  const cacheKey = "matrix-draft/" + a.id + "/" + a.version;
  const [initialTime] = useState(() => a.server_now ?? Date.now() / 1000);
  const [values, set] = useState(() => {
      try {
        return a.status === "open" && a.expires > initialTime
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
    [clock, tick] = useState(initialTime);
  useEffect(() => {
    if (a.status !== "open") return;
    let active = true;
    let anchor = a.server_now ?? initialTime;
    let sampled = performance.now();
    const update = () => tick(anchor + (performance.now() - sampled) / 1000);
    const timer = setInterval(update, 1000);
    async function synchronize() {
      if (document.visibilityState !== "visible") return;
      try {
        const snapshot = await api("/attempts/" + a.id + "/clock");
        if (!active || !Number.isFinite(snapshot.server_now)) return;
        anchor = snapshot.server_now;
        sampled = performance.now();
        update();
        if (snapshot.status !== a.status) refresh();
      } catch {
        // Continue measuring elapsed time while offline; the server checks every write.
      }
    }
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [a.id, a.status, a.server_now, initialTime, refresh]);
  const q = a.questions[index],
    key = "/attempts/" + a.id,
    writable = a.status === "open" && a.expires > clock;
  const seconds = Math.max(0, Math.ceil(a.expires - clock));
  const [savedQuestion, markSaved] = useState(null);
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
      if (a.kind === "coding" && values[q.id]?.trim()) markSaved({ id: q.id });
    } catch {
      notify("Server unavailable. Draft retained in this tab.");
    }
  };
  const change = (v) => {
    set((prev) => ({ ...prev, [q.id]: v }));
    notify("Unsaved changes");
  };
  return (
    <section aria-label="Assessment worksheet">
      <button className="quiet" onClick={leave}>
        ← Workspace
      </button>{" "}
      <Status>
        {writable ? "in progress" : a.status === "open" ? "expired" : a.status}
      </Status>
      {a.feedback && (
        <article>
          <h3>Skill breakdown</h3>
          {Object.entries(a.feedback.section_scores).map(([s, v]) => (
            <div className="skill-result" key={s}>
              <span>{s}</span>
              <meter min="0" max="100" value={v} aria-label={s + " correct"} />
              <strong>{v}%</strong>
            </div>
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
          {a.kind === "coding" && (
            <label>
              Solution to discuss
              <select
                value={index}
                onChange={(e) => select(Number(e.target.value))}
              >
                {a.questions.map((item, i) => (
                  <option value={i} key={item.id}>
                    {i + 1}. {item.prompt}
                  </option>
                ))}
              </select>
            </label>
          )}
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
          <div className="attempt-strip">
            <span>
              Question <strong>{index + 1}</strong> of {a.questions.length}
            </span>
            <span className="time-left" data-urgent={seconds <= 60}>
              <time title={"Deadline " + date(a.expires)}>
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </time>{" "}
              remaining
            </span>
          </div>
          <nav className="question-index" aria-label="Questions">
            {a.questions.map((x, i) => (
              <button
                className={i === index ? "" : "quiet"}
                key={x.id}
                aria-current={i === index ? "step" : undefined}
                onClick={() => select(i)}
              >
                {i + 1}
                {values[x.id] ? " ✓" : ""}
              </button>
            ))}
          </nav>
          {q.options ? (
            <>
              <h3>{q.prompt}</h3>
              <p>{q.description}</p>
              {q.options.map((opt) => (
                <label key={opt} className="option answer-option">
                  <input
                    type="radio"
                    disabled={!writable}
                    checked={values[q.id] === opt}
                    onChange={() => change(opt)}
                  />
                  {opt}
                </label>
              ))}
            </>
          ) : (
            <div className="coding-desk">
              <div className="problem-sheet">
                <h3>{q.prompt}</h3>
                <p>{q.description}</p>
                <div className="problem-example">
                  <div>
                    <h4>Example input</h4>
                    <pre>{q.example.input.trimEnd()}</pre>
                  </div>
                  <div>
                    <h4>Expected output</h4>
                    <pre>{q.example.output.trimEnd()}</pre>
                  </div>
                </div>
              </div>
              <div className="solution-sheet">
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
              </div>
            </div>
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
      {a.kind === "coding" && (writable || a.status === "complete") && (
        <CodeDiscussion
          key={a.id + "/" + q.id}
          attempt={a.id}
          question={q.id}
          source={a.status === "complete" ? a.answers[q.id] : values[q.id]}
          completed={a.status === "complete"}
          saved={savedQuestion?.id === q.id ? savedQuestion : 0}
        />
      )}
    </section>
  );
}
