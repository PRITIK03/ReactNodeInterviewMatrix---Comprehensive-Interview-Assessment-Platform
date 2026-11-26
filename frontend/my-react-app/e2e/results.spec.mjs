import { expect, test } from "@playwright/test";

test("results keep each solution with its own verdicts and saved source", async ({
  page,
}) => {
  const attempt = {
    id: "result",
    version: "edition",
    kind: "coding",
    status: "complete",
    score: 2,
    total: 3,
    expires: 10,
    answers: { a: "print(3)", b: "print(7)" },
    questions: [
      { id: "a", prompt: "Sum the intervals" },
      { id: "b", prompt: "Find the peak" },
    ],
    case_results: [
      { question: "a", position: 0, hidden: false, status: "passed" },
      { question: "a", position: 1, hidden: true, status: "time_limit" },
      { question: "b", position: 0, hidden: false, status: "passed" },
    ],
  };
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/me")
      ? { role: "candidate" }
      : path.endsWith("/attempts/result")
        ? attempt
        : path.endsWith("/follow-ups")
          ? { turns: [], limit: 0 }
          : path.endsWith("/overview")
            ? { metrics: {} }
            : [];
    return route.fulfill({ json: data });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#assessments?attempt=result");
  await expect(
    page.getByRole("heading", { name: "Assessment result" }),
  ).toBeVisible();
  const verdicts = page.getByRole("list", { name: "Test verdicts" });
  await expect(verdicts.getByRole("listitem")).toHaveCount(2);
  await expect(verdicts.getByText("Time limit")).toBeVisible();
  await page.getByText("Submitted Python", { exact: true }).click();
  await expect(page.getByLabel("Submitted Python source")).toHaveText(
    "print(3)",
  );
  await page.getByLabel("Solution to discuss").selectOption("1");
  await expect(verdicts.getByRole("listitem")).toHaveCount(1);
  await page.getByText("Submitted Python", { exact: true }).click();
  await expect(page.getByLabel("Submitted Python source")).toHaveText(
    "print(7)",
  );
  await expect(page.locator(".tally-track i")).toHaveCSS(
    "animation-name",
    "none",
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
