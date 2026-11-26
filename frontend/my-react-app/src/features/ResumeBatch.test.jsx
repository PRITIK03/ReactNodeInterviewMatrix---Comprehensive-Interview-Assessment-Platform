// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import ResumeBatch from "./ResumeBatch";
import { api } from "./client";
vi.mock("./client", () => ({ api: vi.fn() }));
it("keeps successful uploads when another file fails and retries only that file", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div"),
    root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ResumeBatch
          application="application-one"
          documents={[{ id: "another-document", status: "uploading" }]}
          refresh={() => {}}
        />,
      ),
    );
    expect(host.querySelector(".batch-counts").textContent).toContain("1 pending");
    const input = host.querySelector("input[type=file]");
    const files = ["one.pdf", "two.pdf", "script.txt"].map(
      (name) => new File(["fixture"], name),
    );
    Object.defineProperty(input, "files", { value: files });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    const button = (name) =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === name);
    expect(host.textContent).toContain("rejected");
    expect(button("Upload selected files").disabled).toBe(true);
    await act(async () => host.querySelector("input[type=checkbox]").click());
    api
      .mockResolvedValueOnce({ id: "one", status: "queued" })
      .mockRejectedValueOnce(new Error("Unavailable"));
    await act(async () => button("Upload selected files").click());
    expect(host.querySelectorAll("li")[0].textContent).toContain("queued");
    api.mockResolvedValueOnce({ id: "one", status: "queued" });
    await act(async () => button("Retry file").click());
    expect(host.querySelectorAll("li")[1].textContent).toContain(
      "Existing document reused",
    );
    expect(api.mock.calls.map((c) => c[2].name)).toEqual([
      "one.pdf",
      "two.pdf",
      "two.pdf",
    ]);
    expect(
      api.mock.calls.every(
        (c) =>
          c[0] === "/applications/application-one/resumes" &&
          c[3]["X-Resume-Consent"] === "review-v1",
      ),
    ).toBe(true);
  } finally {
    await act(async () => root.unmount());
  }
});
