import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { AuditEvent, Member, Team as TeamT } from "../../lib/types";
import { Avatar, Button, Field, inputClass } from "../../components/ui";

export default function Team() {
  const [team, setTeam] = useState<TeamT | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Workspace · easydraw";
    (async () => {
      try {
        const t = await api.team.get();
        setTeam(t.team);
        setName(t.team.name);
        setMembers(t.members);
        try {
          setAudit(await api.team.audit(100));
        } catch {
          setAudit([]);
        }
      } catch (e) {
        setMsg((e as Error).message);
      }
    })();
  }, []);

  const canEdit = team?.role === "owner" || team?.role === "admin";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      {msg && <div role="status" className="rounded-xl bg-[var(--bg-soft)] px-4 py-2 text-sm">{msg}</div>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
        <h2 className="font-semibold">Name</h2>
        <form
          className="mt-4 flex max-w-sm items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setTeam(await api.team.update({ name: name.trim() }));
              setMsg("Saved");
              setTimeout(() => setMsg(null), 2000);
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <div className="flex-1">
            <Field label="Workspace name">
              <input className={inputClass} value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </Field>
          </div>
          <Button type="submit" disabled={!canEdit || !name.trim() || name.trim() === team?.name}>
            Save
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
        <h2 className="font-semibold">People</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">easydraw has no sign-in, so this workspace is shared by everyone who opens your server. Share individual files with a link instead.</p>
        <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
          {members.map((m) => (
            <li key={m.email} className="flex items-center gap-3 py-2.5">
              <Avatar name={m.name || m.email} color={m.avatarColor} />
              <div className="flex-1">
                <div className="font-medium">{m.name || m.email}</div>
              </div>
              <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-0.5 text-xs capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
        <h2 className="font-semibold">Activity log</h2>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
              <tr>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {audit.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-[var(--fg-muted)]">
                    No activity yet.
                  </td>
                </tr>
              )}
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap py-2 pr-4 text-[var(--fg-muted)]">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 mono text-xs">{a.action}</td>
                  <td className="py-2">{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
