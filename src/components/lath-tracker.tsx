import { useEffect, useState } from "react";
import { Minus, Play, Plus, RotateCcw, Save, Square, Usb } from "lucide-react";
import { connectCard, sendSave } from "../lib/lath/midi";
import {
  clearTrack,
  copyPattern,
  rewind,
  selectPattern,
  setBpm,
  setDelay,
  setDrive,
  setExt,
  setInSend,
  setKnob,
  setMaster,
  setMix,
  setMorph,
  setRoom,
  setScene,
  setSongStep,
  addSongStep,
  removeSongStep,
  queueNext,
  setSwing,
  setTrackLen,
  setVoice,
  toggleMute,
  togglePlay,
  writeStep,
} from "../lib/lath/session";
import { loadStored, persist, useLath } from "../lib/lath/store";
import { pushProject, resumeAudio } from "../lib/lath/audio";
import { DELAY_TIMES, FX, KNOB_TARGETS, MODELS, TRACKS, noteName } from "../lib/lath/types";
import type { Step } from "../lib/lath/types";

const EMPTY: Step = { n: 0, v: 0, l: 0, f: 0, a: 0 };

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="text-fg">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function LathTracker() {
  const project = useLath((s) => s.project);
  const pos = useLath((s) => s.pos);
  const running = useLath((s) => s.running);
  const connected = useLath((s) => s.connected);
  const status = useLath((s) => s.status);
  const selT = useLath((s) => s.selT);
  const selS = useLath((s) => s.selS);
  const octave = useLath((s) => s.octave);
  const ext = useLath((s) => s.ext);
  const [span, setSpan] = useState(32);
  const [tab, setTab] = useState<"seq" | "sound" | "mix" | "perform">("seq");
  const pat = project.pattern;
  const cell = project.steps[pat][selT][selS];
  const lengths = project.trackLen[pat];
  const bank = project.scenes[project.scene] ?? project.scenes[0];

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      useLath.setState({ project: stored });
      pushProject(stored);
      persist(stored);
    } else {
      pushProject(useLath.getState().project);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const s = useLath.getState();
      const move = (dt: number, ds: number) => {
        const L = s.project.trackLen[s.project.pattern][s.selT] || 16;
        useLath.setState({
          selT: Math.max(0, Math.min(5, s.selT + dt)),
          selS: (s.selS + ds + L) % L,
        });
      };
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
        return;
      }
      if (event.key === "ArrowRight") move(1, 0);
      else if (event.key === "ArrowLeft") move(-1, 0);
      else if (event.key === "ArrowDown") move(0, 1);
      else if (event.key === "ArrowUp") move(0, -1);
      else if (event.key === "Backspace" || event.key === "Delete") {
        writeStep(s.selT, s.selS, EMPTY);
      } else if (event.key === "," || event.key === ".") {
        useLath.setState({ octave: Math.max(0, Math.min(6, s.octave + (event.key === "." ? 1 : -1))) });
      } else {
        const note = keyToNote(event.key, s.octave);
        if (note) {
          event.preventDefault();
          const prev = s.project.steps[s.project.pattern][s.selT][s.selS];
          const next: Step = prev.n ? { ...prev, n: note } : { n: note, v: 104, l: 0, f: 0, a: 0 };
          writeStep(s.selT, s.selS, next, true);
          const L = s.project.trackLen[s.project.pattern][s.selT] || 16;
          useLath.setState({ selS: (s.selS + 1) % L });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const row = document.querySelector(`[data-step="${pos[selT]}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [pos, selT]);

  const patchCell = (partial: Partial<Step>, audition = false) => {
    writeStep(selT, selS, { ...cell, ...partial }, audition);
  };

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-accent">LATH</h1>
          <p className="mt-1 max-w-md text-xs text-muted">
            Tracker for the Workshop Computer. Four drum synths in the card, two CV and gate tracks for the analog oscillators.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn btn-accent" onClick={() => void togglePlay()} aria-label={running ? "Stop" : "Play"}>
            {running ? <Square size={16} /> : <Play size={16} />}
            {running ? "Stop" : "Play"}
          </button>
          <button className="btn" onClick={() => void rewind()} aria-label="Back to the first step">
            <RotateCcw size={16} />
            Top
          </button>
          <button
            className="btn"
            onClick={() => void connectCard().catch(() => useLath.setState({ status: "MIDI permission was blocked." }))}
          >
            <Usb size={16} />
            {connected ? "Connected" : "Connect card"}
          </button>
          <button
            className="btn"
            disabled={!connected}
            onClick={() => {
              sendSave();
              useLath.setState({ status: "Writing the card…" });
            }}
          >
            <Save size={16} />
            Save on card
          </button>
        </div>
      </header>

      <p className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted">
        <span className={running ? "live on" : "live"} aria-hidden />
        {status}
      </p>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3" role="tablist">
        {(
          [
            ["seq", "Sequencer"],
            ["sound", "Sound"],
            ["mix", "Mixer"],
            ["perform", "Perform"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "btn btn-accent" : "btn"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <a className="btn ml-auto" href={`${import.meta.env.BASE_URL}LATH.uf2`}>
          Firmware
        </a>
      </div>

      {tab === "seq" && (
      <div className="stage">
        <section className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2 px-3 py-3">
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                className={i === pat ? "btn btn-accent" : "btn"}
                onClick={() => selectPattern(i)}
              >
                {String.fromCharCode(65 + i)}
              </button>
            ))}
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Steps</span>
              <span className="flex gap-1">
                {[16, 32, 64].map((n) => (
                  <button key={n} className={span === n ? "btn btn-accent" : "btn"} onClick={() => setSpan(n)}>
                    {n}
                  </button>
                ))}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              Copy to
              <select
                aria-label="Copy to"
                className="bg-surface text-fg"
                value=""
                onChange={(e) => {
                  if (e.target.value) copyPattern(Number(e.target.value));
                }}
              >
                <option value="">pattern…</option>
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-scroll">
            <div className="tracker-grid sticky top-0 z-10 bg-bg">
              <div className="cell bg-bg text-muted"> </div>
              {TRACKS.map((tr, i) => (
                <div key={tr.id} className="cell flex flex-col justify-between bg-surface-2 px-1 py-1">
                  <button className="text-left" onClick={() => useLath.setState({ selT: i })}>
                    <span className="block text-sm text-fg">{tr.name}</span>
                    <span className="text-muted">{tr.role}</span>
                  </button>
                  <span className="mt-1 flex items-center justify-between gap-1">
                    <button className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={`Shorter ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="text-fg">{lengths[i]}</span>
                    <button className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={`Longer ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] + 1)}>
                      <Plus size={14} />
                    </button>
                    <button className={`inline-flex min-h-11 items-center px-1 ${project.mute[i] ? "text-led" : "text-muted"}`} aria-label={project.mute[i] ? `Unmute ${tr.name}` : `Mute ${tr.name}`} onClick={() => toggleMute(i)}>
                      {project.mute[i] ? "mute" : "on"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
            {Array.from({ length: span }, (_, step) => (
              <div className="tracker-grid" key={step} data-step={step}>
                <div className="cell flex items-center justify-center bg-bg text-muted">{String(step + 1).padStart(2, "0")}</div>
                {TRACKS.map((_, tr) => {
                  const c = project.steps[pat][tr][step];
                  const dim = step >= lengths[tr];
                  const on = pos[tr] === step && running && !dim;
                  const sel = selT === tr && selS === step;
                  const fx = FX[c.f]?.name;
                  return (
                    <button
                      key={tr}
                      className={`cell px-1 text-left ${dim ? "cell-dim" : ""} ${on ? "cell-on" : ""} ${sel ? "cell-sel" : ""}`}
                      onClick={() => {
                        useLath.setState({ selT: tr, selS: step });
                        void resumeAudio();
                      }}
                    >
                      <span className="block">{noteName(c.n)}</span>
                      <span className="text-muted">
                        {c.n ? c.v : ""} {c.f ? fx : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <aside className="grid gap-5 px-4 py-4">
          <section className="grid gap-3">
            <h2 className="font-display text-2xl leading-none text-accent">
              {TRACKS[selT].name} · {String(selS + 1).padStart(2, "0")}
            </h2>
            <div className="flex flex-wrap gap-1">
              {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((name, i) => {
                const n = (octave + 1) * 12 + i;
                return (
                  <button
                    key={name}
                    className={cell.n === n ? "btn btn-accent" : "btn"}
                    onClick={() => patchCell({ n, v: cell.v || 104 }, true)}
                  >
                    {name}
                  </button>
                );
              })}
              <button className="btn" onClick={() => useLath.setState({ octave: Math.max(0, octave - 1) })}>
                oct−
              </button>
              <button className="btn" onClick={() => useLath.setState({ octave: Math.min(6, octave + 1) })}>
                oct+
              </button>
              <button className="btn" onClick={() => patchCell(EMPTY)}>
                Rest
              </button>
            </div>
            <p className="text-xs text-muted">Typing uses the computer keyboard. Z is C{octave}. The row above is one octave up. Comma and period move the octave.</p>
            <Slider label="Velocity" min={1} max={127} value={cell.v || 104} onChange={(v) => patchCell({ v, n: cell.n })} />
            <Slider
              label={selT < 4 ? "Length — scales the decay" : "Gate length — 32 fills the step. Velocity shortens it."}
              min={0}
              max={32}
              value={cell.l}
              onChange={(l) => patchCell({ l })}
            />
            <div className="grid gap-1">
              <span className="text-xs text-muted">Retrigger — hits inside this step. Uses the command slot.</span>
              <div className="flex flex-wrap gap-1">
                {[
                  [0, "once"],
                  [2, "2×"],
                  [3, "3×"],
                  [4, "4×"],
                  [6, "6×"],
                  [8, "8×"],
                ].map(([n, label]) => {
                  const on = n === 0 ? cell.f !== 1 : cell.f === 1 && cell.a === n;
                  return (
                    <button
                      key={label}
                      className={on ? "btn btn-accent" : "btn"}
                      onClick={() => {
                        if (n === 0) {
                          if (cell.f === 1) patchCell({ f: 0, a: 0 });
                        } else patchCell({ f: 1, a: Number(n), v: cell.v || 104 });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="grid gap-1 text-xs text-muted">
              Command
              <select
                className="bg-surface text-fg"
                value={cell.f}
                onChange={(e) => patchCell({ f: Number(e.target.value) })}
              >
                {FX.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name === "—" ? "None" : fx.name}
                  </option>
                ))}
              </select>
              <span>{FX[cell.f]?.hint}</span>
            </label>
            {cell.f > 0 && (
              <Slider label="Command value" min={0} max={127} value={cell.a} onChange={(a) => patchCell({ a })} />
            )}
            <button className="btn justify-self-start" onClick={() => clearTrack(selT)}>
              Clear {TRACKS[selT].name}
            </button>
          </section>

          <section className="grid gap-3 border-t border-border pt-4">
            <h2 className="text-sm text-muted">Clock</h2>
            <Slider label="Tempo" min={40} max={300} value={project.bpm} onChange={setBpm} />
            <Slider label="Swing — 64 is straight" min={0} max={127} value={project.swing} onChange={setSwing} />
            <p className="text-xs text-muted">The middle position plays. Up stops. A down click queues the next song pattern.</p>
          </section>
        </aside>
      </div>
      )}

      {tab === "sound" && (
        <div className="sound-grid px-4 py-4">
          <div className="col-span-full flex flex-wrap items-center gap-2">
            <Banks scene={project.scene} />
            <span className="col-span-full text-xs text-muted">These sliders store the selected preset. The main knob blends A, B and C.</span>
          </div>
          {TRACKS.slice(0, 4).map((tr, i) => (
            <section key={tr.id} className="grid gap-3 border border-border bg-surface p-4">
              <h2 className="font-display text-2xl leading-none text-accent">
                {tr.name}
                <span className="ml-2 text-sm text-muted">{tr.role}</span>
              </h2>
              <Slider label="Decay" min={1} max={127} value={bank.voice[i].decay} onChange={(v) => setVoice(i, "decay", v)} />
              <Slider label="Tone" min={0} max={127} value={bank.voice[i].tone} onChange={(v) => setVoice(i, "tone", v)} />
              <Slider label="Pitch centre — 24 is the written note" min={0} max={48} value={bank.voice[i].pitch} onChange={(v) => setVoice(i, "pitch", v)} />
              <Slider
                label={i === 0 ? "Click" : i === 1 ? "Noise in the metal" : i === 2 ? "Snare noise against the wire" : "Bite"}
                min={0}
                max={127}
                value={bank.voice[i].aux}
                onChange={(v) => setVoice(i, "aux", v)}
              />
              {i === 3 && (
                <label className="grid gap-1 text-xs text-muted">
                  Model
                  <select
                    className="bg-surface text-fg"
                    value={bank.voice[3].model}
                    onChange={(e) => setVoice(3, "model", Number(e.target.value))}
                  >
                    {MODELS.map((name, mi) => (
                      <option key={name} value={mi}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === "mix" && (
        <div className="grid gap-6 px-4 py-4">
          <Banks scene={project.scene} />
          <div className="mix-grid">
            <section className="grid content-start gap-3">
              <h2 className="text-sm text-muted">Drums</h2>
              {TRACKS.slice(0, 4).map((tr, i) => (
                <div key={tr.id} className="grid gap-1 border-b border-border pb-3">
                  <span className="text-sm text-fg">{tr.name}</span>
                  <Slider label="Level" min={0} max={127} value={bank.mix[i].level} onChange={(v) => setMix(i, "level", v)} />
                  <Slider label="Pan" min={0} max={127} value={bank.mix[i].pan} onChange={(v) => setMix(i, "pan", v)} />
                </div>
              ))}
            </section>
            <section className="grid content-start gap-3">
              <h2 className="text-sm text-muted">Audio inputs</h2>
              <p className="text-xs text-muted">
                Patch the oscillators into audio in 1 and 2. Delay and room sends are post-fader. In this preview the returns follow the CV tracks.
              </p>
              {["Audio in 1", "Audio in 2"].map((label, i) => (
                <div key={label} className="grid gap-1 border-b border-border pb-3">
                  <span className="text-sm text-fg">{label}</span>
                  <Slider label="Level" min={0} max={127} value={bank.mix[4 + i].level} onChange={(v) => setMix(4 + i, "level", v)} />
                  <Slider label="Pan" min={0} max={127} value={bank.mix[4 + i].pan} onChange={(v) => setMix(4 + i, "pan", v)} />
                  <Slider label="Delay send" min={0} max={127} value={bank.inSend[i].d} onChange={(v) => setInSend(i, "d", v)} />
                  <Slider label="Room send" min={0} max={127} value={bank.inSend[i].r} onChange={(v) => setInSend(i, "r", v)} />
                </div>
              ))}
            </section>
          </div>
          <section className="grid gap-3 border-t border-border pt-4">
            <h2 className="text-sm text-muted">Effects</h2>
            <p className="text-xs text-muted">Drum-bus sends sit under the effect. Input sends are on each return. On the card, delays longer than about a third of a second are shortened. Drive stays on the drums.</p>
            <div className="mix-grid">
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs text-muted">
                  Delay time
                  <select
                    className="bg-surface text-fg"
                    value={bank.delay.time}
                    onChange={(e) => setDelay("time", Number(e.target.value))}
                  >
                    {DELAY_TIMES.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <Slider label="Delay feedback" min={0} max={127} value={bank.delay.fb} onChange={(v) => setDelay("fb", v)} />
                <Slider label="Delay send from the drum bus" min={0} max={127} value={bank.delay.mix} onChange={(v) => setDelay("mix", v)} />
              </div>
              <div className="grid gap-3">
                <Slider label="Room size" min={0} max={127} value={bank.room.size} onChange={(v) => setRoom("size", v)} />
                <Slider label="Room damp" min={0} max={127} value={bank.room.damp} onChange={(v) => setRoom("damp", v)} />
                <Slider label="Room send from the drum bus" min={0} max={127} value={bank.room.mix} onChange={(v) => setRoom("mix", v)} />
                <Slider label="Drive on the drum bus" min={0} max={127} value={bank.drive} onChange={setDrive} />
              </div>
            </div>
            <Slider label="Master" min={0} max={127} value={bank.master} onChange={setMaster} />
          </section>
        </div>
      )}

      {tab === "perform" && (
        <div className="grid gap-6 px-4 py-4">
          <section className="grid max-w-2xl gap-2 text-sm leading-relaxed text-muted">
            <h2 className="font-display text-2xl leading-none text-accent">On the module</h2>
            <p>Save, then unplug USB. The Computer runs from the case power, and the knobs and switch keep working with no browser attached.</p>
            <p>The middle position plays. Up stops and stays there. Down is only a click: it queues the next song step, and that pattern starts when the longest track of the current one finishes. The switch springs back to the middle, so it keeps playing.</p>
          </section>
          <section className="grid max-w-xl gap-3">
            <h2 className="text-sm text-muted">Main knob · presets</h2>
            <Banks scene={project.scene} />
            <Slider
              label={connected ? "Main knob position, from the module" : "Preview morph — left is A, centre is B, right is C"}
              min={0}
              max={127}
              value={project.morph}
              disabled={connected}
              onChange={setMorph}
            />
          </section>
          <section className="mix-grid max-w-3xl">
            <label className="grid gap-1 text-xs text-muted">
              Knob X
              <select className="bg-surface text-fg" value={project.knobX} onChange={(e) => setKnob("knobX", Number(e.target.value))}>
                {KNOB_TARGETS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Knob Y
              <select className="bg-surface text-fg" value={project.knobY} onChange={(e) => setKnob("knobY", Number(e.target.value))}>
                {KNOB_TARGETS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <p className="max-w-2xl text-xs text-muted">X starts on swing and Y on drive. A knob takes over once you move it, so a value you set here stays until then. Tempo and swing live on the sequencer. The rest of this list is stored in the presets and ridden live.</p>
          <section className="grid max-w-2xl gap-3">
            <h2 className="text-sm text-muted">Song</h2>
            <p className="text-xs text-muted">The down click walks this list. The queued pattern waits until the current one ends.</p>
            <div className="flex flex-wrap gap-2">
              {project.song.map((pat, i) => (
                <div key={i} className={`grid gap-1 border p-2 ${project.songAt === i ? "border-fg" : "border-border"}`}>
                  <span className="text-xs text-muted">
                    {i + 1}
                    {project.pending === i ? " · queued" : project.songAt === i ? " · now" : ""}
                  </span>
                  <select className="bg-surface text-fg" value={pat} onChange={(e) => setSongStep(i, Number(e.target.value))}>
                    {["A", "B", "C", "D", "E", "F", "G", "H"].map((name, n) => (
                      <option key={name} value={n}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button className="btn" disabled={project.song.length <= 1} onClick={() => removeSongStep(i)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={project.song.length >= 16} onClick={addSongStep}>
                Add step
              </button>
              <button className="btn" onClick={() => queueNext()}>
                Queue next
              </button>
            </div>
          </section>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} />
            External clock. Pulse in 1 steps, pulse in 2 resets, while the switch is in the middle.
          </label>
        </div>
      )}
    </main>
  );
}

function Banks({ scene }: { scene: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {["A", "B", "C"].map((name, i) => (
        <button key={name} className={scene === i ? "btn btn-accent" : "btn"} onClick={() => setScene(i)}>
          Preset {name}
        </button>
      ))}
    </div>
  );
}

function keyToNote(key: string, octave: number): number | null {
  const white = "zxcvbnm".indexOf(key);
  const white2 = "qwertyu".indexOf(key);
  const black: Record<string, number> = { s: 1, d: 3, g: 6, h: 8, j: 10 };
  const black2: Record<string, number> = { "2": 1, "3": 3, "5": 6, "6": 8, "7": 10 };
  const semis = [0, 2, 4, 5, 7, 9, 11];
  let n: number | null = null;
  if (white >= 0) n = (octave + 1) * 12 + semis[white];
  else if (key in black) n = (octave + 1) * 12 + black[key];
  else if (white2 >= 0) n = (octave + 2) * 12 + semis[white2];
  else if (key in black2) n = (octave + 2) * 12 + black2[key];
  if (n === null) return null;
  if (n < 1 || n > 127) return null;
  return n;
}
