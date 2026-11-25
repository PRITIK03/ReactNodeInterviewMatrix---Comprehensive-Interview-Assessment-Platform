import { useResource } from "./features/useResource";
import React, {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { api, date, displayName } from "./features/client";
import {
  Pager,
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
import PracticeLibrary from "./features/PracticeLibrary";
import {
  AudioLines,
  BriefcaseBusiness,
  CircleUserRound,
  FolderOpen,
  LibraryBig,
  LogOut,
  ListChecks,
  History,
} from "lucide-react";
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
          <input type="email" name="email" autoComplete="username" required />
        </Field>
        <Field
          label={register ? "Password (12 or more characters)" : "Password"}
        >
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
          empty="No assessment invitations on this page."
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
      <Pager offset={offset} onPage={page} count={rows.data?.length} />
    </Panel>
  );
}
const navigation = {
  Assessments: LibraryBig,
  Jobs: BriefcaseBusiness,
  Applications: FolderOpen,
  Readiness: AudioLines,
  Profile: CircleUserRound,
};
function subscribeLocation(update) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
const currentLocation = () => window.location.hash.slice(1);
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <ListChecks size={22} strokeWidth={2.2} />
      </span>
      InterviewMatrix
    </span>
  );
}
function Workspace({ user, signout }) {
  const admin = user.role === "recruiter";
  const tabs = admin
    ? ["Jobs", "Applications"]
    : ["Assessments", "Applications", "Readiness", "Profile"];
  const route = useSyncExternalStore(subscribeLocation, currentLocation);
  const [path, query] = route.split("?");
  const [section, company, kind] = path.split("/");
  const tab = tabs.find((t) => t.toLowerCase() === section) || tabs[0];
  const attemptId = new URLSearchParams(query).get("attempt") || "";
  const id =
    tab === "Assessments" && /^[\w-]{1,64}$/.test(attemptId) && attemptId;
  const [rev, bump] = useState(0),
    [err, fail] = useState(""),
    [offset, page] = useState(0);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pending = useRef(false);
  const startKeys = useRef(new Map());
  const reload = useCallback(() => bump((x) => x + 1), []);
  const versions = useResource(
      admin ? "/assessments" : "/assessments?current_only=true",
      rev,
      true,
    ),
    history = useResource(!admin && "/attempts?offset=" + offset, rev),
    attempt = useResource(id && "/attempts/" + id, rev),
    overview = useResource("/overview", rev);
  const libraryPath = section === "assessments" ? path : "assessments";
  const openAttempt = (key) => {
    window.location.hash = libraryPath + "?attempt=" + encodeURIComponent(key);
  };
  async function start(version, invitation = null) {
    if (pending.current) return;
    pending.current = true;
    setStarting(true);
    const target = JSON.stringify([version, invitation]);
    if (!startKeys.current.has(target))
      startKeys.current.set(target, crypto.randomUUID());
    try {
      const r = await api("/attempts", "POST", {
        version,
        invitation,
        request_key: startKeys.current.get(target),
      });
      startKeys.current.delete(target);
      openAttempt(r.id);
      fail("");
    } catch (e) {
      fail(e.message);
    } finally {
      pending.current = false;
      setStarting(false);
    }
  }
  const pageTitle =
    tab === "Assessments"
      ? id
        ? attempt.data
          ? attempt.data.kind === "coding"
            ? "Python assessment"
            : "Aptitude assessment"
          : "Assessment"
        : "Practice library"
      : tab;
  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <header className="masthead">
        <div className="mast-inner">
          <Brand />
          <span className="workspace-name">
            {admin
              ? overview.data?.name || "Recruiter workspace"
              : "Candidate workspace"}
          </span>
          <button
            className="signout"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              try {
                await signout();
              } catch {
                fail(
                  "Sign-out could not be confirmed. Check your connection and try again.",
                );
                setLeaving(false);
              }
            }}
          >
            <LogOut size={16} />
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <nav className="index-nav" aria-label="Workspace">
          {tabs.map((t) => {
            const Icon = navigation[t];
            return (
              <button
                className="index-link"
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => {
                  window.location.hash = t.toLowerCase();
                  fail("");
                }}
              >
                <Icon size={16} />
                {t === "Assessments" ? "Practice library" : t}
              </button>
            );
          })}
        </nav>
      </header>
      <div className="canvas">
        <main id="workspace" tabIndex={-1} data-area={tab.toLowerCase()}>
          <header className="page-heading">
            <h1>{pageTitle}</h1>
            {tab === "Assessments" && !id && versions.data?.length > 0 && (
              <p className="catalog-size">
                <strong>{versions.data.length}</strong> practice assessments
              </p>
            )}
          </header>
          {err && <p role="alert">{err}</p>}
          {admin && tab === "Jobs" && overview.data && (
            <div className="metrics">
              {Object.entries(overview.data.metrics).map(([label, n]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
          )}
          {admin && overview.error && <p role="alert">{overview.error}</p>}
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
            <Profile
              user={user}
              revision={rev}
              reload={reload}
              overview={overview}
            />
          )}
          {tab === "Assessments" &&
            (id ? (
              <>
                <Feedback resource={attempt} loading="Opening assessment…" />
                {attempt.data && (
                  <Attempt
                    key={id}
                    item={attempt.data}
                    refresh={reload}
                    leave={() => {
                      window.location.hash = libraryPath;
                      reload();
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <PracticeLibrary
                  catalog={versions}
                  companyKey={company}
                  kindKey={kind}
                  start={start}
                  starting={starting}
                />
                <section className="attempt-history">
                  <h2>
                    <History size={21} /> Your attempts
                  </h2>
                  <Feedback
                    resource={history}
                    loading="Loading your attempts…"
                  />
                  {history.data &&
                    (history.data.length ? (
                      <Table
                        headers={[
                          "Assessment",
                          "Started",
                          "State",
                          "Score",
                          "",
                        ]}
                        rows={history.data.map((a) => [
                          a.id,
                          <span className="attempt-name">
                            <strong>{displayName(a.kind)}</strong>
                            <small>
                              {displayName(a.company)} · {displayName(a.level)}
                            </small>
                          </span>,
                          date(a.started),
                          <Status>{a.status}</Status>,
                          <Score {...a} />,
                          <button
                            className="quiet"
                            onClick={() => openAttempt(a.id)}
                          >
                            Open
                          </button>,
                        ])}
                      />
                    ) : (
                      <p className="empty">
                        {offset
                          ? "No more attempts."
                          : "You haven’t started an assessment yet."}
                      </p>
                    ))}
                  <Pager
                    offset={offset}
                    onPage={page}
                    count={history.data?.length}
                  />
                </section>
              </>
            ))}
        </main>
      </div>
    </div>
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
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          for (const k of Object.keys(sessionStorage))
            if (k.startsWith("matrix-draft/")) sessionStorage.removeItem(k);
          bump((x) => x + 1);
        }}
      />
    );
  return (
    <main className="entry">
      <Brand />
      <div className="entry-sheet">
        {session.status === 401 ? (
          <Login done={() => bump((x) => x + 1)} />
        ) : (
          <Feedback resource={session} loading="Opening workspace…" />
        )}
      </div>
    </main>
  );
}
