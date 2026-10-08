"use client";
import { usePreferences } from "./preferences";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListOrdered,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import { api, csv } from "../lib/client";
import type { Branch } from "../lib/db";
import type { CustomerRecord } from "../lib/customers";
import {
  dateKey,
  dateBounds,
  datePreset,
  type CustomerDateRange,
} from "../lib/customer-dates";
import { Modal } from "./modal";
const sorting = [
  { value: "name", label: "Customer" },
  { value: "visits", label: "Total visits" },
  { value: "last", label: "Last visit" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];
function initials(name: string) {
  const words = (name.trim() || "?").split(/\s+/);
  return (
    words.length === 1
      ? words[0].slice(0, 2)
      : words
          .slice(0, 2)
          .map((n) => n[0])
          .join("")
  ).toUpperCase();
}
export default function Customers({
  branches,
  branchId,
}: {
  branches: Branch[];
  branchId: string;
  onBranchChange?: (id: string) => void;
}) {
  const { t: tx, locale, n } = usePreferences();

  const [selectedBranch, setSelectedBranch] = useState(branchId);
  const [range, setRange] = useState(() => datePreset("365"));
  const [dateOpen, setDateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("any");
  const [marketing, setMarketing] = useState("any");
  const [sort, setSort] = useState("last");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [rows, setRows] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const version = useRef(0);
  const lastQuery = useRef("");
  const params = () =>
    new URLSearchParams({
      branch: selectedBranch,
      ...dateBounds(range),
      search: query,
      priority,
      marketing,
      sort,
      direction,
    }).toString();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController(),
      id = ++version.current;
    const queryString = params();
    if (lastQuery.current !== queryString) {
      setLoading(true);
      setRows([]);
      lastQuery.current = queryString;
    }
    setError("");
    fetch("/api/customers?" + queryString, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Could not load customers.");
        return data;
      })
      .then((data) => {
        if (id === version.current) setRows(data.customers);
      })
      .catch((e) => {
        if (e.name !== "AbortError" && id === version.current) {
          if (e.message === "Please sign in.")
            window.location.replace("/login");
          else setError(e.message);
        }
      })
      .finally(() => {
        if (id === version.current) setLoading(false);
      });
    return () => {
      controller.abort();
      version.current++;
    };
  }, [
    selectedBranch,
    range,
    query,
    priority,
    marketing,
    sort,
    direction,
    revision,
  ]);
  useEffect(() => {
    const timer = setInterval(() => setRevision((r) => r + 1), 10000);
    return () => clearInterval(timer);
  }, []);
  async function exportCustomers() {
    setExporting(true);
    setError("");
    try {
      const result = await api<{ customers: CustomerRecord[] }>(
        "customers?" + params(),
      );
      csv("tableq-customers.csv", [
        [
          "Name",
          "Phone",
          "Email",
          "Branch",
          "Total visits",
          "Last visit",
          "Had a priority visit",
          "Marketing consent",
          "Notes",
        ],
        ...result.customers.map((c) => [
          c.name,
          c.phone,
          c.email,
          branches.find((b) => b.id === c.branch_id)?.name || c.branch_id,
          c.visits,
          c.last,
          c.priority ? "Yes" : "No",
          c.marketing_consent ? "Granted" : "Not granted",
          c.notes,
        ]),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      className="customer-directory"
      aria-label={tx("Customer directory")}
    >
      <div className="customer-controls">
        <div className="customer-control-row">
          <button
            className="button primary customer-export"
            disabled={exporting || loading || search !== query}
            onClick={exportCustomers}
          >
            <ArrowDownToLine size={18} />
            {exporting ? tx("Exporting…") : tx("Export CSV")}
          </button>
          <button
            className="customer-control customer-date-button"
            onClick={() => setDateOpen(true)}
          >
            <CalendarDays size={18} />
            {tx(range.label)}
            <ChevronDown size={16} />
          </button>
          <label className="customer-control">
            <MapPin size={18} />
            <select
              aria-label={tx("Customer branch")}
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setEditing(null);
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.archived ? tx(" (archived)") : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="customer-control-row">
          <label className="customer-control customer-source">
            <ListOrdered size={18} />
            <select aria-label={tx("Customer visit source")}>
              <option value="queue">{tx("Queue")}</option>
            </select>
          </label>
          <label className="customer-control customer-search">
            <Search size={18} />
            <input
              aria-label={tx("Search customers")}
              placeholder={tx("Search by name or phone")}
              maxLength={200}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="customer-control-row customer-filter-row">
          <label className="customer-control customer-pill">
            <Star size={19} />
            <span>{tx("Priority:")}</span>
            <select
              aria-label={tx("Priority filter")}
              style={{ minWidth: 70 }}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="any">{tx("Any")}</option>
              <option value="yes">{tx("Had a priority visit")}</option>
              <option value="no">{tx("No priority visits")}</option>
            </select>
          </label>
          <label className="customer-control customer-pill">
            <Megaphone size={19} />
            <span>{tx("Marketing consent:")}</span>
            <select
              aria-label={tx("Marketing consent filter")}
              style={{ minWidth: 70 }}
              value={marketing}
              onChange={(e) => setMarketing(e.target.value)}
            >
              <option value="any">{tx("Any")}</option>
              <option value="granted">{tx("Granted")}</option>
              <option value="not-granted">{tx("Not granted")}</option>
            </select>
          </label>
          <span className="customer-match" role="status">
            {loading
              ? tx("Loading customers…")
              : tx(
                  rows.length === 1
                    ? "{count} customer matches"
                    : "{count} customers match",
                  { count: rows.length },
                )}
          </span>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {tx(error)}
        </p>
      )}
      <div className="customer-list">
        <div className="customer-sort-bar">
          <span>{tx("Sort")}</span>
          <div className="customer-sort-select">
            <button
              className="customer-sort-direction"
              aria-label={
                direction === "desc"
                  ? tx("Sort ascending")
                  : tx("Sort descending")
              }
              onClick={() =>
                setDirection((d) => (d === "desc" ? "asc" : "desc"))
              }
            >
              {direction === "desc" ? (
                <ArrowDown size={17} />
              ) : (
                <ArrowUp size={17} />
              )}
            </button>
            <select
              aria-label={tx("Sort customers")}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setDirection(
                  e.target.value === "last" || e.target.value === "visits"
                    ? "desc"
                    : "asc",
                );
              }}
            >
              {sorting.map((s) => (
                <option key={s.value} value={s.value}>
                  {tx(s.label)}
                </option>
              ))}
              <option disabled value="next">
                {tx("Next visit (no bookings)")}
              </option>
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        {!loading &&
          rows.map((c) => (
            <article className="customer-list-row" key={c.id}>
              <button
                className="customer-row-identity"
                onClick={() => setEditing(c)}
                aria-label={tx("View customer {value0}", {
                  value0: c.name || tx("Unnamed customer"),
                })}
              >
                <span
                  className={`customer-avatar customer-color-${c.id.charCodeAt(0) % 5}`}
                >
                  {initials(c.name)}
                </span>
                <strong>{c.name || tx("Unnamed customer")}</strong>
                {c.priority && <Star size={15} className="priority-star" />}
              </button>
              <div className="customer-row-visits">
                <small>{tx("Total visits")}</small>
                <span>{n(c.visits)}</span>
              </div>
              <div className="customer-row-marketing">
                <small>{tx("Marketing")}</small>
                <span>
                  {c.marketing_consent ? <Check size={16} /> : <X size={16} />}{" "}
                  {c.marketing_consent ? tx("Granted") : tx("Not granted")}
                </span>
              </div>
              <button
                className="customer-edit-button"
                onClick={() => setEditing(c)}
                aria-label={tx("Edit customer {value0}", {
                  value0: c.name || tx("Unnamed customer"),
                })}
              >
                <Pencil size={17} />
                {tx("Edit")}
              </button>
              <div className="customer-row-phone">
                <small>{tx("Phone")}</small>
                <span>{c.phone || "—"}</span>
              </div>
              <div className="customer-row-email">
                <small>{tx("Email")}</small>
                <span>{c.email || "—"}</span>
              </div>
            </article>
          ))}
        {loading && (
          <div className="customer-empty">
            <Clock size={25} />
            <p>{tx("Loading your guest directory…")}</p>
          </div>
        )}
        {!loading && !error && !rows.length && (
          <div className="customer-empty">
            <Users size={32} />
            <h3>{tx("No customers match.")}</h3>
            <p>
              {tx(
                "Try changing the date range or filters. Guests appear after check-in.",
              )}
            </p>
          </div>
        )}
      </div>
      {dateOpen && (
        <DatePicker
          range={range}
          onClose={() => setDateOpen(false)}
          onApply={(r) => {
            setRange(r);
            setDateOpen(false);
          }}
        />
      )}
      {editing && (
        <CustomerEditor
          customer={editing}
          range={range}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </section>
  );
}
function DatePicker({
  range,
  onClose,
  onApply,
}: {
  range: CustomerDateRange;
  onClose: () => void;
  onApply: (range: CustomerDateRange) => void;
}) {
  const { t: tx, locale, n } = usePreferences();

  const [draft, setDraft] = useState(range);
  const [month, setMonth] = useState(() => new Date(range.end + "T00:00:00"));
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [error, setError] = useState("");
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function pick(key: string) {
    if (!choosingEnd) {
      setDraft({ start: key, end: key, label: "Custom dates" });
      setChoosingEnd(true);
    } else {
      setDraft({
        start: key < draft.start ? key : draft.start,
        end: key < draft.start ? draft.start : key,
        label: "Custom dates",
      });
      setChoosingEnd(false);
    }
    setError("");
  }
  return (
    <Modal
      title={tx("Customer date range")}
      className="customer-date-dialog"
      onClose={onClose}
    >
      <div className="customer-date-presets">
        {[
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["7", "Last 7 days"],
          ["30", "Last 30 days"],
          ["60", "Last 60 days"],
          ["90", "Last 90 days"],
          ["365", "Last 365 days"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={draft.label === label ? "selected" : ""}
            onClick={() => {
              const r = datePreset(value);
              setDraft(r);
              setMonth(new Date(r.end + "T00:00:00"));
              setChoosingEnd(false);
              setError("");
            }}
          >
            {tx(label)}
          </button>
        ))}
      </div>
      <div className="customer-date-inputs">
        <label>
          {tx("Start date")}
          <input
            type="date"
            value={draft.start}
            onChange={(e) =>
              setDraft({
                ...draft,
                start: e.target.value,
                label: "Custom dates",
              })
            }
          />
        </label>
        <label>
          {tx("End date")}
          <input
            type="date"
            value={draft.end}
            onChange={(e) =>
              setDraft({ ...draft, end: e.target.value, label: "Custom dates" })
            }
          />
        </label>
      </div>
      <div className="customer-calendar-header">
        <button
          aria-label={tx("Previous month")}
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft size={20} />
        </button>
        <strong>
          {month.toLocaleDateString(locale, {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          aria-label={tx("Next month")}
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div
        className="customer-calendar"
        role="group"
        aria-label={tx("Select date range")}
      >
        {Array.from({ length: 7 }, (_, i) =>
          new Date(2024, 0, 8 + i).toLocaleDateString(locale, {
            weekday: "short",
          }),
        ).map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(month.getFullYear(), month.getMonth(), i + 1),
            key = dateKey(date),
            selected = key >= draft.start && key <= draft.end;
          return (
            <button
              key={key}
              aria-label={date.toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              aria-pressed={selected}
              className={`${selected ? "in-range" : ""} ${key === draft.start || key === draft.end ? "endpoint" : ""}`}
              onClick={() => pick(key)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="customer-calendar-help">
        {choosingEnd
          ? tx("Choose the end date.")
          : tx("Choose a preset or select a start and end date.")}
      </p>
      {error && (
        <p className="error" role="alert">
          {tx(error)}
        </p>
      )}
      <div className="customer-editor-footer">
        <button
          className="button primary"
          onClick={() => {
            if (
              !/^\d{4}-\d{2}-\d{2}$/.test(draft.start) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(draft.end) ||
              draft.start > draft.end
            ) {
              setError("Choose a valid start and end date.");
              return;
            }
            onApply({
              ...draft,
              label:
                draft.label === "Custom dates"
                  ? `${draft.start} – ${draft.end}`
                  : draft.label,
            });
          }}
        >
          {tx("Apply")}
        </button>
        <button className="button secondary" onClick={onClose}>
          {tx("Cancel")}
        </button>
      </div>
    </Modal>
  );
}
function CustomerEditor({
  customer,
  range,
  onClose,
  onSaved,
}: {
  customer: CustomerRecord;
  range: CustomerDateRange;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t: tx, locale, n } = usePreferences();

  const [name, setName] = useState(customer.name),
    [phone, setPhone] = useState(customer.phone),
    [email, setEmail] = useState(customer.email),
    [notes, setNotes] = useState(customer.notes),
    [consent, setConsent] = useState(!!customer.marketing_consent);
  const [history, setHistory] = useState(customer.history);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function noShow(id: string) {
    if (
      !window.confirm(
        tx(
          "Mark this called guest as a no-show and release their reserved seats?",
        ),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(
        `tickets/${id}?branch=${encodeURIComponent(customer.branch_id)}`,
        "PATCH",
        { status: "cancelled", noShow: true },
      );
      setHistory((h) =>
        h.map((t) =>
          t.id === id ? { ...t, status: "cancelled", no_show: 1 } : t,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={tx("Customer {value0}", {
        value0: customer.name || tx("Unnamed customer"),
      })}
      className="customer-dialog"
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              `customers/${customer.id}?branch=${encodeURIComponent(customer.branch_id)}`,
              "PATCH",
              { name, phone, email, notes, marketingConsent: consent },
            );
            onSaved();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <div className="customer-editor-fields">
          <h3>{tx("Customer details")}</h3>
          <label>
            {tx("Name (optional)")}
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {tx("Phone (optional)")}
            <input
              type="tel"
              maxLength={20}
              value={phone}
              placeholder={tx("Phone number")}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            {tx("Email (optional)")}
            <input
              type="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="customer-consent-toggle">
            <input
              type="checkbox"
              role="switch"
              aria-label={tx("Marketing consent")}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="customer-switch-track" aria-hidden="true" />
            <span>{tx("Marketing consent")}</span>
            <span
              className="customer-consent-info"
              title={tx(
                "Record consent only when the customer has explicitly agreed to marketing. Queue-update consent is separate.",
              )}
            >
              ⓘ
            </span>
          </label>
          <label>
            {tx("Notes (optional)")}
            <textarea
              rows={4}
              maxLength={1000}
              value={notes}
              placeholder={tx("Internal customer notes")}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {tx(error)}
            </p>
          )}
        </div>
        <section className="customer-activity">
          <h3>{tx("Activity")}</h3>
          <p>
            {tx(range.label)}
            {tx(". Queue visits.")}
          </p>
          <div className="customer-activity-summary">
            <span>
              {tx("Total visits:")}
              <strong>{n(history.length)}</strong>
            </span>
            <span>
              {tx("No-show:")}{" "}
              <strong>{n(history.filter((t) => !!t.no_show).length)}</strong>
            </span>
          </div>
          {history.map((t) => (
            <div className="customer-activity-row" key={t.id}>
              <ListOrdered size={19} />
              <div>
                <strong>
                  {tx("Queue ·")}
                  {t.queue_number}
                </strong>
                <small>
                  {new Date(t.joined_at).toLocaleString(locale, {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  {t.email && <Mail size={15} />}
                  <Users size={15} />
                  {t.party_size}
                  {!!t.priority && <Star size={14} />}
                </small>
              </div>
              <span
                className={`customer-activity-badge ${t.status === "served" ? "showed" : t.no_show ? "no-show" : ""}`}
              >
                {t.status === "served"
                  ? tx("Showed")
                  : t.no_show
                    ? tx("No-show")
                    : t.status === "cancelled"
                      ? tx("Cancelled")
                      : t.status === "notified"
                        ? tx("Table ready")
                        : tx("Waiting")}
              </span>
              {t.status === "notified" && (
                <button
                  type="button"
                  className="customer-no-show"
                  disabled={busy}
                  onClick={() => noShow(t.id)}
                >
                  {tx("Mark no-show")}
                </button>
              )}
            </div>
          ))}
        </section>
        <div className="customer-editor-footer">
          <button className="button primary" disabled={busy}>
            {busy ? tx("Saving…") : tx("Save changes")}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            {tx("Cancel")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
