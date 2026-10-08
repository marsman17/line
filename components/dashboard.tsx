"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
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
import Customers from "./customers";
import AccountMenu from "./account-menu";
import { usePreferences } from "./preferences";
import { Modal } from "./modal";
import CompanyLogo from "./company-logo";
import BranchManagement from "./branches";
import type { Branch, Manager, Ticket } from "../lib/db";
type Tab = "overview" | "queue" | "customers" | "analytics";
type Data = Restaurant & {
  branches: Branch[];
  user: Manager;
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
  const { t: tx, locale, n } = usePreferences();
  const time = (date: string) =>
    new Date(date).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const { t } = usePreferences();
  const [branchId, setBranchId] = useState("");
  const [manageBranches, setManageBranches] = useState(false);
  const requestVersion = useRef(0);
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
  const [receipt, setReceipt] = useState("");
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const result = await api<Data>(
        `tickets${branchId ? "?branch=" + encodeURIComponent(branchId) : ""}`,
      );
      if (version !== requestVersion.current) return;
      setData(result);
      setError("");
    } catch (e) {
      if (version !== requestVersion.current) return;
      const message = (e as Error).message;
      if (message === "Please sign in.") window.location.replace("/login");
      else setError(message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [branchId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      clearInterval(timer);
      requestVersion.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (!form && !qr && !confirm && !menu && !manageBranches) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setForm(null);
        setQr(false);
        setConfirm(null);
        setMenu(false);
        setManageBranches(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [form, qr, confirm, menu, manageBranches]);
  async function mutate(id: string, body: unknown) {
    setBusy(id);
    try {
      await api(
        `tickets/${id}?branch=${encodeURIComponent(data!.branchId)}`,
        "PATCH",
        body,
      );
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
  const reservedSeats =
    occupancy + called.reduce((s, t) => s + t.party_size, 0);
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
  function selectBranch(id: string) {
    requestVersion.current++;
    setData(null);
    setLoading(true);
    setError("");
    setBranchId(id);
    setSearch("");
    setReceipt("");
    setFilter("waiting");
    setForm(null);
    setQr(false);
    setConfirm(null);
    if (id === "all") setTab("analytics");
  }
  function exportQueue() {
    csv("tableq-queue.csv", [
      [
        "Branch",
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
          data?.branches.find((b) => b.id === t.branch_id)?.name || t.branch_id,
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
          {tx("T")}
          <span>{tx("Q")}</span>
        </span>
        <p>{tx("Getting your front desk ready…")}</p>
      </main>
    );
  if (!data)
    return (
      <main className="loading-screen">
        <p className="error">
          {tx(error) || tx("Unable to load your restaurant.")}
        </p>
        <button className="button primary" onClick={refresh}>
          {tx("Try again")}
        </button>
      </main>
    );
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenu(false)}
          aria-label={tx("Close navigation")}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="/">
          <span className="brand-icon">
            {tx("T")}
            <span>{tx("Q")}</span>
          </span>
          {tx("TableQ")}
          <span className="brand-dot">.</span>
        </a>
        <span className="sidebar-label">{tx("YOUR RESTAURANT")}</span>
        <div className="restaurant-switch">
          <span className="restaurant-avatar">
            <CompanyLogo
              branchId={data.branchId}
              version={
                data.branches.find((b) => b.id === data.branchId)?.logo_version
              }
              name={data.name}
            />
          </span>
          <label className="branch-picker">
            {tx("Branch")}
            <select
              aria-label={tx("Branch")}
              value={data.branchId}
              onChange={(e) => selectBranch(e.target.value)}
            >
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.archived ? tx(" (archived)") : ""}
                </option>
              ))}
              {tab === "analytics" && (
                <option value="all">{tx("All branches")}</option>
              )}
            </select>
          </label>
        </div>
        {data.user.role === "admin" && (
          <button
            className="button secondary branch-manage"
            onClick={() => setManageBranches(true)}
          >
            {tx("Manage branches & staff")}
          </button>
        )}
        {data.user.role === "admin" && (
          <a className="nav-item cms-nav" href="/cms">
            <SlidersHorizontal size={18} />
            {tx("CMS administration")}
          </a>
        )}
        <span className="sidebar-label">{tx("WORKSPACE")}</span>
        <nav>
          {tabs.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                if (data.branchId === "all" && id !== "analytics")
                  selectBranch(data.branches[0].id);
                setTab(id);
                setSearch("");
                setMenu(false);
              }}
            >
              <Icon size={18} />
              {t(name)}
              {id === "queue" && waiting.length > 0 && (
                <span className="nav-count">{n(waiting.length)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="qr-promo">
            <span className="icon-tile">
              <QrCode size={22} />
            </span>
            <strong>{tx("Let guests check in.")}</strong>
            <p>{tx("One scan. A warmer welcome.")}</p>
            <button
              disabled={data.branchId === "all"}
              onClick={() => setQr(true)}
            >
              {tx("Get your QR code")}
              <ArrowRight size={14} />
            </button>
          </div>
          <AccountMenu />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label={tx("Open navigation")}
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span className="desktop-only">{tx("Workspace")}</span>
            <span className="desktop-only slash">/</span>
            <span>{tx(tabs.find((t) => t.id === tab)?.name || "")}</span>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i /> {tx("Live updates")}
            </span>
            <span className="topbar-divider" />
            <span className="topbar-date">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="avatar small manager">{tx("M")}</span>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "overview"
                  ? tx("YOUR FRONT DESK, AT A GLANCE")
                  : tab === "queue"
                    ? tx("A LITTLE LESS WAITING")
                    : tab === "customers"
                      ? tx("FAMILIAR FACES, BETTER HOSPITALITY")
                      : tx("FROM BUSY NIGHTS TO BETTER INSIGHTS")}
              </span>
              <h1>
                {tab === "overview"
                  ? tx("A warm welcome starts here.")
                  : tab === "queue"
                    ? tx("Your queue.")
                    : tab === "customers"
                      ? tx("Customers")
                      : tx("Understand every wait.")}
              </h1>
              <p>
                {tab === "overview"
                  ? tx("Here’s what’s happening at {value0} today.", {
                      value0: data.name,
                    })
                  : tab === "queue"
                    ? tx(
                        "Keep things moving. Make every guest feel looked after.",
                      )
                    : tab === "customers"
                      ? tx("Every visit is the beginning of a relationship.")
                      : tx("A closer look at your guest flow and service.")}
              </p>
            </div>
            <div className="heading-actions">
              {tab === "overview" ? (
                <button
                  className="button secondary"
                  onClick={() => setQr(true)}
                >
                  <QrCode size={16} />
                  <span>{tx("Check-in QR")}</span>
                </button>
              ) : tab !== "customers" ? (
                <button className="button secondary" onClick={exportQueue}>
                  <ArrowDownToLine size={16} />
                  {tx("Export CSV")}
                </button>
              ) : null}
              {(tab === "overview" || tab === "queue") && (
                <button
                  className="button primary"
                  disabled={data.archived}
                  onClick={() => setForm("new")}
                >
                  <Plus size={17} />
                  {tx("Add guest")}
                </button>
              )}
              {tab === "analytics" && (
                <select
                  className="select"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                >
                  <option value="7">{tx("Last 7 days")}</option>
                  <option value="30">{tx("Last 30 days")}</option>
                  <option value="90">{tx("Last 90 days")}</option>
                </select>
              )}
            </div>
          </div>
          {data.archived && (
            <p className="error">
              {tx(
                "This branch is archived. Its history is preserved and new check-ins are closed. An administrator can restore it in Manage branches & staff.",
              )}
            </p>
          )}
          {receipt && (
            <div className="receipt-banner">
              <Check size={17} />
              <span>
                {tx(
                  "Guest added. Share their private status link to enable mobile alerts.",
                )}
              </span>
              <a href={`/guest/${receipt}`} target="_blank" rel="noreferrer">
                {tx("Open guest link")}
                <ExternalLink size={13} />
              </a>
              <button
                className="icon-button"
                aria-label={tx("Dismiss guest link")}
                onClick={() => setReceipt("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {tx(error)}
              <button
                aria-label={tx("Dismiss error")}
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data.pushEnabled && !data.smsEnabled && (
            <div className="setup-banner">
              <Bell size={17} />
              <span>
                {tx(
                  "Live guest status is active. Configure Web Push or SMS to send alerts when guests leave the page.",
                )}
              </span>
              <a
                href={`/check-in?branch=${encodeURIComponent(data.branchId)}`}
                target="_blank"
                rel="noreferrer"
              >
                {tx("Guest view")}
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {(tab === "overview" || tab === "queue") && (
            <>
              <div className="stats-grid">
                <Stat
                  label={tx("Waiting guests")}
                  value={waiting.reduce((s, t) => s + t.party_size, 0)}
                  unit={tx("people")}
                  icon={Users}
                  note={tx("{value0} {value1} in the queue", {
                    value0: waiting.length,
                    value1: waiting.length === 1 ? tx("party") : tx("parties"),
                  })}
                  tone="amber"
                />
                <Stat
                  label={tx("Estimated wait")}
                  value={waiting.length ? Math.max(5, waiting.length * 5) : 0}
                  unit={tx("min")}
                  icon={Clock}
                  note={
                    waiting.length
                      ? tx("Estimate · 5 min per waiting party")
                      : tx("Ready to welcome your next guest")
                  }
                  tone="purple"
                />
                <Stat
                  label={tx("Tables ready")}
                  value={called.length}
                  unit={tx("parties")}
                  icon={Bell}
                  note={
                    called.length
                      ? tx("Notified and on their way")
                      : tx("No guests currently called")
                  }
                  tone="blue"
                />
                <Stat
                  label={tx("Seated today")}
                  value={daily
                    .filter((t) => t.status === "served")
                    .reduce((s, t) => s + t.party_size, 0)}
                  unit={tx("people")}
                  icon={UtensilsCrossed}
                  note={tx("{value0} / {value1} seats currently occupied", {
                    value0: occupancy,
                    value1: data.capacity,
                  })}
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
                      <strong>
                        {tx("A little room for a great evening.")}
                      </strong>
                      <p>
                        {reservedSeats >= data.capacity
                          ? tx(
                              "Your dining room is full. Free a table when guests leave.",
                            )
                          : tx(
                              "{value0} seats available in your dining room.",
                              {
                                value0: Math.max(
                                  0,
                                  data.capacity - reservedSeats,
                                ),
                              },
                            )}
                      </p>
                    </div>
                  </div>
                  <div className="occupancy">
                    <span>
                      {tx("Occupancy")}{" "}
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
                    <h2>{tx("Guest queue")}</h2>
                    <span className="count-badge">
                      {n(waiting.length + called.length)}
                    </span>
                  </div>
                  <div>
                    <span className="live-indicator">
                      <i /> {tx("Updated live")}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={tx("Queue actions")}
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
                        {s === "all" ? tx("All guests") : tx(statusLabel[s])}
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
                        aria-label={tx("Search guests")}
                        placeholder={tx("Search guests…")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="select"
                      aria-label={tx("Queue date range")}
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="today">{tx("Today + active")}</option>
                      <option value="all">{tx("All time")}</option>
                    </select>
                  </div>
                </div>
                {visible.length ? (
                  <>
                    <div className="table-header">
                      <span>{tx("GUEST")}</span>
                      <span>{tx("PARTY")}</span>
                      <span>{tx("WAIT TIME")}</span>
                      <span>{tx("STATUS")}</span>
                      <span>{tx("ACTIONS")}</span>
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
                                {t.phone || t.email || tx("Walk-in guest")}
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
                            <strong>{n(t.party_size)}</strong>
                            <span className="mobile-only">{tx("people")}</span>
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
                              {tx("min")}
                            </strong>
                            <small>
                              {tx("Joined")}
                              {time(t.joined_at)}
                            </small>
                          </div>
                          <div className="status-cell">
                            <span className={`status-badge ${t.status}`}>
                              <i />
                              {t.status === "served" && t.released_at
                                ? tx("Completed")
                                : tx(statusLabel[t.status])}
                            </span>
                            {t.status === "notified" && (
                              <small>
                                {data.notifications.some(
                                  (n) =>
                                    n.ticket_id === t.id && n.status === "sent",
                                )
                                  ? tx("Alert sent")
                                  : data.notifications.some(
                                        (n) =>
                                          n.ticket_id === t.id &&
                                          n.status === "failed",
                                      )
                                    ? tx("Delivery failed — contact guest")
                                    : tx("Live status updated")}
                              </small>
                            )}
                          </div>
                          <div className="row-actions">
                            {t.status === "waiting" && (
                              <button
                                className="button call-button"
                                disabled={
                                  busy === t.id ||
                                  reservedSeats + t.party_size > data.capacity
                                }
                                title={
                                  reservedSeats + t.party_size > data.capacity
                                    ? tx("Not enough free seats")
                                    : tx("Call this guest")
                                }
                                onClick={() =>
                                  mutate(t.id, { status: "notified" })
                                }
                              >
                                <Bell size={14} />
                                {tx("Call guest")}
                              </button>
                            )}
                            {t.status === "notified" && (
                              <>
                                <button
                                  className="button seat-button"
                                  disabled={
                                    busy === t.id ||
                                    reservedSeats > data.capacity
                                  }
                                  onClick={() =>
                                    mutate(t.id, { status: "served" })
                                  }
                                >
                                  <Check size={15} />
                                  {tx("Seat guest")}
                                </button>
                                <button
                                  className="icon-button"
                                  title={tx("Return to waiting queue")}
                                  aria-label={tx("Return {value0} to waiting", {
                                    value0: t.name,
                                  })}
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
                                {tx("Free table")}
                              </button>
                            )}
                            <button
                              className="icon-button"
                              title={tx("Edit guest")}
                              aria-label={tx("Edit {value0}", {
                                value0: t.name,
                              })}
                              onClick={() => setForm(t)}
                            >
                              <Pencil size={15} />
                            </button>
                            {["waiting", "notified"].includes(t.status) ? (
                              <button
                                className="icon-button danger"
                                title={tx("Cancel visit")}
                                aria-label={tx("Cancel {value0}", {
                                  value0: t.name,
                                })}
                                onClick={() =>
                                  setConfirm({
                                    title: "Cancel this visit?",
                                    description: tx(
                                      "{name} will be removed from the active queue. Their visit remains in your history.",
                                      { name: t.name },
                                    ),
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
                                title={tx("Delete guest record")}
                                aria-label={tx("Delete {value0}", {
                                  value0: t.name,
                                })}
                                onClick={() =>
                                  setConfirm({
                                    title: "Delete this guest record?",
                                    description:
                                      "This permanently deletes this visit and its notification records. This cannot be undone.",
                                    action: async () => {
                                      await api(
                                        `tickets/${t.id}?branch=${encodeURIComponent(data.branchId)}`,
                                        "DELETE",
                                      );
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
                        ? tx("No guests found.")
                        : filter === "waiting"
                          ? tx("A little calm before the good times.")
                          : tx("Nothing here just yet.")}
                    </h3>
                    <p>
                      {search
                        ? tx("Try another name, phone number, or email.")
                        : filter === "waiting"
                          ? tx(
                              "Your queue is clear. Add a guest or let them scan your QR code.",
                            )
                          : tx(
                              "Guest visits will appear here as your service moves along.",
                            )}
                    </p>
                    {filter === "waiting" && !search && (
                      <button
                        className="button primary"
                        disabled={data.archived}
                        onClick={() => setForm("new")}
                      >
                        <Plus size={16} />
                        {tx("Add your first guest")}
                      </button>
                    )}
                  </div>
                )}
                <div className="panel-footer">
                  <span>
                    {n(visible.length)}{" "}
                    {visible.length === 1 ? tx("party") : tx("parties")}{" "}
                    {tx("shown")}
                  </span>
                  <span>
                    <span className="tiny-dot" />{" "}
                    {tx("A better wait starts with a little care.")}
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
                      <h3>{tx("Skip the clipboard.")}</h3>
                      <p>
                        {tx(
                          "Guests scan, check in, and get on with their evening.",
                        )}
                      </p>
                      <button onClick={() => setQr(true)}>
                        {tx("View check-in QR")}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="insight-card">
                    <span className="icon-tile purple">
                      <ChartNoAxesCombined size={24} />
                    </span>
                    <div>
                      <h3>{tx("Every wait tells a story.")}</h3>
                      <p>
                        {tx(
                          "See your busy hours and make room for better service.",
                        )}
                      </p>
                      <button onClick={() => setTab("analytics")}>
                        {tx("Explore analytics")}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === "customers" && (
            <Customers
              branches={data.branches}
              branchId={data.branchId}
              onBranchChange={selectBranch}
            />
          )}
          {tab === "analytics" && (
            <>
              <Analytics tickets={all} range={Number(range)} avg={avg} />
              {data.branchId === "all" && (
                <section className="panel branch-comparison">
                  <h2>{tx("Branch comparison")}</h2>
                  {data.branches.map((b) => {
                    const visits = all.filter(
                      (t) =>
                        t.branch_id === b.id &&
                        new Date(t.joined_at).getTime() >=
                          Date.now() - Number(range) * 86400000,
                    );
                    return (
                      <div className="branch-item" key={b.id}>
                        <strong>{b.name}</strong>
                        <small>
                          {n(visits.length)} {tx("parties ·")}{" "}
                          {visits.reduce((n, t) => n + t.party_size, 0)}{" "}
                          {tx("guests ·")}
                          {
                            visits.filter((t) => t.status === "served").length
                          }{" "}
                          {tx("seated parties")}
                        </small>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}
          <footer className="dashboard-footer">
            <span>
              {tx("TableQ")}
              <span className="brand-dot">.</span> {tx("A better wait.")}
            </span>
            <span>
              {tx("Made for a warmer welcome")}
              <Leaf size={12} />
            </span>
          </footer>
        </main>
      </div>
      {manageBranches && (
        <Modal
          title={tx("Branches & staff")}
          onClose={() => setManageBranches(false)}
        >
          <BranchManagement
            currentBranch={data.branchId}
            onChanged={async () => {
              await refresh();
            }}
          />
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {tx(toast)}
        </div>
      )}
      {form && (
        <GuestForm
          ticket={form}
          branchId={data.branchId}
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
          title={tx("A warm welcome, one scan away.")}
          onClose={() => setQr(false)}
        >
          <p className="modal-description">
            {tx(
              "Place this QR code at your entrance. Guests can join your queue straight from their phones.",
            )}
          </p>
          <div className="qr-display">
            <div className="qr-restaurant">
              <CompanyLogo
                branchId={data.branchId}
                version={
                  data.branches.find((b) => b.id === data.branchId)
                    ?.logo_version
                }
                name={data.name}
              />
              <strong>{data.name}</strong>
            </div>
            <img
              src={`/api/qr?branch=${encodeURIComponent(data.branchId)}`}
              width="240"
              height="240"
              alt={tx("Scan to join the restaurant queue")}
            />
            <h3>{tx("Scan. Join. Relax.")}</h3>
            <p>{tx("We’ll let you know when your table is ready.")}</p>
            <span className="qr-brand">{tx("Powered by TableQ.")}</span>
          </div>
          <div className="modal-actions">
            <a
              className="button secondary"
              href={`/api/qr?branch=${encodeURIComponent(data.branchId)}`}
              download="tableq-check-in.svg"
            >
              <ArrowDownToLine size={16} />
              {tx("Download QR")}
            </a>
            <a
              className="button primary"
              href={`/check-in?branch=${encodeURIComponent(data.branchId)}`}
              target="_blank"
              rel="noreferrer"
            >
              {tx("Open check-in")}
              <ExternalLink size={15} />
            </a>
          </div>
          <p className="helper">
            {data.appUrl
              ? tx("Your QR uses the configured public app URL.")
              : tx(
                  "For deployment, set APP_URL to your public HTTPS address before printing.",
                )}
          </p>
        </Modal>
      )}
      {confirm && (
        <Modal title={tx(confirm.title)} onClose={() => setConfirm(null)}>
          <p className="modal-description">{tx(confirm.description)}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              {tx("Keep guest")}
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
              {busy === "confirm" ? tx("Working…") : tx("Confirm")}
            </button>
          </div>
        </Modal>
      )}
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
  const { t: tx, locale, n } = usePreferences();

  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{tx(label)}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">
        {n(value)}
        <span>{tx(unit)}</span>
      </div>
      <p>
        <span className={`tiny-dot ${tone}`} />
        {tx(note)}
      </p>
    </div>
  );
}
function GuestForm({
  ticket,
  branchId,
  onClose,
  onSaved,
}: {
  ticket: Ticket | "new";
  branchId: string;
  onClose: () => void;
  onSaved: (result: { token?: string }) => Promise<void>;
}) {
  const { t: tx, locale, n } = usePreferences();

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
    <Modal
      title={initial ? tx("Edit guest") : tx("Add to queue")}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api(
              initial
                ? `tickets/${initial.id}?branch=${encodeURIComponent(branchId)}`
                : `tickets?branch=${encodeURIComponent(branchId)}`,
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
            {tx("Party size")}
            <div className="stepper">
              <Users size={17} />
              <strong>{size}</strong>
              <button
                type="button"
                disabled={size <= 1}
                onClick={() => setSize(size - 1)}
                aria-label={tx("Decrease party size")}
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                disabled={size >= 20}
                onClick={() => setSize(size + 1)}
                aria-label={tx("Increase party size")}
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
            <Star size={16} /> {tx("Priority")}
          </label>
        </div>
        <label>
          {tx("Guest name")}
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tx("Full name")}
          />
        </label>
        <label>
          {tx("Mobile number")}
          <span className="optional">{tx("optional")}</span>
          <input
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
          <small className="helper">
            {tx("Include the country code, without spaces.")}
          </small>
        </label>
        <label>
          {tx("Email")}
          <span className="optional">{tx("optional")}</span>
          <input
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tx("name@example.com")}
          />
        </label>
        <label>
          {tx("Notes")}
          <span className="optional">{tx("private to your team")}</span>
          <textarea
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tx(
              "High chair, accessibility needs, special occasion…",
            )}
            rows={2}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {tx("Guest agrees to receive updates about this visit.")}
        </label>
        {error && (
          <p className="error" role="alert">
            {tx(error)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            {tx("Cancel")}
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? tx("Saving…")
              : initial
                ? tx("Save changes")
                : tx("Add to queue")}
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
  const { t: tx, locale, n } = usePreferences();

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
    label: new Date(2024, 0, 1, i + 10).toLocaleTimeString(locale, {
      hour: "numeric",
    }),
    value: selected
      .filter((t) => new Date(t.joined_at).getHours() === i + 10)
      .reduce((s, t) => s + t.party_size, 0),
  }));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
    (label, i) => ({
      label: new Date(2024, 0, 7 + i).toLocaleDateString(locale, {
        weekday: "short",
      }),
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
      label: i === 3 ? n(7) + "+" : n(i * 2 + 1) + "–" + n(i * 2 + 2),
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
          label={tx("Guests welcomed")}
          value={selected.reduce((s, t) => s + t.party_size, 0)}
          unit={tx("people")}
          icon={Users}
          note={tx("{value0} parties joined", { value0: selected.length })}
          tone="amber"
        />
        <Stat
          label={tx("Average wait")}
          value={average}
          unit={tx("min")}
          icon={Clock}
          note={tx("From check-in to table-ready")}
          tone="purple"
        />
        <Stat
          label={tx("Seating rate")}
          value={
            selected.length
              ? Math.round((served.length / selected.length) * 100)
              : 0
          }
          unit="%"
          icon={CheckCheck}
          note={tx("{value0} parties seated", { value0: served.length })}
          tone="green"
        />
        <Stat
          label={tx("Walk-aways")}
          value={cancelled.length}
          unit={tx("parties")}
          icon={ArrowRight}
          note={tx("Cancelled visits in this period")}
          tone="blue"
        />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{tx("The guest journey")}</h2>
            </div>
            <span className="muted">{tx("Parties")}</span>
          </div>
          <p className="chart-description">
            {tx("From the first hello to a seat at the table.")}
          </p>
          <div className="funnel">
            {[
              { label: "Joined", value: selected.length },
              { label: "Notified", value: notified.length },
              { label: "Seated", value: served.length },
            ].map((s, i) => (
              <div className="funnel-stage" key={s.label}>
                <span>{tx(s.label)}</span>
                <strong>{n(s.value)}</strong>
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
              ? tx("{value0}% of notified parties were seated.", {
                  value0: Math.round((served.length / notified.length) * 100),
                })
              : tx("Your guest journey will appear after your first check-in.")}
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{tx("Demand by hour")}</h2>
            </div>
            <Clock size={16} />
          </div>
          <p className="chart-description">
            {tx("Find your busiest moments. Plan your warmest welcome.")}
          </p>
          <Bars values={hours} suffix={" " + tx("guests")} />
          <div className="chart-note">{tx("Local time · 10 AM to 9 PM")}</div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{tx("Demand by weekday")}</h2>
            </div>
            <CalendarDays size={16} />
          </div>
          <p className="chart-description">{tx("A rhythm to every week.")}</p>
          <Bars values={days} suffix={" " + tx("guests")} />
          <div className="chart-note">
            <span className="tiny-dot amber" />
            {tx("Total guests during the selected period")}
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{tx("Wait by party size")}</h2>
            </div>
            <Users size={16} />
          </div>
          <p className="chart-description">
            {tx("Average minutes from check-in to table-ready.")}
          </p>
          <Bars values={sizes} suffix={" " + tx("min")} />
          <div className="chart-note">
            {tx("Party size · based on notified guests")}
          </div>
        </section>
      </div>
      {!selected.length && (
        <p className="analytics-empty">
          <Sparkles size={16} />
          {tx(
            "Real insights will grow with your queue. No sample data is included.",
          )}
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
  const { n } = usePreferences();
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={values
        .map((v) => `${v.label}: ${n(v.value)}${suffix}`)
        .join(", ")}
    >
      <div className="chart-grid">
        <span>{n(max)}</span>
        <span>{n(Math.round(max / 2))}</span>
        <span>{n(0)}</span>
      </div>
      <div className="bars">
        {values.map((v, i) => (
          <div className="bar-column" key={i}>
            <div className="bar-track">
              <div
                className="bar"
                style={{ height: `${(v.value / max) * 100}%` }}
                title={`${n(v.value)}${suffix}`}
              >
                <span>{v.value > 0 ? n(v.value) : ""}</span>
              </div>
            </div>
            <small>{v.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
