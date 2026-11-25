import React, { useEffect, useState } from "react";
export function Status({ children }) {
  return (
    <span className="status" data-state={String(children)}>
      {String(children).replaceAll("_", " ")}
    </span>
  );
}
export function Score({ score, total }) {
  return <strong>{score == null ? "Pending" : score + " / " + total}</strong>;
}
export function Panel({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Table({ headers, rows }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, ...cells]) => (
            <tr key={id}>
              {cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted">No records yet.</p>}
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export function Form({ submit, label, children }) {
  const [busy, set] = useState(false),
    [err, fail] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = e.currentTarget;
        const fields = Object.fromEntries(new FormData(f));
        set(true);
        fail("");
        try {
          await submit(fields, f);
        } catch (error) {
          fail(error.message);
        } finally {
          set(false);
        }
      }}
    >
      {children}
      {err && <p role="alert">{err}</p>}
      <button disabled={busy}>{busy ? "Working…" : label}</button>
    </form>
  );
}
export function Feedback({ resource }) {
  return resource.error ? (
    <p role="alert">{resource.error}</p>
  ) : resource.data === null ? (
    <p role="status">Loading…</p>
  ) : null;
}
export function Dialog({ title, children, onClose }) {
  const ref = React.useRef(null);
  const titleId = React.useId();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose}>
      <header>
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose}>Close</button>
      </header>
      {children}
    </dialog>
  );
}
