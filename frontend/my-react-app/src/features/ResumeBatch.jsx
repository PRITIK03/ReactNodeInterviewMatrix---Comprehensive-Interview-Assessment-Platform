import { useEffect, useRef, useState } from "react";
import { Files, ArrowRight } from "lucide-react";
import { api } from "./client";

const types = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export default function ResumeBatch({ application, documents, refresh }) {
  const [rows, setRows] = useState([]),
    [consent, confirm] = useState(false),
    [busy, working] = useState(false),
    [notice, say] = useState("");
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  function select(files) {
    if (files.length > 8) {
      setRows([]);
      confirm(false);
      say("Select up to eight documents at a time.");
      return;
    }
    say("");
    confirm(false);
    setRows(
      files.map((file) => {
        const ext = file.name.split(".").pop().toLowerCase();
        const invalid =
          !Object.hasOwn(types, ext) ||
          (file.type && file.type !== types[ext]) ||
          !file.size ||
          file.size > 5 * 1024 * 1024;
        return {
          file,
          ext,
          key: crypto.randomUUID(),
          state: invalid ? "rejected" : "selected",
          error: invalid ? "Choose a non-empty PDF or DOCX up to 5 MiB." : "",
        };
      }),
    );
  }
  function patch(key, changes) {
    setRows((old) =>
      old.map((r) => (r.key === key ? { ...r, ...changes } : r)),
    );
  }
  const status = (r) =>
    documents?.find((d) => d.id === r.id)?.status || r.state;
  async function upload(items) {
    if (active.current || !consent) return;
    const controller = new AbortController();
    active.current = controller;
    working(true);
    const known = new Set([
      ...(documents || []).map((d) => d.id),
      ...rows.map((r) => r.id).filter(Boolean),
    ]);
    try {
      for (const row of items) {
        if (controller.signal.aborted) break;
        const retry = row.id && status(row) === "failed";
        patch(row.key, { state: "uploading", error: "" });
        try {
          const result = retry
            ? await api(
                "/resumes/" + row.id + "/retry",
                "POST",
                undefined,
                {},
                controller.signal,
              )
            : await api(
                "/applications/" + application + "/resumes",
                "POST",
                row.file,
                {
                  "Content-Type": types[row.ext],
                  "X-File-Extension": row.ext,
                  "X-Resume-Consent": "review-v1",
                },
                controller.signal,
              );
          if (!controller.signal.aborted)
            patch(row.key, {
              id: result.id || row.id,
              state: result.status,
              reused: !retry && known.has(result.id),
            });
          known.add(result.id);
        } catch (e) {
          if (!controller.signal.aborted)
            patch(row.key, { state: "upload error", error: e.message });
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        working(false);
        refresh();
      }
      active.current = null;
    }
  }
  const processing = documents?.filter((d) =>
    ["queued", "processing", "retrying"].includes(d.status),
  ).length;
  const failed = documents?.filter((d) =>
    ["failed", "upload_failed"].includes(d.status),
  ).length;
  const selected = rows.filter((r) => r.state === "selected");
  return (
    <section className="batch-session">
      <h4>
        <Files size={18} aria-hidden="true" /> Upload a group
      </h4>
      <p>
        Up to eight resumes for this application. The file list stays in this
        view; uploaded documents remain in the application.
      </p>
      {documents && (
        <p className="batch-counts">
          {processing} pending · {failed} failed{" "}
          <small>among this application’s listed documents</small>
        </p>
      )}
      <label>
        PDF or DOCX files
        <input
          type="file"
          multiple
          accept=".pdf,.docx"
          disabled={busy}
          onChange={(e) => select(Array.from(e.target.files))}
        />
      </label>
      {notice && <p role="alert">{notice}</p>}
      {rows.length > 0 && (
        <>
          <ol className="transfer-list">
            {rows.map((r) => (
              <li key={r.key} data-running={r.state === "uploading"}>
                <span>
                  {r.file.name}
                  <small>
                    {r.ext.toUpperCase()} · {Math.ceil(r.file.size / 1024)} KiB
                  </small>
                </span>
                <ArrowRight aria-hidden="true" size={15} />
                <strong>{status(r).replaceAll("_", " ")}</strong>
                {r.reused && <small>Existing document reused</small>}
                {r.error && <small role="alert">{r.error}</small>}
                {["upload error", "failed", "upload_failed"].includes(
                  status(r),
                ) && (
                  <button
                    disabled={busy || !consent}
                    onClick={() => upload([r])}
                  >
                    Retry file
                  </button>
                )}
                {["ready", "needs_review"].includes(status(r)) && (
                  <button
                    className="quiet"
                    onClick={() =>
                      document.getElementById("resume-" + r.id)?.focus()
                    }
                  >
                    Inspect document
                  </button>
                )}
              </li>
            ))}
          </ol>
          <label className="option">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => confirm(e.target.checked)}
            />
            The candidate authorized these uploads for this application.
          </label>
          <button
            disabled={!selected.length || !consent || busy}
            onClick={() => upload(selected)}
          >
            {busy ? "Uploading…" : "Upload selected files"}
          </button>
        </>
      )}
    </section>
  );
}
