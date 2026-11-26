import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";
import SpokenAnswer from "./SpokenAnswer";

export default function CodeDiscussion({
  attempt,
  question,
  source,
  completed,
  readOnly,
  assigned,
  saved,
}) {
  const base = "/attempts/" + attempt;
  const path = base + "/questions/" + question + "/follow-ups";
  const [thread, setThread] = useState(null);
  const [error, fail] = useState("");
  const [working, setWorking] = useState(false);
  const [useGemini, chooseGemini] = useState(false);
  const inFlight = useRef(false);
  const lastSave = useRef(null);
  const [reload, retry] = useState(0);
  useEffect(() => {
    let live = true;
    api(path)
      .then((data) => {
        if (live) setThread(data);
      })
      .catch((e) => {
        if (live) fail(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, reload]);

  const ask = useCallback(
    async (persistDraft) => {
      if (!thread || inFlight.current) return;
      inFlight.current = true;
      setWorking(true);
      fail("");
      try {
        if (persistDraft && !completed) {
          await api(base + "/draft", "PUT", {
            answers: [{ question_id: question, value: source }],
          });
        }
        const item = await api(path, "POST", {
          turn: thread.turns.length + 1,
          use_gemini: useGemini,
        });
        chooseGemini(false);
        setThread((t) => ({
          ...t,
          turns: [...t.turns.filter((x) => x.turn !== item.turn), item],
        }));
      } catch (e) {
        fail(e.message);
      } finally {
        inFlight.current = false;
        setWorking(false);
      }
    },
    [base, completed, path, question, source, thread, useGemini],
  );

  useEffect(() => {
    // A successful explicit draft save (or opening a submitted solution) starts
    // the first question. Ordinary typing never interrupts the editor.
    if (readOnly || !thread || thread.turns.length || (!completed && !saved))
      return;
    if (lastSave.current === saved) return;
    lastSave.current = saved;
    void ask(false);
  }, [thread, completed, readOnly, saved, ask]);

  const current = thread?.turns?.at(-1);
  function patch(turn, fields) {
    setThread((t) => ({
      ...t,
      turns: t.turns.map((x) => (x.turn === turn ? { ...x, ...fields } : x)),
    }));
  }
  async function reviewAction(item, action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    fail("");
    try {
      if (action === "review") {
        const result = await api(path + "/" + item.turn + "/review", "POST", {
          share_explanation: true,
        });
        patch(item.turn, { model_review: result });
      } else {
        patch(
          item.turn,
          await api(path + "/" + item.turn + "/sharing", "PUT", {
            shared: !item.shared_at,
          }),
        );
      }
    } catch (e) {
      fail(e.message);
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }
  return (
    <article className="code-discussion" aria-label="Code discussion">
      <h3>Discuss your solution</h3>
      {!current && thread && (
        <p>
          {readOnly
            ? "There are no saved explanations for this question."
            : "Save your Python draft to discuss a line. You can type or dictate your answer and revisit the feedback in this attempt."}
        </p>
      )}
      {thread?.turns?.map((item) => (
        <div className="code-turn" key={item.turn}>
          <small>
            Question {item.turn} ·{" "}
            {item.provider === "gemini" ? "Gemini" : "Local practice"} · Saved
            line {item.line}
          </small>
          <pre>{item.excerpt}</pre>
          <h4>{item.prompt}</h4>
          {item.reply != null ? (
            <>
              <div className="saved-reply">
                <small>Your saved explanation</small>
                <blockquote className="explanation">{item.reply}</blockquote>
              </div>
              {item.analysis && (
                <details className="reply-notes" open>
                  <summary>Explanation notes</summary>
                  <small>Local text check · Private coaching</small>
                  {item.analysis.identifiers.length > 0 && (
                    <p>
                      Named in your code and answer:{" "}
                      <b>{item.analysis.identifiers.join(", ")}</b>
                    </p>
                  )}
                  {item.analysis.phrases.map(({ label, quote }) => (
                    <p key={label}>
                      <strong>{label}</strong> · <q>{quote}</q>
                    </p>
                  ))}
                  <p>
                    <strong>Try next</strong> · {item.analysis.next_step}
                  </p>
                </details>
              )}
              {item.model_review ? (
                <div className="semantic-review">
                  <h4>Gemini feedback</h4>
                  <p>
                    {item.model_review.coverage} ·{" "}
                    {item.model_review.observation}
                  </p>
                  <q>{item.model_review.quote}</q>
                  <p>{item.model_review.next_question}</p>
                </div>
              ) : (
                thread.gemini_available && (
                  <button
                    disabled={working}
                    onClick={() => reviewAction(item, "review")}
                    className="quiet"
                  >
                    Send this answer, question and code structure to Gemini for
                    feedback
                  </button>
                )
              )}
              {assigned && completed && (
                <div className="share-explanation">
                  <small>
                    {item.shared_at
                      ? "Your recruiter can read this question, saved line and answer."
                      : "Only you can read this explanation. Sharing includes the question, saved line and your confirmed text."}
                  </small>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => reviewAction(item, "share")}
                    className="quiet"
                  >
                    {item.shared_at
                      ? "Withdraw shared explanation"
                      : "Share explanation with this job’s recruiter"}
                  </button>
                </div>
              )}
            </>
          ) : readOnly ? (
            <p>This discussion closed before an answer was saved.</p>
          ) : (
            <SpokenAnswer
              onSave={async (text) =>
                patch(
                  item.turn,
                  await api(path + "/" + item.turn, "PUT", { text }),
                )
              }
            />
          )}
        </div>
      ))}
      {thread &&
        !readOnly &&
        (!current || current.reply !== null) &&
        thread.turns.length < thread.limit && (
          <>
            {thread.gemini_available && (
              <label className="option">
                <input
                  type="checkbox"
                  checked={useGemini}
                  disabled={working}
                  onChange={(e) => chooseGemini(e.target.checked)}
                />{" "}
                Use Gemini for the next question. Share code identifiers and
                operators from selected lines.
              </label>
            )}
            <button
              type="button"
              className="quiet"
              disabled={working || !source?.trim()}
              onClick={() => ask(true)}
            >
              {working
                ? "Preparing question…"
                : current
                  ? "Ask another question"
                  : "Ask about my code"}
            </button>
          </>
        )}
      {error && (
        <p role="alert">
          {error}{" "}
          {!thread && (
            <button
              className="quiet"
              onClick={() => {
                fail("");
                retry((n) => n + 1);
              }}
            >
              Retry
            </button>
          )}
        </p>
      )}
    </article>
  );
}
