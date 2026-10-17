"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, Database, FileText, Gauge, Layers3, Radio, RefreshCw, Search,
  Server, Settings2, ShieldCheck, SlidersHorizontal, TerminalSquare, Zap
} from "lucide-react";

type LogRow = {
  id: number;
  event_timestamp?: string | null;
  timestamp?: string | null;
  received_at?: string | null;
  server_id?: string | null;
  category?: string;
  message?: string;
  details?: unknown;
};

type ApiPayload = LogRow[] | { logs?: LogRow[]; items?: LogRow[]; error?: string; detail?: string };

function getRows(payload: ApiPayload): LogRow[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.logs)) return payload.logs;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function timestampOf(row: LogRow) {
  return row.event_timestamp || row.timestamp || row.received_at || "";
}

function formatTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}

function levelFor(row: LogRow) {
  const text = `${row.category ?? ""} ${row.message ?? ""}`.toLowerCase();
  if (text.includes("critical") || text.includes("fatal")) return "CRITICAL";
  if (text.includes("error") || text.includes("failed") || text.includes("fault")) return "ERROR";
  if (text.includes("warning") || text.includes("warn")) return "WARNING";
  return "INFO";
}

function detailsText(details: unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try { return JSON.stringify(details, null, 2); } catch { return String(details); }
}

export default function Home() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [server, setServer] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connected, setConnected] = useState<"connecting" | "online" | "offline">("connecting");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const latestId = useRef(0);
  const initialized = useRef(false);

  const fetchLogs = useCallback(async (initial = false) => {
    try {
      const afterId = initial ? 0 : latestId.current;
      const response = await fetch(`/api/logs?after_id=${afterId}&limit=100`, { cache: "no-store" });
      const payload = await response.json() as ApiPayload;
      if (!response.ok) {
        const message = !Array.isArray(payload) && (payload.error || payload.detail);
        throw new Error(message || `Logs API returned HTTP ${response.status}`);
      }
      const incoming = getRows(payload).sort((a, b) => a.id - b.id);
      if (initial || !initialized.current) {
        setLogs(incoming.slice(-500).reverse());
        latestId.current = incoming.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
        initialized.current = true;
        setNewCount(0);
      } else if (incoming.length) {
        setLogs(current => {
          const existing = new Set(current.map(row => row.id));
          const fresh = incoming.filter(row => !existing.has(row.id));
          if (fresh.length) setNewCount(count => count + fresh.length);
          return [...fresh.reverse(), ...current].slice(0, 500);
        });
        latestId.current = incoming.reduce((max, row) => Math.max(max, Number(row.id) || 0), latestId.current);
      }
      setConnected("online");
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      setConnected("offline");
      setError(e instanceof Error ? e.message : "Unable to load logs");
    }
  }, []);

  useEffect(() => {
    void fetchLogs(true);
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void fetchLogs(false), 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  const servers = useMemo(() => Array.from(new Set(logs.map(row => row.server_id || "Unknown server"))).sort(), [logs]);
  const categories = useMemo(() => Array.from(new Set(logs.map(row => row.category || "GENERAL"))).sort(), [logs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter(row => {
      const rowLevel = levelFor(row);
      const haystack = `${row.id} ${row.category ?? ""} ${row.message ?? ""} ${row.server_id ?? ""} ${detailsText(row.details)}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (level === "ALL" || rowLevel === level)
        && (server === "ALL" || (row.server_id || "Unknown server") === server)
        && (category === "ALL" || (row.category || "GENERAL") === category);
    });
  }, [logs, search, level, server, category]);

  const counts = useMemo(() => ({
    total: logs.length,
    warnings: logs.filter(row => levelFor(row) === "WARNING").length,
    errors: logs.filter(row => ["ERROR", "CRITICAL"].includes(levelFor(row))).length,
    servers: servers.length,
  }), [logs, servers]);

  const exportCsv = () => {
    setExporting(true);
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["id", "timestamp", "level", "category", "message", "server_id", "details"],
      ...filtered.map(row => [row.id, timestampOf(row), levelFor(row), row.category, row.message, row.server_id, detailsText(row.details)])
    ];
    const csv = rows.map(row => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fh-electrical-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={21} fill="currentColor" /></div>
          <div><div className="brand-name">FH <span>ELECTRICAL</span></div><div className="brand-caption">OPERATIONS PLATFORM</div></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          <a className="nav-item" href="#overview"><Gauge size={17} />Overview</a>
          <a className="nav-item active" href="#logs"><TerminalSquare size={17} />Live logs <span className="nav-dot" /></a>
          <a className="nav-item" href="#systems"><Layers3 size={17} />Electrical systems</a>
          <a className="nav-item" href="#servers"><Server size={17} />Servers</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <div className="status-heading"><span className={`status-light ${connected}`} />API CONNECTION</div>
            <div className="status-main">{connected === "online" ? "Systems operational" : connected === "offline" ? "Connection issue" : "Connecting…"}</div>
            <div className="status-sub">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for first response"}</div>
          </div>
          <a className="nav-item muted" href="#settings"><Settings2 size={17} />Settings</a>
          <div className="profile">
            <div className="avatar">FH</div><div className="profile-copy"><strong>FH Admin</strong><span>System administrator</span></div><CircleHelp size={16} className="profile-help" />
          </div>
        </div>
      </aside>

      <section className="main-panel" id="logs">
        <header className="topbar">
          <div className="breadcrumbs"><span>Operations</span><span className="crumb-slash">/</span><strong>Live logs</strong></div>
          <div className="topbar-actions">
            <span className={`connection-pill ${connected}`}><span className="status-light" />{connected === "online" ? "API CONNECTED" : connected === "offline" ? "API DISCONNECTED" : "CONNECTING"}</span>
            <button className={`icon-button ${autoRefresh ? "toggled" : ""}`} onClick={() => setAutoRefresh(v => !v)} title={autoRefresh ? "Pause automatic refresh" : "Enable automatic refresh"}><Radio size={17} /><span>{autoRefresh ? "Live" : "Paused"}</span></button>
            <button className="icon-button" onClick={() => void fetchLogs(true)} title="Refresh logs"><RefreshCw size={16} /><span>Refresh</span></button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />MONITORING CENTER</div>
              <h1>Live logs<span className="heading-period">.</span></h1>
              <p className="page-description">Monitor events and activity from your Roblox electrical systems.</p>
            </div>
            <button className="export-button" onClick={exportCsv} disabled={exporting || filtered.length === 0}><ArrowDownToLine size={16} />Export CSV</button>
          </div>

          {error && <div className="error-banner"><AlertTriangle size={17} /><div><strong>Couldn&apos;t load logs</strong><span>{error}</span></div><button onClick={() => void fetchLogs(true)}>Try again</button></div>}

          <div className="metric-grid">
            <Metric icon={<Activity size={18} />} label="Events loaded" value={counts.total.toLocaleString()} note="Latest 500 records" accent="blue" />
            <Metric icon={<AlertTriangle size={18} />} label="Warnings" value={counts.warnings.toLocaleString()} note="In loaded records" accent="amber" />
            <Metric icon={<ShieldCheck size={18} />} label="Errors & faults" value={counts.errors.toLocaleString()} note="In loaded records" accent="red" />
            <Metric icon={<Server size={18} />} label="Servers seen" value={counts.servers.toLocaleString()} note="Unique server IDs" accent="green" />
          </div>

          <section className="logs-card">
            <div className="card-top">
              <div className="card-title-wrap"><div className="card-icon"><Database size={17} /></div><div><h2>Event stream</h2><p>Newest events appear first <span className="small-separator">·</span> Refreshes every 5 seconds</p></div></div>
              <div className="stream-indicator"><span className={`status-light ${connected}`} />{autoRefresh ? "STREAMING" : "PAUSED"}</div>
            </div>
            <div className="filter-bar">
              <div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages, categories, servers…" aria-label="Search logs" />{search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}</div>
              <div className="filter-select"><SlidersHorizontal size={15} /><select value={level} onChange={e => setLevel(e.target.value)} aria-label="Filter by level"><option value="ALL">All levels</option><option>INFO</option><option>WARNING</option><option>ERROR</option><option>CRITICAL</option></select><ChevronDown size={13} /></div>
              <div className="filter-select"><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category"><option value="ALL">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></div>
              <div className="filter-select"><select value={server} onChange={e => setServer(e.target.value)} aria-label="Filter by server"><option value="ALL">All servers</option>{servers.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></div>
            </div>
            <div className="table-meta"><span><strong>{filtered.length.toLocaleString()}</strong> events <span className="meta-muted">matching filters</span></span><span className="latest-meta"><Clock3 size={13} />{lastUpdated ? `Last checked ${lastUpdated.toLocaleTimeString()}` : "Waiting for data"}{newCount > 0 && <button className="new-events" onClick={() => setNewCount(0)}>+{newCount} new</button>}</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th className="time-col">TIMESTAMP</th><th>LEVEL</th><th>SOURCE</th><th>MESSAGE</th><th>SERVER</th><th className="detail-col">DETAILS</th></tr></thead>
                <tbody>
                  {filtered.map(row => {
                    const rowLevel = levelFor(row);
                    return <tr key={row.id} onClick={() => setSelected(row)} className="log-row">
                      <td className="time-cell"><span>{formatTime(timestampOf(row))}</span><small>#{row.id}</small></td>
                      <td><LevelBadge level={rowLevel} /></td>
                      <td><span className="source-label"><span className="source-mark">{(row.category || "G").slice(0, 1).toUpperCase()}</span>{row.category || "GENERAL"}</span></td>
                      <td><span className="message-text">{row.message || "(no message)"}</span></td>
                      <td><span className="server-label"><span className="server-dot" />{row.server_id || "—"}</span></td>
                      <td><button className="details-button" onClick={e => { e.stopPropagation(); setSelected(row); }} aria-label={`View details for log ${row.id}`}><FileText size={15} /></button></td>
                    </tr>;
                  })}
                  {filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><FileText size={23} /></div><strong>{logs.length ? "No logs match these filters" : connected === "offline" ? "API unavailable" : "Waiting for your first logs"}</strong><span>{logs.length ? "Try changing your search or filters." : "When Roblox sends events to your API, they will appear here automatically."}</span>{logs.length > 0 && <button onClick={() => { setSearch(""); setLevel("ALL"); setServer("ALL"); setCategory("ALL"); }}>Clear all filters</button>}</div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span><span className="footer-live-dot" />{autoRefresh ? "Automatic refresh enabled" : "Automatic refresh paused"}</span><span>Showing up to 500 recent records stored in this view</span></div>
          </section>
          <footer className="page-footer"><span>FH ELECTRICAL OPS <span className="footer-divider">/</span> MONITORING</span><span>Secure server-side API connection <ShieldCheck size={13} /></span></footer>
        </div>
      </section>

      {selected && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="modal-header"><div><div className="eyebrow">EVENT INSPECTOR</div><h2 id="detail-title">Log entry <span>#{selected.id}</span></h2></div><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details">×</button></div>
          <div className="modal-summary"><LevelBadge level={levelFor(selected)} /><span className="source-label"><span className="source-mark">{(selected.category || "G").slice(0, 1).toUpperCase()}</span>{selected.category || "GENERAL"}</span></div>
          <div className="detail-field"><label>Message</label><div className="detail-message">{selected.message || "—"}</div></div>
          <div className="detail-field"><label>Timestamp</label><div>{timestampOf(selected) || "—"}</div></div>
          <div className="detail-field"><label>Server ID</label><div className="mono">{selected.server_id || "—"}</div></div>
          <div className="detail-field"><label>Details payload</label><pre className="json-view">{detailsText(selected.details) || "No additional details attached."}</pre></div>
          <button className="modal-done" onClick={() => setSelected(null)}>Close inspector</button>
        </section>
      </div>}
    </main>
  );
}

function Metric({ icon, label, value, note, accent }: { icon: React.ReactNode; label: string; value: string; note: string; accent: string }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${accent}`}>{icon}</span><span className="metric-kicker">LIVE</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></div>;
}

function LevelBadge({ level }: { level: string }) {
  const cls = level.toLowerCase();
  return <span className={`level-badge ${cls}`}><span />{level}</span>;
}
