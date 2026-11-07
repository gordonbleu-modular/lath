import type { Project } from "./types";
import { persist, useLath } from "./store";

let ctx: AudioContext | null = null;
let node: AudioWorkletNode | null = null;
let booting: Promise<void> | null = null;
let latest: Project | null = null;

export function pushProject(project: Project) {
  latest = project;
  node?.port.postMessage({ type: "project", project });
}

function audioContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new Ctor();
  return ctx;
}

// Must run in the click itself, before any await, or Chrome drops the gesture
// and resume() never resolves.
export function primeAudio() {
  const c = audioContext();
  if (c.state !== "running") void c.resume();
}

export async function ensureAudio() {
  primeAudio();
  if (node) return;
  if (!booting) booting = boot();
  await booting;
}

async function boot() {
  const c = audioContext();
  if (c.state !== "running") void c.resume();
  await c.audioWorklet.addModule(new URL("lath-worklet.js?v=3", document.baseURI).href);
  node = new AudioWorkletNode(c, "lath", { outputChannelCount: [2] });
  node.connect(c.destination);
  node.port.onmessage = (event) => {
    const data = event.data as { type?: string; pos?: number[]; pattern?: number; songAt?: number };
    if (data?.type === "song" && !useLath.getState().hardwareClock && data.pattern != null && data.songAt != null) {
      const project = structuredClone(useLath.getState().project);
      project.pattern = data.pattern;
      project.songAt = data.songAt;
      project.pending = -1;
      useLath.setState({ project });
      persist(project);
      latest = project;
      return;
    }
    if (data?.type === "head" && data.pos && !useLath.getState().hardwareClock) {
      useLath.setState({ pos: data.pos });
    }
  };
  if (latest) node.port.postMessage({ type: "project", project: latest });
  const s = useLath.getState();
  node.port.postMessage({ type: "run", value: s.running && !s.hardwareClock });
  node.port.postMessage({ type: "monitor", value: !s.hardwareClock });
}

export async function resumeAudio() {
  primeAudio();
  await ensureAudio();
  if (ctx && ctx.state !== "running") await ctx.resume();
}

export function engineRun(running: boolean) {
  node?.port.postMessage({ type: "run", value: running });
}

export function engineMonitor(on: boolean) {
  node?.port.postMessage({ type: "monitor", value: on });
}

export function engineRewind() {
  node?.port.postMessage({ type: "rewind" });
}

export function engineAudition(t: number, n: number, v: number, l: number, f: number, a: number) {
  node?.port.postMessage({ type: "audition", t, n, v, l, f, a });
}
