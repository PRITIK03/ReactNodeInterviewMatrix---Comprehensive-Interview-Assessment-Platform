import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";
import SpokenAnswer from "./SpokenAnswer";

export default function CodeDiscussion({
  attempt,
  question,
  source,
  completed,
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
    if (!thread || thread.turns.length || (!completed && !saved)) return;
    if (lastSave.current === saved) return;
    lastSave.current = saved;
    void ask(false);
  }, [thread, completed, saved, ask]);

  const current = thread?.turns?.at(-1);
  return (
    <article className="code-discussion" aria-label="Code discussion">
      <h3>Discuss your solution</h3>
      {!current && (
        <p>
          Explain a choice in your Python code. Your discussion is private to
          this attempt and does not affect the test score.
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
          {item.reply !== null ? (
            <p className="explanation">{item.reply}</p>
          ) : (
            <SpokenAnswer
              onSave={async (text) => {
                const result = await api(path + "/" + item.turn, "PUT", {
                  text,
                });
                setThread((t) => ({
                  ...t,
                  turns: t.turns.map((x) =>
                    x.turn === item.turn ? { ...x, reply: result.reply } : x,
                  ),
                }));
              }}
            />
          )}
        </div>
      ))}
      {thread &&
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
