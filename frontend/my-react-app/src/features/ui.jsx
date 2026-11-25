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
export function Panel({ title, children, action }) {
  return (
    <section>
      {action ? (
        <header className="section-heading">
          <h2>{title}</h2>
          {action}
        </header>
      ) : (
        <h2>{title}</h2>
      )}
      {children}
    </section>
  );
}
export function Table({ headers, rows, empty = "No records yet." }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
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
    </div>
  );
}
export function Pager({ offset, count, onPage }) {
  if (!offset && count !== 50) return null;
  return (
    <div className="pager">
      <button disabled={!offset} onClick={() => onPage(offset - 50)}>
        Previous
      </button>
      <button disabled={count !== 50} onClick={() => onPage(offset + 50)}>
        Next
      </button>
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
export function Feedback({ resource, loading = "Loading…" }) {
  return resource.error ? (
    <div className="resource-error" role="alert">
      {resource.error}{" "}
      {resource.retry && (
        <button type="button" className="quiet" onClick={resource.retry}>
          Try again
        </button>
      )}
    </div>
  ) : resource.data === null ? (
    <p className="loading" role="status">
      {loading}
    </p>
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
