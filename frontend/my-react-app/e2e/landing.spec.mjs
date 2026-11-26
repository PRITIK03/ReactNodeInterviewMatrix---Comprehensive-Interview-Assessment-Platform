import { expect, test } from "@playwright/test";

test("the public ledger, example trace and sign-in work without a candidate account", async ({
  page,
}) => {
  const writes = [];
  await page.route("**/api/v1/**", (route) => {
    if (route.request().method() !== "GET")
      writes.push(route.request().method());
    return route.fulfill({ status: 401, json: { detail: "Sign in required" } });
  });
  await page.goto("/");
  const opener = page.getByRole("button", {
    name: "Inspect evidence for Coding correctness",
  });
  await opener.click();
  await expect(page.getByRole("dialog")).toContainText("40 distinct minutes");
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  for (const total of [15, 35, 40]) {
    await page.getByRole("button", { name: "Trace next window" }).click();
    await expect(page.locator(".trace-action b")).toHaveText(
      total + " min covered",
    );
  }
  await page.getByRole("button", { name: "Replay example" }).click();
  await expect(page.locator(".trace-action b")).toHaveText("7 min covered");
  await page.getByRole("button", { name: "Aptitude", exact: true }).click();
  await expect(page.locator(".preview-panel")).toContainText(
    "What is 10% of 80?",
  );
  await page.getByRole("link", { name: "Open workspace" }).last().click();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("link", { name: "InterviewMatrix home" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "See the work behind a score.",
  );
  expect(writes).toEqual([]);
});

test("both landing sections fit small phones, tablets and wide screens with reduced motion", async ({
  page,
}) => {
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Sign in required" } }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#home");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [768, 1024],
    [820, 1180],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const elements = [
        ...document.querySelectorAll(
          ".landing :is(a:not(.skip-link),button,h1,h2,.preview-panel,.review-sheet)",
        ),
      ];
      return {
        scroll: document.documentElement.scrollWidth,
        outside: elements
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width && (r.right > innerWidth + 1 || r.left < -1);
          })
          .map((el) => el.textContent),
        animation: getComputedStyle(document.querySelector(".landing-copy"))
          .animationName,
      };
    });
    expect(layout.scroll, String(width)).toBeLessThanOrEqual(width);
    expect(layout.outside, String(width)).toEqual([]);
    expect(layout.animation).toBe("none");
  }
});
