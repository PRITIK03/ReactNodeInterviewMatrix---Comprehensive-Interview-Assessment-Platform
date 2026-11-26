import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api, date } from "./client";
import { Status, Form } from "./ui";
import CodeDiscussion from "./CodeDiscussion";
import AssessmentResult from "./AssessmentResult";
const Editor = lazy(() => import("./PythonEditor"));
export default function Attempt({ item: a, refresh, leave }) {
  const cacheKey = "matrix-draft/" + a.id + "/" + a.version;
  const [initialTime] = useState(() => a.server_now ?? Date.now() / 1000);
  const [serverAnswers, setServerAnswers] = useState(a.answers);
  const [values, set] = useState(() => {
      try {
        if (a.status !== "open" || a.expires <= initialTime) return a.answers;
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "{}");
        const recovered = { ...a.answers };
        for (const question of a.questions) {
          const draft = cached?.[question.id];
          if (
            typeof draft === "string" &&
            (!question.options || question.options.includes(draft))
          ) {
            recovered[question.id] = draft;
          }
        }
        return recovered;
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
  const edits = useRef(0);
  const saving = useRef(false);
  const [draftPending, setDraftPending] = useState(false);
  const [submission, setSubmission] = useState("idle");
  const q = a.questions[index],
    key = "/attempts/" + a.id,
    writable = a.status === "open" && a.expires > clock;
  const editing = writable && submission === "idle";
  const remainingQuestions = a.questions.filter(
    (item) => !values[item.id]?.trim(),
  ).length;
  const seconds = Math.max(0, Math.ceil(a.expires - clock));
  const [savedQuestion, markSaved] = useState(null);
  const [advice, setAdvice] = useState(null);
  const pack = () =>
    Object.entries(values)
      .filter(([, v]) => v?.trim())
      .map(([question_id, value]) => ({ question_id, value }));
  useEffect(() => {
    try {
      const changes = Object.entries(values).filter(
        ([id, value]) => value !== (serverAnswers[id] ?? ""),
      );
      if (writable && changes.length)
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify(Object.fromEntries(changes)),
        );
      else sessionStorage.removeItem(cacheKey);
    } catch {
      /* Draft stays in memory. */
    }
  }, [values, writable, cacheKey, serverAnswers]);
  const save = async () => {
    if (saving.current || !editing) return;
    saving.current = true;
    setDraftPending(true);
    const revision = edits.current;
    try {
      await api(key + "/draft", "PUT", {
        answers: pack(),
        replace_snapshot: true,
      });
      setServerAnswers(values);
      if (revision !== edits.current) return;
      notify("Draft saved on server");
      if (a.kind === "coding" && values[q.id]?.trim()) markSaved({ id: q.id });
    } catch (error) {
      notify(
        error.status
          ? error.message
          : "Could not reach the server. Draft retained in this tab.",
      );
    } finally {
      saving.current = false;
      setDraftPending(false);
    }
  };
  async function reconcileSubmission() {
    try {
      const snapshot = await api(key + "/clock");
      if (snapshot.status !== a.status) refresh();
      else setSubmission("idle");
    } catch {
      setSubmission("unconfirmed");
    }
  }
  const change = (v) => {
    edits.current += 1;
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
      {a.status === "complete" ? (
        <>
          <AssessmentResult attempt={a} index={index} select={select} />
          {a.feedback && (
            <article>
              <h3>Skill breakdown</h3>
              {Object.entries(a.feedback.section_scores).map(([s, v]) => (
                <div className="skill-result" key={s}>
                  <span>{s}</span>
                  <meter
                    min="0"
                    max="100"
                    value={v}
                    aria-label={s + " correct"}
                  />
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
                    await api(key + "/coaching", "POST", {
                      share_source: true,
                    }),
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
        </>
      ) : (
        <>
          <div className="attempt-strip">
            <span>
              Question <strong>{index + 1}</strong> of {a.questions.length}
            </span>
            {a.status === "open" && (
              <span className="time-left" data-urgent={seconds <= 60}>
                <time title={"Deadline " + date(a.expires)}>
                  {Math.floor(seconds / 60)}:
                  {String(seconds % 60).padStart(2, "0")}
                </time>{" "}
                remaining
              </span>
            )}
          </div>
          {writable && remainingQuestions > 0 && a.questions.length > 1 && (
            <small className="pace-note">
              {remainingQuestions} unanswered · About{" "}
              {Math.floor(seconds / remainingQuestions / 60)}m{" "}
              {Math.floor((seconds / remainingQuestions) % 60)}s available per
              unanswered question
            </small>
          )}
          <nav className="question-index" aria-label="Questions">
            {a.questions.map((x, i) => (
              <button
                className={i === index ? "" : "quiet"}
                key={x.id}
                aria-current={i === index ? "step" : undefined}
                onClick={() => select(i)}
              >
                {i + 1}
                {values[x.id]?.trim() ? " ✓" : ""}
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
                    name={"answer-" + q.id}
                    disabled={!editing}
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
                      readOnly={!editing}
                    />
                  </Suspense>
                ) : (
                  <pre>{values[q.id]}</pre>
                )}
              </div>
            </div>
          )}
          {writable && (
            <button
              className="quiet"
              onClick={save}
              disabled={draftPending || !editing}
            >
              {draftPending ? "Saving…" : "Save draft"}
            </button>
          )}{" "}
          <span role="status">{notice}</span>
          {submission === "unconfirmed" && (
            <div role="status">
              Submission status is unknown. Reconnect to check before editing.
              <button className="quiet" onClick={reconcileSubmission}>
                Check submission status
              </button>
            </div>
          )}
          {(writable ||
            a.status === "runner_unavailable" ||
            a.status === "grading") && (
            <Form
              label={
                a.status === "runner_unavailable"
                  ? "Retry grading"
                  : a.status === "grading"
                    ? "Check grading"
                    : "Submit for scoring"
              }
              disabled={
                draftPending || submission !== "idle" || remainingQuestions > 0
              }
              submit={async () => {
                setSubmission("submitting");
                try {
                  await api(key + "/submit", "POST", { answers: pack() });
                } catch (error) {
                  await reconcileSubmission();
                  throw error;
                }
                try {
                  sessionStorage.removeItem(cacheKey);
                } catch {
                  /* Storage disabled */
                }
                refresh();
              }}
            >
              <p>
                {a.status === "runner_unavailable"
                  ? "Your submitted answers are saved. Retry the same submission when the runner is available."
                  : a.status === "grading"
                    ? "Your submitted answers are locked while the runner checks them."
                    : `${a.questions.length - remainingQuestions} of ${a.questions.length} answered. Submission locks your answers.`}
              </p>
            </Form>
          )}
        </>
      )}
      {a.kind === "coding" && (
        <fieldset
          className="discussion-controls"
          disabled={submission !== "idle"}
        >
          <CodeDiscussion
            key={a.id + "/" + q.id}
            attempt={a.id}
            question={q.id}
            source={a.status === "complete" ? a.answers[q.id] : values[q.id]}
            completed={a.status === "complete"}
            readOnly={!writable && a.status !== "complete"}
            assigned={Boolean(a.invitation)}
            saved={savedQuestion?.id === q.id ? savedQuestion : 0}
          />
        </fieldset>
      )}
    </section>
  );
}
