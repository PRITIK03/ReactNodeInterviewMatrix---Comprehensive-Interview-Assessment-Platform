import { expect, test } from "@playwright/test";

test("a recruiter corrects an over-allocated rubric before saving a version", async ({
  page,
}) => {
  let saved;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/jobs") && route.request().method() === "POST")
      saved = route.request().postDataJSON();
    const data = path.endsWith("/me")
      ? { role: "recruiter" }
      : path.endsWith("/overview")
        ? { name: "Hiring workspace", metrics: {} }
        : [];
    return route.fulfill({ json: data });
  });
  await page.goto("/#jobs");
  await page.getByRole("button", { name: "Create job" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job title").fill("Python engineer");
  await dialog
    .getByLabel("Description", { exact: true })
    .first()
    .fill("Build scheduling tools.");
  await dialog.getByLabel("Criterion name").fill("Correctness");
  await dialog.getByRole("button", { name: "Add criterion" }).click();
  await dialog.getByLabel("Criterion name").nth(1).fill("Reasoning");
  await expect(
    dialog.getByRole("button", { name: "Save version" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("status")).toHaveText(/reduce weights by 1/i);
  await dialog.getByLabel("Weight percent").first().fill("70");
  await dialog.getByLabel("Weight percent").nth(1).fill("30");
  await expect(dialog.getByRole("status")).toHaveText("Fully allocated");
  await dialog.getByRole("button", { name: "Save version" }).click();
  await expect(dialog).not.toBeVisible();
  expect(saved.criteria.map((c) => c.weight)).toEqual([70, 30]);
});
