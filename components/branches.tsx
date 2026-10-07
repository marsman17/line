"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/client";
import type { Branch } from "../lib/db";
type Staff = { id: number; email: string; branchIds: string[] };
const blankBranch = {
  name: "",
  address: "",
  capacity: 50,
  openingHours: "",
  archived: false,
};
export default function BranchManagement({
  onChanged,
}: {
  currentBranch: string;
  onChanged: () => Promise<void>;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [mode, setMode] = useState<"branches" | "staff">("branches");
  const [branchEdit, setBranchEdit] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState(blankBranch);
  const [staffEdit, setStaffEdit] = useState<number | null>(null);
  const [staffForm, setStaffForm] = useState({
    email: "",
    password: "",
    branchIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  async function load() {
    const [b, s] = await Promise.all([
      api<{ branches: Branch[] }>("branches"),
      api<{ staff: Staff[] }>("staff"),
    ]);
    setBranches(b.branches);
    setStaff(s.staff);
    setLoaded(true);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      await onChanged();
      setMessage(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="branch-management">
      <div className="branch-mode">
        <button
          className={`button ${mode === "branches" ? "primary" : "secondary"}`}
          onClick={() => setMode("branches")}
        >
          Branches
        </button>
        <button
          className={`button ${mode === "staff" ? "primary" : "secondary"}`}
          onClick={() => setMode("staff")}
        >
          Staff access
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="helper" role="status">
          {message}
        </p>
      )}
      {!loaded && <p className="helper">Loading branches and staff…</p>}
      {mode === "branches" ? (
        <>
          <p className="modal-description">
            Each branch has its own queue, capacity, guest check-in link and QR.
            Archiving preserves visit history.
          </p>
          <div className="branch-list">
            {branches.map((b) => (
              <div className="branch-item" key={b.id}>
                <div>
                  <strong>{b.name}</strong>
                  <small>{b.address}</small>
                  <small>
                    {b.capacity} seats · {b.archived ? "Archived" : "Active"}
                  </small>
                </div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setBranchEdit(b.id);
                    setBranchForm({
                      name: b.name,
                      address: b.address,
                      capacity: b.capacity,
                      openingHours: b.opening_hours,
                      archived: !!b.archived,
                    });
                    setError("");
                    setMessage("");
                  }}
                >
                  Edit branch
                </button>
              </div>
            ))}
          </div>
          <h3>{branchEdit ? "Edit branch" : "Add a branch"}</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () =>
                  api(
                    branchEdit ? "branches/" + branchEdit : "branches",
                    branchEdit ? "PATCH" : "POST",
                    branchForm,
                  ),
                branchEdit
                  ? "Branch updated."
                  : "Branch added. Select it in the workspace to get its QR.",
              );
              if (ok) {
                setBranchEdit(null);
                setBranchForm(blankBranch);
              }
            }}
          >
            <label>
              Branch name
              <input
                required
                maxLength={80}
                value={branchForm.name}
                onChange={(e) =>
                  setBranchForm({ ...branchForm, name: e.target.value })
                }
              />
            </label>
            <label>
              Branch address
              <input
                required
                maxLength={200}
                value={branchForm.address}
                onChange={(e) =>
                  setBranchForm({ ...branchForm, address: e.target.value })
                }
              />
            </label>
            <label>
              Seating capacity
              <input
                required
                type="number"
                min={1}
                max={2000}
                value={branchForm.capacity}
                onChange={(e) =>
                  setBranchForm({
                    ...branchForm,
                    capacity: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Opening hours
              <textarea
                maxLength={500}
                rows={2}
                placeholder="Mon–Fri 12:00–22:00; Sat–Sun 11:00–23:00"
                value={branchForm.openingHours}
                onChange={(e) =>
                  setBranchForm({ ...branchForm, openingHours: e.target.value })
                }
              />
            </label>
            <p className="helper">
              Hours are displayed to guests. Check-in remains open until you
              archive the branch.
            </p>
            {branchEdit && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={branchForm.archived}
                  onChange={(e) =>
                    setBranchForm({ ...branchForm, archived: e.target.checked })
                  }
                />
                Archived · close check-in and preserve history
              </label>
            )}
            <div className="modal-actions">
              {branchEdit && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setBranchEdit(null);
                    setBranchForm(blankBranch);
                  }}
                >
                  Cancel edit
                </button>
              )}
              <button className="button primary" disabled={busy || !loaded}>
                {busy
                  ? "Saving…"
                  : branchEdit
                    ? "Save branch"
                    : "Create branch"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="modal-description">
            Administrators access every branch. Staff can manage only their
            assigned branches. Share initial credentials privately; updating an
            account revokes its existing sessions.
          </p>
          <div className="branch-list">
            {staff.map((s) => (
              <div className="branch-item" key={s.id}>
                <div>
                  <strong>{s.email}</strong>
                  <small>
                    {s.branchIds
                      .map((id) => branches.find((b) => b.id === id)?.name)
                      .join(", ")}
                  </small>
                </div>
                <div className="branch-mode">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setStaffEdit(s.id);
                      setStaffForm({
                        email: s.email,
                        password: "",
                        branchIds: s.branchIds,
                      });
                      setError("");
                      setMessage("");
                    }}
                  >
                    Edit staff
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Remove this staff account and revoke access?",
                        )
                      ) {
                        const ok = await run(
                          () => api("staff/" + s.id, "DELETE"),
                          "Staff access removed.",
                        );
                        if (ok && staffEdit === s.id) {
                          setStaffEdit(null);
                          setStaffForm({
                            email: "",
                            password: "",
                            branchIds: [],
                          });
                        }
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!staff.length && loaded && (
            <p className="helper">No staff accounts yet.</p>
          )}
          <h3>{staffEdit ? "Edit staff access" : "Add staff"}</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const payload = {
                email: staffForm.email,
                branchIds: staffForm.branchIds,
                ...(staffForm.password ? { password: staffForm.password } : {}),
              };
              const ok = await run(
                () =>
                  api(
                    staffEdit ? "staff/" + staffEdit : "staff",
                    staffEdit ? "PATCH" : "POST",
                    payload,
                  ),
                staffEdit ? "Staff access updated." : "Staff account created.",
              );
              if (ok) {
                setStaffEdit(null);
                setStaffForm({ email: "", password: "", branchIds: [] });
              }
            }}
          >
            <label>
              Staff email
              <input
                type="email"
                required
                maxLength={200}
                autoComplete="off"
                value={staffForm.email}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, email: e.target.value })
                }
              />
            </label>
            <label>
              {staffEdit
                ? "New password · leave blank to keep current"
                : "Initial password"}
              <input
                type="password"
                required={!staffEdit}
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                value={staffForm.password}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, password: e.target.value })
                }
              />
            </label>
            <fieldset>
              <legend>Assigned branches · choose at least one</legend>
              {branches.map((b) => (
                <label className="checkbox-label" key={b.id}>
                  <input
                    type="checkbox"
                    checked={staffForm.branchIds.includes(b.id)}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        branchIds: e.target.checked
                          ? [...staffForm.branchIds, b.id]
                          : staffForm.branchIds.filter((id) => id !== b.id),
                      })
                    }
                  />
                  {b.name}
                  {b.archived ? " (archived)" : ""}
                </label>
              ))}
            </fieldset>
            <div className="modal-actions">
              {staffEdit && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setStaffEdit(null);
                    setStaffForm({ email: "", password: "", branchIds: [] });
                  }}
                >
                  Cancel edit
                </button>
              )}
              <button
                className="button primary"
                disabled={busy || !loaded || !staffForm.branchIds.length}
              >
                {busy
                  ? "Saving…"
                  : staffEdit
                    ? "Save staff"
                    : "Create staff account"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
