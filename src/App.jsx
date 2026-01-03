import React, { useEffect, useMemo, useRef, useState } from "react";

// ToolStack — Overtime-It — Upgraded MVP (Styled v1: light neutral + lime accent)
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

// --- UI tokens (Styled v1) ---
const btnSecondary =
  "px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary =
  "px-3 py-2 rounded-xl bg-neutral-900 text-white border border-neutral-900 shadow-sm hover:bg-neutral-800 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
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
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : tone === "danger"
      ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
      : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${ACTION_BASE} ${cls}`}>
      {children}
    </button>
  );
}

function ActionFileButton({ children, onFile, accept = "application/json", tone = "primary", title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

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
        "hover:bg-neutral-50 active:translate-y-[1px] transition flex items-center justify-center " +
        "focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300 " +
        className
      }
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4" />
        <path d="M12 17h.01" />
        <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
      </svg>
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-neutral-500">ToolStack • Help Pack v1</div>
              <h2 className="text-lg font-semibold text-neutral-900">{appName} — how your data works</h2>
              <div className="mt-3 h-[2px] w-56 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
            </div>

            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-5 max-h-[70vh] overflow-auto">
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

          <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2">
            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- storage ---
function migrateIfNeeded() {
  // Placeholder for future migrations.
  // Example:
  // const legacy = localStorage.getItem("toolstack_overtime_it_v0");
  // if (legacy && !localStorage.getItem(KEY)) localStorage.setItem(KEY, legacy);
}

function loadProfile() {
  return (
    safeParse(typeof window !== "undefined" ? localStorage.getItem(PROFILE_KEY) : null, null) || {
      org: "ToolStack",
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

  // legacy support: { entries: [] }
  const entries = Array.isArray(s.entries) ? s.entries : [];

  const ui = { ...base.ui, ...(s.ui || {}) };
  const settings = { ...base.settings, ...(s.settings || {}) };
  const lockedMonths = Array.isArray(s.lockedMonths) ? s.lockedMonths.filter(Boolean) : [];

  // sanitize entries
  const cleanEntries = entries
    .filter(Boolean)
    .map((e) => ({
      id: e.id || uid("ot"),
      date: e.date || isoToday(),
      start: e.start || "",
      end: e.end || "",
      breakMins: clamp(toNumber(e.breakMins), 0, 24 * 60),
      workMins: clamp(toNumber(e.workMins), 0, 24 * 60),
      note: typeof e.note === "string" ? e.note : "",
      createdAt: e.createdAt || new Date().toISOString(),
      updatedAt: e.updatedAt || null,
    }));

  // keep UI dates coherent with month
  if (!ui.activeMonth) ui.activeMonth = monthKey();
  if (!ui.filterFrom) ui.filterFrom = startOfMonthISO(ui.activeMonth);
  if (!ui.filterTo) ui.filterTo = endOfMonthISO(ui.activeMonth);

  return {
    ...base,
    ...s,
    settings,
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

export default function App() {
  const [profile, setProfile] = useState(loadProfile());
  const [state, setState] = useState(loadState());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
    // also align range defaults
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
    const totalWork = filtered.reduce((sum, e) => sum + (e.workMins || 0), 0);
    const totalBreak = filtered.reduce((sum, e) => sum + (e.breakMins || 0), 0);
    const daySet = new Set(filtered.map((e) => e.date));
    const daysLogged = daySet.size;

    const standardDayMins = clamp(toNumber(state.settings.standardDayMins), 0, 24 * 60);
    const expected = daysLogged * standardDayMins;
    const balance = totalWork - expected;
    const overtime = Math.max(0, balance);

    return { totalWork, totalBreak, daysLogged, expected, balance, overtime };
  }, [filtered, state.settings.standardDayMins]);

  const computedWorkMins = useMemo(() => {
    const gross = minutesBetween(start, end);
    const b = clamp(toNumber(breakMins), 0, 24 * 60);
    const raw = Math.max(0, gross - b);
    return Math.max(0, roundToStep(raw, state.settings.roundingStep));
  }, [start, end, breakMins, state.settings.roundingStep]);

  const canSaveEntry = Boolean(date && start && end) && !isMonthLocked;

  const clearDraft = () => {
    setEditingId(null);
    setStart("");
    setEnd("");
    setBreakMins(0);
    setNote("");
    // keep date as-is
  };

  const presetNormalDay = () => {
    setStart("08:00");
    setEnd("17:00");
    setBreakMins(60);
    setNote("");
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
    // keep date (usually today)
    notify("Copied last entry fields");
  };

  const addOrUpdateEntry = () => {
    if (!date || !start || !end) return;

    const gross = minutesBetween(start, end);
    const b = clamp(toNumber(breakMins), 0, 24 * 60);
    const rawWork = Math.max(0, gross - b);
    const work = Math.max(0, roundToStep(rawWork, state.settings.roundingStep));

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
                  breakMins: b,
                  workMins: work,
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
      breakMins: b,
      workMins: work,
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
    const header = ["date", "start", "end", "breakMins", "workMins", "workHours", "note"];

    const esc = (v) => {
      const s = String(v ?? "");
      return /[\",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = filtered.map((e) => [
      e.date,
      e.start,
      e.end,
      e.breakMins ?? 0,
      e.workMins ?? 0,
      (toNumber(e.workMins) / 60).toFixed(2),
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

  const openPreview = () => setPreviewOpen(true);

  // IMPORTANT FIX: top bar "Print / Save PDF" prints ONLY the preview sheet
  const printFromTop = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  const moduleManifest = useMemo(
    () => ({
      id: APP_ID,
      name: "Overtime-It",
      version: APP_VERSION,
      storageKeys: [KEY, PROFILE_KEY],
      exports: ["print", "json", "csv"],
    }),
    []
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>

      {previewOpen ? (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #ot-print-preview, #ot-print-preview * { visibility: visible !important; }
            #ot-print-preview { position: absolute !important; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      ) : null}

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="Overtime-It"
        storageKey={KEY}
        actions={["Export CSV"]}
      />

      {/* Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />

          <div className="relative w-full max-w-5xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-lg font-semibold text-white">Print preview</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/20 text-white transition"
                  onClick={() => window.print()}
                >
                  Print / Save PDF
                </button>
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/20 text-white transition"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-lg overflow-auto max-h-[80vh]">
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
            <div className="text-2xl font-semibold tracking-tight">Overtime-It</div>
            <div className="text-sm text-neutral-600">
              Module-ready ({moduleManifest.id}.{moduleManifest.version}) • Offline-first • Export/Import + Print
            </div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>

          {/* Top actions + pinned help icon */}
          <div className="w-full sm:w-[860px] relative">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 pr-12">
              <ActionButton onClick={openPreview}>Preview</ActionButton>
              <ActionButton onClick={printFromTop}>Print / Save PDF</ActionButton>
              <ActionButton onClick={exportCSV}>Export CSV</ActionButton>
              <ActionButton onClick={exportJSON}>Export</ActionButton>
              <ActionFileButton onFile={(f) => importJSON(f)} tone="primary">
                Import
              </ActionFileButton>
            </div>

            <div className="absolute right-0 top-0">
              <HelpIconButton onClick={() => setHelpOpen(true)} />
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Profile */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 print:shadow-none">
              <div className="font-semibold">Profile (shared)</div>
              <div className="mt-3 space-y-2">
                <label className="block text-sm">
                  <div className="text-neutral-600">Organization</div>
                  <input className={inputBase} value={profile.org} onChange={(e) => setProfile({ ...profile, org: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <div className="text-neutral-600">User</div>
                  <input className={inputBase} value={profile.user} onChange={(e) => setProfile({ ...profile, user: e.target.value })} />
                </label>
                <label className="block text-sm">
                  <div className="text-neutral-600">Language</div>
                  <select className={inputBase} value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
                    <option value="EN">EN</option>
                    <option value="DE">DE</option>
                  </select>
                </label>
                <div className="pt-2 text-xs text-neutral-500">
                  Stored at <span className="font-mono">{PROFILE_KEY}</span>
                </div>
              </div>
            </div>

            {/* Month + settings */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 print:shadow-none">
              <div className="font-semibold">Month</div>
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
                    <div className="text-sm text-neutral-600">Days logged</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{totals.daysLogged}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-neutral-600">Total work</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{fmtHours(totals.totalWork)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <div className="text-sm text-neutral-600">Overtime (vs expected)</div>
                  <div className="text-lg font-semibold text-neutral-900">{fmtHours(totals.overtime)}</div>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  Expected: <span className="font-medium text-neutral-900">{fmtHours(totals.expected)}</span> · Balance:{" "}
                  <span className="font-medium text-neutral-900">{fmtHours(Math.abs(totals.balance))}</span>{" "}
                  {totals.balance >= 0 ? "over" : "under"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <label className="block text-sm">
                  <div className="text-neutral-600">Standard day (minutes)</div>
                  <input
                    type="number"
                    min="0"
                    max={24 * 60}
                    className={inputBase}
                    value={state.settings.standardDayMins}
                    onChange={(e) =>
                      setState((s) =>
                        saveState({
                          ...s,
                          settings: { ...s.settings, standardDayMins: clamp(toNumber(e.target.value), 0, 24 * 60) },
                        })
                      )
                    }
                  />
                  <div className="text-xs text-neutral-500 mt-1">Default 480 = 8 hours.</div>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600">Rounding</div>
                  <select
                    className={inputBase}
                    value={String(state.settings.roundingStep || 0)}
                    onChange={(e) =>
                      setState((s) =>
                        saveState({
                          ...s,
                          settings: { ...s.settings, roundingStep: toNumber(e.target.value) },
                        })
                      )
                    }
                  >
                    <option value="0">Exact minutes</option>
                    <option value="5">Nearest 5 minutes</option>
                    <option value="15">Nearest 15 minutes</option>
                  </select>
                </label>

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
                <div className="font-semibold">{editingId ? "Edit entry" : "Add overtime entry"}</div>
                <div className="text-sm text-neutral-600">
                  Computed work: <span className="font-semibold">{fmtHours(computedWorkMins)}</span>
                  {state.settings.roundingStep ? <span className="text-neutral-500"> · rounded to {state.settings.roundingStep}m</span> : null}
                </div>
                {isMonthLocked ? <div className="text-xs text-red-700 mt-1">Month is locked — edits are disabled.</div> : null}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
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
                <button className={btnPrimary} onClick={addOrUpdateEntry} disabled={!canSaveEntry}>
                  {editingId ? "Save changes" : "Add entry"}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
              <label className="text-sm md:col-span-2">
                <div className="text-neutral-600">Date</div>
                <input type="date" className={inputBase} value={date} onChange={(e) => setDate(e.target.value)} disabled={isMonthLocked} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Start</div>
                <input type="time" className={inputBase} value={start} onChange={(e) => setStart(e.target.value)} disabled={isMonthLocked} />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">End</div>
                <input type="time" className={inputBase} value={end} onChange={(e) => setEnd(e.target.value)} disabled={isMonthLocked} />
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
                />
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
              />
            </label>

            {/* Entries */}
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold">Entries</div>
                  <div className="text-sm text-neutral-600">
                    Total work: <span className="font-semibold">{fmtHours(totals.totalWork)}</span>{" "}
                    <span className="text-neutral-500">(breaks {fmtHours(totals.totalBreak)})</span>
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
                      <th className="py-2 pr-2">Work</th>
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
                            <td className="py-2 pr-2 font-semibold">{fmtHours(e.workMins || 0)}</td>
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
          <a className="underline hover:text-neutral-900" href={HUB_URL} target="_blank" rel="noreferrer">
            Return to ToolStack hub
          </a>
          <div className="text-xs text-neutral-500">
            Storage key: <span className="font-mono">{KEY}</span>
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-900 text-white px-4 py-3 shadow-lg print:hidden">
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
          <div className="text-lg font-semibold text-neutral-900 mt-1">{fmtHours(totals.overtime)}</div>
          <div className="text-xs text-neutral-600">
            Total work {fmtHours(totals.totalWork)} · Days {totals.daysLogged}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="font-semibold text-neutral-900">Totals</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-neutral-600">Work</div>
            <div className="font-semibold text-neutral-900">{fmtHours(totals.totalWork)}</div>
          </div>
          <div>
            <div className="text-neutral-600">Breaks</div>
            <div className="font-semibold text-neutral-900">{fmtHours(totals.totalBreak)}</div>
          </div>
          <div>
            <div className="text-neutral-600">Expected</div>
            <div className="font-semibold text-neutral-900">{fmtHours(totals.expected)}</div>
          </div>
          <div>
            <div className="text-neutral-600">Balance</div>
            <div className="font-semibold text-neutral-900">
              {fmtHours(Math.abs(totals.balance))} {totals.balance >= 0 ? "over" : "under"}
            </div>
          </div>
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">Work</th>
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
                  <td className="px-3 py-2 font-semibold">{fmtHours(e.workMins || 0)}</td>
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
