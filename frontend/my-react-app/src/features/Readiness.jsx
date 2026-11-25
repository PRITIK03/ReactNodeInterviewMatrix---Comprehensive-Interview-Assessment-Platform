import { useEffect, useRef, useState } from "react";
import { AudioPreflight, initialAudio, audioReady } from "./audio";
export default function Readiness() {
  const [state, set] = useState(initialAudio),
    ctrl = useRef(null);
  useEffect(() => {
    const c = new AudioPreflight(
      {
        media: navigator.mediaDevices,
        permissions: navigator.permissions,
        Context: window.AudioContext || window.webkitAudioContext,
        Recorder: window.MediaRecorder,
        frame: (cb) => requestAnimationFrame(cb),
        cancel: (id) => cancelAnimationFrame(id),
        url: (b) => URL.createObjectURL(b),
        revoke: (u) => URL.revokeObjectURL(u),
      },
      set,
    );
    ctrl.current = c;
    c.init();
    return () => {
      c.notify = () => {};
      c.dispose();
    };
  }, []);
  const supported = Boolean(
    navigator.mediaDevices?.getUserMedia &&
    (window.AudioContext || window.webkitAudioContext) &&
    window.MediaRecorder,
  );
  return (
    <section className="preflight">
      <h2>Microphone preflight</h2>
      <p>
        The level check uses your microphone when you enable it. Recording a
        four-second playback sample is optional and stays in this tab. Stopping
        the check discards it.
      </p>
      <dl className="checklist">
        <dt>Browser support</dt>
        <dd>
          {supported
            ? "Audio capture, analysis and recording available"
            : "A secure context and a compatible browser are required"}
        </dd>
        <dt>Permission</dt>
        <dd>{state.permission}</dd>
        <dt>Overall readiness</dt>
        <dd role="status" data-ready={audioReady(state)}>
          {audioReady(state)
            ? "Verified by signal and playback"
            : "Checks outstanding"}
        </dd>
      </dl>
      <button disabled={!supported} onClick={() => ctrl.current.start()}>
        {state.running ? "Restart microphone" : "Enable microphone"}
      </button>{" "}
      <button
        className="quiet"
        disabled={!state.running && !state.url && !state.issue}
        onClick={() => ctrl.current.stop()}
      >
        Stop and discard
      </button>
      {state.issue && <p role="alert">{state.issue}</p>}
      {state.running && (
        <>
          <label>
            Microphone
            <select
              value={state.selected}
              onChange={(e) => ctrl.current.start(e.target.value)}
            >
              {state.devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone " + (i + 1)}
                </option>
              ))}
            </select>
          </label>
          <label className="signal-level">
            Live input level <meter min="0" max="1" value={state.level} />
          </label>
          <p>
            {state.heard
              ? "Voice-level signal detected."
              : "Speak for a moment. No sustained signal detected yet."}
          </p>
          <button
            disabled={state.recording}
            onClick={() => ctrl.current.record()}
          >
            Record four-second local sample
          </button>
          {state.recording && (
            <strong role="status"> Recording microphone…</strong>
          )}
          {state.url && (
            <>
              <audio
                controls
                src={state.url}
                onEnded={() => ctrl.current.patch({ played: true })}
              />
              <label>
                <input
                  type="checkbox"
                  disabled={!state.played}
                  checked={state.confirmed}
                  onChange={(e) =>
                    ctrl.current.patch({ confirmed: e.target.checked })
                  }
                />{" "}
                I played the sample and could hear myself clearly.
              </label>
            </>
          )}
          {!state.confirmed && (
            <p>
              Record, play the sample to the end and confirm its clarity to
              finish.
            </p>
          )}
        </>
      )}
    </section>
  );
}
