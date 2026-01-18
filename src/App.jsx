import React, { useEffect, useMemo, useRef, useState } from "react";

// ToolStack — Overtime-It — Upgraded MVP (UI Lock: Check-It master)
// Paste into: src/App.jsx
// Requires: Tailwind v4 configured.

const APP_ID = "overtimeit";
const APP_VERSION = "v1";

// Per-module storage namespace
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;

// Shared profile (used by all modules later)
const PROFILE_KEY = "toolstack.profile.v1";

// Put your real ToolStack hub URL here (Wix page)
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// --- utils ---
const safeParse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const uid = (prefix = "id") => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isoToday = () => new Date().toISOString().slice(0, 10);

const monthKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const monthLabel = (ym) => {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return String(ym || "");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
};

const toNumber = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const roundToStep = (mins, step) => {
  const s = toNumber(step);
  if (!s) return mins;
  return Math.round(mins / s) * s;
};

const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  // Overnight support
  const diff = e >= s ? e - s : 24 * 60 - s + e;
  return Math.max(0, diff);
};

const fmtHours = (mins) => {
  const m = Math.max(0, Math.round(toNumber(mins)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
};

const startOfMonthISO = (ym) => `${ym}-01`;

const endOfMonthISO = (ym) => {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return isoToday();
  const d = new Date(Number(y), Number(m), 0);
  return d.toISOString().slice(0, 10);
};

const calculateRules = (start, end, breakMins, rules) => {
  if (!start || !end) return { totalMinutes: 0, minutesByRateLabel: {}, missingMinutes: 0 };

  const toMins = (s) => {
    const [h, m] = String(s).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  let s = toMins(start);
  let e = toMins(end);
  if (e < s) e += 1440; // Cross midnight

  // Apply break from the end of the shift
  const duration = Math.max(0, e - s - toNumber(breakMins));
  const effectiveEnd = s + duration;

  const byRate = {};
  let total = 0;

  if (duration > 0 && rules && rules.length > 0) {
    rules.forEach((r) => {
      const rS = toMins(r.start);
      const rE = toMins(r.end);
      const intervals = [];

      if (rE < rS) {
        intervals.push([0, rE]);
        intervals.push([rS, 1440]);
        intervals.push([1440, 1440 + rE]);
        intervals.push([1440 + rS, 2880]);
      } else {
        intervals.push([rS, rE]);
        intervals.push([1440 + rS, 1440 + rE]);
      }

      let mins = 0;
      intervals.forEach(([iS, iE]) => {
        const segS = Math.max(s, iS);
        const segE = Math.min(effectiveEnd, iE);
        if (segE > segS) mins += segE - segS;
      });

      if (mins > 0) {
        byRate[r.rateLabel] = (byRate[r.rateLabel] || 0) + mins;
        total += mins;
      }
    });
  }

  const missingMinutes = Math.max(0, duration - total);

  return { totalMinutes: total, minutesByRateLabel: byRate, missingMinutes };
};

const getProfile = (dateStr, holidays = [], override = "auto") => {
  if (override && override !== "auto") return override;
  if (holidays && holidays.includes(dateStr)) return "sundayHoliday";
  if (!dateStr) return "weekday";
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  if (day === 0) return "sundayHoliday";
  if (day === 6) return "saturday";
  return "weekday";
};

const getWeekRange = (dateStr) => {
  const d = new Date(dateStr || isoToday());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: `Week ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
  };
};

const getMonthRange = (dateStr) => {
  const ym = (dateStr || isoToday()).slice(0, 7);
  return { start: startOfMonthISO(ym), end: endOfMonthISO(ym), label: `Month ${monthLabel(ym)}` };
};

// --- UI tokens (Check-It master) ---
const btnSecondary =
  "px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-[#D5FF00] hover:text-black active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary =
  "px-3 py-2 rounded-xl bg-neutral-700 text-white border border-neutral-700 shadow-sm hover:bg-[#D5FF00] hover:text-black active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnDanger =
  "px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 shadow-sm hover:bg-red-100 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const inputBase =
  "w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";

// ---------- Normalized top actions (mobile grid) ----------
const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-700 hover:bg-[#D5FF00] hover:text-black text-white border-neutral-700"
      : tone === "danger"
      ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
      : "bg-white hover:bg-[#D5FF00] hover:text-black text-neutral-700 border-neutral-200";

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${ACTION_BASE} ${cls}`}>
      {children}
    </button>
  );
}

function ActionFileButton({ children, onFile, accept = "application/json", tone = "primary", title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-700 hover:bg-[#D5FF00] hover:text-black text-white border-neutral-700"
      : "bg-white hover:bg-[#D5FF00] hover:text-black text-neutral-700 border-neutral-200";

  return (
    <label title={title} className={`${ACTION_BASE} ${cls} cursor-pointer`}>
      <span>{children}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          onFile?.(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

// ---------- Help icon pinned far-right ----------
function HelpIconButton({ onClick, title = "Help", className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        "print:hidden h-10 w-10 shrink-0 rounded-xl border border-neutral-200 bg-white shadow-sm " +
        "hover:bg-[#D5FF00] active:translate-y-[1px] transition flex items-center justify-center " +
        "focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300 " +
        className
      }
    >
      <span className="text-lg font-black text-neutral-800">?</span>
    </button>
  );
}

// ---------- Help Pack v1 (Canonical) ----------
function HelpModal({ open, onClose, appName = "ToolStack App", storageKey = "(unknown)", actions = [] }) {
  if (!open) return null;

  const Section = ({ title, children }) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <div className="text-sm text-neutral-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );

  const Bullet = ({ children }) => <li className="ml-4 list-disc">{children}</li>;

  const ActionRow = ({ name, desc }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-neutral-100 last:border-b-0">
      <div className="text-sm font-medium text-neutral-900">{name}</div>
      <div className="text-sm text-neutral-600 text-right">{desc}</div>
    </div>
  );

  const baseActions = [
    { name: "Preview", desc: "Shows a clean report sheet inside the app (print-safe)." },
    { name: "Print / Save PDF", desc: "Uses your browser print dialog to print or save a PDF." },
    { name: "Export", desc: "Downloads a JSON backup file of your saved data." },
    { name: "Import", desc: "Loads a JSON backup file and replaces the current saved data." },
  ];

  const extra = (actions || []).map((a) => ({
    name: a,
    desc: String(a).toLowerCase().includes("csv")
      ? "Downloads a CSV export for spreadsheets (Excel/Sheets)."
      : "Extra tool for this app.",
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-4 bg-white shrink-0">
            <div>
              <div className="text-sm text-neutral-500">ToolStack • Help Pack v1</div>
              <h2 className="text-lg font-semibold text-neutral-900">{appName} — how your data works</h2>
              <div className="mt-3 h-[2px] w-56 rounded-full bg-gradient-to-r from-[#D5FF00]/0 via-[#D5FF00] to-[#D5FF00]/0" />
            </div>

            <button
              type="button"
              className={btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            <Section title="Quick start (daily use)">
              <ul className="space-y-1">
                <Bullet>Use the app normally — it autosaves as you type.</Bullet>
                <Bullet>
                  Use <b>Preview</b> → then <b>Print / Save PDF</b> for a clean report.
                </Bullet>
                <Bullet>
                  Use <b>Export</b> regularly to create backups.
                </Bullet>
              </ul>
            </Section>

            <Section title="Where your data lives (important)">
              <p>
                Your data is saved automatically in your browser on <b>this device</b> using local storage (localStorage).
              </p>
              <ul className="space-y-1">
                <Bullet>No login is required (for now).</Bullet>
                <Bullet>If you switch device/browser/profile, your data will not follow automatically.</Bullet>
              </ul>
            </Section>

            <Section title="Backup routine (recommended)">
              <ul className="space-y-1">
                <Bullet>
                  Export after major changes, or at least <b>weekly</b>.
                </Bullet>
                <Bullet>Keep 2–3 older exports as a fallback.</Bullet>
                <Bullet>Save exports somewhere safe (Drive/Dropbox/OneDrive) or email them to yourself.</Bullet>
              </ul>
            </Section>

            <Section title="Restore / move to a new device (Import)">
              <p>
                On a new device/browser (or after clearing site data), use <b>Import</b> and select your latest exported JSON.
              </p>
              <ul className="space-y-1">
                <Bullet>Import replaces the current saved data with the file’s contents.</Bullet>
                <Bullet>If an import fails, try an older export (versions can differ).</Bullet>
              </ul>
            </Section>

            <Section title="Overtime Rules (User-defined)">
              <Bullet>Use the <b>Rules Wizard</b> to set up rules quickly.</Bullet>
              <Bullet>You must define at least one overtime window before the app can calculate overtime.</Bullet>
              <Bullet>Windows can cross midnight (e.g. 20:00–06:00).</Bullet>
              <Bullet>When you enter a session (start/end), the app splits time into your rate windows automatically.</Bullet>
              <Bullet>Break minutes reduce the calculated overtime (subtracted from the end of the shift first).</Bullet>
            </Section>

            <Section title="Buttons glossary (same meaning across ToolStack)">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3">
                {[...baseActions, ...extra].map((a) => (
                  <ActionRow key={a.name} name={a.name} desc={a.desc} />
                ))}
              </div>
            </Section>

            <Section title="What can erase local data">
              <ul className="space-y-1">
                <Bullet>Clearing browser history / site data.</Bullet>
                <Bullet>Private/incognito mode.</Bullet>
                <Bullet>Some “cleanup/optimizer” tools.</Bullet>
                <Bullet>Reinstalling the browser or using a different browser profile.</Bullet>
              </ul>
            </Section>

            <Section title="Storage key (for troubleshooting)">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <span className="font-medium">localStorage key:</span> <span className="font-mono">{storageKey}</span>
              </div>
            </Section>

            <Section title="Privacy">
              <p>By default, your data stays on your device. It only leaves your device if you export it or share it yourself.</p>
            </Section>
          </div>

          <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              className={btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
          </div>
      </div>
    </div>
  );
}

// --- storage ---
function migrateIfNeeded() {
  // Placeholder for future migrations.
}

function loadProfile() {
  return (
    safeParse(typeof window !== "undefined" ? localStorage.getItem(PROFILE_KEY) : null, null) || {
      org: "",
      user: "",
      language: "EN",
      logo: "",
    }
  );
}

function normalizeState(raw) {
  const base = {
    meta: { appId: APP_ID, version: APP_VERSION, updatedAt: new Date().toISOString() },
    rulesByProfile: { weekday: [], saturday: [], sundayHoliday: [] },
    holidays: [],
    settings: {
      standardDayMins: 480, // 8h
      roundingStep: 0, // 0 = exact minutes
    },
    ui: {
      activeMonth: monthKey(),
      useRange: false,
      filterFrom: startOfMonthISO(monthKey()),
      filterTo: endOfMonthISO(monthKey()),
    },
    lockedMonths: [], // ["YYYY-MM"]
    entries: [],
  };

  const s = raw && typeof raw === "object" ? raw : base;

  const entries = Array.isArray(s.entries) ? s.entries : [];
  const ui = { ...base.ui, ...(s.ui || {}) };
  const settings = { ...base.settings, ...(s.settings || {}) };
  const lockedMonths = Array.isArray(s.lockedMonths) ? s.lockedMonths.filter(Boolean) : [];
  const holidays = Array.isArray(s.holidays) ? s.holidays : [];
  
  let rulesByProfile = s.rulesByProfile || { weekday: [], saturday: [], sundayHoliday: [] };
  
  // Migration from rulesByDayType (v1.1) or rules (v1.0)
  if (s.rulesByDayType && !s.rulesByProfile) {
    rulesByProfile.weekday = s.rulesByDayType.weekday || [];
    rulesByProfile.saturday = s.rulesByDayType.weekend || [];
    rulesByProfile.sundayHoliday = s.rulesByDayType.weekend || [];
  } else if (Array.isArray(s.rules) && !s.rulesByProfile) {
    rulesByProfile.weekday = s.rules;
  }
  ['weekday', 'saturday', 'sundayHoliday'].forEach(k => {
    if (!Array.isArray(rulesByProfile[k])) rulesByProfile[k] = [];
  });

  const cleanEntries = entries
    .filter(Boolean)
    .map((e) => ({
      id: e.id || uid("ot"),
      date: e.date || isoToday(),
      start: e.start || "",
      end: e.end || "",
      breakMins: clamp(toNumber(e.breakMins), 0, 24 * 60),
      workMins: clamp(toNumber(e.workMins), 0, 24 * 60),
      totalMinutes: toNumber(e.totalMinutes),
      missingMinutes: toNumber(e.missingMinutes),
      profileOverride: e.profileOverride || "auto",
      minutesByRateLabel: e.minutesByRateLabel || {},
      note: typeof e.note === "string" ? e.note : "",
      createdAt: e.createdAt || new Date().toISOString(),
      updatedAt: e.updatedAt || null,
    }));

  if (!ui.activeMonth) ui.activeMonth = monthKey();
  if (!ui.filterFrom) ui.filterFrom = startOfMonthISO(ui.activeMonth);
  if (!ui.filterTo) ui.filterTo = endOfMonthISO(ui.activeMonth);

  return {
    ...base,
    ...s,
    settings,
    rulesByProfile,
    holidays,
    rulesByDayType: undefined,
    rules: undefined, // Cleanup old key
    ui,
    lockedMonths,
    entries: cleanEntries,
    meta: { ...base.meta, ...(s.meta || {}), updatedAt: new Date().toISOString() },
  };
}

function loadState() {
  migrateIfNeeded();
  const raw = safeParse(typeof window !== "undefined" ? localStorage.getItem(KEY) : null, null);
  return normalizeState(raw);
}

function saveState(state) {
  const next = normalizeState({
    ...state,
    meta: { ...(state.meta || {}), updatedAt: new Date().toISOString() },
  });
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function RulesWizardModal({ open, onClose, rulesByProfile, holidays, onSave }) {
  if (!open) return null;
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState("weekday");
  const [draftRules, setDraftRules] = useState({ weekday: [], saturday: [], sundayHoliday: [] });
  const [draftHolidays, setDraftHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState("");

  // Form inputs
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rateLabel, setRateLabel] = useState("");

  // Test inputs
  const [tS, setTS] = useState("08:00");
  const [tE, setTE] = useState("18:00");
  const [tB, setTB] = useState(0);

  useEffect(() => {
    if (open) {
      const hasRules = rulesByProfile && Object.values(rulesByProfile).some(arr => arr.length > 0);
      setStep(hasRules ? 2 : 1);
      setActiveTab("weekday");
      setDraftRules(rulesByProfile ? JSON.parse(JSON.stringify(rulesByProfile)) : { weekday: [], saturday: [], sundayHoliday: [] });
      setDraftHolidays(holidays ? [...holidays] : []);
      setName(""); setStart(""); setEnd(""); setRateLabel("");
      setTS("08:00"); setTE("18:00"); setTB(0);
      setNewHoliday("");
    }
  }, [open, rulesByProfile, holidays]);

  const currentList = draftRules[activeTab] || [];

  const add = () => {
    if (!name || !start || !end || !rateLabel) return;
    setDraftRules({
      ...draftRules,
      [activeTab]: [...currentList, { id: uid("rule"), name, start, end, rateLabel }]
    });
    setName(""); setStart(""); setEnd(""); setRateLabel("");
  };

  const remove = (id) => {
    setDraftRules({ ...draftRules, [activeTab]: currentList.filter((r) => r.id !== id) });
  };

  const edit = (r) => {
    setName(r.name);
    setStart(r.start);
    setEnd(r.end);
    setRateLabel(r.rateLabel);
    remove(r.id);
  };

  const addHoliday = () => {
    if (!newHoliday || draftHolidays.includes(newHoliday)) return;
    setDraftHolidays([...draftHolidays, newHoliday].sort());
    setNewHoliday("");
  };

  const removeHoliday = (h) => {
    setDraftHolidays(draftHolidays.filter(d => d !== h));
  };

  const testResult = useMemo(() => {
    const rules = draftRules[activeTab] || [];
    return calculateRules(tS, tE, tB, rules);
  }, [tS, tE, tB, draftRules, activeTab]);

  const canNext = step === 1 || (step === 2 && Object.values(draftRules).some(arr => arr.length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg text-neutral-900">Rules Wizard</h3>
            <div className="text-xs text-neutral-500">Step {step} of 3</div>
          </div>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="text-xl font-bold text-neutral-800">Welcome to Overtime-It Rules</h4>
              <p className="text-neutral-600">
                To calculate your overtime correctly, this app needs to know your rate windows.
              </p>
              <ul className="list-disc ml-5 space-y-2 text-neutral-700">
                <li><b>Rate Labels:</b> Give each window a name (e.g., "1.5x", "Night", "Sunday").</li>
                <li><b>Time Windows:</b> Define start and end times for each rate.</li>
                <li><b>Crossing Midnight:</b> If End time is earlier than Start time, it counts as overnight.</li>
                <li><b>Time Only:</b> This version tracks hours/minutes, not currency.</li>
              </ul>
              <div className="pt-4">
                <button onClick={() => setStep(2)} className={btnPrimary + " w-full sm:w-auto"}>Start setup</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-900">Manage Rules</h4>
                  <div className="flex bg-neutral-100 p-1 rounded-xl">
                    {["weekday", "saturday", "sundayHoliday"].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition ${activeTab === tab ? "bg-white shadow text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}>
                        {tab === "sundayHoliday" ? "Sun/Hol" : tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input className={inputBase + " !mt-0 sm:col-span-2"} placeholder="Name (e.g. Evening)" value={name} onChange={e => setName(e.target.value)} />
                  <input type="time" className={inputBase + " !mt-0"} value={start} onChange={e => setStart(e.target.value)} />
                  <input type="time" className={inputBase + " !mt-0"} value={end} onChange={e => setEnd(e.target.value)} />
                  <input className={inputBase + " !mt-0 sm:col-span-2"} placeholder="Rate Label (e.g. 1.5x)" value={rateLabel} onChange={e => setRateLabel(e.target.value)} />
                  <button onClick={add} disabled={!name || !start || !end || !rateLabel} className={btnPrimary + " sm:col-span-2"}>Add Window</button>
                </div>
                <div className="text-xs text-neutral-500">
                  Tip: If End is earlier than Start, it covers midnight (e.g. 22:00 to 06:00).
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-neutral-900 capitalize">{activeTab === "sundayHoliday" ? "Sunday / Holiday" : activeTab} Rules ({currentList.length})</h4>
                {currentList.length === 0 && (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-500 italic">
                    No rules for this profile yet.
                  </div>
                )}
                {currentList.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm border border-neutral-200 p-3 rounded-xl bg-white">
                    <div className="flex-1 font-medium text-neutral-900">{r.name}</div>
                    <div className="text-neutral-600 font-mono">{r.start} - {r.end}</div>
                    <div className="bg-neutral-100 px-2 py-1 rounded text-xs font-medium text-neutral-700">{r.rateLabel}</div>
                    <button onClick={() => edit(r)} className="text-neutral-600 hover:bg-[#D5FF00] hover:text-black px-2 py-1 rounded transition">Edit</button>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded transition">Delete</button>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-100 pt-4 space-y-3">
                <h4 className="font-semibold text-neutral-900">Public Holidays</h4>
                <div className="flex gap-2">
                  <input type="date" className={inputBase + " !mt-0"} value={newHoliday} onChange={e => setNewHoliday(e.target.value)} />
                  <button onClick={addHoliday} className={btnSecondary}>Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draftHolidays.length === 0 && <span className="text-xs text-neutral-400 italic">No holidays added.</span>}
                  {draftHolidays.map(h => (
                    <span key={h} className="inline-flex items-center px-2 py-1 rounded border border-neutral-200 bg-neutral-50 text-xs text-neutral-700">
                      {h}
                      <button onClick={() => removeHoliday(h)} className="ml-2 text-neutral-400 hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
                <div className="text-xs text-neutral-500">Dates listed here use the Sunday/Holiday rules profile.</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                {["weekday", "saturday", "sundayHoliday"].map(type => (
                  <div key={type} className="mb-4 last:mb-0">
                    <h4 className="font-semibold text-neutral-900 mb-2 capitalize">{type === "sundayHoliday" ? "Sunday / Holiday" : type} Rules</h4>
                    <div className="flex flex-wrap gap-2">
                      {draftRules[type].length === 0 ? <span className="text-xs text-neutral-400 italic">None</span> : 
                        draftRules[type].map(r => (
                          <span key={r.id} className="inline-flex items-center px-2 py-1 rounded border border-neutral-200 bg-neutral-50 text-xs text-neutral-700">
                            {r.name}: {r.start}-{r.end} ({r.rateLabel})
                          </span>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <h4 className="font-semibold text-neutral-900 mb-3">Test Calculation ({activeTab === "sundayHoliday" ? "Sun/Hol" : activeTab})</h4>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <label className="text-xs text-neutral-600 block">Start
                    <input type="time" className={inputBase} value={tS} onChange={e => setTS(e.target.value)} />
                  </label>
                  <label className="text-xs text-neutral-600 block">End
                    <input type="time" className={inputBase} value={tE} onChange={e => setTE(e.target.value)} />
                  </label>
                  <label className="text-xs text-neutral-600 block">Break (m)
                    <input type="number" className={inputBase} value={tB} onChange={e => setTB(e.target.value)} />
                  </label>
                </div>
                <div className="bg-lime-50 border border-lime-100 p-3 rounded-xl">
                  <div className="text-sm font-medium text-lime-900">Result: {fmtHours(testResult.totalMinutes)}</div>
                  <div className="text-xs text-lime-800 mt-1 space-y-1">
                    {Object.entries(testResult.minutesByRateLabel).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>{k}:</span> <span>{fmtHours(v)}</span></div>
                    ))}
                    {testResult.missingMinutes > 0 && (
                      <div className="text-xs text-amber-700 font-medium mt-1 border-t border-amber-200 pt-1">
                        Missing rules: {fmtHours(testResult.missingMinutes)}
                        <div className="font-normal text-amber-600">Add a rule window to cover this time.</div>
                      </div>
                    )}
                    {testResult.totalMinutes === 0 && <span>No overtime calculated.</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-between">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))} 
            disabled={step === 1} 
            className={btnSecondary}
          >
            Back
          </button>
          
          {step < 3 ? (
            <button 
              onClick={() => setStep(s => s + 1)} 
              disabled={!canNext} 
              className={btnPrimary}
            >
              Next
            </button>
          ) : (
            <button 
              onClick={() => { onSave(draftRules, draftHolidays); onClose(); }} 
              className={btnPrimary}
            >
              Finish & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportModal({ open, onClose, entries, profile, onOpenRules }) {
  if (!open) return null;
  const [rangeType, setRangeType] = useState("week");
  const [targetDate, setTargetDate] = useState(isoToday());

  const range = useMemo(() => {
    return rangeType === "week" ? getWeekRange(targetDate) : getMonthRange(targetDate);
  }, [rangeType, targetDate]);

  const filtered = useMemo(() => {
    return entries.filter((e) => e.date >= range.start && e.date <= range.end);
  }, [entries, range]);

  const totals = useMemo(() => {
    let total = 0;
    let missing = 0;
    const byRate = {};
    filtered.forEach((e) => {
      const m = e.totalMinutes ?? e.workMins ?? 0;
      total += m;
      missing += (e.missingMinutes || 0);
      if (e.minutesByRateLabel) {
        Object.entries(e.minutesByRateLabel).forEach(([l, v]) => (byRate[l] = (byRate[l] || 0) + v));
      }
    });
    return { total, byRate, missing };
  }, [filtered]);

  const handleExport = () => {
    const payload = { range, generatedAt: new Date().toISOString(), entries: filtered, totals };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overtime-pack-${rangeType}-${range.start}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-100 flex flex-wrap justify-between items-center bg-neutral-50 rounded-t-2xl gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <h3 className="font-semibold text-lg">Export Pack</h3>
            <select className="px-2 py-1 rounded border border-neutral-300 text-sm" value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
            <input type="date" className="px-2 py-1 rounded border border-neutral-300 text-sm" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className={btnSecondary}>Export JSON</button>
            <button onClick={() => window.print()} className={btnSecondary}>Print / PDF</button>
            <button onClick={onClose} className={btnPrimary}>Close</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-white rounded-b-2xl">
          <div id="report-pack-print">
            <div className="mb-6">
              <div className="text-2xl font-bold text-neutral-900">Overtime Pack</div>
              <div className="text-neutral-600">{range.label}</div>
              <div className="text-sm text-neutral-500 mt-1">{profile.org} • {profile.user}</div>
            </div>
            <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="text-sm font-semibold text-neutral-700 mb-2">Summary</div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-neutral-500">Total Hours</div>
                  <div className="text-xl font-bold text-neutral-900">{fmtHours(totals.total)}</div>
                </div>
                {Object.entries(totals.byRate).map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-neutral-500">{l}</div>
                    <div className="text-lg font-medium text-neutral-900">{fmtHours(v)}</div>
                  </div>
                ))}
                {totals.missing > 0 && (
                  <div>
                    <div className="text-xs text-amber-600">Unclassified</div>
                    <div className="text-lg font-medium text-amber-700">{fmtHours(totals.missing)}</div>
                    <button onClick={onOpenRules} className="text-xs underline text-amber-600 hover:text-amber-800">Edit rules</button>
                  </div>
                )}
              </div>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-neutral-500 border-b border-neutral-200">
                <tr><th className="py-2">Date</th><th className="py-2">Start</th><th className="py-2">End</th><th className="py-2">Break</th><th className="py-2">Total</th><th className="py-2">Note</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-neutral-500">No entries in range</td></tr>}
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 font-medium">{e.date}</td>
                    <td className="py-2">{e.start}</td>
                    <td className="py-2">{e.end}</td>
                    <td className="py-2">{e.breakMins ? e.breakMins + "m" : "-"}</td>
                    <td className="py-2 font-semibold">
                      {fmtHours(e.totalMinutes)}
                      {e.missingMinutes > 0 && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1 rounded" title="Missing rules">!</span>}
                    </td>
                    <td className="py-2 text-neutral-600">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportMenuModal({ open, onClose, actions }) {
  if (!open) return null;
  const btnClass = "w-full text-left px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:bg-[#D5FF00] hover:text-black transition text-sm font-medium flex items-center justify-between group";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
          <h3 className="font-semibold text-lg text-neutral-900">Export Menu</h3>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { actions.print(); onClose(); }} className={btnClass}>
            <span>Print / Save PDF</span><span className="text-neutral-400 group-hover:text-black">→</span>
          </button>
          <button onClick={() => { actions.exportCSVEntries(); onClose(); }} className={btnClass}>
            <span>Export CSV (Entries)</span><span className="text-neutral-400 group-hover:text-black">↓</span>
          </button>
          <button onClick={() => { actions.exportCSVSummary(); onClose(); }} className={btnClass}>
            <span>Export CSV (Summary)</span><span className="text-neutral-400 group-hover:text-black">↓</span>
          </button>
          <button onClick={() => { actions.exportJSON(); onClose(); }} className={btnClass}>
            <span>Export JSON (Full backup)</span><span className="text-neutral-400 group-hover:text-black">↓</span>
          </button>
          <label className={btnClass + " cursor-pointer"}>
            <span>Import JSON</span><span className="text-neutral-400 group-hover:text-black">↑</span>
            <input type="file" accept="application/json" className="hidden" onChange={actions.importJSON} />
          </label>
          <div className="h-px bg-neutral-100 my-2" />
          <button onClick={() => { actions.copySummary(); onClose(); }} className={btnClass}>
            <span>Copy Summary</span><span className="text-neutral-400 group-hover:text-black">📋</span>
          </button>
          <button onClick={() => { actions.emailSummary(); onClose(); }} className={btnClass}>
            <span>Email Summary</span><span className="text-neutral-400 group-hover:text-black">✉️</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(loadProfile());
  const [state, setState] = useState(loadState());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Draft entry fields
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(isoToday());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [breakMins, setBreakMins] = useState(0);
  const [note, setNote] = useState("");
  const [profileOverride, setProfileOverride] = useState("auto");
  const endRef = useRef(null);

  // Persist profile (shared)
  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  // Persist state
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  // Keep draft date aligned with active month when switching months
  useEffect(() => {
    const ym = state.ui.activeMonth;
    if (!ym) return;
    const cur = date || isoToday();
    if (String(cur).slice(0, 7) !== ym) {
      const nextDate = ym === monthKey(new Date()) ? isoToday() : `${ym}-01`;
      setDate(nextDate);
    }

    setState((s) => {
      const u = s.ui || {};
      if (u.filterFrom?.slice(0, 7) === ym && u.filterTo?.slice(0, 7) === ym) return s;
      return saveState({
        ...s,
        ui: {
          ...u,
          filterFrom: startOfMonthISO(ym),
          filterTo: endOfMonthISO(ym),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ui.activeMonth]);

  const isMonthLocked = useMemo(() => {
    const ym = state.ui.activeMonth;
    return Boolean(ym && (state.lockedMonths || []).includes(ym));
  }, [state.ui.activeMonth, state.lockedMonths]);

  const entriesSorted = useMemo(() => {
    return [...(state.entries || [])].sort((a, b) => {
      const ak = `${a.date} ${a.start || ""}`;
      const bk = `${b.date} ${b.start || ""}`;
      return bk.localeCompare(ak);
    });
  }, [state.entries]);

  const filtered = useMemo(() => {
    const u = state.ui;
    if (!u.useRange) {
      const ym = u.activeMonth;
      return entriesSorted.filter((e) => String(e.date || "").slice(0, 7) === ym);
    }
    const from = u.filterFrom || startOfMonthISO(u.activeMonth);
    const to = u.filterTo || endOfMonthISO(u.activeMonth);
    return entriesSorted.filter((e) => e.date >= from && e.date <= to);
  }, [entriesSorted, state.ui]);

  const totals = useMemo(() => {
    let totalOvertime = 0;
    const byRate = {};
    const daySet = new Set(filtered.map((e) => e.date));

    filtered.forEach((e) => {
      const mins = e.totalMinutes ?? e.workMins ?? 0;
      totalOvertime += mins;
      if (e.minutesByRateLabel) {
        Object.entries(e.minutesByRateLabel).forEach(([label, m]) => {
          byRate[label] = (byRate[label] || 0) + m;
        });
      } else if (mins > 0) {
        byRate["(Legacy)"] = (byRate["(Legacy)"] || 0) + mins;
      }
    });

    return { totalOvertime, byRate, daysLogged: daySet.size };
  }, [filtered]);

  const computedResult = useMemo(() => {
    const profile = getProfile(date, state.holidays, profileOverride);
    const rules = state.rulesByProfile?.[profile] || [];
    return calculateRules(start, end, breakMins, rules);
  }, [start, end, breakMins, state.rulesByProfile, state.holidays, date, profileOverride]);

  const canSaveEntry = Boolean(date && start && end) && !isMonthLocked;

  const clearDraft = () => {
    setEditingId(null);
    setStart("");
    setEnd("");
    setBreakMins(0);
    setNote("");
    setProfileOverride("auto");
  };

  const startNowSession = () => {
    const now = new Date();
    const coeff = 1000 * 60 * 5;
    const rounded = new Date(Math.round(now.getTime() / coeff) * coeff);
    const hh = String(rounded.getHours()).padStart(2, "0");
    const mm = String(rounded.getMinutes()).padStart(2, "0");
    const startStr = `${hh}:${mm}`;
    
    const endD = new Date(rounded.getTime() + 30 * 60000);
    const eh = String(endD.getHours()).padStart(2, "0");
    const em = String(endD.getMinutes()).padStart(2, "0");
    const endStr = `${eh}:${em}`;

    const today = isoToday();
    const ym = today.slice(0, 7);

    if (ym !== state.ui.activeMonth) {
      setState(s => saveState({ ...s, ui: { ...s.ui, activeMonth: ym } }));
    }

    setEditingId(null);
    setDate(today);
    setStart(startStr);
    setEnd(endStr);
    setBreakMins(0);
    setNote("");
    setProfileOverride("auto");
    notify("Draft started (Now)");
    setTimeout(() => endRef.current?.focus(), 50);
  };

  const adjustEnd = (mins) => {
    if (!end) return;
    const [h, m] = end.split(":").map(Number);
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m + mins);
    setEnd(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") addOrUpdateEntry();
  };

  const presetNormalDay = () => {
    setStart("08:00");
    setEnd("17:00");
    setBreakMins(60);
    setNote("");
    setProfileOverride("auto");
    notify("Preset applied");
  };

  const copyLastEntry = () => {
    const ym = state.ui.activeMonth;
    const last = entriesSorted.find((e) => String(e.date || "").slice(0, 7) === ym) || entriesSorted[0];
    if (!last) return notify("No entry to copy");
    setStart(last.start || "");
    setEnd(last.end || "");
    setBreakMins(clamp(toNumber(last.breakMins), 0, 24 * 60));
    setNote(last.note || "");
    setProfileOverride(last.profileOverride || "auto");
    notify("Copied last entry fields");
  };

  const addOrUpdateEntry = () => {
    if (!date || !start || !end) return;

    const profile = getProfile(date, state.holidays, profileOverride);
    const rules = state.rulesByProfile?.[profile] || [];

    if (rules.length === 0) {
      notify(`No rules for ${profile}. Saved with 0 OT.`);
    }

    const { totalMinutes, minutesByRateLabel, missingMinutes } = calculateRules(start, end, breakMins, rules);
    
    if (editingId) {
      setState((prev) =>
        saveState({
          ...prev,
          entries: (prev.entries || []).map((e) =>
            e.id === editingId
              ? {
                  ...e,
                  date,
                  start,
                  end,
                  breakMins: toNumber(breakMins),
                  workMins: totalMinutes, // Keep for legacy compat
                  totalMinutes,
                  minutesByRateLabel,
                  missingMinutes,
                  profileOverride,
                  note: String(note || "").trim(),
                  updatedAt: new Date().toISOString(),
                }
              : e
          ),
        })
      );
      notify("Entry updated");
      clearDraft();
      return;
    }

    const entry = {
      id: uid("ot"),
      date,
      start,
      end,
      breakMins: toNumber(breakMins),
      workMins: totalMinutes,
      totalMinutes,
      minutesByRateLabel,
      missingMinutes,
      profileOverride,
      note: String(note || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    setState((prev) => saveState({ ...prev, entries: [entry, ...(prev.entries || [])] }));
    notify("Entry added");
    setStart("");
    setEnd("");
    setBreakMins(0);
    setNote("");
    setProfileOverride("auto");
  };

  const beginEdit = (entry) => {
    if (!entry) return;
    const ym = String(entry.date || "").slice(0, 7);
    if ((state.lockedMonths || []).includes(ym)) {
      notify("That month is locked");
      return;
    }
    setEditingId(entry.id);
    setDate(entry.date);
    setStart(entry.start || "");
    setEnd(entry.end || "");
    setBreakMins(clamp(toNumber(entry.breakMins), 0, 24 * 60));
    setNote(entry.note || "");
    setProfileOverride(entry.profileOverride || "auto");
    notify("Editing entry");
  };

  const deleteEntry = (id) => {
    if (isMonthLocked) return;
    const ok = window.confirm("Delete this entry?");
    if (!ok) return;
    setState((prev) => saveState({ ...prev, entries: (prev.entries || []).filter((e) => e.id !== id) }));
    if (editingId === id) clearDraft();
    notify("Deleted");
  };

  const duplicateEntry = (entry) => {
    if (!entry) return;
    const ym = String(entry.date || "").slice(0, 7);
    if ((state.lockedMonths || []).includes(ym)) {
      notify("That month is locked");
      return;
    }
    const copy = {
      ...entry,
      id: uid("ot"),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    setState((prev) => saveState({ ...prev, entries: [copy, ...(prev.entries || [])] }));
    notify("Duplicated");
  };

  const toggleLockMonth = () => {
    const ym = state.ui.activeMonth;
    if (!ym) return;
    setState((prev) => {
      const locked = new Set(prev.lockedMonths || []);
      if (locked.has(ym)) locked.delete(ym);
      else locked.add(ym);
      return saveState({ ...prev, lockedMonths: Array.from(locked) });
    });
    if (editingId) clearDraft();
    notify(isMonthLocked ? "Month unlocked" : "Month locked");
  };

  const exportJSON = () => {
    const payload = { exportedAt: new Date().toISOString(), profile, data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-overtime-it-${APP_VERSION}-${isoToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Exported");
  };

  const importJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const incoming = parsed?.data;
        if (!incoming || !Array.isArray(incoming.entries)) throw new Error("Invalid import file");
        setProfile(parsed?.profile || profile);
        setState(saveState(incoming));
        notify("Imported");
      } catch (e) {
        alert("Import failed: " + (e?.message || "unknown error"));
      }
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const header = ["date", "start", "end", "breakMins", "totalMinutes", "totalHours", "note"];

    const esc = (v) => {
      const s = String(v ?? "");
      return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = filtered.map((e) => [
      e.date,
      e.start,
      e.end,
      e.breakMins ?? 0,
      e.totalMinutes ?? 0,
      (toNumber(e.totalMinutes) / 60).toFixed(2),
      e.note || "",
    ]);

    const csv = [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-overtime-it-${state.ui.activeMonth}-entries.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("CSV exported");
  };

  const exportCSVSummary = () => {
    const rows = [
      ["Category", "Minutes", "Hours"],
      ["Total", totals.totalOvertime, (totals.totalOvertime / 60).toFixed(2)],
      ...Object.entries(totals.byRate).map(([l, m]) => [l, m, (m / 60).toFixed(2)]),
    ];
    if (totals.missing > 0) {
      rows.push(["Unclassified", totals.missing, (totals.missing / 60).toFixed(2)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overtime-summary-${isoToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Summary CSV exported");
  };

  const getSummaryText = () => {
    const lines = ["Overtime Summary"];
    lines.push(state.ui.useRange ? `Range: ${state.ui.filterFrom} to ${state.ui.filterTo}` : `Month: ${monthLabel(state.ui.activeMonth)}`);
    lines.push(`Total: ${fmtHours(totals.totalOvertime)}`);
    Object.entries(totals.byRate).forEach(([l, m]) => lines.push(`${l}: ${fmtHours(m)}`));
    if (totals.missing > 0) lines.push(`Missing Rules: ${fmtHours(totals.missing)}`);
    return lines.join("\n");
  };

  const copySummary = () => {
    navigator.clipboard.writeText(getSummaryText()).then(() => notify("Copied to clipboard"));
  };

  const emailSummary = () => {
    const body = getSummaryText();
    window.location.href = `mailto:?subject=Overtime Summary&body=${encodeURIComponent(body)}`;
  };

  const openPreview = () => setPreviewOpen(true);

  // IMPORTANT: top bar "Print / Save PDF" prints ONLY the preview sheet
  const printFromTop = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          #report-pack-print, #report-pack-print * { visibility: visible !important; }
        }
      `}</style>

      {previewOpen ? (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #ot-print-preview, #ot-print-preview *, #report-pack-print, #report-pack-print * { visibility: visible !important; }
            #ot-print-preview, #report-pack-print { position: absolute !important; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      ) : null}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} appName="Overtime-It" storageKey={KEY} actions={["Export CSV"]} />
      
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} entries={entriesSorted} profile={profile} onOpenRules={() => setRulesOpen(true)} />
      
      <RulesWizardModal 
        open={rulesOpen} 
        onClose={() => setRulesOpen(false)} 
        rulesByProfile={state.rulesByProfile} 
        holidays={state.holidays}
        onSave={(newRulesByProfile, newHolidays) => {
          setState(s => saveState({ ...s, rulesByProfile: newRulesByProfile, holidays: newHolidays }));
          notify("Rules saved");
        }} 
      />

      <ExportMenuModal
        open={exportMenuOpen}
        onClose={() => setExportMenuOpen(false)}
        actions={{
          print: printFromTop,
          exportCSVEntries: exportCSV,
          exportCSVSummary,
          exportJSON,
          importJSON: (e) => {
            const file = e.target.files?.[0];
            if (file) importJSON(file);
            setExportMenuOpen(false);
          },
          copySummary,
          emailSummary,
        }}
      />

      {/* Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />

          <div className="relative w-full max-w-5xl">
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-neutral-800">Print preview</div>
              <div className="flex items-center gap-2">
                <button className={btnSecondary} onClick={() => window.print()}>
                  Print / Save PDF
                </button>
                <button className={btnPrimary} onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="ot-print-preview" className="p-6">
                <ReportSheet
                  profile={profile}
                  month={state.ui.activeMonth}
                  useRange={state.ui.useRange}
                  range={{ from: state.ui.filterFrom, to: state.ui.filterTo }}
                  totals={totals}
                  entries={filtered}
                  storageKey={KEY}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-700">
              <span>Overtime</span>
              <span className="text-[#D5FF00]">It</span>
            </div>
            <div className="text-sm text-neutral-700">Record your overtime with ease</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-[#D5FF00]/0 via-[#D5FF00] to-[#D5FF00]/0" />
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-lime-200 bg-lime-50 text-neutral-800">
                {fmtHours(totals.totalOvertime)} overtime
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 bg-white text-neutral-800">
                {totals.daysLogged} days
              </span>
            </div>
          </div>

          {/* Top actions + pinned help icon */}
          <div className="w-full sm:w-[860px] relative">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 pr-12">
              <ActionButton onClick={() => setRulesOpen(true)}>Rules Wizard</ActionButton>
              <ActionButton onClick={() => setReportOpen(true)}>Range Report</ActionButton>
              <ActionButton onClick={openPreview} tone="default">Preview</ActionButton>
              <ActionButton onClick={() => setExportMenuOpen(true)}>Export</ActionButton>
            </div>

            <div className="absolute right-0 top-0">
              <HelpIconButton onClick={() => setHelpOpen(true)} />
            </div>
          </div>
        </div>

        {/* Banner if no rules */}
        {(!state.rulesByProfile?.weekday?.length && !state.rulesByProfile?.saturday?.length && !state.rulesByProfile?.sundayHoliday?.length) && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-amber-800">Overtime rules not set</div>
              <div className="text-sm text-amber-700">You must set up rules before you can record entries.</div>
            </div>
            <button
              onClick={() => setRulesOpen(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 font-medium hover:bg-[#D5FF00] hover:text-black transition"
            >
              Run Rules Wizard
            </button>
          </div>
        )}

        {/* Main grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Profile */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 print:shadow-none">
              <div className="font-semibold text-neutral-800">Profile (shared)</div>
              <div className="mt-3 space-y-2">
                <label className="block text-sm">
                  <div className="text-neutral-600">Organization</div>
                  <input className={inputBase} value={profile.org} onChange={(e) => setProfile({ ...profile, org: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <div className="text-neutral-600">User</div>
                  <input className={inputBase} value={profile.user} onChange={(e) => setProfile({ ...profile, user: e.target.value })} />
                </label>
                <div className="pt-2 text-xs text-neutral-500">
                  Stored at <span className="font-mono">{PROFILE_KEY}</span>
                </div>
              </div>
            </div>

            {/* Month + settings */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 print:shadow-none">
              <div className="font-semibold text-neutral-800">Month</div>
              <div className="mt-3">
                <label className="block text-sm">
                  <div className="text-neutral-600">Active month</div>
                  <input
                    type="month"
                    className={inputBase}
                    value={state.ui.activeMonth}
                    onChange={(e) => setState((s) => saveState({ ...s, ui: { ...s.ui, activeMonth: e.target.value } }))}
                  />
                </label>
                <div className="mt-2 text-sm text-neutral-600">{monthLabel(state.ui.activeMonth)}</div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-neutral-600">Total Overtime</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{fmtHours(totals.totalOvertime)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-200 space-y-1">
                  {Object.entries(totals.byRate).map(([label, mins]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{label}</span>
                      <span className="font-medium text-neutral-900">{fmtHours(mins)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <button className={isMonthLocked ? btnSecondary : btnDanger} onClick={toggleLockMonth}>
                    {isMonthLocked ? "Unlock month" : "Lock month"}
                  </button>
                  <div className="text-xs text-neutral-500">Prevents edits for this month.</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-900">Filter mode</div>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.ui.useRange}
                      onChange={(e) => setState((s) => saveState({ ...s, ui: { ...s.ui, useRange: e.target.checked } }))}
                    />
                    <span className="text-neutral-700">Custom range</span>
                  </label>
                </div>

                {state.ui.useRange ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      <div className="text-neutral-600">From</div>
                      <input
                        type="date"
                        className={inputBase}
                        value={state.ui.filterFrom}
                        onChange={(e) => setState((s) => saveState({ ...s, ui: { ...s.ui, filterFrom: e.target.value } }))}
                      />
                    </label>
                    <label className="text-sm">
                      <div className="text-neutral-600">To</div>
                      <input
                        type="date"
                        className={inputBase}
                        value={state.ui.filterTo}
                        onChange={(e) => setState((s) => saveState({ ...s, ui: { ...s.ui, filterTo: e.target.value } }))}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-neutral-600">Showing all entries in the active month.</div>
                )}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 lg:col-span-3 print:shadow-none">
            {/* Add / Edit entry */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-semibold text-neutral-800">{editingId ? "Edit entry" : "Add overtime entry"}</div>
                <div className="text-sm text-neutral-600">
                  Computed: <span className="font-semibold">{fmtHours(computedResult.totalMinutes)}</span>
                  {(!state.rulesByProfile?.[getProfile(date, state.holidays, profileOverride)]?.length) && <span className="text-red-600 ml-2">No rules for {getProfile(date, state.holidays, profileOverride)}!</span>}
                </div>
                {isMonthLocked ? <div className="text-xs text-red-700 mt-1">Month is locked — edits are disabled.</div> : null}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button className={btnSecondary} onClick={startNowSession} disabled={isMonthLocked}>
                  Add OT (Now)
                </button>
                <button className={btnSecondary} onClick={presetNormalDay} disabled={isMonthLocked}>
                  Preset: Normal day
                </button>
                <button className={btnSecondary} onClick={copyLastEntry} disabled={isMonthLocked}>
                  Copy last
                </button>
                {editingId ? (
                  <button className={btnSecondary} onClick={clearDraft}>
                    Cancel edit
                  </button>
                ) : null}
                <button className={btnSecondary} onClick={clearDraft} disabled={isMonthLocked}>
                  Clear
                </button>
                <button className={btnPrimary} onClick={addOrUpdateEntry} disabled={!canSaveEntry}>
                  {editingId ? "Save changes" : "Add entry"}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
              <label className="text-sm md:col-span-2">
                <div className="text-neutral-600">Date</div>
                <input type="date" className={inputBase} value={date} onChange={(e) => setDate(e.target.value)} disabled={isMonthLocked} onKeyDown={handleKeyDown} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Start</div>
                <input type="time" className={inputBase} value={start} onChange={(e) => setStart(e.target.value)} disabled={isMonthLocked} onKeyDown={handleKeyDown} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">End</div>
                <input type="time" className={inputBase} value={end} onChange={(e) => setEnd(e.target.value)} disabled={isMonthLocked} ref={endRef} onKeyDown={handleKeyDown} />
                <div className="flex gap-1 mt-1">
                  {[15, 30, 60].map(m => (
                    <button key={m} onClick={() => adjustEnd(m)} className="px-2 py-0.5 text-xs bg-neutral-100 hover:bg-[#D5FF00] hover:text-black rounded border-neutral-200 transition">+{m}m</button>
                  ))}
                </div>
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Break (mins)</div>
                <input
                  type="number"
                  min="0"
                  max={24 * 60}
                  className={inputBase}
                  value={breakMins}
                  onChange={(e) => setBreakMins(e.target.value)}
                  disabled={isMonthLocked}
                  onKeyDown={handleKeyDown}
                />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Profile</div>
                <select className={inputBase} value={profileOverride} onChange={e => setProfileOverride(e.target.value)} disabled={isMonthLocked}>
                  <option value="auto">Auto</option>
                  <option value="weekday">Weekday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sundayHoliday">Sun/Hol</option>
                </select>
              </label>
            </div>

            <label className="block text-sm mt-2">
              <div className="text-neutral-600">Note</div>
              <input
                className={inputBase}
                placeholder="e.g., reception cover, late run, VIP duty"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isMonthLocked}
                onKeyDown={handleKeyDown}
              />
            </label>

            {/* Entries */}
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-800">Entries</div>
                  <div className="text-sm text-neutral-600">
                    Total: <span className="font-semibold">{fmtHours(totals.totalOvertime)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className={btnSecondary} onClick={openPreview}>
                    Preview
                  </button>
                </div>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600">
                    <tr className="border-b">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Start</th>
                      <th className="py-2 pr-2">End</th>
                      <th className="py-2 pr-2">Break</th>
                      <th className="py-2 pr-2">Total</th>
                      <th className="py-2 pr-2">Note</th>
                      <th className="py-2 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-neutral-500">
                          No entries in this view.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((e) => {
                        const ym = String(e.date || "").slice(0, 7);
                        const locked = (state.lockedMonths || []).includes(ym);
                        const selected = editingId === e.id;
                        return (
                          <tr key={e.id} className={`border-b last:border-b-0 ${selected ? "bg-lime-50" : ""}`}>
                            <td className="py-2 pr-2 font-medium">{e.date}</td>
                            <td className="py-2 pr-2">{e.start || "-"}</td>
                            <td className="py-2 pr-2">{e.end || "-"}</td>
                            <td className="py-2 pr-2">{e.breakMins ? `${e.breakMins}m` : "-"}</td>
                            <td className="py-2 pr-2 font-semibold">
                              {fmtHours(e.totalMinutes ?? e.workMins ?? 0)}
                              {e.missingMinutes > 0 && (
                                <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 ml-2" title="Time not covered by rules">
                                  Missing ({getProfile(e.date, state.holidays, e.profileOverride)}): {e.missingMinutes}m
                                  <button onClick={() => setRulesOpen(true)} className="ml-1 underline hover:text-amber-900">Edit rules</button>
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-2">{e.note || ""}</td>
                            <td className="py-2 pr-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button className={btnSecondary} onClick={() => beginEdit(e)} disabled={locked} title={locked ? "Month locked" : ""}>
                                  Edit
                                </button>
                                <button className={btnSecondary} onClick={() => duplicateEntry(e)} disabled={locked} title={locked ? "Month locked" : ""}>
                                  Duplicate
                                </button>
                                <button className={btnDanger} onClick={() => deleteEntry(e.id)} disabled={locked} title={locked ? "Month locked" : ""}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3 text-sm text-neutral-600">
          <a className="underline hover:text-[#D5FF00]" href={HUB_URL} target="_blank" rel="noreferrer">
            Return to ToolStack hub
          </a>
          <div className="text-xs text-neutral-500">
            Storage key: <span className="font-mono">{KEY}</span>
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-800 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReportSheet({ profile, month, useRange, range, totals, entries, storageKey }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-neutral-900">Overtime Report</div>
          <div className="text-sm text-neutral-600">{profile.org || "ToolStack"}</div>
          <div className="mt-3 h-[2px] w-64 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
        </div>
        <div className="text-sm text-neutral-600">Generated: {new Date().toLocaleString()}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">Prepared by</div>
          <div className="text-lg font-semibold text-neutral-900 mt-1">{profile.user || "—"}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">View</div>
          <div className="text-sm text-neutral-900 mt-1">
            {useRange ? (
              <>
                {range.from} → {range.to}
              </>
            ) : (
              <>{monthLabel(month)}</>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">Overtime</div>
          <div className="text-lg font-semibold text-neutral-900 mt-1">{fmtHours(totals.totalOvertime)}</div>
          <div className="text-xs text-neutral-600">
            Days {totals.daysLogged}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="font-semibold text-neutral-900">Totals</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-neutral-600">Total Overtime</div>
            <div className="font-semibold text-neutral-900">{fmtHours(totals.totalOvertime)}</div>
          </div>
          {Object.entries(totals.byRate).map(([label, mins]) => (
            <div key={label}><div className="text-neutral-600">{label}</div><div className="font-semibold text-neutral-900">{fmtHours(mins)}</div></div>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Start</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">End</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Break</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Total</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-neutral-500">
                  No entries.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-neutral-200">
                  <td className="px-3 py-2 font-medium">{e.date}</td>
                  <td className="px-3 py-2">{e.start || "-"}</td>
                  <td className="px-3 py-2">{e.end || "-"}</td>
                  <td className="px-3 py-2">{e.breakMins ? `${e.breakMins}m` : "-"}</td>
                  <td className="px-3 py-2 font-semibold">{fmtHours(e.totalMinutes ?? e.workMins ?? 0)}</td>
                  <td className="px-3 py-2">{e.note || ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-neutral-600">Prepared by</div>
          <div className="mt-8 border-t pt-2">Signature</div>
        </div>
        <div>
          <div className="text-neutral-600">Approved by</div>
          <div className="mt-8 border-t pt-2">Signature</div>
        </div>
      </div>

      <div className="mt-6 text-xs text-neutral-500">
        Storage key: <span className="font-mono">{storageKey}</span>
      </div>
    </div>
  );
}
