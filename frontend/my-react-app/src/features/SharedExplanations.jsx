import { useState } from "react";
import { useResource } from "./useResource";
import { Feedback, Pager } from "./ui";
import { date } from "./client";
export default function SharedExplanations({ application, revision, source }) {
  const [open, setOpen] = useState(false);
  const [offset, page] = useState(0);
  const filter = source
    ? "&attempt=" +
      encodeURIComponent(source.attempt) +
      (source.question
        ? "&question=" + encodeURIComponent(source.question)
        : "")
    : "";
  const rows = useResource(
    open &&
      "/applications/" +
        application +
        "/shared-explanations?offset=" +
        offset +
        filter,
    revision,
  );
  const visible = rows.data?.filter(
    (r) =>
      !source ||
      (r.attempt === source.attempt &&
        (!source.question || r.question === source.question)),
  );
  return (
    <section className="shared-explanations">
      <button
        type="button"
        className="quiet"
        aria-expanded={open}
        onClick={() => {
          if (!open) rows.retry();
          setOpen(!open);
        }}
      >
        {source
          ? "Candidate explanations for this submission"
          : "Shared coding explanations"}
      </button>
      {open && (
        <>
          <Feedback resource={rows} />
          {visible?.length === 0 && (
            <p className="empty">No shared explanations on this page.</p>
          )}
          {visible?.map((r) => (
            <article key={[r.attempt, r.question, r.turn].join("/")}>
              <small>
                Problem {r.position + 1} · Follow-up {r.turn} · Saved line{" "}
                {r.line} · Shared {date(r.shared_at)}
              </small>
              <h4>{r.prompt}</h4>
              <pre>{r.excerpt}</pre>
              <blockquote>{r.reply}</blockquote>
            </article>
          ))}
          <Pager offset={offset} onPage={page} count={rows.data?.length} />
        </>
      )}
    </section>
  );
}
