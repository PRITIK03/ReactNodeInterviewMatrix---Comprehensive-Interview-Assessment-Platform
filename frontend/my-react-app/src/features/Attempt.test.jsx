// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Attempt from "./Attempt";
import { api } from "./client";

vi.mock("./client", () => ({ api: vi.fn(), date: () => "Local deadline" }));
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(api).mockReset().mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const item = {
  id: "attempt-a",
  version: "version-a",
  kind: "aptitude",
  status: "open",
  score: null,
  total: null,
  answers: {},
  case_results: [],
  expires: 4102444800,
  questions: [
    { id: "question-a", prompt: "Choose a color", options: ["Green", "Red"] },
  ],
};

it("posts only the chosen response and assigned question ID", async () => {
  const refresh = vi.fn();
  await act(async () =>
    root.render(<Attempt item={item} refresh={refresh} leave={() => {}} />),
  );
  await act(async () => host.querySelector("input[type=radio]").click());
  await act(async () => host.querySelector("form").requestSubmit());
  expect(api).toHaveBeenCalledWith("/attempts/attempt-a/submit", "POST", {
    answers: [{ question_id: "question-a", value: "Green" }],
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it("displays the stored score after recovery and locks the form", async () => {
  await act(async () =>
    root.render(
      <Attempt
        item={{
          ...item,
          status: "complete",
          score: 0,
          total: 1,
          answers: { "question-a": "Green" },
        }}
      />,
    ),
  );
  expect(host.textContent).toContain("0 / 1");
  expect(host.querySelector("form")).toBeNull();
});

it("uses the server clock even when the browser clock is ahead", async () => {
  const serverNow = Math.floor(Date.now() / 1000) - 3600;
  await act(async () =>
    root.render(
      <Attempt
        item={{ ...item, server_now: serverNow, expires: serverNow + 45 }}
      />,
    ),
  );
  expect(host.querySelector("input[type=radio]").disabled).toBe(false);
  expect(
    host.querySelector(".time-left[data-urgent=true] time").textContent,
  ).toBe("0:45");
});

it("keeps newer edits marked unsaved when an earlier save finishes", async () => {
  let finish;
  api.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => root.render(<Attempt item={item} />));
  const choices = host.querySelectorAll("input[type=radio]");
  await act(async () => choices[0].click());
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Save draft",
  );
  await act(async () => button.click());
  await act(async () => choices[1].click());
  await act(async () => finish({ saved: true }));
  expect(host.querySelector('[role="status"]').textContent).toContain(
    "Unsaved changes",
  );
});

it("reports an oversized answer with the server's reason", async () => {
  api.mockRejectedValueOnce(
    Object.assign(new Error("Answer too large"), { status: 413 }),
  );
  await act(async () => root.render(<Attempt item={item} />));
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent === "Save draft")
      .click(),
  );
  expect(host.textContent).toContain("Answer too large");
});

it("locks answers during submission and reconciles a committed runner failure", async () => {
  let reject;
  api.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  api.mockResolvedValueOnce({ status: "runner_unavailable" });
  const refresh = vi.fn();
  await act(async () => root.render(<Attempt item={item} refresh={refresh} />));
  await act(async () => host.querySelector("input[type=radio]").click());
  await act(async () => host.querySelector("form").requestSubmit());
  const locked = host.querySelector("input[type=radio]").disabled;
  await act(async () =>
    reject(Object.assign(new Error("Runner unavailable"), { status: 503 })),
  );
  expect(locked).toBe(true);
  expect(refresh).toHaveBeenCalledOnce();
});

it("ignores damaged cached entries and stores only edits the server has not confirmed", async () => {
  const key = "matrix-draft/attempt-a/version-a";
  sessionStorage.setItem(
    key,
    JSON.stringify({ "question-a": 99, removed: "unrelated" }),
  );
  await act(async () =>
    root.render(
      <Attempt item={{ ...item, answers: { "question-a": "Green" } }} />,
    ),
  );
  expect(host.querySelectorAll("input")[0].checked).toBe(true);
  expect(sessionStorage.getItem(key)).toBeNull();
  await act(async () => host.querySelectorAll("input")[1].click());
  expect(JSON.parse(sessionStorage.getItem(key))).toEqual({
    "question-a": "Red",
  });
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent === "Save draft")
      .click(),
  );
  expect(sessionStorage.getItem(key)).toBeNull();
});
