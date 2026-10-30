import { useCallback, useEffect, useState } from "react";
import { api, API_URL } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import type { ApiTokenInfo, Usage } from "../../lib/types";
import { Button, Field, inputClass, cx } from "../../components/ui";
import { CodeBlock } from "../../components/marketing/parts";

function Card({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-[var(--fg-muted)]">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const { pref, setPref } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ApiTokenInfo[]>([]);
  const [tokenName, setTokenName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([api.tokens.list(), api.usage()]);
      setTokens(t);
      setUsage(u);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);
  useEffect(() => {
    document.title = "Settings · easydraw";
    void load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  };

  const mcp = JSON.stringify(
    { mcpServers: { easydraw: { command: "bun", args: ["/path/to/easydraw/server/mcp/index.ts"], env: { EASYDRAW_API_URL: API_URL, EASYDRAW_API_TOKEN: fresh ?? "ek_your_token" } } } },
    null,
    2,
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {msg && (
        <div role="status" className="rounded-xl bg-[var(--bg-soft)] px-4 py-2 text-sm">
          {msg}
        </div>
      )}

      <Card title="Profile" desc="Your name appears on comments and cursors.">
        <form
          className="flex max-w-sm items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api.auth.update({ name: name.trim() });
              setUser(r.user);
              flash("Saved");
            } catch (err) {
              flash((err as Error).message);
            }
          }}
        >
          <div className="flex-1">
            <Field label="Display name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </Field>
          </div>
          <Button type="submit" disabled={!name.trim() || name.trim() === user?.name}>
            Save
          </Button>
        </form>
      </Card>

      <Card title="Appearance">
        <div className="inline-flex rounded-full border border-[var(--border)] p-1" role="radiogroup" aria-label="Theme">
          {(["light", "dark", "system"] as const).map((p) => (
            <button key={p} role="radio" aria-checked={pref === p} onClick={() => setPref(p)} className={cx("cursor-pointer rounded-full px-4 py-1.5 text-sm capitalize", pref === p ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--fg-muted)]")}>
              {p}
            </button>
          ))}
        </div>
      </Card>

      <Card title="API tokens" desc="Use tokens with the REST API, the CLI and the MCP server. A token is shown only once.">
        <form
          className="flex max-w-md gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!tokenName.trim()) return;
            try {
              const r = await api.tokens.create(tokenName.trim());
              setFresh(r.token);
              setTokenName("");
              await load();
            } catch (err) {
              flash((err as Error).message);
            }
          }}
        >
          <input className={inputClass} placeholder="Token name, e.g. CI" value={tokenName} onChange={(e) => setTokenName(e.target.value)} aria-label="Token name" maxLength={100} />
          <Button type="submit" disabled={!tokenName.trim()}>
            Create
          </Button>
        </form>
        {fresh && (
          <div className="mt-4 rounded-xl border border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)] p-4 text-[#2b2b6b]">
            <div className="text-sm font-medium">Copy your new token now. You won't see it again.</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="mono flex-1 overflow-auto rounded-lg bg-white/70 px-3 py-2 text-xs">{fresh}</code>
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(fresh).then(() => flash("Copied"))}>
                Copy
              </Button>
            </div>
          </div>
        )}
        <ul className="mt-5 divide-y divide-[var(--border)] text-sm">
          {tokens.length === 0 && <li className="py-2 text-[var(--fg-muted)]">No tokens yet.</li>}
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1">
                <div className="font-medium">{t.name}</div>
                <div className="mono text-xs text-[var(--fg-muted)]">
                  {t.prefix}… · created {new Date(t.createdAt).toLocaleDateString()} · {t.lastUsedAt ? `used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => (await api.tokens.remove(t.id), await load())}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Use easydraw from your tools">
        <p className="mb-3 text-sm text-[var(--fg-muted)]">Render a diagram with curl:</p>
        <CodeBlock code={`curl -X POST ${API_URL}/api/v1/render \\\n  -H "Authorization: Bearer ek_your_token" -H "Content-Type: application/json" \\\n  -d '{"code":"A > B > C","diagramType":"flowchart"}'`} />
        <p className="mb-3 mt-6 text-sm text-[var(--fg-muted)]">MCP server config (Claude Desktop, Cursor, VS Code):</p>
        <CodeBlock code={mcp} />
      </Card>

      {usage && (
        <Card title="Usage">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[var(--fg-muted)]">Files</dt>
              <dd className="text-xl font-semibold">{usage.files}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">AI requests this month</dt>
              <dd className="text-xl font-semibold">{usage.aiRequestsThisMonth}</dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}
