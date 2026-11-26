import {
  FileText,
  Terminal,
  CircleHelp,
  GitBranch,
  CheckCheck,
} from "lucide-react";
import SharedExplanations from "./SharedExplanations";
import { useState } from "react";
import { api, date } from "./client";
import { useResource } from "./useResource";
import { Form, Field, Feedback } from "./ui";

export default function Evaluation({ application, admin }) {
  const [revision, bump] = useState(0),
    [id, select] = useState("");
  const path = "/applications/" + application;
  const list = useResource(admin && path + "/evaluations", revision),
    resource = useResource(admin && id && "/evaluations/" + id, revision),
    card = resource.data;
  const update = () => bump((x) => x + 1);
  async function review(f, criterion = null) {
    if (f.action === "override" && !f.value?.trim())
      throw new Error("Enter a revised score.");
    await api("/evaluations/" + id + "/review", "POST", {
      action: f.action,
      criterion,
      reason: f.reason,
      revision: card.revision,
      value: f.action === "override" ? Number(f.value) : null,
    });
    update();
  }
  if (!admin)
    return (
      <details>
        <summary>External evaluation permission</summary>
        <p>
          Gemini can verify coded evidence references and allowed score values
          for this application. Resume text, code and contact details stay in
          the workspace.
        </p>
        <Form
          label="Save permission"
          submit={async (f, form) => {
            await api(path + "/evaluation-permission", "PUT", {
              allowed: f.permission === "yes",
            });
            form.querySelector("output").textContent = "Permission saved.";
          }}
        >
          <select name="permission" aria-label="External evaluation permission">
            <option value="no">Decline or withdraw</option>
            <option value="yes">Allow Gemini verification</option>
          </select>
          <output />
        </Form>
      </details>
    );
  const locked =
    card?.stale ||
    card?.history.some((e) =>
      ["review_complete", "request_information"].includes(e.action),
    );
  return (
    <section>
      <h3>Evaluation and human review</h3>
      <Form
        label="Generate scorecard"
        submit={async (f) => {
          const v = await api(path + "/evaluations", "POST", f);
          select(v.id);
          update();
        }}
      >
        <Field label="Evidence scope">
          <select name="scope">
            <option>combined</option>
            <option>resume</option>
            <option>assessment</option>
          </select>
        </Field>
        <Field label="Evaluation method">
          <select name="provider">
            <option value="local">Published evidence rules</option>
            <option value="gemini">Gemini verification</option>
          </select>
        </Field>
      </Form>
      <Feedback resource={list} />
      {list.data?.map((e) => (
        <button className="quiet" key={e.id} onClick={() => select(e.id)}>
          {e.scope} · {e.provider} · {date(e.created)}
        </button>
      ))}
      {id && <Feedback resource={resource} />}
      {card && (
        <>
          <p>
            Job version <code>{card.version.slice(0, 12)}</code> · {card.model}{" "}
            · {card.prompt}
          </p>
          {card.stale && (
            <p role="alert">
              Source evidence changed. Generate a new evaluation before
              reviewing.
            </p>
          )}
          <dl className="score-ledger">
            <div>
              <dt>Reference score</dt>
              <dd>
                {card.reference_aggregate.score_percent == null
                  ? "Incomplete"
                  : card.reference_aggregate.score_percent + "%"}
              </dd>
            </div>
            <div>
              <dt>Human-reviewed score</dt>
              <dd>
                {card.reviewed_aggregate.score_percent == null
                  ? "Incomplete"
                  : card.reviewed_aggregate.score_percent + "%"}
              </dd>
            </div>
            <div>
              <dt>Approved weight</dt>
              <dd>
                {card.reviewed_aggregate.covered_weight}/
                {card.reviewed_aggregate.scope_weight}
              </dd>
            </div>
          </dl>
          <div className="evidence-map">
            <h4>
              <GitBranch size={24} aria-hidden="true" /> Evidence trail
            </h4>
            <p>
              {card.provider === "gemini"
                ? "Gemini verification"
                : "Published evidence rules"}{" "}
              · Select a criterion to inspect its finding.
            </p>
            {card.criteria.map((v) => {
              const last = card.history
                .filter(
                  (e) =>
                    e.criterion === v.criterion_id &&
                    ["override", "accept"].includes(e.action),
                )
                .at(-1);
              return (
                <button
                  key={v.criterion_id}
                  className="trace-route"
                  onClick={() => {
                    const target = document.getElementById(
                      "finding-" + v.criterion_id,
                    );
                    const details = target?.querySelector("details");
                    if (details) details.open = true;
                    target?.focus();
                  }}
                >
                  <span className="trail-criterion">
                    {v.rubric.name}
                    <small>Weight {v.rubric.weight}%</small>
                  </span>
                  <i aria-hidden="true" />
                  <span className="trail-source">
                    {v.source?.document ? (
                      <FileText size={15} aria-hidden="true" />
                    ) : v.source ? (
                      <Terminal size={15} aria-hidden="true" />
                    ) : (
                      <CircleHelp size={15} aria-hidden="true" />
                    )}
                    {card.stale
                      ? "Source changed"
                      : v.source?.document
                        ? "Resume claim"
                        : v.source
                          ? "Assessment record"
                          : "Missing evidence"}
                  </span>
                  <i aria-hidden="true" />
                  <span className="trail-decision" data-approved={v.approved}>
                    {v.approved && <CheckCheck aria-hidden="true" size={16} />}
                    {last?.action === "override"
                      ? "Reviewer override"
                      : v.approved
                        ? "Reviewer accepted"
                        : "Awaiting review"}
                  </span>
                </button>
              );
            })}
          </div>
          {card.criteria.map((v) => (
            <article
              id={"finding-" + v.criterion_id}
              tabIndex={-1}
              key={v.criterion_id}
            >
              <h4>
                {v.rubric.name} · {v.rubric.weight}%
              </h4>
              <p>
                {v.rubric.description} · {v.rubric.instructions}
              </p>
              <p>
                Proposed {v.score ?? "Unscored"} / {v.rubric.scale} ·{" "}
                {v.explanation}. Confidence label {v.confidence}.{" "}
                {v.limitations}.
              </p>
              {v.missing_evidence !== "none" && (
                <p role="status">{v.missing_evidence}</p>
              )}
              {v.source && (
                <details>
                  <summary>Inspect supporting evidence</summary>
                  <blockquote>{v.source.text}</blockquote>
                  <p>
                    {v.source.quality} · {v.source.kind} ·{" "}
                    {v.source.document
                      ? "Document " +
                        v.source.document +
                        " · generation " +
                        v.source.generation +
                        " · " +
                        (v.source.page ? "page " + v.source.page : "DOCX") +
                        " · characters " +
                        v.source.start +
                        "–" +
                        v.source.end
                      : "Attempt " +
                        v.source.attempt +
                        " · version " +
                        v.source.version}
                  </p>
                  {v.source.line && (
                    <p>
                      Question {v.source.question} · line {v.source.line}
                    </p>
                  )}
                  {v.source.cases?.map((t) => (
                    <p key={t.question + t.position}>
                      {t.question.slice(0, 8)} · case {t.position + 1} ·{" "}
                      {t.status}
                    </p>
                  ))}
                </details>
              )}
              {v.source?.attempt &&
                ["coding", "code_review"].includes(
                  v.rubric.evaluation_type,
                ) && (
                  <SharedExplanations
                    application={application}
                    revision={revision}
                    source={v.source}
                  />
                )}
              {v.approved && <p>Reviewer score {v.reviewed_score}</p>}
              {!locked && (
                <Form
                  label="Record criterion review"
                  submit={(f) => review(f, v.criterion_id)}
                >
                  <Field label="Action">
                    <select name="action">
                      <option value="accept">Accept proposed score</option>
                      <option value="override">Override score</option>
                    </select>
                  </Field>
                  <Field label="Override value">
                    <input
                      type="number"
                      name="value"
                      min="0"
                      max={v.rubric.scale}
                    />
                  </Field>
                  <Field label="Review reason">
                    <input required maxLength="800" name="reason" />
                  </Field>
                </Form>
              )}
            </article>
          ))}
          {!locked && (
            <Form
              label="Record human decision or note"
              submit={(f) => review(f)}
            >
              <select name="action" aria-label="Review disposition">
                <option value="note">Add note</option>
                <option value="request_information">
                  Request more information
                </option>
                <option value="review_complete">Complete human review</option>
              </select>
              <Field label="Decision rationale">
                <textarea required maxLength="800" name="reason" />
              </Field>
            </Form>
          )}
          <h4>Review history</h4>
          {card.history.map((e) => (
            <p key={e.id}>
              {date(e.at)} · reviewer {e.actor.slice(0, 8)} · {e.action}{" "}
              {e.criterion}{" "}
              {e.revised != null &&
                " · " + (e.original ?? "unscored") + " → " + e.revised}{" "}
              · {e.reason}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
