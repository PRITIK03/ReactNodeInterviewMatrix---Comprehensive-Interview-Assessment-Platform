export const initialAudio = {
  running: false,
  permission: "unknown",
  level: 0,
  heard: false,
  recording: false,
  url: "",
  played: false,
  confirmed: false,
  devices: [],
  selected: "",
  issue: "",
};
export function audioReady(s) {
  return (
    s.running && s.heard && s.played && s.confirmed && !s.recording && !s.issue
  );
}
export function rms(samples) {
  return Math.sqrt(
    samples.reduce((n, x) => n + ((x - 128) / 128) ** 2, 0) / samples.length,
  );
}
export class AudioPreflight {
  constructor(env, notify) {
    this.env = env;
    this.notify = notify;
    this.state = { ...initialAudio };
    this.generation = 0;
    this.onDevices = () => this.enumerate(this.generation);
  }
  patch(values) {
    this.state = { ...this.state, ...values };
    this.notify(this.state);
  }
  get compatible() {
    return Boolean(
      this.env.media?.getUserMedia && this.env.Context && this.env.Recorder,
    );
  }
  async init() {
    this.env.media?.addEventListener?.("devicechange", this.onDevices);
    const gen = this.generation;
    try {
      const p = await this.env.permissions?.query({ name: "microphone" });
      if (p && gen === this.generation) {
        this.permit = p;
        p.onchange = () => {
          if (p.state === "denied") this.stop();
          this.patch({ permission: p.state });
        };
        this.patch({ permission: p.state });
      }
    } catch {
      /* Some browsers only expose permission through getUserMedia. */
    }
  }
  async enumerate(gen) {
    if (!this.stream) return;
    try {
      const devices = (await this.env.media.enumerateDevices()).filter(
        (d) => d.kind === "audioinput",
      );
      if (gen !== this.generation) return;
      if (
        this.state.selected &&
        devices.length &&
        !devices.some((d) => d.deviceId === this.state.selected)
      ) {
        this.stop();
        this.patch({ issue: "Selected microphone disconnected." });
        return;
      }
      this.patch({ devices });
    } catch {
      if (gen === this.generation)
        this.patch({
          issue: "Microphone list unavailable. Check browser permissions.",
        });
    }
  }
  stop() {
    this.generation++;
    this.env.cancel(this.frame);
    clearTimeout(this.timer);
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    this.context?.close().catch(() => {});
    this.context = null;
    if (this.state.url) this.env.revoke(this.state.url);
    this.patch({ ...initialAudio, permission: this.state.permission });
  }
  async start(id = "") {
    this.stop();
    const gen = this.generation;
    if (!this.compatible) {
      this.patch({
        issue:
          "Use a secure browser with microphone, Web Audio and recording support.",
      });
      return;
    }
    try {
      const stream = await this.env.media.getUserMedia({
        audio: id ? { deviceId: { exact: id } } : true,
        video: false,
      });
      if (gen !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      track.onended = () => {
        if (gen === this.generation) {
          this.stop();
          this.patch({ issue: "Microphone disconnected." });
        }
      };
      const ctx = new this.env.Context();
      this.context = ctx;
      await ctx.resume();
      if (gen !== this.generation) return;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      this.patch({
        running: true,
        permission: "granted",
        selected: track.getSettings?.().deviceId || id,
      });
      await this.enumerate(gen);
      let sustained = 0,
        last = -200;
      const samples = new Uint8Array(analyser.fftSize);
      const update = (time) => {
        if (gen !== this.generation) return;
        if (time - last >= 100) {
          last = time;
          analyser.getByteTimeDomainData(samples);
          const level = rms(samples);
          sustained = level > 0.012 ? sustained + 1 : 0;
          this.patch({ level, heard: this.state.heard || sustained >= 3 });
        }
        this.frame = this.env.frame(update);
      };
      update(0);
    } catch (e) {
      if (gen !== this.generation) return;
      this.stop();
      const denied = e.name === "NotAllowedError";
      this.patch({
        permission: denied ? "denied" : this.state.permission,
        issue: denied
          ? "Allow microphone access in this site’s settings and try again."
          : e.name === "NotFoundError"
            ? "No microphone found. Connect one and try again."
            : "Microphone unavailable. Check the selected device and close other recording apps.",
      });
    }
  }
  record() {
    if (!this.stream || this.state.recording) return;
    const gen = this.generation,
      chunks = [];
    try {
      const rec = new this.env.Recorder(this.stream);
      this.recorder = rec;
      const previous = this.state.url;
      if (previous) this.env.revoke(previous);
      this.patch({
        recording: true,
        url: "",
        played: false,
        confirmed: false,
        issue: "",
      });
      rec.ondataavailable = (e) => {
        if (gen === this.generation && e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (gen !== this.generation) return;
        clearTimeout(this.timer);
        const blob = new Blob(chunks, { type: rec.mimeType });
        this.patch({
          recording: false,
          url: blob.size ? this.env.url(blob) : "",
          issue: blob.size ? "" : "Recording contained no audio.",
        });
      };
      rec.onerror = () => {
        if (gen === this.generation) {
          this.stop();
          this.patch({
            issue: "Recording failed. Retry the microphone check.",
          });
        }
      };
      rec.start();
      this.timer = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 4000);
    } catch {
      this.patch({
        recording: false,
        issue: "Recording is unavailable in this browser.",
      });
    }
  }
  dispose() {
    this.env.media?.removeEventListener?.("devicechange", this.onDevices);
    if (this.permit) this.permit.onchange = null;
    this.stop();
  }
}
