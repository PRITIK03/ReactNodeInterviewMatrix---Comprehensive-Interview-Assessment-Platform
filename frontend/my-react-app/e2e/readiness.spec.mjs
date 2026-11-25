import { test, expect } from "@playwright/test";
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test("synthetic microphone passes only after local playback confirmation", async ({
  page,
}) => {
  // Feed a continuous generated tone into the browser's real Web Audio and MediaRecorder APIs.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext(),
        tone = ctx.createOscillator(),
        output = ctx.createMediaStreamDestination();
      tone.connect(output);
      tone.start();
      await ctx.resume();
      const track = output.stream.getAudioTracks()[0],
        stop = track.stop.bind(track);
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "audioinput",
          deviceId: track.getSettings().deviceId || "synthetic",
          label: "Generated tone",
        },
      ];
      track.stop = () => {
        stop();
        tone.stop();
        ctx.close();
      };
      return output.stream;
    };
  });
  const posts = [];
  await page.route("**/api/v1/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (r.request().method() !== "GET") posts.push(path);
    await r.fulfill({
      json: path.endsWith("/me")
        ? { role: "candidate", email: "demo@example.org" }
        : path.endsWith("/overview")
          ? { name: "Candidate", metrics: {} }
          : [],
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Readiness" }).click();
  await expect(page.getByRole("status")).toHaveText("Checks outstanding");
  await page.getByRole("button", { name: "Enable microphone" }).click();
  await expect(page.getByText("Voice-level signal detected.")).toBeVisible();
  await page.getByText("Record four-second local sample").click();
  await expect(page.getByText("Recording microphone…")).toBeVisible();
  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /^blob:/);
  await audio.evaluate((a) => a.play());
  const heard = page.getByRole("checkbox");
  await expect(heard).toBeEnabled({ timeout: 10000 });
  await heard.check();
  await expect(page.getByRole("status")).toContainText("Verified by signal");
  await page.getByRole("button", { name: "Stop and discard" }).click();
  await expect(audio).toHaveCount(0);
  expect(posts).toEqual([]);
});
