"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Branch, Manager } from "../lib/db";
import type { ManagedAccount } from "../lib/managers";
import { api } from "../lib/client";
import AccountMenu from "./account-menu";
import BranchManagement from "./branches";
import { Modal } from "./modal";
type Data = { user: Manager; managers: ManagedAccount[]; branches: Branch[] };
const blank = {
  name: "",
  email: "",
  password: "",
  role: "staff" as "admin" | "staff",
  branchIds: [] as string[],
};
export default function CMS() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("accounts");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<ManagedAccount | "new" | null>(null);
  const [form, setForm] = useState(blank);
  const [removing, setRemoving] = useState<ManagedAccount | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<Data>("cms"));
    } catch (e) {
      const message = (e as Error).message;
      if (message === "Please sign in.") window.location.replace("/cms/login");
      else if (message === "CMS administrator access required.")
        setForbidden(true);
      else setError(message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) {
      setEditor(null);
      setRemoving(null);
      setError("");
    }
  };
  if (forbidden)
    return (
      <main className="cms-page">
        <ShieldCheck size={40} />
        <h1>Administrator access required</h1>
        <p>
          Your account can manage assigned restaurant branches. A CMS
          administrator must grant administration access.
        </p>
        <a className="button primary" href="/">
          Back to workspace
        </a>
      </main>
    );
  if (!data)
    return (
      <main className="cms-page">
        <h1>TableQ CMS</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Loading administration…"}
        </p>
        {error && (
          <button className="button secondary" onClick={() => void load()}>
            Retry
          </button>
        )}
      </main>
    );
  const matches = data.managers.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="cms-shell">
      <header className="profile-header">
        <a className="brand" href="/cms">
          <ShieldCheck size={26} />
          TableQ CMS
        </a>
        <a className="button secondary" href="/">
          <ArrowLeft size={16} />
          Restaurant workspace
        </a>
        <AccountMenu />
      </header>
      <main className="cms-page">
        <div className="cms-title">
          <div>
            <span className="eyebrow">ADMINISTRATION</span>
            <h1>Your workspace, managed.</h1>
            <p>
              Create accounts, assign access, and set up restaurant branches.
            </p>
          </div>
          <span className="cms-role">
            <ShieldCheck size={17} />
            CMS administrator
          </span>
        </div>
        <div className="cms-stats">
          <div>
            <Users size={20} />
            <strong>{data.managers.length}</strong>
            <span>Accounts</span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <strong>
              {data.managers.filter((u) => u.role === "admin").length}
            </strong>
            <span>CMS administrators</span>
          </div>
          <div>
            <Building2 size={20} />
            <strong>{data.branches.filter((b) => !b.archived).length}</strong>
            <span>Active branches</span>
          </div>
        </div>
        <nav className="cms-tabs" aria-label="CMS sections">
          <button
            className={tab === "accounts" ? "active" : ""}
            onClick={() => {
              setTab("accounts");
              setError("");
            }}
          >
            <Users size={18} />
            Manager accounts
          </button>
          <button
            className={tab === "branches" ? "active" : ""}
            onClick={() => {
              setTab("branches");
              setError("");
            }}
          >
            <Building2 size={18} />
            Branches
          </button>
        </nav>
        {message && (
          <p role="status" className="cms-success">
            {message}
          </p>
        )}
        {error && !editor && !removing && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        {tab === "branches" ? (
          <section className="cms-panel">
            <h2>Restaurant branches</h2>
            <BranchManagement
              currentBranch={data.branches[0]?.id || "main"}
              branchesOnly
              onChanged={load}
            />
          </section>
        ) : (
          <section className="cms-panel">
            <div className="cms-account-toolbar">
              <label className="cms-search">
                <Search size={18} />
                <input
                  aria-label="Search accounts"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                onClick={() => {
                  setForm(blank);
                  setEditor("new");
                  setError("");
                  setMessage("");
                }}
              >
                <Plus size={17} />
                Add manager account
              </button>
            </div>
            <p className="cms-help">
              Branch managers work only in assigned branches. CMS administrators
              can manage all accounts and every branch.
            </p>
            <div className="cms-account-list">
              {matches.map((u) => (
                <article className="cms-account-row" key={u.id}>
                  <span className="avatar">
                    {u.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="cms-account-identity">
                    <strong>
                      {u.name}
                      {u.id === data.user.id && <small> · You</small>}
                    </strong>
                    <span>{u.email}</span>
                    <small>
                      {u.role === "admin"
                        ? "All branches"
                        : u.branchIds
                            .map(
                              (id) =>
                                data.branches.find((b) => b.id === id)?.name ||
                                id,
                            )
                            .join(", ") || "No assigned branches"}
                    </small>
                  </div>
                  <span className={`cms-account-role ${u.role}`}>
                    {u.role === "admin"
                      ? "CMS administrator"
                      : "Branch manager"}
                  </span>
                  <div className="cms-row-actions">
                    {u.id === data.user.id ? (
                      <a href="/profile" className="button secondary">
                        Your profile
                      </a>
                    ) : (
                      <>
                        <button
                          className="button secondary"
                          aria-label={`Edit ${u.email}`}
                          onClick={() => {
                            setEditor(u);
                            setForm({
                              name: u.name,
                              email: u.email,
                              password: "",
                              role: u.role,
                              branchIds: u.branchIds,
                            });
                            setError("");
                          }}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        <button
                          className="button danger"
                          aria-label={`Remove ${u.email}`}
                          onClick={() => {
                            setRemoving(u);
                            setError("");
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!matches.length && (
              <p className="cms-help">No accounts match your search.</p>
            )}
          </section>
        )}
      </main>
      {editor && (
        <Modal
          title={
            editor === "new" ? "Create manager account" : "Edit manager account"
          }
          onClose={close}
          className="cms-account-dialog"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const payload = {
                name: form.name,
                email: form.email,
                role: form.role,
                branchIds: form.role === "admin" ? [] : form.branchIds,
                ...(form.password ? { password: form.password } : {}),
              };
              if (
                await run(
                  () =>
                    api(
                      editor === "new"
                        ? "cms/managers"
                        : `cms/managers/${editor.id}`,
                      editor === "new" ? "POST" : "PATCH",
                      payload,
                    ),
                  editor === "new"
                    ? "Manager account created. Share the initial password privately."
                    : "Account updated. Previous sessions have been revoked.",
                )
              )
                setEditor(null);
            }}
          >
            <label className="profile-field">
              Manager name
              <input
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="profile-field">
              Manager email
              <input
                type="email"
                required
                maxLength={200}
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="profile-field">
              Account role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as "admin" | "staff",
                  })
                }
              >
                <option value="staff">Branch manager</option>
                <option value="admin">CMS administrator</option>
              </select>
            </label>
            <p className="cms-help">
              {form.role === "admin"
                ? "Full access to the CMS and all branches, including future branches."
                : "Access limited to the branches selected below."}
            </p>
            <label className="profile-field">
              {editor === "new"
                ? "Initial password"
                : "New password (leave blank to keep current)"}
              <input
                aria-label={
                  editor === "new"
                    ? "Initial password"
                    : "New password (leave blank to keep current)"
                }
                type="password"
                required={editor === "new"}
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <small>At least 12 characters.</small>
            </label>
            {form.role === "staff" && (
              <fieldset className="cms-assignments">
                <legend>Assigned branches · choose at least one</legend>
                {data.branches.map((b) => (
                  <label className="checkbox-label" key={b.id}>
                    <input
                      type="checkbox"
                      checked={form.branchIds.includes(b.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          branchIds: e.target.checked
                            ? [...form.branchIds, b.id]
                            : form.branchIds.filter((id) => id !== b.id),
                        })
                      }
                    />
                    {b.name}
                    {b.archived ? " (archived)" : ""}
                  </label>
                ))}
              </fieldset>
            )}
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  busy || (form.role === "staff" && !form.branchIds.length)
                }
              >
                {busy
                  ? "Saving…"
                  : editor === "new"
                    ? "Create account"
                    : "Save account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal title="Remove manager account" onClose={close}>
          <p>
            Remove <strong>{removing.email}</strong> and revoke every active
            session? Their personal settings and feedback will be deleted.
            Restaurant branches, queues, and customers will remain.
          </p>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await run(
                    () => api(`cms/managers/${removing.id}`, "DELETE"),
                    "Manager account removed. Access revoked.",
                  )
                )
                  setRemoving(null);
              }}
            >
              Remove account
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
