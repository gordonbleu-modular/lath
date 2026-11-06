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
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const RETRIG = [
  [0, "1×"],
  [2, "2×"],
  [3, "3×"],
  [4, "4×"],
  [6, "6×"],
  [8, "8×"],
] as const;

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
    <label className="slider">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-fg">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
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
  const pages = span > 32 ? [0, 32] : [0];
  const rows = span > 32 ? 32 : span;

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

  const patchCell = (partial: Partial<Step>, audition = false) => {
    writeStep(selT, selS, { ...cell, ...partial }, audition);
  };

  return (
    <main className="shell bg-bg text-fg">
      <header className="bar">
        <h1 className="brand text-accent">LATH</h1>
        <span className={running ? "live on" : "live"} aria-hidden />
        <p className="status">{status}</p>
        <button className="btn btn-accent" onClick={() => void togglePlay()} aria-label={running ? "Stop" : "Play"}>
          {running ? <Square size={12} /> : <Play size={12} />}
          {running ? "Stop" : "Play"}
        </button>
        <button className="btn" onClick={() => void rewind()} aria-label="Back to the first step">
          <RotateCcw size={12} />
        </button>
        <button className="btn" onClick={() => void connectCard().catch(() => useLath.setState({ status: "MIDI permission was blocked." }))}>
          <Usb size={12} />
          {connected ? "On" : "Connect"}
        </button>
        <button
          className="btn"
          disabled={!connected}
          onClick={() => {
            sendSave();
            useLath.setState({ status: "Writing the card…" });
          }}
        >
          <Save size={12} />
          Save
        </button>
        {(
          [
            ["seq", "Seq"],
            ["sound", "Sound"],
            ["mix", "Mix"],
            ["perform", "Play"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "btn btn-accent" : "btn"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <a className="btn" href={`${import.meta.env.BASE_URL}LATH.uf2`}>
          UF2
        </a>
      </header>

      {tab === "seq" && (
        <div className="fit">
          <section className="seq">
            <div className="bar">
              {Array.from({ length: 8 }, (_, i) => (
                <button key={i} className={i === pat ? "btn btn-accent" : "btn"} onClick={() => selectPattern(i)}>
                  {String.fromCharCode(65 + i)}
                </button>
              ))}
              {[16, 32, 64].map((n) => (
                <button key={n} className={span === n ? "btn btn-accent" : "btn"} onClick={() => setSpan(n)}>
                  {n}
                </button>
              ))}
              <select
                aria-label="Copy to"
                className="ml-auto"
                style={{ width: "7rem" }}
                value=""
                onChange={(e) => {
                  if (e.target.value) copyPattern(Number(e.target.value));
                }}
              >
                <option value="">Copy to…</option>
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)}
                  </option>
                ))}
              </select>
            </div>
            <div className="seq-body">
              {pages.map((start) => (
                <div key={start} className="seq-col" style={{ ["--rows" as string]: rows }}>
                  <div className="row">
                    <div className="cell step-no">#</div>
                    {TRACKS.map((tr, i) => (
                      <div key={tr.id} className="cell th">
                        <button className="th-name" onClick={() => useLath.setState({ selT: i })}>
                          {tr.name}
                        </button>
                        <button className="icon-btn" aria-label={`Shorter ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] - 1)}>
                          <Minus size={10} />
                        </button>
                        <span>{lengths[i]}</span>
                        <button className="icon-btn" aria-label={`Longer ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] + 1)}>
                          <Plus size={10} />
                        </button>
                        <button
                          className={`icon-btn ${project.mute[i] ? "text-led" : ""}`}
                          aria-label={project.mute[i] ? `Unmute ${tr.name}` : `Mute ${tr.name}`}
                          onClick={() => toggleMute(i)}
                        >
                          {project.mute[i] ? "M" : "·"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: rows }, (_, i) => {
                    const step = start + i;
                    return (
                      <div className="row" key={step}>
                        <div className="cell step-no">{String(step + 1).padStart(2, "0")}</div>
                        {TRACKS.map((_, tr) => {
                          const c = project.steps[pat][tr][step];
                          const dim = step >= lengths[tr];
                          const on = pos[tr] === step && running && !dim;
                          const sel = selT === tr && selS === step;
                          return (
                            <button
                              key={tr}
                              className={`cell ${dim ? "cell-dim" : ""} ${on ? "cell-on" : ""} ${sel ? "cell-sel" : ""}`}
                              onClick={() => {
                                useLath.setState({ selT: tr, selS: step });
                                void resumeAudio();
                              }}
                            >
                              <span>{noteName(c.n)}</span>
                              {c.n ? <span className="vel">{c.v}</span> : null}
                              {c.f ? <span className="fxmark">{FX[c.f]?.name}</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <aside className="edit">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm text-accent">
                {TRACKS[selT].name} {String(selS + 1).padStart(2, "0")}
              </h2>
              <button className="btn" onClick={() => clearTrack(selT)}>
                Clear
              </button>
            </div>
            <div className="notes" title={`Computer keys. Z is C${octave}. Comma and period move the octave.`}>
              {NOTES.map((name, i) => {
                const n = (octave + 1) * 12 + i;
                return (
                  <button key={name} className={cell.n === n ? "btn btn-accent" : "btn"} onClick={() => patchCell({ n, v: cell.v || 104 }, true)}>
                    {name}
                  </button>
                );
              })}
              <button className="btn" onClick={() => useLath.setState({ octave: Math.max(0, octave - 1) })}>
                −
              </button>
              <span className="hint self-center">C{octave}</span>
              <button className="btn" onClick={() => useLath.setState({ octave: Math.min(6, octave + 1) })}>
                +
              </button>
              <button className="btn" onClick={() => patchCell(EMPTY)}>
                Rest
              </button>
            </div>
            <Slider label="Velocity" min={1} max={127} value={cell.v || 104} onChange={(v) => patchCell({ v, n: cell.n })} />
            <Slider label={selT < 4 ? "Length" : "Gate"} min={0} max={32} value={cell.l} onChange={(l) => patchCell({ l })} />
            <div className="notes">
              {RETRIG.map(([n, label]) => {
                const on = n === 0 ? cell.f !== 1 : cell.f === 1 && cell.a === n;
                return (
                  <button
                    key={label}
                    className={on ? "btn btn-accent" : "btn"}
                    onClick={() => {
                      if (n === 0) {
                        if (cell.f === 1) patchCell({ f: 0, a: 0 });
                      } else patchCell({ f: 1, a: n, v: cell.v || 104 });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="slider">
              Command
              <select className="bg-surface text-fg" value={cell.f} onChange={(e) => patchCell({ f: Number(e.target.value) })}>
                {FX.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name === "—" ? "None" : `${fx.name} ${fx.hint.split(".")[0]}`}
                  </option>
                ))}
              </select>
            </label>
            {cell.f > 0 && <Slider label="Value" min={0} max={127} value={cell.a} onChange={(a) => patchCell({ a })} />}
            <div className="mt-auto grid gap-1">
              <Slider label="Tempo" min={40} max={300} value={project.bpm} onChange={setBpm} />
              <Slider label="Swing" min={0} max={127} value={project.swing} onChange={setSwing} />
            </div>
          </aside>
        </div>
      )}

      {tab === "sound" && (
        <div className="pane">
          <div className="bar" style={{ padding: 0, border: 0 }}>
            <Banks scene={project.scene} />
          </div>
          <div className="sound-grid">
            {TRACKS.slice(0, 4).map((tr, i) => (
              <section key={tr.id} className="card">
                <h2 className="text-sm text-accent">
                  {tr.name} <span className="text-muted">{tr.role}</span>
                </h2>
                <Slider label="Decay" min={1} max={127} value={bank.voice[i].decay} onChange={(v) => setVoice(i, "decay", v)} />
                <Slider label="Tone" min={0} max={127} value={bank.voice[i].tone} onChange={(v) => setVoice(i, "tone", v)} />
                <Slider label="Pitch" min={0} max={48} value={bank.voice[i].pitch} onChange={(v) => setVoice(i, "pitch", v)} />
                <Slider
                  label={i === 0 ? "Click" : i === 1 ? "Noise" : i === 2 ? "Snare" : "Bite"}
                  min={0}
                  max={127}
                  value={bank.voice[i].aux}
                  onChange={(v) => setVoice(i, "aux", v)}
                />
                {i === 3 && (
                  <label className="slider">
                    Model
                    <select className="bg-surface text-fg" value={bank.voice[3].model} onChange={(e) => setVoice(3, "model", Number(e.target.value))}>
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
        </div>
      )}

      {tab === "mix" && (
        <div className="pane">
          <div className="bar" style={{ padding: 0, border: 0 }}>
            <Banks scene={project.scene} />
          </div>
          <div className="strips">
            {TRACKS.slice(0, 4).map((tr, i) => (
              <section key={tr.id} className="card">
                <h2 className="text-sm text-fg">{tr.name}</h2>
                <Slider label="Level" min={0} max={127} value={bank.mix[i].level} onChange={(v) => setMix(i, "level", v)} />
                <Slider label="Pan" min={0} max={127} value={bank.mix[i].pan} onChange={(v) => setMix(i, "pan", v)} />
              </section>
            ))}
            {["In 1", "In 2"].map((label, i) => (
              <section key={label} className="card">
                <h2 className="text-sm text-fg">{label}</h2>
                <Slider label="Level" min={0} max={127} value={bank.mix[4 + i].level} onChange={(v) => setMix(4 + i, "level", v)} />
                <Slider label="Pan" min={0} max={127} value={bank.mix[4 + i].pan} onChange={(v) => setMix(4 + i, "pan", v)} />
                <Slider label="Delay" min={0} max={127} value={bank.inSend[i].d} onChange={(v) => setInSend(i, "d", v)} />
                <Slider label="Room" min={0} max={127} value={bank.inSend[i].r} onChange={(v) => setInSend(i, "r", v)} />
              </section>
            ))}
          </div>
          <div className="strips" style={{ flex: "none", gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
            <label className="slider">
              Delay
              <select className="bg-surface text-fg" value={bank.delay.time} onChange={(e) => setDelay("time", Number(e.target.value))}>
                {DELAY_TIMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Slider label="Feedback" min={0} max={127} value={bank.delay.fb} onChange={(v) => setDelay("fb", v)} />
            <Slider label="Drum delay" min={0} max={127} value={bank.delay.mix} onChange={(v) => setDelay("mix", v)} />
            <Slider label="Room size" min={0} max={127} value={bank.room.size} onChange={(v) => setRoom("size", v)} />
            <Slider label="Damp" min={0} max={127} value={bank.room.damp} onChange={(v) => setRoom("damp", v)} />
            <Slider label="Drum room" min={0} max={127} value={bank.room.mix} onChange={(v) => setRoom("mix", v)} />
            <Slider label="Drive" min={0} max={127} value={bank.drive} onChange={setDrive} />
            <Slider label="Master" min={0} max={127} value={bank.master} onChange={setMaster} />
          </div>
        </div>
      )}

      {tab === "perform" && (
        <div className="pane">
          <div className="perform">
            <section className="grid content-start gap-2">
              <Banks scene={project.scene} />
              <Slider
                label={connected ? "Main knob" : "Morph A–B–C"}
                min={0}
                max={127}
                value={project.morph}
                disabled={connected}
                onChange={setMorph}
              />
              <label className="slider">
                Knob X
                <select className="bg-surface text-fg" value={project.knobX} onChange={(e) => setKnob("knobX", Number(e.target.value))}>
                  {KNOB_TARGETS.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="slider">
                Knob Y
                <select className="bg-surface text-fg" value={project.knobY} onChange={(e) => setKnob("knobY", Number(e.target.value))}>
                  {KNOB_TARGETS.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hint flex items-center gap-2">
                <input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} />
                External clock. Pulse in 1 steps, pulse in 2 resets.
              </label>
            </section>
            <section className="grid content-start gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm text-accent">Song</h2>
                <button className="btn" disabled={project.song.length >= 16} onClick={addSongStep}>
                  Add
                </button>
                <button className="btn" onClick={() => queueNext()}>
                  Queue
                </button>
              </div>
              <div className="song">
                {project.song.map((stepPat, i) => (
                  <div key={i} className={`song-step ${project.songAt === i ? "now" : ""}`}>
                    <span className="hint">
                      {i + 1}
                      {project.pending === i ? " cue" : project.songAt === i ? " now" : ""}
                    </span>
                    <select className="bg-surface text-fg" value={stepPat} onChange={(e) => setSongStep(i, Number(e.target.value))}>
                      {["A", "B", "C", "D", "E", "F", "G", "H"].map((name, n) => (
                        <option key={name} value={n}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button className="btn" disabled={project.song.length <= 1} onClick={() => removeSongStep(i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function Banks({ scene }: { scene: number }) {
  return (
    <div className="flex gap-1">
      {["A", "B", "C"].map((name, i) => (
        <button key={name} className={scene === i ? "btn btn-accent" : "btn"} onClick={() => setScene(i)}>
          {name}
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
