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
