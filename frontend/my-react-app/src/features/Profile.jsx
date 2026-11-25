import { useResource } from "./useResource";
import { api } from "./client";
import { Panel, Form, Field, Feedback } from "./ui";

export default function Profile({ user, revision, reload }) {
  const profile = useResource("/profile", revision);
  return (
    <Panel title="Candidate profile">
      <p>{user.email}</p>
      <p>
        This profile is private to your account. Recruiters see the candidate
        record and results for their own applications. You choose whether to
        share a resume with each workspace.
      </p>
      <Feedback resource={profile} />
      {profile.data && (
        <Form
          label="Save profile"
          submit={async (fields) => {
            await api("/profile", "PUT", fields);
            reload();
          }}
        >
          <Field label="Display name">
            <input
              name="name"
              maxLength={120}
              defaultValue={profile.data.name}
            />
          </Field>
          <Field label="Professional headline">
            <input
              name="headline"
              maxLength={240}
              defaultValue={profile.data.headline}
            />
          </Field>
        </Form>
      )}
    </Panel>
  );
}
