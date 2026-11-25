import { expect, test } from "@playwright/test";

test("company, track and level resolve one version and survive refresh and Back", async ({
  page,
}) => {
  const versions = ["accenture", "amazon"].flatMap((company) =>
    ["aptitude", "coding"].flatMap((kind) =>
      ["advanced", "beginner", "intermediate"].map((level) => ({
        company,
        kind,
        level,
        id: [company, kind, level].join("-"),
        minutes: 30,
        question_count: kind === "coding" ? 3 : 15,
      })),
    ),
  );
  const starts = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
    const value = {
      "/me": { role: "candidate", email: "demo@example.org" },
      "/overview": { metrics: {} },
      "/assessments": versions,
      "/attempts": [],
      "/attempts/started": {
        id: "started",
        version: versions[0].id,
        kind: "aptitude",
        expires: 4102444800,
        answers: {},
        questions: [
          { id: "q", prompt: "Choose a number", options: ["1", "2"] },
        ],
        status: "open",
      },
    };
    if (path === "/attempts" && route.request().method() === "POST") {
      starts.push(route.request().postDataJSON());
      if (starts.length === 1) return route.abort();
      return route.fulfill({ json: { id: "started" } });
    }
    return route.fulfill({ json: value[path] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Accenture", exact: true }).click();
  await expect(page.locator(".track")).toHaveCount(2);
  await page.getByRole("link", { name: "Python coding", exact: true }).click();
  const levels = page.locator(".level-list button strong");
  await expect(levels).toHaveText(["Beginner", "Intermediate", "Advanced"]);
  await page.reload();
  await expect(levels).toHaveCount(3);
  await page.getByRole("link", { name: "Amazon", exact: true }).click();
  await expect(page.locator(".track")).toHaveCount(2);
  await page.goBack();
  await expect(levels).toHaveCount(3);
  expect(starts).toEqual([]);
  await page.getByRole("link", { name: "Accenture assessments" }).click();
  await page.getByRole("link", { name: "Aptitude", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Intermediate Aptitude" })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Start Intermediate Aptitude" })
    .click();
  await expect(page.getByText("Choose a number")).toBeVisible();
  expect(starts).toHaveLength(2);
  expect(starts[0].version).toBe("accenture-aptitude-intermediate");
  expect(starts[0]).toEqual(starts[1]);
  await page.getByRole("button", { name: "← Workspace" }).click();
  await expect(levels).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Profile", exact: true }),
  ).toBeInViewport();
});

test("workspace outage offers retry and an empty library has its own state", async ({
  page,
}) => {
  let restored = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/me") && !restored)
      return route.fulfill({
        status: 503,
        json: { detail: "Workspace temporarily unavailable" },
      });
    return route.fulfill({
      json: path.endsWith("/me")
        ? { role: "candidate", email: "demo@example.org" }
        : path.endsWith("/overview")
          ? { metrics: {} }
          : [],
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Workspace temporarily unavailable",
  );
  await expect(page.getByLabel("Password")).toHaveCount(0);
  restored = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText("No published practice assessments yet."),
  ).toBeVisible();
});
