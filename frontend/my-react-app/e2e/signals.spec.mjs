import { expect, test } from "@playwright/test";

test("daily completion counts are readable by keyboard and link to the graded attempt", async ({
  page,
}) => {
  const activity = Array.from({ length: 14 }, (_, i) => ({
    day: (20000 + i) * 86400,
    count: i === 3 ? 2 : 0,
  }));
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/me")
      ? { role: "candidate", email: "practice@example.org" }
      : path.endsWith("/overview")
        ? {
            activity,
            last_result: {
              id: "practice-result",
              kind: "coding",
              score: 4,
              total: 5,
            },
            metrics: {},
          }
        : [];
    return route.fulfill({ json: data });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/#assessments");
  const panel = page.getByRole("region", { name: "Assessment activity" });
  await expect(panel.locator(".activity-stat strong")).toHaveText("2");
  await panel.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(panel.locator("dl dd")).toHaveCount(14);
  await expect(panel.locator("dl dd").nth(3)).toHaveText("2");
  expect(
    await page
      .locator(".engraving")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.getByRole("button", { name: "Python coding review" }).click();
  await expect(page).toHaveURL(/attempt=practice-result/);
});

test("staff can filter the pipeline through current-stage totals", async ({
  page,
}) => {
  const rows = [
    { id: "a", name: "Applicant A", title: "Engineer", stage: "review" },
    { id: "b", name: "Applicant B", title: "Engineer", stage: "applied" },
  ];
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith("/me")
      ? { role: "recruiter" }
      : url.pathname.endsWith("/overview")
        ? {
            name: "Test studio",
            metrics: {},
            stages: { review: 1, applied: 1 },
          }
        : url.pathname.endsWith("/applications")
          ? rows.filter(
              (r) =>
                !url.searchParams.get("stage") ||
                r.stage === url.searchParams.get("stage"),
            )
          : [];
    return route.fulfill({ json: data });
  });
  await page.goto("/#applications");
  const stages = page.getByRole("group", {
    name: "Filter applications by current stage",
  });
  const review = stages.getByRole("button", { name: /review/i });
  await review.click();
  await expect(review).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Applicant A")).toBeVisible();
  await expect(page.getByText("Applicant B")).toHaveCount(0);
  await stages.getByRole("button", { name: /closed/i }).click();
  await expect(
    page.getByText("No applications match this stage."),
  ).toBeVisible();
  await stages.getByRole("button", { name: /all stages/i }).click();
  await expect(page.getByText("Applicant B")).toBeVisible();
});
