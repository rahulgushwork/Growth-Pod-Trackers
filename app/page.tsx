"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── Types ─── */

type EmailRow = {
  date: string;
  emails_sent: number;
  target_emails_sent: number | null;
  attainment: number | null;
  bounce_rate: number;
  inboxes_at_capacity: number;
  domains_at_capacity: number;
  domains_above_reputation: number;
  emails_2plus_opens: number;
  open_2plus_rate: number;
  unique_2plus_no_call: number;
  calls_burner: number | null;
  demos_burner: number | null;
  demo_call_rate_burner: number | null;
  calls_non_burner: number | null;
  demos_non_burner: number | null;
  demo_call_rate_non_burner: number | null;
  lift_from_burner: number | null;
  if_no_burner: number | null;
  difference: number | null;
  cost_lift: number | null;
};

type CallRow = {
  date: string;
  total_calls: number;
  calls_mtd: number;
  target: number;
  attainment: number;
  sales_dialer_calls: number;
  justcall_calls: number;
};

/* ─── Helpers ─── */

function fmt(val: number | null | undefined, suffix = ""): string {
  if (val === null || val === undefined) return "\u2014";
  return val.toLocaleString() + suffix;
}

type ColDef<T> = { key: keyof T; short: string; full: string; suffix?: string; manual?: boolean };

/* ─── Column definitions ─── */

const EMAIL_COLS: ColDef<EmailRow>[] = [
  { key: "date",                     short: "Date",               full: "Date" },
  { key: "emails_sent",              short: "Emails Sent",        full: "# of Emails Sent" },
  { key: "target_emails_sent",       short: "Target Sent",        full: "Target Emails Sent" },
  { key: "attainment",               short: "Attainment",         full: "Attainment", suffix: "%" },
  { key: "bounce_rate",              short: "Bounce %",           full: "Bounce Rate", suffix: "%" },
  { key: "inboxes_at_capacity",      short: "Inboxes @ Cap",      full: "# of Inboxes Used to Capacity" },
  { key: "domains_at_capacity",      short: "Domains @ Cap",      full: "# of Domains Used to Capacity" },
  { key: "domains_above_reputation", short: "Domains Good Rep",   full: "# of Domains above Acceptable Reputation Score" },
  { key: "emails_2plus_opens",       short: "Emails >2 Opens",    full: "# of Emails with >2 Opens" },
  { key: "open_2plus_rate",          short: ">2 Open Rate",       full: "2+ Open to Email Sent Rate", suffix: "%" },
  { key: "unique_2plus_no_call",     short: ">2 Opens No Call",   full: "# of Unique Contacts >2 Opens, No Call" },
  { key: "calls_burner",             short: "Calls (Burner)",     full: "# of Calls to Burner Email Opens [Incl. Manual Dials]" },
  { key: "demos_burner",             short: "Demos (Burner)",     full: "# of Demos Booked from Burner Emails" },
  { key: "demo_call_rate_burner",    short: "Demo:Call Burner",   full: "Demo to Call Rate - Burner Email", suffix: "%" },
  { key: "calls_non_burner",         short: "Calls (Non-Burner)", full: "# of Calls Made to Non-Burner Email Opens" },
  { key: "demos_non_burner",         short: "Demos (Non-Burner)", full: "# of Demos Booked from Non-Burner Email Opens" },
  { key: "demo_call_rate_non_burner",short: "Demo:Call Non-Burner",full:"Demo to Call Rate - Non Burner Email", suffix: "%" },
  { key: "lift_from_burner",         short: "Burner Lift",        full: "Lift from Burner Email (Rate Difference)", suffix: "%" },
  { key: "if_no_burner",             short: "If No Burner",       full: "If Burner Email Was Not There (Hypothetical Demos)" },
  { key: "difference",               short: "Difference",         full: "Difference (Actual Burner Demos - Hypothetical)" },
  { key: "cost_lift",                short: "Cost Lift",          full: "Cost Lift (Incremental Demos as % of Total)", suffix: "%" },
];

const CALL_COLS: ColDef<CallRow>[] = [
  { key: "date",               short: "Date",              full: "Date" },
  { key: "total_calls",        short: "# of Calls",        full: "# of Calls" },
  { key: "calls_mtd",          short: "# Calls MTD",       full: "# of Calls MTD" },
  { key: "target",             short: "Month Target",       full: "# of Calls Month - Target" },
  { key: "attainment",         short: "Attainment %",       full: "# of Calls Attainment (%)", suffix: "%" },
  { key: "sales_dialer_calls", short: "SalesDialer",        full: "# SalesDialer Calls" },
  { key: "justcall_calls",     short: "JustCall",           full: "# JustCall Calls" },
];

/* ─── Component ─── */

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [tab, setTab] = useState<"email" | "calls">("email");

  const [from, setFrom]             = useState("2026-01-05");
  const [to, setTo]                 = useState(today);
  const [emailRows, setEmailRows]   = useState<EmailRow[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [callRows, setCallRows]     = useState<CallRow[]>([]);
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError]   = useState<string | null>(null);

  const fetchEmail = useCallback(async () => {
    setEmailLoading(true);
    setEmailError(null);
    try {
      const res = await fetch(`/api/metrics?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setEmailRows(json.rows);
    } catch (e: unknown) {
      setEmailError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setEmailLoading(false);
    }
  }, [from, to]);

  const fetchCalls = useCallback(async () => {
    setCallLoading(true);
    setCallError(null);
    try {
      const res = await fetch("/api/calls");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCallRows(json.rows);
    } catch (e: unknown) {
      setCallError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCallLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmail(); }, [fetchEmail]);
  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  function renderAttainment(val: number | null) {
    if (val === null) return <span className="text-slate-500">{"\u2014"}</span>;
    const color = val >= 100 ? "text-emerald-400" : val >= 80 ? "text-amber-400" : "text-rose-400";
    return <span className={`font-semibold ${color}`}>{val.toFixed(1)}%</span>;
  }

  function renderEmailCell(row: EmailRow, col: ColDef<EmailRow>) {
    const val = row[col.key];
    if (col.key === "date") return <span className="font-mono text-[11px] text-blue-200">{String(val)}</span>;
    if (col.key === "attainment") return renderAttainment(val as number | null);
    if (val === null || val === undefined) return <span className="text-slate-600">{"\u2014"}</span>;
    return <span>{fmt(val as number, col.suffix || "")}</span>;
  }

  function renderCallCell(row: CallRow, col: ColDef<CallRow>) {
    const val = row[col.key];
    if (col.key === "date") return <span className="font-mono text-[11px] text-blue-200">{String(val)}</span>;
    if (col.key === "attainment") return renderAttainment(val as number);
    return <span>{fmt(val as number, col.suffix || "")}</span>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Top bar */}
      <div className="border-b border-blue-900/40 bg-slate-950/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.prod.website-files.com/65c292289fb0ea1ff3a84bd3/697c6f8360e1d60efdeb23f1_gushwork-white-logo.webp"
              alt="Gushwork"
              className="h-7"
            />
            <div className="w-px h-6 bg-blue-800/50" />
            <span className="text-sm font-medium text-slate-300 tracking-tight">GTM Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/50 border border-blue-900/30 rounded-xl p-1 w-fit mb-6 shadow-lg shadow-blue-950/20">
          <button onClick={() => setTab("email")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === "email"
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}>
            Burner Email
          </button>
          <button onClick={() => setTab("calls")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === "calls"
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}>
            Cold Calling
          </button>
        </div>

        {/* ─── Burner Email Tab ─── */}
        {tab === "email" && (
          <>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-800/40 border border-blue-900/20 rounded-lg px-3 py-1.5">
                <label className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="bg-transparent border-none text-xs text-blue-100 outline-none" />
              </div>
              <div className="flex items-center gap-2 bg-slate-800/40 border border-blue-900/20 rounded-lg px-3 py-1.5">
                <label className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="bg-transparent border-none text-xs text-blue-100 outline-none" />
              </div>
              <button onClick={fetchEmail}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md shadow-blue-600/20 hover:shadow-blue-500/30">
                Refresh
              </button>
              {emailLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-blue-300">Loading...</span>
                </div>
              )}
            </div>

            {emailError && (
              <div className="bg-rose-950/40 border border-rose-800/50 text-rose-200 rounded-xl p-4 mb-5 text-xs backdrop-blur-sm">{emailError}</div>
            )}

            <div className="overflow-x-auto rounded-xl border border-blue-900/30 shadow-xl shadow-blue-950/30 bg-slate-900/30 backdrop-blur-sm">
              <table className="text-xs border-collapse w-max">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-900 to-blue-950/80">
                    {EMAIL_COLS.map(col => (
                      <th key={col.key} title={col.full}
                        className={`px-3 py-3 text-left font-semibold border-b border-blue-900/40 whitespace-nowrap ${
                          col.manual ? "text-slate-500" : "text-blue-200"
                        }`}>
                        {col.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emailRows.length === 0 && !emailLoading && (
                    <tr><td colSpan={EMAIL_COLS.length} className="text-center text-slate-500 py-16">No data for selected range.</td></tr>
                  )}
                  {emailRows.map((row, i) => (
                    <tr key={row.date}
                      className={`border-b border-blue-900/15 hover:bg-blue-900/15 transition-all duration-150 ${
                        i % 2 === 0 ? "bg-slate-900/20" : "bg-blue-950/10"
                      }`}>
                      {EMAIL_COLS.map(col => (
                        <td key={col.key}
                          className={`px-3 py-2.5 whitespace-nowrap tabular-nums ${
                            col.manual ? "text-slate-600" : "text-slate-200"
                          }`}>
                          {renderEmailCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-600 mt-3">
              Hover column headers for full names. Capacity &amp; reputation are current snapshots. {"\u2014"} = manual/external data source.
            </p>
          </>
        )}

        {/* ─── Cold Calling Tab ─── */}
        {tab === "calls" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2 bg-slate-800/40 border border-blue-900/20 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Current Month to Date</span>
              </div>
              <button onClick={fetchCalls}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md shadow-blue-600/20 hover:shadow-blue-500/30">
                Refresh
              </button>
              {callLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-blue-300">Loading...</span>
                </div>
              )}
            </div>

            {callError && (
              <div className="bg-rose-950/40 border border-rose-800/50 text-rose-200 rounded-xl p-4 mb-5 text-xs backdrop-blur-sm">{callError}</div>
            )}

            <div className="overflow-x-auto rounded-xl border border-blue-900/30 shadow-xl shadow-blue-950/30 bg-slate-900/30 backdrop-blur-sm">
              <table className="text-xs border-collapse w-max">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-900 to-blue-950/80">
                    {CALL_COLS.map(col => (
                      <th key={col.key} title={col.full}
                        className="px-3 py-3 text-left font-semibold border-b border-blue-900/40 whitespace-nowrap text-blue-200">
                        {col.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {callRows.length === 0 && !callLoading && (
                    <tr><td colSpan={CALL_COLS.length} className="text-center text-slate-500 py-16">No data.</td></tr>
                  )}
                  {callRows.map((row, i) => (
                    <tr key={row.date}
                      className={`border-b border-blue-900/15 hover:bg-blue-900/15 transition-all duration-150 ${
                        i % 2 === 0 ? "bg-slate-900/20" : "bg-blue-950/10"
                      }`}>
                      {CALL_COLS.map(col => (
                        <td key={col.key} className="px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-200">
                          {renderCallCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-600 mt-3">
              Data from gist.justcall_daily_call_stats. Monthly target: 100,000. All queries READ ONLY.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
