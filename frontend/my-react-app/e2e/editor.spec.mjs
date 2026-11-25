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
async function openEditor(page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
    const response = {
      "/me": { role: "candidate", email: "demo@example.org" },
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
  await page.getByRole("button", { name: "Open", exact: true }).click();
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
