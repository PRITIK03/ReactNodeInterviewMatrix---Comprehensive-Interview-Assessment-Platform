import { useEffect, useRef, useState } from "react";
import { browserMonitor, initialAudio, audioReady } from "./audio";
export default function Readiness() {
  const [state, set] = useState(initialAudio),
    ctrl = useRef(null);
  useEffect(() => {
    const c = browserMonitor(set);
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
        Enable your microphone to check the input level. To verify playback,
        record a four-second sample and confirm you can hear it. Stopping the
        check discards the sample.
      </p>
      <div className="preflight-console" aria-label="Microphone input monitor">
        <div>
          <span className="monitor-title">Input monitor</span>
          <strong>{state.running ? "Listening" : "Standby"}</strong>
        </div>
        <div className="meter-display" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i
              key={i}
              data-lit={
                state.running &&
                state.level > Math.pow(10, (-60 + i * 2.5) / 20)
              }
            />
          ))}
        </div>
        <small>
          {state.running ? "Live microphone level" : "Microphone off"}
        </small>
      </div>
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
