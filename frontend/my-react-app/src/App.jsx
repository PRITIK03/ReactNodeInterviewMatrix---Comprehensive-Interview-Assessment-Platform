import { useResource } from "./features/useResource";
import React, { useCallback, useState } from "react";
import { api, date } from "./features/client";
import {
  Panel,
  Form,
  Field,
  Table,
  Score,
  Status,
  Feedback,
} from "./features/ui";
import Recruiter from "./features/Recruiter";
import Readiness from "./features/Readiness";
import Applications from "./features/Applications";
import Profile from "./features/Profile";
import Attempt from "./features/Attempt";
import LinearProgress from "@mui/material/LinearProgress";
import "./workspace.css";

function Login({ done }) {
  const [register, toggle] = useState(false),
    [role, setRole] = useState("candidate");
  return (
    <Panel title={register ? "Create your account" : "Welcome back"}>
      <Form
        label={register ? "Create account" : "Sign in"}
        submit={async (f) => {
          if (register) await api("/register", "POST", { ...f, role });
          await api("/login", "POST", { email: f.email, password: f.password });
          done();
        }}
      >
        <Field label="Email">
          <input type="email" name="email" required />
        </Field>
        <Field label="Password · 12 characters minimum">
          <input type="password" name="password" minLength="12" required />
        </Field>
        {register && (
          <>
            <Field label="Workspace">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="candidate">Candidate</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </Field>
            {role === "recruiter" && (
              <Field label="New organization">
                <input name="organization" required />
              </Field>
            )}
          </>
        )}
      </Form>
      <button className="quiet" onClick={() => toggle(!register)}>
        {register ? "Already registered? Sign in" : "Create an account"}
      </button>
    </Panel>
  );
}
function InvitationList({ start, revision }) {
  const [offset, page] = useState(0),
    rows = useResource("/invitations?offset=" + offset, revision);
  return (
    <Panel title="Assessment invitations">
      <Feedback resource={rows} />
      {rows.data && (
        <Table
          headers={["Role", "Organization", "Expires", "State", "Assessment"]}
          rows={rows.data.map((i) => [
            i.id,
            i.title,
            i.organization,
            date(i.expires),
            <Status>{i.status}</Status>,
            i.accepted && i.status !== "expired" ? (
              <button onClick={() => start(i.version, i.id)}>
                Open attempt
              </button>
            ) : (
              "Claim code required"
            ),
          ])}
        />
      )}
      <button disabled={!offset} onClick={() => page(offset - 50)}>
        Previous
      </button>{" "}
      <button
        disabled={rows.data?.length !== 50}
        onClick={() => page(offset + 50)}
      >
        Next
      </button>
    </Panel>
  );
}
function Workspace({ user, signout }) {
  const admin = user.role === "recruiter";
  const [rev, bump] = useState(0),
    [tab, go] = useState(admin ? "Jobs" : "Assessments"),
    [id, setId] = useState(""),
    [err, fail] = useState(""),
    [company, choose] = useState(""),
    [offset, page] = useState(0);
  const reload = useCallback(() => bump((x) => x + 1), []);
  const versions = useResource("/assessments", rev),
    history = useResource(!admin && "/attempts?offset=" + offset, rev),
    attempt = useResource(id && "/attempts/" + id, rev),
    overview = useResource("/overview", rev);
  async function start(version, invitation = null) {
    try {
      const r = await api("/attempts", "POST", {
        version,
        invitation,
        request_key: crypto.randomUUID(),
      });
      setId(r.id);
      go("Assessments");
      fail("");
    } catch (e) {
      fail(e.message);
    }
  }
  return (
    <>
      <header className="mast">
        <b>InterviewMatrix</b>
        <span>
          {user.email}{" "}
          <button className="quiet" onClick={signout}>
            Sign out
          </button>
        </span>
      </header>
      <main>
        <p className="eyebrow">
          {admin ? "Hiring workspace" : "Candidate workspace"}
        </p>
        <h1>{admin ? "Recruitment overview" : "Assessment studio"}</h1>
        <nav>
          {(admin
            ? ["Jobs", "Applications"]
            : ["Assessments", "Applications", "Readiness", "Profile"]
          ).map((t) => (
            <button
              className={tab === t ? "" : "quiet"}
              key={t}
              onClick={() => {
                go(t);
                setId("");
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        {err && <p role="alert">{err}</p>}
        {overview.data ? (
          <div className="overview">
            <strong>{overview.data.name}</strong>
            {Object.entries(overview.data.metrics).map(([k, v]) => (
              <span key={k}>
                <b>{v}</b> {k}
              </span>
            ))}
          </div>
        ) : overview.error ? (
          <p role="alert">{overview.error}</p>
        ) : (
          <LinearProgress />
        )}
        {tab === "Jobs" && (
          <Recruiter
            versions={versions.data || []}
            revision={rev}
            reload={reload}
          />
        )}
        {tab === "Applications" && (
          <>
            {!admin && (
              <Panel title="Accept an invitation">
                <Form
                  label="Claim assessment"
                  submit={async (f, form) => {
                    await api("/invitations/accept", "POST", f);
                    form.reset();
                    reload();
                  }}
                >
                  <Field label="Private invitation code">
                    <input required name="token" autoComplete="off" />
                  </Field>
                </Form>
              </Panel>
            )}
            {!admin && <InvitationList start={start} revision={rev} />}
            <Applications
              admin={admin}
              versions={versions.data || []}
              start={start}
              revision={rev}
              reload={reload}
            />
          </>
        )}
        {tab === "Readiness" && <Readiness />}
        {tab === "Profile" && (
          <Profile user={user} revision={rev} reload={reload} />
        )}
        {tab === "Assessments" &&
          (id ? (
            <>
              <Feedback resource={attempt} />
              {attempt.data && (
                <Attempt
                  key={id}
                  item={attempt.data}
                  refresh={reload}
                  leave={() => {
                    setId("");
                    reload();
                  }}
                />
              )}
            </>
          ) : (
            <>
              <Panel title="Your attempts">
                <Feedback resource={history} />
                {history.data && (
                  <Table
                    headers={[
                      "Assessment",
                      "Started",
                      "State",
                      "Score",
                      "Attempt",
                    ]}
                    rows={history.data.map((a) => [
                      a.id,
                      a.company + " · " + a.kind,
                      date(a.started),
                      <Status>{a.status}</Status>,
                      <Score {...a} />,
                      <button onClick={() => setId(a.id)}>Open</button>,
                    ])}
                  />
                )}
                <button disabled={!offset} onClick={() => page(offset - 50)}>
                  Previous
                </button>{" "}
                <button
                  disabled={history.data?.length !== 50}
                  onClick={() => page(offset + 50)}
                >
                  Next
                </button>
              </Panel>
              <Panel title="Practice library">
                <Field label="Company">
                  <select
                    value={company}
                    onChange={(e) => choose(e.target.value)}
                  >
                    <option value="">All companies</option>
                    {[
                      ...new Set((versions.data || []).map((v) => v.company)),
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Feedback resource={versions} />
                <div className="grid">
                  {versions.data
                    ?.filter((v) => !company || company === v.company)
                    .map((v) => (
                      <article key={v.id}>
                        <small>{v.company.toUpperCase()}</small>
                        <h3>
                          {v.kind === "coding" ? "Python coding" : "Aptitude"}
                        </h3>
                        <p>
                          {v.level} · {v.minutes} min
                        </p>
                        <button onClick={() => start(v.id)}>
                          Start assessment
                        </button>
                      </article>
                    ))}
                </div>
              </Panel>
            </>
          ))}
      </main>
    </>
  );
}
export default function App() {
  const [rev, bump] = useState(0),
    session = useResource("/me", rev);
  if (session.data)
    return (
      <Workspace
        user={session.data}
        signout={async () => {
          await api("/logout", "POST");
          for (const k of Object.keys(sessionStorage))
            if (k.startsWith("matrix-draft/")) sessionStorage.removeItem(k);
          bump((x) => x + 1);
        }}
      />
    );
  return (
    <main className="entry">
      <p className="eyebrow">InterviewMatrix</p>
      <h1>Assessment workspace</h1>
      {session.error ? (
        <Login done={() => bump((x) => x + 1)} />
      ) : (
        <Feedback resource={session} />
      )}
    </main>
  );
}
