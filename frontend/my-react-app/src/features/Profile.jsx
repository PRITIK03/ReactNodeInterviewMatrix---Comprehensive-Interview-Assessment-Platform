import { useState } from "react";
import { LockKeyhole, Mail, Pencil } from "lucide-react";
import { useResource } from "./useResource";
import { api } from "./client";
import { Dialog, Form, Field, Feedback } from "./ui";

export default function Profile({ user, revision, reload, overview }) {
  const profile = useResource("/profile", revision);
  const [editing, edit] = useState(false);
  const [notice, setNotice] = useState("");
  const name = profile.data?.name || user.email.split("@")[0];
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
  return (
    <>
      <Feedback resource={profile} />
      {profile.data && (
        <section className="identity">
          <div className="identity-cover" aria-hidden="true" />
          <div className="identity-content">
            <div className="identity-actions">
              <span className="avatar" aria-hidden="true">
                {initials}
              </span>
              <button
                className="quiet"
                onClick={() => {
                  edit(true);
                  setNotice("");
                }}
              >
                <Pencil size={15} /> Edit profile
              </button>
            </div>
            <h2>{name}</h2>
            {profile.data.headline && <p>{profile.data.headline}</p>}
            <p className="contact">
              <Mail size={16} />
              {user.email}
            </p>
          </div>
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {editing && (
        <Dialog title="Edit profile" onClose={() => edit(false)}>
          <Form
            label="Save profile"
            submit={async (fields) => {
              await api("/profile", "PUT", fields);
              edit(false);
              setNotice("Profile saved.");
              reload();
            }}
          >
            <Field label="Display name">
              <input
                name="name"
                maxLength={120}
                defaultValue={profile.data?.name}
                autoComplete="name"
              />
            </Field>
            <Field label="Professional headline">
              <input
                name="headline"
                maxLength={240}
                defaultValue={profile.data?.headline}
              />
            </Field>
          </Form>
        </Dialog>
      )}
      <section>
        <h2>Assessment activity</h2>
        <Feedback resource={overview} />
        {overview.data && (
          <div className="metrics">
            {Object.entries(overview.data.metrics).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="privacy">
        <LockKeyhole size={17} />
        <span>
          Your profile is private. Resume sharing is managed per application.
        </span>
      </div>
    </>
  );
}
