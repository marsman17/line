"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Ellipsis,
  ExternalLink,
  Leaf,
  ListOrdered,
  LogOut,
  Menu,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { api, csv, type Restaurant } from "../lib/client";
import type { Ticket } from "../lib/db";
type Tab = "overview" | "queue" | "customers" | "analytics";
type Data = Restaurant & {
  tickets: Ticket[];
  notifications: {
    ticket_id: string;
    channel: string;
    status: string;
    last_error: string | null;
  }[];
};
const tabs: { id: Tab; name: string; icon: typeof Users }[] = [
  { id: "overview", name: "Overview", icon: UtensilsCrossed },
  { id: "queue", name: "Queue", icon: ListOrdered },
  { id: "customers", name: "Customers", icon: Users },
  { id: "analytics", name: "Analytics", icon: ChartNoAxesCombined },
];
const statusLabel = {
  waiting: "Waiting",
  notified: "Table ready",
  served: "Seated",
  cancelled: "Cancelled",
};
const time = (date: string) =>
  new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const today = (date: string) =>
  new Date(date).toLocaleDateString() === new Date().toLocaleDateString();
const minutes = (date: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("waiting");
  const [period, setPeriod] = useState("today");
  const [form, setForm] = useState<Ticket | "new" | null>(null);
  const [qr, setQr] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [range, setRange] = useState("30");
  const [customer, setCustomer] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await api<Data>("tickets");
      setData(result);
      setError("");
    } catch (e) {
      const message = (e as Error).message;
      if (message === "Please sign in.") window.location.replace("/login");
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (!form && !qr && !confirm && !menu && !customer) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setForm(null);
        setQr(false);
        setConfirm(null);
        setMenu(false);
        setCustomer(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [form, qr, confirm, menu, customer]);
  async function mutate(id: string, body: unknown) {
    setBusy(id);
    try {
      await api(`tickets/${id}`, "PATCH", body);
      await refresh();
      setToast("Queue updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const all = data?.tickets || [];
  const waiting = all.filter((t) => t.status === "waiting");
  const called = all.filter((t) => t.status === "notified");
  const seated = all.filter((t) => t.status === "served" && !t.released_at);
  const daily = all.filter((t) => today(t.joined_at));
  const occupancy = seated.reduce((s, t) => s + t.party_size, 0);
  const averages = all
    .filter((t) => t.notified_at)
    .map(
      (t) =>
        (new Date(t.notified_at!).getTime() - new Date(t.joined_at).getTime()) /
        60000,
    );
  const avg = averages.length
    ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
    : 0;
  const visible = all.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (period === "all" ||
        today(t.joined_at) ||
        t.status === "waiting" ||
        t.status === "notified" ||
        (t.status === "served" && !t.released_at)) &&
      `${t.name} ${t.phone} ${t.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const customers = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        email: string;
        phone: string;
        visits: number;
        size: number;
        last: string;
        priority: boolean;
        consent: boolean;
        history: Ticket[];
      }
    >();
    for (const t of all) {
      const key = t.phone || t.email || t.name.toLowerCase();
      const old = map.get(key);
      if (old) {
        old.visits++;
        old.history.push(t);
        old.priority ||= !!t.priority;
        if (t.joined_at > old.last) {
          old.last = t.joined_at;
          old.name = t.name;
          old.email = t.email;
          old.phone = t.phone;
        }
      } else
        map.set(key, {
          key,
          name: t.name,
          email: t.email,
          phone: t.phone,
          visits: 1,
          size: t.party_size,
          last: t.joined_at,
          priority: !!t.priority,
          consent: !!t.consent,
          history: [t],
        });
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [all]);
  function exportQueue() {
    csv("tableq-queue.csv", [
      [
        "Name",
        "Phone",
        "Email",
        "Party size",
        "Status",
        "Priority",
        "Joined",
        "Notified",
        "Seated/cancelled",
      ],
      ...all
        .filter(
          (t) =>
            tab !== "analytics" ||
            new Date(t.joined_at).getTime() >=
              Date.now() - Number(range) * 86400000,
        )
        .map((t) => [
          t.name,
          t.phone,
          t.email,
          t.party_size,
          statusLabel[t.status],
          t.priority ? "Yes" : "No",
          t.joined_at,
          t.notified_at || "",
          t.finished_at || "",
        ]),
    ]);
  }
  if (loading)
    return (
      <main className="loading-screen">
        <span className="brand-icon">
          T<span>Q</span>
        </span>
        <p>Getting your front desk ready…</p>
      </main>
    );
  if (!data)
    return (
      <main className="loading-screen">
        <p className="error">{error || "Unable to load your restaurant."}</p>
        <button className="button primary" onClick={refresh}>
          Try again
        </button>
      </main>
    );
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="/">
          <span className="brand-icon">
            T<span>Q</span>
          </span>
          TableQ<span className="brand-dot">.</span>
        </a>
        <span className="sidebar-label">YOUR RESTAURANT</span>
        <div className="restaurant-switch">
          <span className="restaurant-avatar">
            <Leaf size={21} />
          </span>
          <div>
            <strong>{data.name}</strong>
            <small>Restaurant workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="sidebar-label">WORKSPACE</span>
        <nav>
          {tabs.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setTab(id);
                setSearch("");
                setMenu(false);
              }}
            >
              <Icon size={18} />
              {name}
              {id === "queue" && waiting.length > 0 && (
                <span className="nav-count">{waiting.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="qr-promo">
            <span className="icon-tile">
              <QrCode size={22} />
            </span>
            <strong>Let guests check in.</strong>
            <p>One scan. A warmer welcome.</p>
            <button onClick={() => setQr(true)}>
              Get your QR code <ArrowRight size={14} />
            </button>
          </div>
          <div className="manager-profile">
            <span className="avatar manager">M</span>
            <div>
              <strong>Restaurant manager</strong>
              <small>Front desk</small>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                await api("logout", "POST");
                window.location.href = "/login";
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span className="desktop-only">Workspace</span>
            <span className="desktop-only slash">/</span>
            <span>{tabs.find((t) => t.id === tab)?.name}</span>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i /> Live updates
            </span>
            <span className="topbar-divider" />
            <span className="topbar-date">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="avatar small manager">M</span>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "overview"
                  ? "YOUR FRONT DESK, AT A GLANCE"
                  : tab === "queue"
                    ? "A LITTLE LESS WAITING"
                    : tab === "customers"
                      ? "FAMILIAR FACES, BETTER HOSPITALITY"
                      : "FROM BUSY NIGHTS TO BETTER INSIGHTS"}
              </span>
              <h1>
                {tab === "overview"
                  ? "A warm welcome starts here."
                  : tab === "queue"
                    ? "Your queue."
                    : tab === "customers"
                      ? "Your guests."
                      : "Understand every wait."}
              </h1>
              <p>
                {tab === "overview"
                  ? `Here’s what’s happening at ${data.name} today.`
                  : tab === "queue"
                    ? "Keep things moving. Make every guest feel looked after."
                    : tab === "customers"
                      ? "Every visit is the beginning of a relationship."
                      : "A closer look at your guest flow and service."}
              </p>
            </div>
            <div className="heading-actions">
              {tab === "overview" ? (
                <button
                  className="button secondary"
                  onClick={() => setQr(true)}
                >
                  <QrCode size={16} />
                  <span>Check-in QR</span>
                </button>
              ) : (
                <button
                  className="button secondary"
                  onClick={() =>
                    tab === "customers"
                      ? csv("tableq-customers.csv", [
                          ["Name", "Phone", "Email", "Visits", "Last visit"],
                          ...customers.map((c) => [
                            c.name,
                            c.phone,
                            c.email,
                            c.visits,
                            c.last,
                          ]),
                        ])
                      : exportQueue()
                  }
                >
                  <ArrowDownToLine size={16} />
                  Export CSV
                </button>
              )}
              {(tab === "overview" || tab === "queue") && (
                <button
                  className="button primary"
                  onClick={() => setForm("new")}
                >
                  <Plus size={17} />
                  Add guest
                </button>
              )}
              {tab === "analytics" && (
                <select
                  className="select"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              )}
            </div>
          </div>
          {receipt && (
            <div className="receipt-banner">
              <Check size={17} />
              <span>
                Guest added. Share their private status link to enable mobile
                alerts.
              </span>
              <a href={`/guest/${receipt}`} target="_blank" rel="noreferrer">
                Open guest link <ExternalLink size={13} />
              </a>
              <button
                className="icon-button"
                aria-label="Dismiss guest link"
                onClick={() => setReceipt("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!data.pushEnabled && !data.smsEnabled && (
            <div className="setup-banner">
              <Bell size={17} />
              <span>
                Live guest status is active. Configure Web Push or SMS to send
                alerts when guests leave the page.
              </span>
              <a href="/check-in" target="_blank" rel="noreferrer">
                Guest view <ExternalLink size={13} />
              </a>
            </div>
          )}
          {(tab === "overview" || tab === "queue") && (
            <>
              <div className="stats-grid">
                <Stat
                  label="Waiting guests"
                  value={waiting.reduce((s, t) => s + t.party_size, 0)}
                  unit="people"
                  icon={Users}
                  note={`${waiting.length} ${waiting.length === 1 ? "party" : "parties"} in the queue`}
                  tone="amber"
                />
                <Stat
                  label="Estimated wait"
                  value={waiting.length ? Math.max(5, waiting.length * 5) : 0}
                  unit="min"
                  icon={Clock}
                  note={
                    waiting.length
                      ? "Estimate · 5 min per waiting party"
                      : "Ready to welcome your next guest"
                  }
                  tone="purple"
                />
                <Stat
                  label="Tables ready"
                  value={called.length}
                  unit="parties"
                  icon={Bell}
                  note={
                    called.length
                      ? "Notified and on their way"
                      : "No guests currently called"
                  }
                  tone="blue"
                />
                <Stat
                  label="Seated today"
                  value={daily
                    .filter((t) => t.status === "served")
                    .reduce((s, t) => s + t.party_size, 0)}
                  unit="people"
                  icon={UtensilsCrossed}
                  note={`${occupancy} / ${data.capacity} seats currently occupied`}
                  tone="green"
                />
              </div>
              {tab === "overview" && (
                <div className="overview-band">
                  <div>
                    <span className="icon-tile green">
                      <Leaf size={22} />
                    </span>
                    <div>
                      <strong>A little room for a great evening.</strong>
                      <p>
                        {occupancy >= data.capacity
                          ? "Your dining room is full. Free a table when guests leave."
                          : `${Math.max(0, data.capacity - occupancy)} seats available in your dining room.`}
                      </p>
                    </div>
                  </div>
                  <div className="occupancy">
                    <span>
                      Occupancy{" "}
                      <strong>
                        {occupancy} / {data.capacity}
                      </strong>
                    </span>
                    <div className="progress">
                      <i
                        style={{
                          width: `${Math.min(100, (occupancy / data.capacity) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <section className="panel queue-panel">
                <div className="panel-heading">
                  <div>
                    <ListOrdered size={19} />
                    <h2>Guest queue</h2>
                    <span className="count-badge">
                      {waiting.length + called.length}
                    </span>
                  </div>
                  <div>
                    <span className="live-indicator">
                      <i /> Updated live
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Queue actions"
                      onClick={exportQueue}
                    >
                      <ArrowDownToLine size={17} />
                    </button>
                  </div>
                </div>
                <div className="queue-toolbar">
                  <div className="status-tabs">
                    {(
                      [
                        "waiting",
                        "notified",
                        "served",
                        "cancelled",
                        "all",
                      ] as const
                    ).map((s) => (
                      <button
                        key={s}
                        className={filter === s ? "selected" : ""}
                        onClick={() => setFilter(s)}
                      >
                        {s === "all" ? "All guests" : statusLabel[s]}
                        <span>
                          {s === "all"
                            ? all.length
                            : all.filter((t) => t.status === s).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="queue-tools">
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        aria-label="Search guests"
                        placeholder="Search guests…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="select"
                      aria-label="Queue date range"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="today">Today + active</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                </div>
                {visible.length ? (
                  <>
                    <div className="table-header">
                      <span>GUEST</span>
                      <span>PARTY</span>
                      <span>WAIT TIME</span>
                      <span>STATUS</span>
                      <span>ACTIONS</span>
                    </div>
                    <div className="ticket-list">
                      {visible.map((t) => (
                        <div
                          className={`ticket-row ${t.priority ? "priority-row" : ""}`}
                          key={t.id}
                        >
                          <div className="guest-cell">
                            <span
                              className={`avatar color-${t.name.charCodeAt(0) % 5}`}
                            >
                              {initials(t.name)}
                            </span>
                            <div>
                              <strong>
                                {t.name}
                                {!!t.priority && (
                                  <Star className="priority-star" size={13} />
                                )}
                              </strong>
                              <small>
                                {t.phone || t.email || "Walk-in guest"}
                                <span className="mobile-joined">
                                  {" "}
                                  · {time(t.joined_at)}
                                </span>
                              </small>
                              {t.notes && (
                                <span className="ticket-note">{t.notes}</span>
                              )}
                            </div>
                          </div>
                          <div className="party-cell">
                            <Users size={15} />
                            <strong>{t.party_size}</strong>
                            <span className="mobile-only">people</span>
                          </div>
                          <div className="wait-cell">
                            <Clock size={14} />
                            <strong>
                              {t.notified_at
                                ? Math.max(
                                    0,
                                    Math.round(
                                      (new Date(t.notified_at).getTime() -
                                        new Date(t.joined_at).getTime()) /
                                        60000,
                                    ),
                                  )
                                : minutes(t.joined_at)}{" "}
                              min
                            </strong>
                            <small>Joined {time(t.joined_at)}</small>
                          </div>
                          <div className="status-cell">
                            <span className={`status-badge ${t.status}`}>
                              <i />
                              {t.status === "served" && t.released_at
                                ? "Completed"
                                : statusLabel[t.status]}
                            </span>
                            {t.status === "notified" && (
                              <small>
                                {data.notifications.some(
                                  (n) =>
                                    n.ticket_id === t.id && n.status === "sent",
                                )
                                  ? "Alert sent"
                                  : data.notifications.some(
                                        (n) =>
                                          n.ticket_id === t.id &&
                                          n.status === "failed",
                                      )
                                    ? "Delivery failed — contact guest"
                                    : "Live status updated"}
                              </small>
                            )}
                          </div>
                          <div className="row-actions">
                            {t.status === "waiting" && (
                              <button
                                className="button call-button"
                                disabled={
                                  busy === t.id ||
                                  occupancy + t.party_size > data.capacity
                                }
                                title={
                                  occupancy + t.party_size > data.capacity
                                    ? "Not enough free seats"
                                    : "Call this guest"
                                }
                                onClick={() =>
                                  mutate(t.id, { status: "notified" })
                                }
                              >
                                <Bell size={14} />
                                Call guest
                              </button>
                            )}
                            {t.status === "notified" && (
                              <>
                                <button
                                  className="button seat-button"
                                  disabled={
                                    busy === t.id ||
                                    occupancy + t.party_size > data.capacity
                                  }
                                  onClick={() =>
                                    mutate(t.id, { status: "served" })
                                  }
                                >
                                  <Check size={15} />
                                  Seat guest
                                </button>
                                <button
                                  className="icon-button"
                                  title="Return to waiting queue"
                                  aria-label={`Return ${t.name} to waiting`}
                                  onClick={() =>
                                    mutate(t.id, { status: "waiting" })
                                  }
                                >
                                  <ArrowLeft size={15} />
                                </button>
                              </>
                            )}
                            {t.status === "served" && !t.released_at && (
                              <button
                                className="button secondary compact"
                                disabled={busy === t.id}
                                onClick={() =>
                                  mutate(t.id, { action: "release" })
                                }
                              >
                                <CheckCheck size={14} />
                                Free table
                              </button>
                            )}
                            <button
                              className="icon-button"
                              title="Edit guest"
                              aria-label={`Edit ${t.name}`}
                              onClick={() => setForm(t)}
                            >
                              <Pencil size={15} />
                            </button>
                            {["waiting", "notified"].includes(t.status) ? (
                              <button
                                className="icon-button danger"
                                title="Cancel visit"
                                aria-label={`Cancel ${t.name}`}
                                onClick={() =>
                                  setConfirm({
                                    title: "Cancel this visit?",
                                    description: `${t.name} will be removed from the active queue. Their visit remains in your history.`,
                                    action: async () => {
                                      await mutate(t.id, {
                                        status: "cancelled",
                                      });
                                    },
                                  })
                                }
                              >
                                <X size={16} />
                              </button>
                            ) : (
                              <button
                                className="icon-button danger"
                                title="Delete guest record"
                                aria-label={`Delete ${t.name}`}
                                onClick={() =>
                                  setConfirm({
                                    title: "Delete this guest record?",
                                    description:
                                      "This permanently deletes this visit and its notification records. This cannot be undone.",
                                    action: async () => {
                                      await api(`tickets/${t.id}`, "DELETE");
                                      await refresh();
                                      setReceipt("");
                                      setToast("Guest record deleted.");
                                    },
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      <ListOrdered size={32} />
                      <span className="empty-spark">
                        <Sparkles size={15} />
                      </span>
                    </div>
                    <h3>
                      {search
                        ? "No guests found."
                        : filter === "waiting"
                          ? "A little calm before the good times."
                          : "Nothing here just yet."}
                    </h3>
                    <p>
                      {search
                        ? "Try another name, phone number, or email."
                        : filter === "waiting"
                          ? "Your queue is clear. Add a guest or let them scan your QR code."
                          : "Guest visits will appear here as your service moves along."}
                    </p>
                    {filter === "waiting" && !search && (
                      <button
                        className="button primary"
                        onClick={() => setForm("new")}
                      >
                        <Plus size={16} />
                        Add your first guest
                      </button>
                    )}
                  </div>
                )}
                <div className="panel-footer">
                  <span>
                    {visible.length}{" "}
                    {visible.length === 1 ? "party" : "parties"} shown
                  </span>
                  <span>
                    <span className="tiny-dot" /> A better wait starts with a
                    little care.
                  </span>
                </div>
              </section>
              {tab === "overview" && (
                <div className="bottom-cards">
                  <div className="insight-card">
                    <span className="icon-tile amber">
                      <QrCode size={24} />
                    </span>
                    <div>
                      <h3>Skip the clipboard.</h3>
                      <p>
                        Guests scan, check in, and get on with their evening.
                      </p>
                      <button onClick={() => setQr(true)}>
                        View check-in QR <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="insight-card">
                    <span className="icon-tile purple">
                      <ChartNoAxesCombined size={24} />
                    </span>
                    <div>
                      <h3>Every wait tells a story.</h3>
                      <p>
                        See your busy hours and make room for better service.
                      </p>
                      <button onClick={() => setTab("analytics")}>
                        Explore analytics <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === "customers" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <Users size={18} />
                  <h2>Guest directory</h2>
                  <span className="count-badge">{customers.length}</span>
                </div>
              </div>
              <div className="customer-toolbar">
                <div className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="Search customers"
                    placeholder="Search by name, phone, or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span className="muted">Sorted by most recent visit</span>
              </div>
              <div className="customer-grid">
                {customers
                  .filter((c) =>
                    `${c.name} ${c.email} ${c.phone}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <button
                      className="customer-card"
                      key={c.key}
                      onClick={() => setCustomer(c.key)}
                    >
                      <div className="customer-top">
                        <span
                          className={`avatar color-${c.name.charCodeAt(0) % 5}`}
                        >
                          {initials(c.name)}
                        </span>
                        <strong>{c.name}</strong>
                        {c.priority && (
                          <Star size={14} className="priority-star" />
                        )}
                        <ArrowRight size={16} />
                      </div>
                      <div className="customer-details">
                        <div>
                          <small>Total visits</small>
                          <strong>{c.visits}</strong>
                        </div>
                        <div>
                          <small>Visit updates</small>
                          <span>
                            {c.consent ? "✓ Opted in" : "Not opted in"}
                          </span>
                        </div>
                      </div>
                      <p>{c.phone || c.email || "Walk-in guest"}</p>
                      <small>
                        Last visit ·{" "}
                        {new Date(c.last).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </small>
                    </button>
                  ))}
              </div>
              {!customers.length && (
                <div className="empty-state">
                  <Users size={35} />
                  <h3>Your next regular starts here.</h3>
                  <p>Guests appear automatically after their first check-in.</p>
                </div>
              )}
              {customers.length > 0 &&
                !customers.some((c) =>
                  `${c.name} ${c.email} ${c.phone}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <div className="empty-state">
                    <Search size={30} />
                    <h3>No matching guests.</h3>
                    <p>Try a different name or contact detail.</p>
                  </div>
                )}
            </section>
          )}
          {tab === "analytics" && (
            <Analytics tickets={all} range={Number(range)} avg={avg} />
          )}
          <footer className="dashboard-footer">
            <span>
              TableQ<span className="brand-dot">.</span> A better wait.
            </span>
            <span>
              Made for a warmer welcome <Leaf size={12} />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {form && (
        <GuestForm
          ticket={form}
          onClose={() => setForm(null)}
          onSaved={async (result) => {
            if (form === "new") {
              setFilter("waiting");
              setSearch("");
              setReceipt(result.token || "");
            }
            setForm(null);
            await refresh();
            setToast(
              form === "new"
                ? "Guest added to the queue."
                : "Guest details updated.",
            );
          }}
        />
      )}
      {qr && (
        <Modal
          title="A warm welcome, one scan away."
          onClose={() => setQr(false)}
        >
          <p className="modal-description">
            Place this QR code at your entrance. Guests can join your queue
            straight from their phones.
          </p>
          <div className="qr-display">
            <div className="qr-restaurant">
              <Leaf size={21} />
              <strong>{data.name}</strong>
            </div>
            <img
              src="/api/qr"
              width="240"
              height="240"
              alt="Scan to join the restaurant queue"
            />
            <h3>Scan. Join. Relax.</h3>
            <p>We’ll let you know when your table is ready.</p>
            <span className="qr-brand">Powered by TableQ.</span>
          </div>
          <div className="modal-actions">
            <a
              className="button secondary"
              href="/api/qr"
              download="tableq-check-in.svg"
            >
              <ArrowDownToLine size={16} />
              Download QR
            </a>
            <a
              className="button primary"
              href="/check-in"
              target="_blank"
              rel="noreferrer"
            >
              Open check-in <ExternalLink size={15} />
            </a>
          </div>
          <p className="helper">
            {data.appUrl
              ? "Your QR uses the configured public app URL."
              : "For deployment, set APP_URL to your public HTTPS address before printing."}
          </p>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="modal-description">{confirm.description}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Keep guest
            </button>
            <button
              className="button danger-button"
              disabled={busy === "confirm"}
              onClick={async () => {
                setBusy("confirm");
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "confirm" ? "Working…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
      {customer &&
        (() => {
          const c = customers.find((c) => c.key === customer);
          return c ? (
            <Modal title={c.name} onClose={() => setCustomer(null)}>
              <div className="customer-summary">
                <p>{c.phone || "No phone recorded"}</p>
                <p>{c.email || "No email recorded"}</p>
                <span className="status-badge waiting">{c.visits} visits</span>
              </div>
              <h3 className="section-title">Visit history</h3>
              {[...c.history]
                .sort((a, b) => b.joined_at.localeCompare(a.joined_at))
                .map((t) => (
                  <div className="history-row" key={t.id}>
                    <div>
                      <strong>
                        {new Date(t.joined_at).toLocaleDateString()}
                      </strong>
                      <small>
                        {t.party_size} people · {time(t.joined_at)}
                      </small>
                    </div>
                    <span className={`status-badge ${t.status}`}>
                      {statusLabel[t.status]}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Edit visit"
                      onClick={() => {
                        setCustomer(null);
                        setForm(t);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                ))}
            </Modal>
          ) : null;
        })()}
    </div>
  );
}
function Stat({
  label,
  value,
  unit,
  icon: Icon,
  note,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  icon: typeof Users;
  note: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>
        <span className={`tiny-dot ${tone}`} />
        {note}
      </p>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector(
      '[role="dialog"]',
    ) as HTMLElement | null;
    dialog?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
      );
      if (!els?.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", trap);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function GuestForm({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: Ticket | "new";
  onClose: () => void;
  onSaved: (result: { token?: string }) => Promise<void>;
}) {
  const initial = ticket === "new" ? null : ticket;
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [size, setSize] = useState(initial?.party_size || 2);
  const [priority, setPriority] = useState(!!initial?.priority);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [consent, setConsent] = useState(!!initial?.consent);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={initial ? "Edit guest" : "Add to queue"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api(
              initial ? `tickets/${initial.id}` : "tickets",
              initial ? "PATCH" : "POST",
              { name, phone, email, partySize: size, priority, notes, consent },
            );
            await onSaved(result);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="form-top">
          <label>
            Party size
            <div className="stepper">
              <Users size={17} />
              <strong>{size}</strong>
              <button
                type="button"
                disabled={size <= 1}
                onClick={() => setSize(size - 1)}
                aria-label="Decrease party size"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                disabled={size >= 20}
                onClick={() => setSize(size + 1)}
                aria-label="Increase party size"
              >
                <Plus size={16} />
              </button>
            </div>
          </label>
          <label className="priority-toggle">
            <input
              type="checkbox"
              checked={priority}
              onChange={(e) => setPriority(e.target.checked)}
            />
            <span className="switch" />
            <Star size={16} /> Priority
          </label>
        </div>
        <label>
          Guest name
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </label>
        <label>
          Mobile number <span className="optional">optional</span>
          <input
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
          <small className="helper">
            Include the country code, without spaces.
          </small>
        </label>
        <label>
          Email <span className="optional">optional</span>
          <input
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <label>
          Notes <span className="optional">private to your team</span>
          <textarea
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="High chair, accessibility needs, special occasion…"
            rows={2}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Guest agrees to receive updates about this visit.
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add to queue"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Analytics({
  tickets,
  range,
}: {
  tickets: Ticket[];
  range: number;
  avg: number;
}) {
  const selected = tickets.filter(
    (t) => new Date(t.joined_at).getTime() >= Date.now() - range * 86400000,
  );
  const served = selected.filter((t) => t.status === "served");
  const notified = selected.filter((t) => t.notified_at);
  const cancelled = selected.filter((t) => t.status === "cancelled");
  const waitValues = notified.map(
    (t) =>
      (new Date(t.notified_at!).getTime() - new Date(t.joined_at).getTime()) /
      60000,
  );
  const average = waitValues.length
    ? Math.round(waitValues.reduce((a, b) => a + b, 0) / waitValues.length)
    : 0;
  const hours = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 10 > 12 ? i - 2 : i + 10}${i + 10 >= 12 ? "p" : "a"}`,
    value: selected
      .filter((t) => new Date(t.joined_at).getHours() === i + 10)
      .reduce((s, t) => s + t.party_size, 0),
  }));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
    (label, i) => ({
      label,
      value: selected
        .filter((t) => new Date(t.joined_at).getDay() === i)
        .reduce((s, t) => s + t.party_size, 0),
    }),
  );
  const sizes = ["1–2", "3–4", "5–6", "7+"].map((label, i) => {
    const group = notified.filter((t) =>
      i === 3
        ? t.party_size >= 7
        : t.party_size >= i * 2 + 1 && t.party_size <= i * 2 + 2,
    );
    return {
      label,
      value: group.length
        ? Math.round(
            group.reduce(
              (s, t) =>
                s +
                (new Date(t.notified_at!).getTime() -
                  new Date(t.joined_at).getTime()) /
                  60000,
              0,
            ) / group.length,
          )
        : 0,
    };
  });
  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Guests welcomed"
          value={selected.reduce((s, t) => s + t.party_size, 0)}
          unit="people"
          icon={Users}
          note={`${selected.length} parties joined`}
          tone="amber"
        />
        <Stat
          label="Average wait"
          value={average}
          unit="min"
          icon={Clock}
          note="From check-in to table-ready"
          tone="purple"
        />
        <Stat
          label="Seating rate"
          value={
            selected.length
              ? Math.round((served.length / selected.length) * 100)
              : 0
          }
          unit="%"
          icon={CheckCheck}
          note={`${served.length} parties seated`}
          tone="green"
        />
        <Stat
          label="Walk-aways"
          value={cancelled.length}
          unit="parties"
          icon={ArrowRight}
          note="Cancelled visits in this period"
          tone="blue"
        />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>The guest journey</h2>
            </div>
            <span className="muted">Parties</span>
          </div>
          <p className="chart-description">
            From the first hello to a seat at the table.
          </p>
          <div className="funnel">
            {[
              { label: "Joined", value: selected.length },
              { label: "Notified", value: notified.length },
              { label: "Seated", value: served.length },
            ].map((s, i) => (
              <div className="funnel-stage" key={s.label}>
                <span>{s.label}</span>
                <strong>{s.value}</strong>
                <div className="funnel-track">
                  <i
                    style={{
                      height: `${selected.length ? (s.value / selected.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                {i < 2 && <ArrowRight className="funnel-arrow" size={19} />}
              </div>
            ))}
          </div>
          <div className="chart-note">
            <span className="tiny-dot green" />
            {notified.length
              ? `${Math.round((served.length / notified.length) * 100)}% of notified parties were seated.`
              : "Your guest journey will appear after your first check-in."}
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Demand by hour</h2>
            </div>
            <Clock size={16} />
          </div>
          <p className="chart-description">
            Find your busiest moments. Plan your warmest welcome.
          </p>
          <Bars values={hours} suffix=" guests" />
          <div className="chart-note">Local time · 10 AM to 9 PM</div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Demand by weekday</h2>
            </div>
            <CalendarDays size={16} />
          </div>
          <p className="chart-description">A rhythm to every week.</p>
          <Bars values={days} suffix=" guests" />
          <div className="chart-note">
            <span className="tiny-dot amber" />
            Total guests during the selected period
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Wait by party size</h2>
            </div>
            <Users size={16} />
          </div>
          <p className="chart-description">
            Average minutes from check-in to table-ready.
          </p>
          <Bars values={sizes} suffix=" min" />
          <div className="chart-note">
            Party size · based on notified guests
          </div>
        </section>
      </div>
      {!selected.length && (
        <p className="analytics-empty">
          <Sparkles size={16} />
          Real insights will grow with your queue. No sample data is included.
        </p>
      )}
    </>
  );
}
function Bars({
  values,
  suffix,
}: {
  values: { label: string; value: number }[];
  suffix: string;
}) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={values
        .map((v) => `${v.label}: ${v.value}${suffix}`)
        .join(", ")}
    >
      <div className="chart-grid">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="bars">
        {values.map((v, i) => (
          <div className="bar-column" key={i}>
            <div className="bar-track">
              <div
                className="bar"
                style={{ height: `${(v.value / max) * 100}%` }}
                title={`${v.value}${suffix}`}
              >
                <span>{v.value > 0 ? v.value : ""}</span>
              </div>
            </div>
            <small>{v.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
