import Evaluation from "./Evaluation";
import { useResource } from "./useResource";
import React, { useEffect, useState } from "react";
import { api, date } from "./client";
import {
  Status,
  Score,
  Form,
  Field,
  Feedback,
  Panel,
  Table,
  Pager,
} from "./ui";

function Resume({ row, admin, revision, reload }) {
  const r = useResource("/resumes/" + row.id, revision),
    data = r.data;
  return (
    <article>
      <h4>
        {row.format.toUpperCase()} · {date(row.created)}{" "}
        <Status>{row.status}</Status>
      </h4>
      <small>
        Source document {row.id} · expires {date(row.expires)}
      </small>
      <Feedback resource={r} />
      {data && (
        <>
          {data.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          {Object.entries(data.facts || {})
            .filter(([, v]) => v.length)
            .map(([field, facts]) => (
              <details key={field}>
                <summary>
                  {field} ({facts.length})
                </summary>
                {facts.map((f, i) => (
                  <blockquote key={i}>
                    {f.value}
                    <small>
                      {f.status} · {f.confidence} confidence ·{" "}
                      {f.evidence.method} ·{" "}
                      {f.evidence.page ? "page " + f.evidence.page : "document"}{" "}
                      · characters {f.evidence.start}–{f.evidence.end}
                    </small>
                    <q>{f.evidence.excerpt}</q>
                  </blockquote>
                ))}
              </details>
            ))}
          {data.facts && (
            <a href={"/api/v1/resumes/" + row.id + "/original"} download>
              Download source document
            </a>
          )}
          {data.corrections.map((c, i) => (
            <p key={i}>
              <b>Reviewed {c.field}</b> · {c.value} ({c.reason})
            </p>
          ))}
          {admin && data.facts && (
            <Form
              label="Save correction"
              submit={async (f) => {
                await api("/resumes/" + row.id + "/corrections", "POST", f);
                reload();
              }}
            >
              <Field label="Field">
                <select name="field">
                  {Object.keys(data.facts).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="Corrected value">
                <input name="value" required />
              </Field>
              <Field label="Reason">
                <input name="reason" required />
              </Field>
            </Form>
          )}
          <div className="row">
            <Form
              label="Reprocess"
              submit={async () => {
                await api("/resumes/" + row.id + "/retry", "POST");
                reload();
              }}
            />
            <Form
              label="Delete document"
              submit={async () => {
                if (
                  window.confirm(
                    "Delete this resume, extracted facts and corrections?",
                  )
                ) {
                  await api("/resumes/" + row.id, "DELETE");
                  reload();
                }
              }}
            />
          </div>
        </>
      )}
    </article>
  );
}
export default function Applications({
  admin,
  versions,
  start,
  revision,
  reload,
}) {
  const [filter, setFilter] = useState(""),
    [id, select] = useState(""),
    [offset, page] = useState(0),
    [token, showToken] = useState("");
  const rows = useResource(
      "/applications?stage=" + filter + "&offset=" + offset,
      revision,
    ),
    item = useResource(id && "/applications/" + id, revision),
    docs = useResource(id && "/applications/" + id + "/resumes", revision);
  const [docTick, update] = useState(0);
  const pending = docs.data?.some((d) =>
    ["uploading", "queued", "processing", "retrying"].includes(d.status),
  );
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      update(docTick + 1);
      reload();
    }, 5000);
    return () => clearTimeout(t);
  }, [pending, docTick, reload]);
  return (
    <Panel title={admin ? "Candidate pipeline" : "My applications"}>
      <Field label="Stage filter">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            page(0);
          }}
        >
          {["", "applied", "assessment", "review", "closed"].map((v) => (
            <option key={v} value={v}>
              {v || "All stages"}
            </option>
          ))}
        </select>
      </Field>
      <Feedback resource={rows} />
      {rows.data && (
        <Table
          empty="No applications match this stage."
          headers={["Candidate", "Job", "Stage", "Application"]}
          rows={rows.data.map((r) => [
            r.id,
            r.name,
            r.title,
            <Status>{r.stage}</Status>,
            <button
              onClick={() => {
                select(r.id);
                showToken("");
              }}
            >
              Open
            </button>,
          ])}
        />
      )}
      <Pager offset={offset} onPage={page} count={rows.data?.length} />
      {id && (
        <>
          <Feedback resource={item} />
          {item.data && (
            <article>
              <h3>
                {item.data.name} · {item.data.title}
              </h3>
              <p>
                {item.data.history
                  .map((r) => r.stage + " (" + date(r.at) + ")")
                  .join(" → ")}
              </p>
              {admin && item.data.stage !== "closed" && (
                <Form
                  label="Update stage"
                  submit={async (f) => {
                    await api("/applications/" + id + "/stage", "POST", f);
                    reload();
                  }}
                >
                  <select name="stage">
                    {(
                      {
                        applied: ["assessment", "closed"],
                        assessment: ["review", "closed"],
                        review: ["closed"],
                      }[item.data.stage] || []
                    ).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Form>
              )}
              {admin && ["assessment", "applied"].includes(item.data.stage) && (
                <Form
                  label="Create private invitation"
                  submit={async (f) => {
                    const r = await api(
                      "/applications/" + id + "/invitations",
                      "POST",
                      {
                        version: f.version,
                        expires: Math.floor(
                          new Date(f.deadline).getTime() / 1000,
                        ),
                      },
                    );
                    showToken(r.token);
                    reload();
                  }}
                >
                  <Field label="Assessment version">
                    <select name="version">
                      {versions.map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.company} · {v.level} · {v.kind}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Expiry (local time)">
                    <input type="datetime-local" name="deadline" required />
                  </Field>
                </Form>
              )}
              {token && (
                <label>
                  Share this one-time claim code privately with the candidate
                  <input
                    readOnly
                    value={token}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              <h4>Assessment invitations</h4>
              {item.data.invitations.map((i) => (
                <p key={i.id}>
                  <Status>{i.status}</Status> · expires {date(i.expires)} ·{" "}
                  <Score {...i} />
                  {!admin && i.accepted && (
                    <button onClick={() => start(i.version, i.id)}>
                      Open attempt
                    </button>
                  )}
                </p>
              ))}
              <Evaluation key={id} application={id} admin={admin} />
              <h4>Resume evidence</h4>
              <p>
                Private to the candidate and this hiring workspace. Documents
                expire after 90 days. Extracted facts can be corrected or
                deleted.
              </p>
              {!admin && (
                <Form
                  label="Allow recruiter upload"
                  submit={async () => {
                    await api(
                      "/applications/" + id + "/resume-consent",
                      "POST",
                    );
                    reload();
                  }}
                >
                  <label className="option">
                    <input type="checkbox" required />I authorize my recruiter
                    to upload a resume for this application.
                  </label>
                </Form>
              )}
              <Form
                label="Upload resume"
                submit={async (f) => {
                  const ext = f.file.name.split(".").pop().toLowerCase();
                  await api(
                    "/applications/" + id + "/resumes",
                    "POST",
                    f.file,
                    {
                      "Content-Type": f.file.type,
                      "X-File-Extension": ext,
                      "X-Resume-Consent": "review-v1",
                    },
                  );
                  reload();
                }}
              >
                <input type="file" accept=".pdf,.docx" name="file" required />
                <label className="option">
                  <input type="checkbox" required />
                  {admin
                    ? "The candidate authorized this upload."
                    : "I authorize extraction and review for this application."}
                </label>
              </Form>
              <Feedback resource={docs} />
              {docs.data?.map((r) => (
                <Resume
                  key={r.id}
                  row={r}
                  admin={admin}
                  revision={revision}
                  reload={reload}
                />
              ))}
            </article>
          )}
        </>
      )}
    </Panel>
  );
}
