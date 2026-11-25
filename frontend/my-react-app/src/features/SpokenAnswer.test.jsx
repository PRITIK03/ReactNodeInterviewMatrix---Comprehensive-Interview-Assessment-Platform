// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SpokenAnswer from "./SpokenAnswer";

let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal("isSecureContext", true);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("offers typing when the browser lacks speech recognition", async () => {
  await act(async () => root.render(<SpokenAnswer onSave={vi.fn()} />));
  expect(host.textContent).toContain("Voice input is unavailable");
  expect(host.querySelector("textarea").disabled).toBe(false);
  expect(host.querySelector("[aria-pressed]")).toBeNull();
});
it("handles permission denial and leaves the text editable", async () => {
  const save = vi.fn();
  vi.stubGlobal(
    "SpeechRecognition",
    class {
      start() {
        queueMicrotask(() => {
          this.onerror({ error: "not-allowed" });
          this.onend();
        });
      }
    },
  );
  await act(async () => root.render(<SpokenAnswer onSave={save} />));
  await act(async () => host.querySelector("[aria-pressed]").click());
  expect(host.textContent).toContain("permission was denied");
  expect(host.querySelector("textarea").disabled).toBe(false);
  expect(save).not.toHaveBeenCalled();
});
it("aborts an active recognition session when leaving the question", async () => {
  const abort = vi.fn();
  vi.stubGlobal(
    "SpeechRecognition",
    class {
      start() {}
      abort = abort;
    },
  );
  await act(async () => root.render(<SpokenAnswer onSave={vi.fn()} />));
  await act(async () => host.querySelector("[aria-pressed]").click());
  await act(async () => root.render(null));
  expect(abort).toHaveBeenCalledOnce();
});
