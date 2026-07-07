import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, Dumbbell, History, TrendingUp, Save } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const PROGRAM: any = {
  Monday: {
    title: "Lower A + Tabata Abs",
    exercises: [
      { name: "Back Squat", target: "3x6-8", sets: 3 },
      { name: "Leg Press", target: "3x10-12", sets: 3 },
      { name: "Bulgarian Split Squat", target: "2x10 / leg", sets: 2 },
      { name: "Leg Extension", target: "3x12-15", sets: 3 },
    ],
    tabata: true,
  },
  Wednesday: {
    title: "Upper A",
    exercises: [
      { name: "Incline DB Press", target: "3x6-10", sets: 3 },
      { name: "Flat DB Press", target: "3x10-12", sets: 3 },
      { name: "Cable Pec-Deck Fly", target: "3x12-15", sets: 3 },
      { name: "Seated DB Shoulder Press", target: "3x8-10", sets: 3 },
      { name: "Cable Lateral Raise", target: "3x12-15", sets: 3 },
      { name: "Triceps Pushdown", target: "3x10-12", sets: 3 },
    ],
  },
  Friday: {
    title: "Lower B",
    exercises: [
      { name: "Romanian Deadlift", target: "3x6-8", sets: 3 },
      { name: "Hip Thrust", target: "3x8-10", sets: 3 },
      { name: "Seated Leg Curl", target: "3x10-12", sets: 3 },
      { name: "Seated Calf Raise", target: "3x12-15", sets: 3 },
    ],
  },
  Saturday: {
    title: "Upper B",
    exercises: [
      { name: "Neutral-Grip Lat Pulldown", target: "3x6-10", sets: 3 },
      { name: "Chest-Supported Row", target: "3x8-10", sets: 3 },
      { name: "Seated Cable Row", target: "3x10-12", sets: 3 },
      { name: "Rear Delt Fly", target: "3x12-15", sets: 3 },
      { name: "Barbell / DB Curl", target: "3x8-10", sets: 3 },
    ],
  },
};
const DAYS = ["Monday", "Wednesday", "Friday", "Saturday"];
const STORAGE_KEY = "iron-log-sessions-v1";
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } };
const saveSessions = (s: any) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [view, setView] = useState("home");
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sessions, setSessions] = useState<any[]>(loadSessions());
  useEffect(() => { saveSessions(sessions); }, [sessions]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
        {view !== "home" && (
          <button onClick={() => setView("home")} className="p-1 -ml-1"><ChevronLeft size={24} /></button>
        )}
        <Dumbbell size={22} className="text-orange-500" />
        <h1 className="text-lg font-bold">Iron Log</h1>
      </header>
      <main className="p-4 max-w-2xl mx-auto pb-28">
        {view === "home" && <Home onLog={(d: string) => { setSelectedDay(d); setView("log"); }} onHistory={() => setView("history")} onProgress={() => setView("progress")} />}
        {view === "log" && <LogSession day={selectedDay} sessions={sessions} onSave={(s: any) => { setSessions([...sessions, s]); setView("home"); }} />}
        {view === "history" && <HistoryView sessions={sessions} selected={selectedExercise} setSelected={setSelectedExercise} />}
        {view === "progress" && <ProgressView sessions={sessions} selected={selectedExercise} setSelected={setSelectedExercise} />}
      </main>
    </div>
  );
}

function Home({ onLog, onHistory, onProgress }: any) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Log today</h2>
        <div className="grid grid-cols-2 gap-2">
          {DAYS.map((d) => (
            <button key={d} onClick={() => onLog(d)} className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 text-left active:border-orange-500">
              <div className="font-semibold">{d}</div>
              <div className="text-xs text-neutral-400 mt-1">{PROGRAM[d].title}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <button onClick={onHistory} className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3"><History size={20} /> History</button>
        <button onClick={onProgress} className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3"><TrendingUp size={20} /> Progress</button>
      </section>
    </div>
  );
}

function LogSession({ day, sessions, onSave }: any) {
  const cfg = PROGRAM[day];
  const [logs, setLogs] = useState<any[]>(cfg.exercises.map((e: any) => ({ exercise: e.name, sets: Array.from({ length: e.sets }, () => ({ weight: "", reps: "" })) })));
  const [tabata, setTabata] = useState({ round1Exercises: "", round2Exercises: "", totalTime: "" });

  const lastFor = (name: string) => {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const ex = sessions[i].exercises.find((e: any) => e.exercise === name);
      if (ex) return { date: sessions[i].date, sets: ex.sets };
    }
    return null;
  };
  const updateSet = (ei: number, si: number, field: string, v: string) => {
    const next = [...logs];
    next[ei].sets[si] = { ...next[ei].sets[si], [field]: v };
    setLogs(next);
  };
  const save = () => {
    const session: any = { date: today(), day, exercises: logs.filter((e: any) => e.sets.some((s: any) => s.weight || s.reps)) };
    if (cfg.tabata) session.tabata = tabata;
    onSave(session);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{day}</h2>
        <p className="text-sm text-neutral-400">{cfg.title}</p>
      </div>
      {logs.map((log: any, ei: number) => {
        const last = lastFor(log.exercise);
        const target = cfg.exercises[ei].target;
        return (
          <div key={log.exercise} className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
            <div className="font-semibold">{log.exercise}</div>
            <div className="text-xs text-neutral-500 mb-2">Target: {target}</div>
            {last && (
              <div className="text-xs text-neutral-400 mb-3 border-l-2 border-orange-500 pl-2">
                Last ({last.date}): {last.sets.map((s: any, i: number) => <span key={i}>{s.weight}kg×{s.reps}{i < last.sets.length - 1 ? " · " : ""}</span>)}
              </div>
            )}
            <div className="space-y-2">
              {log.sets.map((s: any, si: number) => (
                <div key={si} className="flex gap-2 items-center">
                  <span className="text-xs text-neutral-500 w-10">Set {si + 1}</span>
                  <input type="number" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => updateSet(ei, si, "weight", e.target.value)} className="flex-1 bg-neutral-800 rounded px-3 py-3 text-lg" />
                  <input type="number" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => updateSet(ei, si, "reps", e.target.value)} className="flex-1 bg-neutral-800 rounded px-3 py-3 text-lg" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {cfg.tabata && (
        <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
          <div className="font-semibold">Tabata Abs</div>
          <div className="text-xs text-neutral-500 mb-3">2 rounds · 10 exercises · 30s work / 8s transition · 60s between rounds</div>
          <div className="space-y-2">
            <input type="number" placeholder="Round 1: exercises done (of 10)" value={tabata.round1Exercises} onChange={(e) => setTabata({ ...tabata, round1Exercises: e.target.value })} className="w-full bg-neutral-800 rounded px-3 py-3" />
            <input type="number" placeholder="Round 2: exercises done (of 10)" value={tabata.round2Exercises} onChange={(e) => setTabata({ ...tabata, round2Exercises: e.target.value })} className="w-full bg-neutral-800 rounded px-3 py-3" />
            <input type="text" placeholder="Total time (mm:ss)" value={tabata.totalTime} onChange={(e) => setTabata({ ...tabata, totalTime: e.target.value })} className="w-full bg-neutral-800 rounded px-3 py-3" />
          </div>
        </div>
      )}
      <button onClick={save} className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto bg-orange-600 active:bg-orange-700 py-4 rounded-lg font-semibold flex items-center justify-center gap-2">
        <Save size={20} /> Save Session ({today()})
      </button>
    </div>
  );
}

function allExercises() {
  const s = new Set<string>();
  DAYS.forEach((d) => PROGRAM[d].exercises.forEach((e: any) => s.add(e.name)));
  return Array.from(s);
}

function HistoryView({ sessions, selected, setSelected }: any) {
  const exercises = allExercises();
  const rows = useMemo(() => {
    const r: any[] = [];
    sessions.forEach((s: any) => {
      const ex = s.exercises.find((e: any) => e.exercise === selected);
      if (ex) r.push({ date: s.date, sets: ex.sets });
    });
    return r.reverse();
  }, [sessions, selected]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">History</h2>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded p-3">
        <option value="">Pick an exercise…</option>
        {exercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {selected && rows.length === 0 && <p className="text-neutral-500">No history yet.</p>}
      <div className="space-y-2">
        {rows.map((r: any, i: number) => (
          <div key={i} className="bg-neutral-900 rounded p-3 border border-neutral-800">
            <div className="text-xs text-neutral-500 mb-1">{r.date}</div>
            <div className="text-sm">{r.sets.map((s: any, si: number) => <span key={si}>{s.weight}kg × {s.reps}{si < r.sets.length - 1 ? "  ·  " : ""}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressView({ sessions, selected, setSelected }: any) {
  const exercises = allExercises();
  const data = useMemo(() => {
    return sessions.map((s: any) => {
      const ex = s.exercises.find((e: any) => e.exercise === selected);
      if (!ex) return null;
      const top = Math.max(...ex.sets.map((set: any) => parseFloat(set.weight) || 0));
      return { date: s.date, top };
    }).filter(Boolean);
  }, [sessions, selected]);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Progress</h2>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded p-3">
        <option value="">Pick an exercise…</option>
        {exercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {selected && data.length === 0 && <p className="text-neutral-500">No data yet.</p>}
      {data.length > 0 && (
        <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#262626" />
              <XAxis dataKey="date" stroke="#737373" fontSize={11} />
              <YAxis stroke="#737373" fontSize={11} />
              <Tooltip contentStyle={{ background: "#171717", border: "1px solid #404040" }} />
              <Line type="monotone" dataKey="top" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
