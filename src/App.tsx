import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, Dumbbell, History, TrendingUp, Save, Download, Upload } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const PROGRAM: any = {
  Monday: {
    title: "Lower A + Tabata Abs",
    exercises: [
      { name: "Back Squat", target: "3x6-8", sets: 3 },
      { name: "Leg Press", target: "3x10-12", sets: 3 },
      { name: "Bulgarian Split Squat", target: "2x10/leg", sets: 2 },
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

const loadSessions = (): any[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
};
const saveSessions = (s: any) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
const today = () => new Date().toISOString().slice(0, 10);

// ---------- CSV Export / Import ----------
function escapeCsv(v: any): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportToCsv(sessions: any[]) {
  const headers = ["Date", "Day", "Workout", "Exercise", "Set #", "Weight (kg)", "Reps", "Target", "Notes"];
  const rows: string[] = [headers.join(",")];

  sessions.forEach((s) => {
    const workoutTitle = PROGRAM[s.day]?.title || "";
    s.exercises.forEach((ex: any) => {
      const target = PROGRAM[s.day]?.exercises.find((e: any) => e.name === ex.exercise)?.target || "";
      ex.sets.forEach((set: any, i: number) => {
        rows.push([
          s.date, s.day, workoutTitle, ex.exercise, i + 1,
          set.weight || "", set.reps || "", target, "",
        ].map(escapeCsv).join(","));
      });
    });
    if (s.tabata) {
      rows.push([s.date, s.day, workoutTitle, "Tabata Abs - Round 1", "", "", s.tabata.round1Exercises || "", "of 10", ""].map(escapeCsv).join(","));
      rows.push([s.date, s.day, workoutTitle, "Tabata Abs - Round 2", "", "", s.tabata.round2Exercises || "", "of 10", ""].map(escapeCsv).join(","));
      rows.push([s.date, s.day, workoutTitle, "Tabata Abs - Total Time", "", "", s.tabata.totalTime || "", "mm:ss", ""].map(escapeCsv).join(","));
    }
  });

  const csv = rows.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iron-log-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function importFromCsv(text: string): any[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iDate = idx("Date"), iDay = idx("Day"), iExercise = idx("Exercise"),
        iSet = idx("Set #"), iWeight = idx("Weight (kg)"), iReps = idx("Reps");

  const sessionsMap = new Map<string, any>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const date = row[iDate]?.trim();
    const day = row[iDay]?.trim();
    const exercise = row[iExercise]?.trim();
    if (!date || !day || !exercise) continue;
    const key = date + "|" + day;
    if (!sessionsMap.has(key)) sessionsMap.set(key, { date, day, exercises: [] });
    const session = sessionsMap.get(key);

    if (exercise.startsWith("Tabata Abs")) {
      if (!session.tabata) session.tabata = { round1Exercises: "", round2Exercises: "", totalTime: "" };
      const val = row[iReps]?.trim() || "";
      if (exercise.includes("Round 1")) session.tabata.round1Exercises = val;
      else if (exercise.includes("Round 2")) session.tabata.round2Exercises = val;
      else if (exercise.includes("Total Time")) session.tabata.totalTime = val;
      continue;
    }

    let ex = session.exercises.find((e: any) => e.exercise === exercise);
    if (!ex) { ex = { exercise, sets: [] }; session.exercises.push(ex); }
    const setNum = parseInt(row[iSet] || "0") - 1;
    const weight = row[iWeight]?.trim() || "";
    const reps = row[iReps]?.trim() || "";
    while (ex.sets.length <= setNum) ex.sets.push({ weight: "", reps: "" });
    if (setNum >= 0) ex.sets[setNum] = { weight, reps };
  }
  return Array.from(sessionsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- App ----------
export default function App() {
  const [view, setView] = useState<any>("home");
  const [selectedDay, setSelectedDay] = useState<any>("Monday");
  const [selectedExercise, setSelectedExercise] = useState<any>("");
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
        {view === "home" && (
          <Home
            sessions={sessions}
            setSessions={setSessions}
            onLog={(d: string) => { setSelectedDay(d); setView("log"); }}
            onHistory={() => setView("history")}
            onProgress={() => setView("progress")}
          />
        )}
        {view === "log" && (
          <LogSession
            day={selectedDay}
            sessions={sessions}
            onSave={(s: any) => { setSessions([...sessions, s]); setView("home"); }}
          />
        )}
        {view === "history" && (
          <HistoryView sessions={sessions} selected={selectedExercise} setSelected={setSelectedExercise} />
        )}
        {view === "progress" && (
          <ProgressView sessions={sessions} selected={selectedExercise} setSelected={setSelectedExercise} />
        )}
      </main>
    </div>
  );
}

function Home({ sessions, setSessions, onLog, onHistory, onProgress }: any) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = importFromCsv(String(ev.target?.result || ""));
        if (imported.length === 0) { alert("No sessions found in file."); return; }
        const choice = confirm(
          `Import ${imported.length} session(s)?\n\nOK = REPLACE all existing data\nCancel = MERGE with existing data`
        );
        if (choice) {
          setSessions(imported);
          alert("Data replaced.");
        } else {
          const merged = [...sessions];
          const existingKeys = new Set(sessions.map((s: any) => s.date + "|" + s.day));
          imported.forEach((s: any) => {
            if (!existingKeys.has(s.date + "|" + s.day)) merged.push(s);
          });
          merged.sort((a, b) => a.date.localeCompare(b.date));
          setSessions(merged);
          alert(`Merged. Total sessions: ${merged.length}`);
        }
      } catch (err) {
        alert("Failed to import file. Make sure it's a valid Iron Log CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Log today</h2>
        <div className="grid grid-cols-2 gap-2">
          {DAYS.map((d) => (
            <button key={d} onClick={() => onLog(d)}
              className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 text-left active:border-orange-500">
              <div className="font-semibold">{d}</div>
              <div className="text-xs text-neutral-400 mt-1">{PROGRAM[d].title}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <button onClick={onHistory} className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3">
          <History size={20} /> History
        </button>
        <button onClick={onProgress} className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3">
          <TrendingUp size={20} /> Progress
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Backup</h2>
        <button
          onClick={() => {
            if (sessions.length === 0) { alert("Nothing to export yet."); return; }
            exportToCsv(sessions);
          }}
          className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3">
          <Download size={20} className="text-orange-500" />
          <div className="text-left">
            <div className="font-semibold">Export to Excel (CSV)</div>
            <div className="text-xs text-neutral-400">{sessions.length} session(s) logged</div>
          </div>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full p-4 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3">
          <Upload size={20} className="text-orange-500" />
          <div className="text-left">
            <div className="font-semibold">Import from CSV</div>
            <div className="text-xs text-neutral-400">Restore or merge a backup</div>
          </div>
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
      </section>
    </div>
  );
}

function LogSession({ day, sessions, onSave }: any) {
  const cfg = PROGRAM[day];
  const [logs, setLogs] = useState<any>(
    cfg.exercises.map((e: any) => ({
      exercise: e.name,
      sets: Array.from({ length: e.sets }, () => ({ weight: "", reps: "" })),
    }))
  );
  const [tabata, setTabata] = useState<any>({ round1Exercises: "", round2Exercises: "", totalTime: "" });

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
    const session: any = {
      date: today(),
      day,
      exercises: logs.filter((e: any) => e.sets.some((s: any) => s.weight || s.reps)),
    };
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
                Last ({last.date}): {last.sets.map((s: any, i: number) =>
                  <span key={i}>{s.weight}kg×{s.reps}{i < last.sets.length - 1 ? " · " : ""}</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {log.sets.map((s: any, si: number) => (
                <div key={si} className="flex gap-2 items-center">
                  <span className="text-xs text-neutral-500 w-10">Set {si + 1}</span>
                  <input type="number" inputMode="decimal" placeholder="kg" value={s.weight}
                    onChange={(e) => updateSet(ei, si, "weight", e.target.value)}
                    className="flex-1 bg-neutral-800 rounded px-3 py-3 text-lg" />
                  <input type="number" inputMode="numeric" placeholder="reps" value={s.reps}
                    onChange={(e) => updateSet(ei, si, "reps", e.target.value)}
                    className="flex-1 bg-neutral-800 rounded px-3 py-3 text-lg" />
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
            <input type="number" placeholder="Round 1: exercises done (of 10)" value={tabata.round1Exercises}
              onChange={(e) => setTabata({ ...tabata, round1Exercises: e.target.value })}
              className="w-full bg-neutral-800 rounded px-3 py-3" />
            <input type="number" placeholder="Round 2: exercises done (of 10)" value={tabata.round2Exercises}
              onChange={(e) => setTabata({ ...tabata, round2Exercises: e.target.value })}
              className="w-full bg-neutral-800 rounded px-3 py-3" />
            <input type="text" placeholder="Total time (mm:ss)" value={tabata.totalTime}
              onChange={(e) => setTabata({ ...tabata, totalTime: e.target.value })}
              className="w-full bg-neutral-800 rounded px-3 py-3" />
          </div>
        </div>
      )}

      <button onClick={save}
        className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto bg-orange-600 active:bg-orange-700 py-4 rounded-lg font-semibold flex items-center justify-center gap-2">
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
      <select value={selected} onChange={(e) => setSelected(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 rounded p-3">
        <option value="">Pick an exercise…</option>
        {exercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {selected && rows.length === 0 && <p className="text-neutral-500">No history yet.</p>}
      <div className="space-y-2">
        {rows.map((r: any, i: number) => (
          <div key={i} className="bg-neutral-900 rounded p-3 border border-neutral-800">
            <div className="text-xs text-neutral-500 mb-1">{r.date}</div>
            <div className="text-sm">
              {r.sets.map((s: any, si: number) => (
                <span key={si}>{s.weight}kg × {s.reps}{si < r.sets.length - 1 ? "  ·  " : ""}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressView({ sessions, selected, setSelected }: any) {
  const exercises = allExercises();
  const data = useMemo(() => {
    return sessions
      .map((s: any) => {
        const ex = s.exercises.find((e: any) => e.exercise === selected);
        if (!ex) return null;
        const top = Math.max(...ex.sets.map((set: any) => parseFloat(set.weight) || 0));
        return { date: s.date, top };
      })
      .filter(Boolean);
  }, [sessions, selected]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Progress</h2>
      <select value={selected} onChange={(e) => setSelected(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 rounded p-3">
        <option value="">Pick an exercise…</option>
        {exercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {selected && data.length === 0 && <p className="text-neutral-500">No data yet.</p>}
      {data.length > 0 && (
        <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data as any}>
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
