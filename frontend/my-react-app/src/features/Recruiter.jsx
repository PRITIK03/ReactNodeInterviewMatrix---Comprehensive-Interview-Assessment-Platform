import { useResource } from "./useResource";
import React, { useState } from "react";
import { api } from "./client";
import {
  Dialog,
  Form,
  Field,
  Panel,
  Table,
  Status,
  Feedback,
  Pager,
} from "./ui";
function Assignments({ jobVersion, versions, revision, reload }) {
  const assigned = useResource(
    "/job-versions/" + jobVersion + "/assessments",
    revision,
  );
  return (
    <article>
      <h3>Assessments for this job version</h3>
      <Feedback resource={assigned} />
      {assigned.data?.map((a) => (
        <p key={a.id}>
          {a.company} · {a.level} · {a.kind}
        </p>
      ))}
      <Form
        label="Associate assessment"
        submit={async (f) => {
          await api("/job-versions/" + jobVersion + "/assessments", "POST", f);
          reload();
        }}
      >
        <Field label="Published assessment">
          <select name="assessment">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company} · {v.level} · {v.kind}
              </option>
            ))}
          </select>
        </Field>
      </Form>
    </article>
  );
}
export default function Recruiter({ revision, reload, versions }) {
  const [assignment, chooseAssignment] = useState(null);
  const [search, find] = useState(""),
    [edit, setEdit] = useState(null),
    [weights, setWeights] = useState([]),
    [offset, page] = useState(0),
    [jobOffset, jobPage] = useState(0);
  const jobs = useResource("/jobs?offset=" + jobOffset, revision),
    people = useResource(
      "/candidates?search=" + encodeURIComponent(search) + "&offset=" + offset,
      revision,
    );
  function field(index, key, value) {
    setWeights((items) =>
      items.map((w, i) => (i === index ? { ...w, [key]: value } : w)),
    );
  }
  function open(j = {}) {
    setEdit(j);
    setWeights(j.criteria || [{ name: "", weight: 100 }]);
  }
  return (
    <>
      <Panel
        title="Job library"
        action={<button onClick={() => open()}>Create job</button>}
      >
        <Feedback resource={jobs} />
        {jobs.data && (
          <Table
            empty="No jobs on this page."
            headers={["Role", "Version", "Publication", "Criteria"]}
            rows={jobs.data.map((j) => [
              j.id,
              j.title,
              "v" + j.revision,
              <Status>{j.status}</Status>,
              <div>
                <button className="quiet" onClick={() => open(j)}>
                  Review / revise
                </button>{" "}
                {j.status === "published" && (
                  <button
                    className="quiet"
                    onClick={() => chooseAssignment(j.id)}
                  >
                    Assessments
                  </button>
                )}
              </div>,
            ])}
          />
        )}
        <Pager offset={jobOffset} onPage={jobPage} count={jobs.data?.length} />
      </Panel>
      {assignment && (
        <Assignments
          jobVersion={assignment}
          versions={versions}
          revision={revision}
          reload={reload}
        />
      )}
      {edit && (
        <Dialog
          title={edit.id ? "Revise job" : "Create job"}
          onClose={() => setEdit(null)}
        >
          <Form
            label="Save version"
            submit={async (f) => {
              await api(
                edit.id ? "/jobs/" + edit.job + "/versions" : "/jobs",
                "POST",
                { ...f, criteria: weights },
              );
              setEdit(null);
              reload();
            }}
          >
            <Field label="Job title">
              <input required name="title" defaultValue={edit.title} />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                required
                defaultValue={edit.description}
              />
            </Field>
            <Field label="Publication">
              <select name="status" defaultValue={edit.status}>
                <option>draft</option>
                <option>published</option>
              </select>
            </Field>
            <h4>Evaluation criteria</h4>
            {weights.map((w, i) => (
              <fieldset key={i} className="rubric-entry">
                <legend>Criterion {i + 1}</legend>
                <Field label="Criterion name">
                  <input
                    value={w.name}
                    required
                    onChange={(e) => field(i, "name", e.target.value)}
                  />
                </Field>
                <Field label="Weight percent">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={w.weight}
                    onChange={(e) => field(i, "weight", Number(e.target.value))}
                  />
                </Field>
                <label>
                  Evidence type
                  <select
                    value={w.evaluation_type || "skills"}
                    onChange={(e) =>
                      field(i, "evaluation_type", e.target.value)
                    }
                  >
                    {[
                      "skills",
                      "employment",
                      "projects",
                      "education",
                      "aptitude",
                      "coding",
                      "code_review",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input
                    value={w.description || ""}
                    placeholder="Job-related requirement"
                    onChange={(e) => field(i, "description", e.target.value)}
                  />
                </label>
                <label>
                  Required evidence
                  <input
                    value={w.required_evidence || ""}
                    placeholder="Exact resume entry, Documented function, or completed assessment"
                    onChange={(e) =>
                      field(i, "required_evidence", e.target.value)
                    }
                  />
                </label>
                <label>
                  Maximum score
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={w.scale ?? 100}
                    onChange={(e) => field(i, "scale", Number(e.target.value))}
                  />
                </label>
                <label>
                  Instructions
                  <select
                    value={w.instructions || "explicit evidence only"}
                    onChange={(e) => field(i, "instructions", e.target.value)}
                  >
                    <option>explicit evidence only</option>
                    <option>require human confirmation</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setWeights(weights.filter((_, j) => i !== j))}
                >
                  Remove
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="quiet"
              onClick={() => setWeights([...weights, { name: "", weight: 1 }])}
            >
              Add criterion
            </button>
            <p>
              Total weight {weights.reduce((s, w) => s + w.weight, 0)} / 100
            </p>
          </Form>
        </Dialog>
      )}
      <Panel title="Candidate directory">
        <details className="command">
          <summary>Add a candidate</summary>
          <Form
            label="Add candidate"
            submit={async (f, form) => {
              await api("/candidates", "POST", f);
              form.reset();
              reload();
            }}
          >
            <div className="row">
              <Field label="Candidate name">
                <input name="name" required />
              </Field>
              <Field label="Contact email">
                <input name="email" type="email" required />
              </Field>
            </div>
          </Form>
        </details>
        <Field label="Find candidate">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              find(e.target.value);
              page(0);
            }}
          />
        </Field>
        <Feedback resource={people} />
        {people.data && (
          <Table
            empty="No candidates match this view."
            headers={["Candidate", "Contact"]}
            rows={people.data.map((p) => [p.id, p.name, p.email])}
          />
        )}
        <Pager offset={offset} onPage={page} count={people.data?.length} />
        <details className="command">
          <summary>Create application</summary>
          <Form
            label="Add to pipeline"
            submit={async (f) => {
              await api("/applications", "POST", f);
              reload();
            }}
          >
            <div className="row">
              <Field label="Candidate">
                <select name="candidate" required>
                  {people.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Published role">
                <select name="job_version" required>
                  {jobs.data
                    ?.filter((j) => j.status === "published")
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} · v{j.revision}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </Form>
        </details>
      </Panel>
    </>
  );
}
