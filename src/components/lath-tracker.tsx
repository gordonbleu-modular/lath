import { useEffect, useState } from "react";
import { Minus, Play, Plus, RotateCcw, Save, Square, Usb } from "lucide-react";
import { connectCard, sendSave } from "../lib/lath/midi";
import {
  clearPattern,
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
  const [tab, setTab] = useState<"seq" | "mix">("seq");
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
        <Num label="Tempo" value={project.bpm} min={40} max={300} onChange={setBpm} />
        <Num label="Swing" value={project.swing} min={0} max={127} onChange={setSwing} />
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
            ["mix", "Mix"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "btn btn-accent" : "btn"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </header>

      {tab === "seq" && (
        <div className="fit">
          <section className="seq">
            <div className="bar">
              <span className="hint">Pattern</span>
              {Array.from({ length: 8 }, (_, i) => (
                <button key={i} className={i === pat ? "btn btn-accent" : "btn"} onClick={() => selectPattern(i)}>
                  {String.fromCharCode(65 + i)}
                </button>
              ))}
              <button className="btn" onClick={() => clearPattern()} aria-label="Clear this pattern">
                Clear
              </button>
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
              <div className="seq-col" style={{ ["--rows" as string]: 32 }}>
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
                  {Array.from({ length: 32 }, (_, step) => {
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
                              {c.f ? (
                                <span className="fxmark">
                                  {FX[c.f]?.name} {c.a}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
            </div>
          </section>

          <aside className="edit">
            <div className="step-edit">
              <h2 className="text-sm text-accent">
                {TRACKS[selT].name} {String(selS + 1).padStart(2, "0")}
              </h2>
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
              <div className="pair">
                <Slider label="Velocity" min={1} max={127} value={cell.v || 104} onChange={(v) => patchCell({ v, n: cell.n })} />
                <Slider label={selT < 4 ? "Length" : "Gate"} min={0} max={32} value={cell.l} onChange={(l) => patchCell({ l })} />
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
                <Slider label="Value" min={0} max={127} value={cell.a} onChange={(a) => patchCell({ a })} />
              </div>
            </div>
            <div className="voices">
              <div className="voice-head">
                <span className="text-sm text-accent">Sounds</span>
                <Banks scene={project.scene} />
              </div>
              {TRACKS.slice(0, 4).map((tr, i) => (
                <section key={tr.id} className="voice">
                  <h2 className="text-sm text-accent">
                    {tr.name} <span className="text-muted">{tr.role}</span>
                  </h2>
                  <Slider label="Decay" min={1} max={127} value={bank.voice[i].decay} onChange={(v) => setVoice(i, "decay", v)} />
                  <Slider label="Tone" min={0} max={127} value={bank.voice[i].tone} onChange={(v) => setVoice(i, "tone", v)} />
                  <Slider label="Pitch" min={0} max={48} value={bank.voice[i].pitch} onChange={(v) => setVoice(i, "pitch", v)} />
                  <Slider
                    label={i === 0 ? "Click" : i === 1 ? "Noise" : i === 2 ? "Wires" : "Bite"}
                    min={0}
                    max={127}
                    value={bank.voice[i].aux}
                    onChange={(v) => setVoice(i, "aux", v)}
                  />
                  {i === 3 && (
                    <label className="slider span2">
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
          </aside>
        </div>
      )}

      {tab === "mix" && (
        <div className="desk">
          <div className="strips">
            {TRACKS.slice(0, 4).map((tr, i) => (
              <Strip key={tr.id} name={tr.name} level={bank.mix[i].level} pan={bank.mix[i].pan} onLevel={(v) => setMix(i, "level", v)} onPan={(v) => setMix(i, "pan", v)} />
            ))}
            {["In 1", "In 2"].map((label, i) => (
              <Strip
                key={label}
                name={label}
                level={bank.mix[4 + i].level}
                pan={bank.mix[4 + i].pan}
                onLevel={(v) => setMix(4 + i, "level", v)}
                onPan={(v) => setMix(4 + i, "pan", v)}
                delay={bank.inSend[i].d}
                room={bank.inSend[i].r}
                onDelay={(v) => setInSend(i, "d", v)}
                onRoom={(v) => setInSend(i, "r", v)}
              />
            ))}
            <section className="strip">
              <h2>Master</h2>
              <Fader label="Level" min={0} max={127} value={bank.master} onChange={setMaster} />
            </section>
          </div>
          <aside className="fx-desk">
            <div className="voice-head">
              <span className="text-sm text-accent">Effects</span>
              <Banks scene={project.scene} />
            </div>
            <div className="fx-groups">
              <section className="fx-group">
                <h3>Delay</h3>
                <label className="slider">
                  Time
                  <select className="bg-surface text-fg" value={bank.delay.time} onChange={(e) => setDelay("time", Number(e.target.value))}>
                    {DELAY_TIMES.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="fx-knobs">
                  <Knob label="Feedback" min={0} max={127} value={bank.delay.fb} onChange={(v) => setDelay("fb", v)} />
                  <Knob label="Send" min={0} max={127} value={bank.delay.mix} onChange={(v) => setDelay("mix", v)} />
                </div>
              </section>
              <section className="fx-group">
                <h3>Room</h3>
                <div className="fx-knobs">
                  <Knob label="Size" min={0} max={127} value={bank.room.size} onChange={(v) => setRoom("size", v)} />
                  <Knob label="Damp" min={0} max={127} value={bank.room.damp} onChange={(v) => setRoom("damp", v)} />
                  <Knob label="Send" min={0} max={127} value={bank.room.mix} onChange={(v) => setRoom("mix", v)} />
                </div>
              </section>
              <section className="fx-group">
                <h3>Drive</h3>
                <div className="fx-knobs">
                  <Knob label="Amount" min={0} max={127} value={bank.drive} onChange={setDrive} />
                </div>
              </section>
            </div>
            <div className="voice-head">
              <span className="text-sm text-accent">Panel</span>
            </div>
            <div className="panel-row">
              <Slider label={connected ? "Main knob" : "Morph"} min={0} max={127} value={project.morph} disabled={connected} onChange={setMorph} />
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
            </div>
            <label className="hint flex items-center gap-2">
              <input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} />
              External clock. Pulse in 1 steps, pulse in 2 resets.
            </label>
            <div className="voice-head">
              <span className="text-sm text-accent">Song</span>
              <span className="flex gap-1">
                <button className="btn" disabled={project.song.length >= 16} onClick={addSongStep}>
                  Add
                </button>
                <button className="btn" onClick={() => queueNext()}>
                  Queue
                </button>
              </span>
            </div>
            <div className="song span2">
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
          </aside>
        </div>
      )}
    </main>
  );
}

function Banks({ scene }: { scene: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="hint">Preset</span>
      {["A", "B", "C"].map((name, i) => (
        <button key={name} className={scene === i ? "btn btn-accent" : "btn"} onClick={() => setScene(i)}>
          {name}
        </button>
      ))}
    </div>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="num">
      {label}
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d]/g, "");
          setText(next);
          const n = Number(next);
          if (next !== "" && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          const n = Number(text);
          const clamped = Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : value;
          setText(String(clamped));
          if (clamped !== value) onChange(clamped);
        }}
      />
    </label>
  );
}

function Fader({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="fader">
      <span>{value}</span>
      <input className="fader-range" type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{label}</span>
    </label>
  );
}

function knobAngle(value: number, min: number, max: number, pan: boolean) {
  if (pan) {
    const center = min === 0 && max === 127 ? 64 : (min + max) / 2;
    if (value <= center) {
      const t = center === min ? 0 : (value - min) / (center - min);
      return -150 + t * 150;
    }
    const t = max === center ? 1 : (value - center) / (max - center);
    return t * 150;
  }
  const t = max === min ? 0 : (value - min) / (max - min);
  return -150 + t * 300;
}

function Knob({
  label,
  value,
  min,
  max,
  pan,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  pan?: boolean;
  onChange: (n: number) => void;
}) {
  const angle = knobAngle(value, min, max, !!pan);
  const readout = pan ? (value === 64 ? "C" : value < 64 ? `L${64 - value}` : `R${value - 64}`) : String(value);
  return (
    <div className="knob">
      <button
        type="button"
        className={pan ? "knob-cap pan" : "knob-cap"}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onChange(Math.max(min, Math.min(max, Math.round(value - e.movementY * 0.7))));
        }}
        onWheel={(e) => {
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? 1 : -1))));
        }}
      >
        <span className="knob-rotor" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="knob-mark" />
        </span>
      </button>
      <span>{label}</span>
      <span className="text-fg">{readout}</span>
    </div>
  );
}

function Strip({
  name,
  level,
  pan,
  onLevel,
  onPan,
  delay,
  room,
  onDelay,
  onRoom,
}: {
  name: string;
  level: number;
  pan: number;
  onLevel: (n: number) => void;
  onPan: (n: number) => void;
  delay?: number;
  room?: number;
  onDelay?: (n: number) => void;
  onRoom?: (n: number) => void;
}) {
  return (
    <section className="strip">
      <h2>{name}</h2>
      <Fader label="Level" min={0} max={127} value={level} onChange={onLevel} />
      <div className="strip-knobs">
        <Knob pan label="Pan" min={0} max={127} value={pan} onChange={onPan} />
        {onDelay && delay != null ? <Knob label="Delay" min={0} max={127} value={delay} onChange={onDelay} /> : null}
        {onRoom && room != null ? <Knob label="Room" min={0} max={127} value={room} onChange={onRoom} /> : null}
      </div>
    </section>
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
