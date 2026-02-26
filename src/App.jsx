import React, { useEffect, useMemo, useRef, useState } from "react";
import overtimeHeading from "./assets/overtimeit.png";

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

const fmtMoney = (n) => {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n || 0);
};

const startOfMonthISO = (ym) => `${ym}-01`;

const endOfMonthISO = (ym) => {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return isoToday();
  const d = new Date(Number(y), Number(m), 0);
  return d.toISOString().slice(0, 10);
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
    { name: "Preview", desc: "Opens the print-ready view." },
    { name: "Print / Save PDF", desc: "Prints only the preview sheet. Choose “Save as PDF” to create a file." },
    { name: "Export", desc: "Downloads a JSON backup file." },
    { name: "Import", desc: "Restores data from a JSON backup file." },
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
            <Section title="About Overtime-It">
              <p>Overtime-It is a local-first overtime and time tracking tool designed to help you log hours, calculate totals, and generate clean print-ready summaries. It runs entirely in your browser with no accounts, no cloud storage, and no automatic data sharing.</p>
            </Section>

            <Section title="How Overtime-It Works">
              <p>Overtime-It follows a simple workflow:</p>
              <ul className="space-y-1">
                <Bullet><b>1. Log Overtime Entries</b><br/>Add entries with date, hours, rate, and multiplier.</Bullet>
                <Bullet><b>2. Review Totals</b><br/>Overtime-It calculates payout based on your entries.</Bullet>
                <Bullet><b>3. Preview & Print</b><br/>Generate a print-ready overtime report using Preview.</Bullet>
                <Bullet><b>4. Export a Backup</b><br/>Export a JSON backup regularly.</Bullet>
              </ul>
            </Section>

            <Section title="Your Data & Privacy">
              <p>Your data is saved locally in this browser using secure local storage.</p>
              <p>This means:</p>
              <ul className="space-y-1">
                <Bullet>Your data stays on this device</Bullet>
                <Bullet>Clearing browser data can remove your logs</Bullet>
                <Bullet>Incognito/private mode will not retain data</Bullet>
                <Bullet>Data does not automatically sync across devices</Bullet>
              </ul>
            </Section>

            <Section title="Backup & Restore">
              <p><b>Export</b> downloads a JSON backup of your current Overtime-It data.</p>
              <p><b>Import</b> restores a previously exported JSON file and replaces current app data.</p>
              <p>Recommended routine:</p>
              <ul className="space-y-1">
                <Bullet>Export weekly</Bullet>
                <Bullet>Export after major edits</Bullet>
                <Bullet>Store backups in two locations (e.g., Downloads + Drive/USB)</Bullet>
              </ul>
            </Section>

            <Section title="Buttons Explained">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3">
                {[...baseActions, ...extra].map((a) => (
                  <ActionRow key={a.name} name={a.name} desc={a.desc} />
                ))}
              </div>
            </Section>

            <Section title="Storage Keys (Advanced)">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 font-mono space-y-1">
                <div>App data key: {storageKey}</div>
                <div>Shared profile key: {PROFILE_KEY}</div>
              </div>
            </Section>

            <Section title="Notes / Limitations">
              <ul className="space-y-1">
                <Bullet>Overtime-It is a tracking tool. Totals depend on the accuracy of the entries you provide.</Bullet>
                <Bullet>Use Export regularly to avoid data loss.</Bullet>
              </ul>
            </Section>

            <Section title="Support / Feedback">
              <p>If something breaks, include: device + browser + steps to reproduce + expected vs actual behaviour.</p>
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

  const cleanEntries = entries
    .filter(Boolean)
    .map((e) => {
      // Migration: convert totalMinutes to hours if hours is missing
      let hours = toNumber(e.hours);
      if (!hours && e.totalMinutes) {
        hours = e.totalMinutes / 60;
      }
      return {
        id: e.id || uid("ot"),
        date: e.date || isoToday(),
        hours: hours || 0,
        rate: toNumber(e.rate) || 0,
        multiplier: toNumber(e.multiplier) || 1.0,
        note: typeof e.note === "string" ? e.note : "",
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || null,
      };
    });

  if (!ui.activeMonth) ui.activeMonth = monthKey();
  if (!ui.filterFrom) ui.filterFrom = startOfMonthISO(ui.activeMonth);
  if (!ui.filterTo) ui.filterTo = endOfMonthISO(ui.activeMonth);

  return {
    ...base,
    ...s,
    settings,
    rulesByProfile: undefined, // Removed
    holidays: undefined, // Removed
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

function ReportModal({ open, onClose, entries, profile }) {
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
    let totalHours = 0;
    let totalPayout = 0;
    filtered.forEach((e) => {
      totalHours += e.hours || 0;
      totalPayout += (e.hours || 0) * (e.rate || 0) * (e.multiplier || 1);
    });
    return { totalHours, totalPayout };
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
                  <div className="text-xl font-bold text-neutral-900">{totals.totalHours.toFixed(2)}h</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Total Payout</div>
                  <div className="text-xl font-bold text-neutral-900">{fmtMoney(totals.totalPayout)}</div>
                </div>
              </div>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-neutral-500 border-b border-neutral-200">
                <tr><th className="py-2">Date</th><th className="py-2">Hours</th><th className="py-2">Rate</th><th className="py-2">Mult</th><th className="py-2">Payout</th><th className="py-2">Note</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-neutral-500">No entries in range</td></tr>}
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 font-medium">{e.date}</td>
                    <td className="py-2">{e.hours}</td>
                    <td className="py-2">{e.rate}</td>
                    <td className="py-2">x{e.multiplier}</td>
                    <td className="py-2 font-semibold">{fmtMoney(e.hours * e.rate * e.multiplier)}</td>
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
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [multiplier, setMultiplier] = useState(1.0);
  const [note, setNote] = useState("");

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
    let totalHours = 0;
    let totalPayout = 0;
    const daySet = new Set(filtered.map((e) => e.date));

    filtered.forEach((e) => {
      totalHours += e.hours || 0;
      totalPayout += (e.hours || 0) * (e.rate || 0) * (e.multiplier || 1);
    });

    return { totalHours, totalPayout, daysLogged: daySet.size };
  }, [filtered]);

  const canSaveEntry = Boolean(date && hours && rate) && !isMonthLocked;

  const clearDraft = () => {
    setEditingId(null);
    setHours("");
    // Keep rate/multiplier for convenience
    setNote("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") addOrUpdateEntry();
  };

  const copyLastEntry = () => {
    const ym = state.ui.activeMonth;
    const last = entriesSorted.find((e) => String(e.date || "").slice(0, 7) === ym) || entriesSorted[0];
    if (!last) return notify("No entry to copy");
    setHours(last.hours || "");
    setRate(last.rate || "");
    setMultiplier(last.multiplier || 1.0);
    setNote(last.note || "");
    notify("Copied last entry fields");
  };

  const addOrUpdateEntry = () => {
    if (!date || !hours || !rate) return;
    
    if (editingId) {
      setState((prev) =>
        saveState({
          ...prev,
          entries: (prev.entries || []).map((e) =>
            e.id === editingId
              ? {
                  ...e,
                  date,
                  hours: toNumber(hours),
                  rate: toNumber(rate),
                  multiplier: toNumber(multiplier),
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
      hours: toNumber(hours),
      rate: toNumber(rate),
      multiplier: toNumber(multiplier),
      note: String(note || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    setState((prev) => saveState({ ...prev, entries: [entry, ...(prev.entries || [])] }));
    notify("Entry added");
    setHours("");
    setNote("");
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
    setHours(entry.hours || "");
    setRate(entry.rate || "");
    setMultiplier(entry.multiplier || 1.0);
    setNote(entry.note || "");
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
    const header = ["date", "hours", "rate", "multiplier", "payout", "note"];

    const esc = (v) => {
      const s = String(v ?? "");
      return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = filtered.map((e) => {
      const p = (e.hours || 0) * (e.rate || 0) * (e.multiplier || 1);
      return [
      e.date,
      e.hours,
      e.rate,
      e.multiplier,
      p.toFixed(2),
      e.note || "",
    ]});

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
      ["Category", "Value"],
      ["Total Hours", totals.totalHours.toFixed(2)],
      ["Total Payout", totals.totalPayout.toFixed(2)],
    ];
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
    lines.push(`Total Hours: ${totals.totalHours.toFixed(2)}h`);
    lines.push(`Total Payout: ${fmtMoney(totals.totalPayout)}`);
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
      
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} entries={entriesSorted} profile={profile} />

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
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <img
              src={overtimeHeading}
              alt="Overtime-It"
              className="h-36 sm:h-48 lg:h-56 w-auto object-contain mix-blend-multiply"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-lime-200 bg-lime-50 text-neutral-800">
                {totals.totalHours.toFixed(2)}h overtime
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 bg-white text-neutral-800">
                {totals.daysLogged} days
              </span>
            </div>
          </div>

          {/* Top actions + pinned help icon */}
          <div className="w-full md:w-auto flex gap-2 self-start">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto">
              <ActionButton onClick={() => setReportOpen(true)}>Range Report</ActionButton>
              <ActionButton onClick={openPreview} tone="default">Preview</ActionButton>
              <ActionButton onClick={() => setExportMenuOpen(true)}>Export</ActionButton>
            </div>
            <HelpIconButton onClick={() => setHelpOpen(true)} />
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                    <div className="text-sm text-neutral-600">Total Payout</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{fmtMoney(totals.totalPayout)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-200 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-neutral-600">Hours</span><span className="font-medium text-neutral-900">{totals.totalHours.toFixed(2)}h</span></div>
                  <div className="flex justify-between text-sm"><span className="text-neutral-600">Days</span><span className="font-medium text-neutral-900">{totals.daysLogged}</span></div>
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
                <div className="text-sm text-neutral-600 mt-1">
                  Payout: {hours || 0} × {rate || 0} × {multiplier} = <span className="font-semibold text-neutral-900">{fmtMoney((hours || 0) * (rate || 0) * multiplier)}</span>
                </div>
                {isMonthLocked ? <div className="text-xs text-red-700 mt-1">Month is locked — edits are disabled.</div> : null}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
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
                <div className="text-neutral-600">Hours</div>
                <input type="number" step="0.25" className={inputBase} value={hours} onChange={(e) => setHours(e.target.value)} disabled={isMonthLocked} onKeyDown={handleKeyDown} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Rate</div>
                <input type="number" step="0.5" className={inputBase} value={rate} onChange={(e) => setRate(e.target.value)} disabled={isMonthLocked} onKeyDown={handleKeyDown} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Multiplier</div>
                <select className={inputBase} value={multiplier} onChange={e => setMultiplier(e.target.value)} disabled={isMonthLocked}>
                  <option value="1">1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2.0x</option>
                </select>
              </label>
              <div className="hidden md:block"></div>
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
                    Total: <span className="font-semibold">{fmtMoney(totals.totalPayout)}</span>
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
                      <th className="py-2 pr-2">Hours</th>
                      <th className="py-2 pr-2">Rate</th>
                      <th className="py-2 pr-2">Mult</th>
                      <th className="py-2 pr-2">Payout</th>
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
                            <td className="py-2 pr-2">{e.hours}</td>
                            <td className="py-2 pr-2">{e.rate}</td>
                            <td className="py-2 pr-2">x{e.multiplier}</td>
                            <td className="py-2 pr-2 font-semibold">{fmtMoney(e.hours * e.rate * e.multiplier)}</td>
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
          <div className="text-lg font-semibold text-neutral-900 mt-1">{totals.totalHours.toFixed(2)}h</div>
          <div className="text-xs text-neutral-600">
            Days {totals.daysLogged}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="font-semibold text-neutral-900">Totals</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-neutral-600">Total Payout</div>
            <div className="font-semibold text-neutral-900">{fmtMoney(totals.totalPayout)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Hours</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Rate</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Payout</th>
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
                  <td className="px-3 py-2">{e.hours}</td>
                  <td className="px-3 py-2">{e.rate} (x{e.multiplier})</td>
                  <td className="px-3 py-2 font-semibold">{fmtMoney(e.hours * e.rate * e.multiplier)}</td>
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
