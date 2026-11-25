import { it, expect, vi } from "vitest";
import { AudioPreflight, audioReady } from "./audio";
function rig() {
  const track = { stop: vi.fn(), getSettings: () => ({ deviceId: "mic1" }) };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  let frame,
    level = 128,
    clock = 0;
  const media = {
    getUserMedia: vi.fn(async () => stream),
    enumerateDevices: async () => [
      { kind: "audioinput", deviceId: "mic1", label: "Test microphone" },
    ],
  };
  class Context {
    async resume() {}
    async close() {}
    createAnalyser() {
      return { getByteTimeDomainData: (b) => b.fill(level) };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
  }
  class Recorder {
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob(["sample"]) });
      this.onstop();
    }
  }
  const env = {
    media,
    Context,
    Recorder,
    frame: (fn) => {
      frame = fn;
      return 1;
    },
    cancel: vi.fn(),
    url: () => "blob:local",
    revoke: vi.fn(),
  };
  const c = new AudioPreflight(env, () => {});
  return {
    env,
    c,
    track,
    stream,
    tick: (value) => {
      level = value;
      for (let i = 1; i <= 4; i++) frame((clock += 120));
    },
  };
}
it("requires signal, completed playback and explicit confirmation", async () => {
  const { c, tick, env, track } = rig();
  await c.start();
  tick(128);
  expect(c.state.heard).toBe(false);
  expect(audioReady(c.state)).toBe(false);
  tick(156);
  expect(c.state.heard).toBe(true);
  c.record();
  expect(c.state.recording).toBe(true);
  c.recorder.stop();
  expect(c.state.url).toBe("blob:local");
  expect(audioReady(c.state)).toBe(false);
  c.patch({ played: true, confirmed: true });
  expect(audioReady(c.state)).toBe(true);
  await c.start("mic1");
  expect(track.stop).toHaveBeenCalled();
  expect(env.revoke).toHaveBeenCalledWith("blob:local");
  expect(env.media.getUserMedia).toHaveBeenLastCalledWith({
    audio: { deviceId: { exact: "mic1" } },
    video: false,
  });
  expect(audioReady(c.state)).toBe(false);
  c.dispose();
});
it.each([
  ["NotAllowedError", "settings"],
  ["NotFoundError", "No microphone"],
  ["NotReadableError", "unavailable"],
])("reports %s", async (name, message) => {
  const { c, env } = rig();
  env.media.getUserMedia.mockRejectedValue({ name });
  await c.start();
  expect(c.state.issue).toContain(message);
  expect(c.state.running).toBe(false);
});
it("releases late streams after cancellation", async () => {
  const { env, c, track, stream } = rig();
  let resolve;
  env.media.getUserMedia.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = c.start();
  c.stop();
  resolve(stream);
  await pending;
  expect(track.stop).toHaveBeenCalled();
  expect(c.state.running).toBe(false);
});
it("reports browser incompatibility without requesting permission", async () => {
  const { env, c } = rig();
  env.Recorder = null;
  await c.start();
  expect(c.state.issue).toMatch(/support/);
  expect(env.media.getUserMedia).not.toHaveBeenCalled();
});
