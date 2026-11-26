import { test, expect } from "@playwright/test";
test.use({ permissions: ["clipboard-read", "clipboard-write"] });
const attempt = {
  id: "sample-attempt",
  version: "sample-version",
  kind: "coding",
  status: "open",
  expires: 4102444800,
  answers: {},
  questions: [
    {
      id: "q1",
      prompt: "Implement a function",
      description: "Read a number.",
      example: { input: "1", output: "1" },
    },
  ],
};
async function openEditor(page, discussionHandler) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
    if (discussionHandler && path.includes("/follow-ups"))
      return discussionHandler(route, path);
    const response = {
      "/me": { role: "candidate", email: "demo@example.org" },
      "/attempts/sample-attempt/questions/q1/follow-ups": {
        turns: [],
        limit: 4,
        gemini_available: false,
      },
      "/assessments": [],
      "/overview": { name: "Candidate", metrics: {} },
      "/attempts": [{ ...attempt, company: "Practice", started: 1 }],
      "/attempts/sample-attempt": attempt,
    };
    await route.fulfill({ json: response[path] ?? {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByRole("textbox", { name: "Python submission" }).focus();
}
const value = (p) =>
  p.evaluate(
    () =>
      JSON.parse(
        sessionStorage.getItem("matrix-draft/sample-attempt/sample-version") ||
          "{}",
      ).q1 || "",
  );
test("Monaco preserves Python indentation, paste, undo, resize and recovery", async ({
  page,
}) => {
  await openEditor(page);
  const k = page.keyboard;
  await k.type("def f():");
  await k.press("End");
  await k.press("Enter");
  await k.type("if True:");
  await k.press("Enter");
  await k.type("pass");
  await k.press("Enter");
  await expect
    .poll(() => value(page))
    .toBe("def f():\n    if True:\n        pass\n    ");
  await k.press("Backspace");
  await expect.poll(() => value(page)).toMatch(/pass\n$/);
  await k.press("ControlOrMeta+a");
  const pasted = "def add(a, b):\n    return (\n        a + b\n    )";
  await page.evaluate((text) => navigator.clipboard.writeText(text), pasted);
  await k.press("ControlOrMeta+v");
  await expect.poll(() => value(page)).toBe(pasted);
  await k.press("ControlOrMeta+z");
  await expect.poll(() => value(page)).not.toBe(pasted);
  await k.press("ControlOrMeta+Shift+z");
  await expect.poll(() => value(page)).toBe(pasted);
  const old = (await page.locator(".monaco-editor").boundingBox()).width;
  await page.setViewportSize({ width: 540, height: 800 });
  await expect
    .poll(
      async () => (await page.locator(".monaco-editor").boundingBox()).width,
    )
    .toBeLessThan(old);
  await page.route("**/draft", (route) => route.abort());
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "retained" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Python submission" }),
  ).toBeVisible();
  await expect.poll(() => value(page)).toBe(pasted);
});
test("continuation and terminal statements use the configured indent width", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByLabel("Indent width").selectOption("2");
  const editor = page.getByRole("textbox", { name: "Python submission" });
  await editor.focus();
  const k = page.keyboard;
  for (const statement of ["return 1", "break", "continue", "pass"]) {
    await k.press("ControlOrMeta+a");
    await k.type("while True:");
    await k.press("Enter");
    await k.type(statement);
    await k.press("Enter");
    await expect
      .poll(() => value(page))
      .toBe("while True:\n  " + statement + "\n");
  }
  await k.press("ControlOrMeta+a");
  await k.type("v = [");
  await k.press("Enter");
  await k.type("1,");
  await expect.poll(() => value(page)).toContain("v = [\n  1,");
});

test("Enter moves directly inside a for loop and a nested if", async ({
  page,
}) => {
  await openEditor(page);
  const k = page.keyboard;
  await k.type("for item in items:");
  await k.press("Enter");
  await k.type("if item:");
  await k.press("Enter");
  await k.type("print");
  await expect
    .poll(() => value(page))
    .toBe("for item in items:\n    if item:\n        print");
});

test("Enter indents the body after a multiline Python header", async ({
  page,
}) => {
  await openEditor(page);
  const header = "if (\n    ready and available\n):";
  await page.evaluate((text) => navigator.clipboard.writeText(text), header);
  await page.keyboard.press("ControlOrMeta+v");
  await page.keyboard.press("Enter");
  await page.keyboard.type("start");
  await expect.poll(() => value(page)).toBe(header + "\n    start");
});

test("saved code starts a discussion, speech is editable and the confirmed reply survives reload", async ({
  page,
}) => {
  const turns = [];
  const saved = [];
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        window.emitSpeech = (words, final) => {
          const segment = [{ transcript: words }];
          segment.isFinal = final;
          this.onresult({ results: [segment] });
        };
      }
      stop() {
        this.onend();
      }
      abort() {
        this.onend();
      }
    };
  });
  await openEditor(page, async (route) => {
    const method = route.request().method();
    if (method === "GET")
      return route.fulfill({
        json: { turns, limit: 4, gemini_available: false },
      });
    if (method === "POST") {
      turns.push({
        turn: 1,
        line: 1,
        excerpt: "total = 0",
        prompt: "What does total represent?",
        provider: "local",
        reply: null,
      });
      return route.fulfill({ json: turns[0] });
    }
    saved.push(route.request().postDataJSON());
    turns[0].reply = saved[0].text;
    turns[0].analysis = {
      identifiers: [],
      phrases: [],
      next_step: "Give an input that illustrates the calculation.",
    };
    return route.fulfill({ json: turns[0] });
  });
  await page.keyboard.type("total = 0");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("What does total represent?")).toBeVisible();
  const box = page.getByLabel("Your explanation");
  await box.fill("My reasoning.");
  await page.getByRole("button", { name: "Dictate answer" }).click();
  await page.evaluate(() => window.emitSpeech("a sum", false));
  await expect(page.getByText("a sum", { exact: true })).toBeVisible();
  await page.evaluate(() => window.emitSpeech("It tracks a sum.", true));
  await page.getByRole("button", { name: "Stop dictation" }).click();
  await expect(box).toHaveValue("My reasoning. It tracks a sum.");
  expect(saved).toHaveLength(0);
  await box.fill("It tracks the cumulative sum.");
  await page.getByRole("button", { name: "Save explanation" }).click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Python submission" }),
  ).toBeVisible();
  await expect(page.getByText("It tracks the cumulative sum.")).toBeVisible();
  await expect(
    page.getByText("Explanation notes", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Give an input that illustrates/)).toBeVisible();
  expect(saved).toEqual([{ text: "It tracks the cumulative sum." }]);
});

test("confirmed dictation inserts once at the cursor and preserves surrounding Python", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        window.deliver = (phrase, final) => {
          const segment = [{ transcript: phrase }];
          segment.isFinal = final;
          this.onresult({ results: [segment] });
        };
      }
      stop() {
        this.onend();
      }
      abort() {
        this.onend();
      }
    };
  });
  await openEditor(page);
  await page.keyboard.type("leftRight");
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Voice input" }).click();
  await page.getByRole("button", { name: "Start dictation" }).click();
  await page.evaluate(() => {
    window.deliver("middle", false);
    window.deliver("middle", true);
    window.deliver("middle", true);
  });
  await page.getByRole("button", { name: "Stop dictation" }).click();
  await expect(page.getByLabel("Transcript preview")).toHaveValue("middle");
  await page.getByRole("button", { name: "Insert at cursor" }).click();
  await expect.poll(() => value(page)).toBe("leftmiddleRight");
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => value(page)).toBe("leftRight");
});
