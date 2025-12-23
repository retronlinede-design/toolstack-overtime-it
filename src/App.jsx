// Overtime-It (ToolStack) — module-ready MVP
// Paste into: src/App.jsx
// Set HUB_URL to your ToolStack Wix hub link.


import React, { useEffect, useMemo, useRef, useState } from "react";

const APP_ID = "overtimeit";
const APP_VERSION = "v1";

// Per-module storage namespace
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;

// Shared profile (used by all modules later)
const PROFILE_KEY = "toolstack.profile.v1";

// Put your real ToolStack hub URL here (Wix page)
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

function safeJSONParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Optional: legacy migration hook placeholder */
function migrateIfNeeded() {
  // Example:
  // const legacy = localStorage.getItem("overtime_entries");
  // if (legacy && !localStorage.getItem(KEY)) localStorage.setItem(KEY, legacy);
}

function loadState() {
  migrateIfNeeded();
  return (
    safeJSONParse(localStorage.getItem(KEY), null) || {
      meta: {
        appId: APP_ID,
        version: APP_VERSION,
        updatedAt: new Date().toISOString(),
      },
      entries: [],
    }
  );
}

function saveState(state) {
  const next = {
    ...state,
    meta: { ...state.meta, updatedAt: new Date().toISOString() },
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function loadProfile() {
  return (
    safeJSONParse(localStorage.getItem(PROFILE_KEY), null) || {
      org: "ToolStack",
      user: "",
      language: "EN",
      logo: "",
    }
  );
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  // Overnight support
  const diff = e >= s ? e - s : 24 * 60 - s + e;
  return Math.max(0, diff);
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeekISO(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(dateISO) {
  const s = new Date(startOfWeekISO(dateISO) + "T00:00:00");
  s.setDate(s.getDate() + 6);
  return s.toISOString().slice(0, 10);
}

export default function App() {
  const [profile, setProfile] = useState(loadProfile());
  const [state, setState] = useState(loadState());

  const [filterFrom, setFilterFrom] = useState(startOfWeekISO(isoToday()));
  const [filterTo, setFilterTo] = useState(endOfWeekISO(isoToday()));
  const [previewOpen, setPreviewOpen] = useState(false);

  const fileRef = useRef(null);

  // Draft entry fields
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

  const entriesSorted = useMemo(() => {
    return [...state.entries].sort((a, b) => {
      const ak = `${a.date} ${a.start || ""}`;
      const bk = `${b.date} ${b.start || ""}`;
      return bk.localeCompare(ak);
    });
  }, [state.entries]);

  const filtered = useMemo(() => {
    return entriesSorted.filter((e) => e.date >= filterFrom && e.date <= filterTo);
  }, [entriesSorted, filterFrom, filterTo]);

  const totals = useMemo(() => {
    const totalWork = filtered.reduce((sum, e) => sum + (e.workMins || 0), 0);
    const totalBreak = filtered.reduce((sum, e) => sum + (e.breakMins || 0), 0);
    return { totalWork, totalBreak };
  }, [filtered]);

  const computedWorkMins = useMemo(() => {
    const gross = minutesBetween(start, end);
    const b = Math.max(0, Number(breakMins) || 0);
    return Math.max(0, gross - b);
  }, [start, end, breakMins]);

  function addEntry() {
    const gross = minutesBetween(start, end);
    const b = Math.max(0, Number(breakMins) || 0);
    const work = Math.max(0, gross - b);

    const entry = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      date,
      start,
      end,
      breakMins: b,
      workMins: work,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => saveState({ ...prev, entries: [entry, ...prev.entries] }));

    // Reset some fields
    setStart("");
    setEnd("");
    setBreakMins(0);
    setNote("");
  }

  function deleteEntry(id) {
    setState((prev) => saveState({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
  }

  function exportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-overtimeit-${APP_VERSION}-${isoToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const incoming = parsed?.data;
        if (!incoming?.entries || !Array.isArray(incoming.entries)) throw new Error("Invalid import file");
        setProfile(parsed?.profile || profile);
        setState(saveState(incoming));
      } catch (e) {
        alert("Import failed: " + (e?.message || "unknown error"));
      }
    };
    reader.readAsText(file);
  }

  function printPreview() {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 50);
  }

  // Module manifest stub (future ToolStack shell will read this)
  const moduleManifest = useMemo(
    () => ({
      id: APP_ID,
      name: "Overtime-It",
      version: APP_VERSION,
      storageKeys: [KEY, PROFILE_KEY],
      exports: ["print", "json"],
    }),
    []
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">Overtime-It</div>
            <div className="text-sm text-neutral-600">
              Module-ready ({moduleManifest.id}.{moduleManifest.version}) • Offline-first • Export/Import + Print
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={printPreview}
            >
              Print / Save PDF
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={exportJSON}
            >
              Export
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={() => fileRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Shared Profile */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
            <div className="font-semibold">Profile (shared)</div>
            <div className="mt-3 space-y-2">
              <label className="block text-sm">
                <div className="text-neutral-600">Organization</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={profile.org}
                  onChange={(e) => setProfile({ ...profile, org: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">User</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={profile.user}
                  onChange={(e) => setProfile({ ...profile, user: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">Language</div>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white"
                  value={profile.language}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                >
                  <option value="EN">EN</option>
                  <option value="DE">DE</option>
                </select>
              </label>
              <div className="text-xs text-neutral-500 pt-2">
                Stored at <span className="font-mono">{PROFILE_KEY}</span>
              </div>
            </div>
          </div>

          {/* Add entry */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 lg:col-span-2">
            <div className="font-semibold">Add overtime entry</div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
              <label className="text-sm sm:col-span-2">
                <div className="text-neutral-600">Date</div>
                <input
                  type="date"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Start</div>
                <input
                  type="time"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">End</div>
                <input
                  type="time"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="text-neutral-600">Break (mins)</div>
                <input
                  type="number"
                  min="0"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={breakMins}
                  onChange={(e) => setBreakMins(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm mt-2">
              <div className="text-neutral-600">Note</div>
              <input
                className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                placeholder="e.g., Reception cover, late run, VIP duty"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-700">
                Computed: <span className="font-semibold">{fmtHours(computedWorkMins)}</span>
              </div>
              <button
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                onClick={addEntry}
                disabled={!date || !start || !end}
              >
                Add entry
              </button>
            </div>
          </div>
        </div>

        {/* Filters + totals */}
        <div className="mt-4 bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="font-semibold">Entries</div>

            <div className="flex flex-wrap gap-2">
              <label className="text-sm">
                <div className="text-neutral-600">From</div>
                <input
                  type="date"
                  className="mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <div className="text-neutral-600">To</div>
                <input
                  type="date"
                  className="mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                />
              </label>
              <div className="text-sm pt-5 text-neutral-700">
                Total: <span className="font-semibold">{fmtHours(totals.totalWork)}</span>{" "}
                <span className="text-neutral-500">(breaks {fmtHours(totals.totalBreak)})</span>
              </div>
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
                  <th className="py-2 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-neutral-500">
                      No entries in this range.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{e.date}</td>
                      <td className="py-2 pr-2">{e.start || "-"}</td>
                      <td className="py-2 pr-2">{e.end || "-"}</td>
                      <td className="py-2 pr-2">{e.breakMins ? `${e.breakMins}m` : "-"}</td>
                      <td className="py-2 pr-2 font-semibold">{fmtHours(e.workMins || 0)}</td>
                      <td className="py-2 pr-2">{e.note || ""}</td>
                      <td className="py-2 pr-2 text-right">
                        <button
                          className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50"
                          onClick={() => deleteEntry(e.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview modal */}
        {previewOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-semibold">Preview</div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50"
                    onClick={printPreview}
                  >
                    Print / Save PDF
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-auto max-h-[80vh]">
                <div className="text-xl font-bold">{profile.org || "ToolStack"}</div>
                <div className="text-sm text-neutral-600">Overtime Report</div>

                <div className="mt-2 text-sm">
                  <div>
                    <span className="text-neutral-600">User:</span> {profile.user || "-"}
                  </div>
                  <div>
                    <span className="text-neutral-600">Range:</span> {filterFrom} → {filterTo}
                  </div>
                  <div>
                    <span className="text-neutral-600">Generated:</span> {new Date().toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-neutral-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-left bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">End</th>
                        <th className="p-2">Break</th>
                        <th className="p-2">Work</th>
                        <th className="p-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-neutral-500">
                            No entries in this range.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((e) => (
                          <tr key={e.id} className="border-t">
                            <td className="p-2 font-medium">{e.date}</td>
                            <td className="p-2">{e.start || "-"}</td>
                            <td className="p-2">{e.end || "-"}</td>
                            <td className="p-2">{e.breakMins ? `${e.breakMins}m` : "-"}</td>
                            <td className="p-2 font-semibold">{fmtHours(e.workMins || 0)}</td>
                            <td className="p-2">{e.note || ""}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm">
                  <div className="font-semibold">Totals</div>
                  <div className="text-neutral-700">
                    Work: <span className="font-semibold">{fmtHours(totals.totalWork)}</span>{" "}
                    <span className="text-neutral-500">(Breaks {fmtHours(totals.totalBreak)})</span>
                  </div>
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
                  Storage key: <span className="font-mono">{KEY}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-neutral-600">
          <a className="underline hover:text-neutral-900" href={HUB_URL} target="_blank" rel="noreferrer">
            Return to ToolStack hub
          </a>
        </div>
      </div>
    </div>
  );
}
