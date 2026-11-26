import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const errors = {
  "not-allowed":
    "Microphone permission was denied. Allow it in browser settings or type your answer.",
  "audio-capture":
    "No microphone is available. Connect a device or type your answer.",
  "no-speech": "No speech was detected. Try again or type your answer.",
  network:
    "The browser’s speech service is unavailable. Try again or type your answer.",
};

export default function SpokenAnswer({ onSave }) {
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [listening, listen] = useState(false);
  const [notice, notify] = useState("");
  const [saving, saveBusy] = useState(false);
  const active = useRef(null);
  const timer = useRef();
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const r = active.current;
      active.current = null;
      if (r) r.abort();
    },
    [],
  );

  function dictate() {
    if (active.current) {
      active.current.stop();
      return;
    }
    notify("");
    try {
      const r = new Recognition();
      active.current = r;
      r.lang = navigator.language?.startsWith("en")
        ? navigator.language
        : "en-IN";
      r.continuous = true;
      r.interimResults = true;
      let nextFinal = 0;
      r.onresult = (event) => {
        if (active.current !== r) return;
        const final = [],
          interim = [];
        for (let i = nextFinal; i < event.results.length; i++) {
          const segment = event.results[i];
          if (segment.isFinal) {
            final.push(segment[0].transcript.trim());
            nextFinal = i + 1;
          } else interim.push(segment[0].transcript);
        }
        if (final.length)
          setText((old) =>
            [old.trimEnd(), ...final].filter(Boolean).join(" ").slice(0, 3000),
          );
        setPartial(interim.join(" "));
      };
      r.onerror = (event) => {
        if (active.current === r)
          notify(
            errors[event.error] ||
              "Dictation stopped. Your text is available to edit.",
          );
      };
      r.onend = () => {
        if (active.current !== r) return;
        clearTimeout(timer.current);
        active.current = null;
        setPartial("");
        listen(false);
      };
      r.start();
      listen(true);
      timer.current = setTimeout(() => {
        if (active.current === r) r.stop();
      }, 60000);
    } catch {
      active.current = null;
      listen(false);
      notify(
        "Could not start dictation. Check microphone access or type your answer.",
      );
    }
  }

  return (
    <div className="spoken-answer">
      <label>
        Your explanation
        <textarea
          rows={4}
          maxLength={3000}
          value={text}
          disabled={saving}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {partial && <p className="muted">{partial}</p>}
      {Recognition && window.isSecureContext ? (
        <small>
          Dictation uses your browser’s speech service, which may send audio to
          its provider. InterviewMatrix saves only the text you confirm.
        </small>
      ) : (
        <small>
          Voice input is unavailable in this browser or connection. You can type
          your answer here.
        </small>
      )}
      <div className="row">
        {Recognition && window.isSecureContext && (
          <button
            type="button"
            className="quiet dictation-toggle"
            disabled={saving}
            aria-pressed={listening}
            onClick={dictate}
          >
            {listening ? (
              <Square aria-hidden="true" size={15} />
            ) : (
              <Mic aria-hidden="true" size={17} />
            )}
            {listening ? "Stop dictation" : "Dictate answer"}
          </button>
        )}
        <button
          type="button"
          disabled={saving || listening || !text.trim()}
          onClick={async () => {
            saveBusy(true);
            notify("");
            try {
              await onSave(text.trim());
            } catch (e) {
              notify(e.message);
            } finally {
              saveBusy(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save explanation"}
        </button>
      </div>
      <small role="status">
        {notice ||
          (listening
            ? "Microphone active · listening…"
            : text.length === 3000
              ? "3,000-character answer limit reached."
              : "")}
      </small>
    </div>
  );
}
