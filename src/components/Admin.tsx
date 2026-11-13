"use client";
import { useEffect, useState } from "react";
import { apiFetch, type ApiError } from "./api";
import CloseButton from "./CloseButton";
import { Empty, ErrorBox, Loading } from "./States";
import { useToast } from "./Toast";
import { useData } from "./useData";

type Row = {
  id: string; email: string; name: string | null; role: "user" | "admin"; status: "active" | "suspended";
  email_verified: boolean; created_at: string; last_login_at: string | null; plan: "free" | "pro";
  comp_plan: "pro" | null; comp_until: string | null; comp_note: string | null;
  sub_status: string | null; sub_interval: string | null; sub_amount_minor: number | null; sub_currency: string | null;
  sub_period_end: string | null; sub_ends_at: string | null; tx_count: number;
};
type Users = { items: Row[]; total: number; page: number; pageSize: number };
type Stats = {
  users: number; active: number; suspended: number; verified: number; signups7: number; signups30: number;
  pro: number; paying: number; trialing: number; pastDue: number; comp: number; cancelling: number;
  mrr: { currency: string; amount_minor: number }[]; signupsByDay: { day: string; n: number }[];
};
type Event = { id: number; admin_email: string; user_email: string; action: string; detail: string | null; created_at: string };

const FILTERS = [
  { id: "all", label: "All" }, { id: "paying", label: "Paying" }, { id: "trial", label: "Trial" }, { id: "comp", label: "Free Pro" },
  { id: "free", label: "Free" }, { id: "suspended", label: "Suspended" }, { id: "admin", label: "Admins" },
] as const;

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return d < 1 ? "today" : d < 2 ? "yesterday" : d < 60 ? `${Math.floor(d)} days ago` : day(iso);
};
const money = (minor: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${cur}`;
  }
};

function planLabel(r: Row): { text: string; tone: string } {
  if (r.sub_status === "past_due") return { text: "Pro · payment due", tone: "warn" };
  if (r.sub_status === "trialing") return { text: "Pro · trial", tone: "income" };
  if (r.sub_status === "active") return { text: `Pro · ${r.sub_interval === "year" ? "yearly" : "monthly"}`, tone: "income" };
  if (r.plan === "pro") return { text: "Pro · free", tone: "remittance" };
  return { text: "Free", tone: "" };
}

export default function Admin({ me }: { me: string }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const sp = new URLSearchParams({ filter, page: String(page) });
  if (query) sp.set("q", query);
  const users = useData<Users>(`/api/admin/users?${sp}`);
  const stats = useData<{ stats: Stats; events: Event[] }>("/api/admin/stats");
  const reloadAll = () => { users.reload(); stats.reload(); };
  const s = stats.data?.stats;
  const maxDay = Math.max(1, ...(s?.signupsByDay.map((d) => d.n) ?? [1]));
  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize)) : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">Accounts, plans and revenue. You can manage accounts here, but you can&apos;t see anyone&apos;s money.</p>
        </div>
      </div>

      {stats.error ? <ErrorBox message={stats.error} onRetry={stats.reload} /> : (
        <div className="grid kpis admin-kpis">
          <div className="card kpi">
            <div className="label"><span>Accounts</span></div>
            <div className="value">{s ? s.users : "…"}</div>
            <div className="sub">{s ? `${s.signups7} new this week · ${s.signups30} this month` : ""}</div>
          </div>
          <div className="card kpi income">
            <div className="label"><span>Pro</span></div>
            <div className="value">{s ? s.pro : "…"}</div>
            <div className="sub">{s ? `${s.paying} paying · ${s.trialing} on trial · ${s.comp} free` : ""}</div>
          </div>
          <div className="card kpi">
            <div className="label"><span>Monthly revenue</span></div>
            <div className="value">{s ? (s.mrr.length ? s.mrr.map((m) => money(m.amount_minor, m.currency)).join(" + ") : money(0, "USD")) : "…"}</div>
            <div className="sub">{s ? `Yearly plans count as a twelfth${s.cancelling ? ` · ${s.cancelling} cancelling` : ""}${s.pastDue ? ` · ${s.pastDue} payment due` : ""}` : ""}</div>
          </div>
          <div className="card kpi">
            <div className="label"><span>Sign-ups, last 30 days</span></div>
            <div className="spark" aria-hidden="true">
              {s?.signupsByDay.map((d) => <span key={d.day} title={`${d.day}: ${d.n}`} style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%`, opacity: d.n ? 1 : 0.35 }} />)}
            </div>
            <div className="sub">{s ? `${s.verified} of ${s.users} confirmed their email${s.suspended ? ` · ${s.suspended} suspended` : ""}` : ""}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="admin-toolbar">
          <input type="search" placeholder="Search email or name…" aria-label="Search accounts" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="seg" role="group" aria-label="Filter accounts">
            {FILTERS.map((f) => (
              <button key={f.id} className={filter === f.id ? "on" : ""} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label}</button>
            ))}
          </div>
        </div>
        {users.error ? <ErrorBox message={users.error} onRetry={users.reload} /> : users.loading && !users.data ? <Loading rows={6} /> : !users.data?.items.length ? (
          <Empty icon="👤" title="No accounts match"><p>Try another search or filter.</p></Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="tx admin-users">
                <thead><tr><th>Account</th><th>Plan</th><th>Joined</th><th>Last sign-in</th><th className="amt">Entries</th></tr></thead>
                <tbody>
                  {users.data.items.map((r) => {
                    const p = planLabel(r);
                    return (
                      <tr key={r.id} onClick={() => setOpen(r)} style={{ cursor: "pointer" }}>
                        <td>
                          <button type="button" className="btn ghost sm admin-email" onClick={(e) => { e.stopPropagation(); setOpen(r); }}>{r.email}</button>
                          <div className="small muted">
                            {r.name ?? ""}{r.role === "admin" && <span className="pill" style={{ marginLeft: r.name ? 6 : 0 }}>Admin</span>}
                            {r.status === "suspended" && <span className="pill expense" style={{ marginLeft: 6 }}>Suspended</span>}
                            {!r.email_verified && <span className="pill" style={{ marginLeft: 6 }}>Email not confirmed</span>}
                          </div>
                        </td>
                        <td><span className={`pill ${p.tone}`}>{p.text}</span></td>
                        <td className="small muted nowrap">{day(r.created_at)}</td>
                        <td className="small muted nowrap">{ago(r.last_login_at)}</td>
                        <td className="amt num">{r.tx_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="admin-pager small muted">
              <span>{users.data.total} {users.data.total === 1 ? "account" : "accounts"}</span>
              {pages > 1 && (
                <span>
                  <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>{" "}
                  Page {page} of {pages}{" "}
                  <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent admin actions</h2>
        {!stats.data?.events.length ? <p className="small muted" style={{ marginTop: 8 }}>Nothing yet.</p> : (
          <ul className="admin-log">
            {stats.data.events.map((e) => (
              <li key={e.id}>
                <span className="small muted nowrap">{day(e.created_at)}</span>
                <span><b>{e.admin_email}</b> {e.action} <b>{e.user_email}</b>{e.detail ? <span className="muted"> ({e.detail})</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <UserModal row={open} self={open.id === me} onClose={() => setOpen(null)} onChanged={(close) => { reloadAll(); if (close) setOpen(null); }} />}
    </>
  );
}

function UserModal({ row, self, onClose, onChanged }: { row: Row; self: boolean; onClose: () => void; onChanged: (close: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [r, setR] = useState(row);
  const [compUntil, setCompUntil] = useState(row.comp_until ? row.comp_until.slice(0, 10) : "");
  const [compNote, setCompNote] = useState(row.comp_note ?? "");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const p = planLabel(r);
  const comp = r.comp_plan === "pro" && (!r.comp_until || new Date(r.comp_until).getTime() > Date.now());

  async function patch(body: Record<string, unknown>, done: string, local: Partial<Row>) {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/users/${r.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setR({ ...r, ...local });
      toast(done, "ok");
      onChanged(false);
    } catch (e) {
      const a = e as ApiError;
      setErr(a.fields ? Object.values(a.fields).flat()[0] ?? a.message : a.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/users/${r.id}`, { method: "DELETE", body: JSON.stringify({ confirmEmail: confirm }) });
      toast(`Deleted ${r.email}`, "ok");
      onChanged(true);
    } catch (e) {
      setErr((e as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="au-title">
        <div className="modal-head">
          <h2 id="au-title" style={{ overflowWrap: "anywhere" }}>{r.email}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <dl className="admin-facts">
          <dt>Name</dt><dd>{r.name || "—"}</dd>
          <dt>Plan</dt><dd><span className={`pill ${p.tone}`}>{p.text}</span></dd>
          {r.sub_status && (
            <>
              <dt>Subscription</dt>
              <dd>
                {r.sub_status}{r.sub_amount_minor != null && r.sub_currency ? `, ${money(r.sub_amount_minor, r.sub_currency)} a ${r.sub_interval === "year" ? "year" : "month"}` : ""}
                {r.sub_ends_at ? `, ends ${day(r.sub_ends_at)}` : r.sub_period_end && r.sub_status !== "canceled" ? `, renews ${day(r.sub_period_end)}` : ""}
              </dd>
            </>
          )}
          <dt>Joined</dt><dd>{day(r.created_at)}</dd>
          <dt>Last sign-in</dt><dd>{ago(r.last_login_at)}</dd>
          <dt>Email</dt><dd>{r.email_verified ? "Confirmed" : "Not confirmed"}</dd>
          <dt>Entries</dt><dd>{r.tx_count} transactions</dd>
        </dl>

        {self ? <p className="small muted">This is your account. Change your own password in Settings.</p> : (
          <>
            <h3 className="admin-h3">Free Pro</h3>
            <p className="small muted">{comp ? `Pro is free for this account${r.comp_until ? ` until ${day(r.comp_until)}` : ""}${r.comp_note ? ` (${r.comp_note})` : ""}.` : "Give Pro without a subscription, for a friend, a tester or a refund."}</p>
            <div className="form-grid">
              <label className="field">Until (empty for no end)
                <input type="date" value={compUntil} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCompUntil(e.target.value)} />
              </label>
              <label className="field">Note
                <input maxLength={200} placeholder="e.g. Beta tester" value={compNote} onChange={(e) => setCompNote(e.target.value)} />
              </label>
            </div>
            <div className="row-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <button className="btn primary sm" disabled={busy} onClick={() => patch({ comp: { until: compUntil || null, note: compNote.trim() || null } }, comp ? "Free Pro updated" : "Pro given",
                { comp_plan: "pro", comp_until: compUntil ? `${compUntil}T23:59:59Z` : null, comp_note: compNote.trim() || null, plan: "pro" })}>
                {comp ? "Save" : "Give Pro"}
              </button>
              {comp && <button className="btn sm" disabled={busy} onClick={() => patch({ comp: null }, "Free Pro removed", { comp_plan: null, comp_until: null, comp_note: null, plan: r.sub_status && ["trialing", "active", "past_due"].includes(r.sub_status) ? "pro" : "free" })}>Remove free Pro</button>}
            </div>

            <h3 className="admin-h3">Account</h3>
            <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              {r.status === "active"
                ? <button className="btn sm" disabled={busy} onClick={() => patch({ status: "suspended" }, "Suspended. They're signed out and can't sign in.", { status: "suspended" })}>Suspend</button>
                : <button className="btn sm" disabled={busy} onClick={() => patch({ status: "active" }, "Reactivated", { status: "active" })}>Reactivate</button>}
              <button className="btn sm" disabled={busy} onClick={() => patch({ signOut: true }, "Signed out on every device", {})}>Sign out everywhere</button>
              {r.role === "admin"
                ? <button className="btn sm" disabled={busy} onClick={() => patch({ role: "user" }, "No longer an admin", { role: "user" })}>Remove admin</button>
                : <button className="btn sm" disabled={busy} onClick={() => patch({ role: "admin" }, "Now an admin", { role: "admin" })}>Make admin</button>}
              {!deleting && <button className="btn sm danger" disabled={busy} onClick={() => setDeleting(true)}>Delete account…</button>}
            </div>
            {deleting && (
              <div className="alert error" style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 8px" }}>This deletes the account and all of its data for good.{r.sub_status && ["trialing", "active", "past_due"].includes(r.sub_status) ? " It doesn't cancel their Paddle subscription; cancel that in Paddle first." : ""} Type <b>{r.email}</b> to confirm.</p>
                <input aria-label="Email to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" style={{ width: "100%" }} />
                <div className="row-actions" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={() => { setDeleting(false); setConfirm(""); }}>Cancel</button>
                  <button className="btn sm danger" disabled={busy || confirm.trim().toLowerCase() !== r.email} onClick={remove}>Delete for good</button>
                </div>
              </div>
            )}
          </>
        )}
        {err && <div className="alert error" style={{ marginTop: 12 }} role="alert">{err}</div>}
      </div>
    </div>
  );
}
