import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useApplyTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { api, API_URL } from "../../lib/api";
import { Avatar, Button, Logo, Spinner, ThemeToggle, cx } from "../ui";

function TopBar() {
  const { user, teams, refresh } = useAuth();
  const active = teams.find((t) => t.id === user?.activeTeamId) ?? teams[0];
  const link = ({ isActive }: { isActive: boolean }) =>
    cx("rounded-full px-3 py-1.5 text-sm", isActive ? "bg-[var(--bg-soft)] font-medium" : "text-[var(--fg-muted)] hover:text-[var(--fg)]");
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-5">
        <Logo to="/app" />
        <nav className="ml-4 flex items-center gap-1">
          <NavLink to="/app" end className={link}>
            Files
          </NavLink>
          <NavLink to="/app/team" className={link}>
            Team
          </NavLink>
          <NavLink to="/app/settings" className={link}>
            Settings
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {teams.length > 1 && (
            <select
              aria-label="Workspace"
              value={active?.id}
              onChange={async (e) => {
                await api.auth.switchTeam(e.target.value);
                await refresh();
                window.location.assign("/app");
              }}
              className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-sm"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {teams.length === 1 && <span className="hidden text-sm text-[var(--fg-muted)] sm:inline">{active?.name}</span>}
          <NavLink to="/docs" className="hidden rounded-full px-3 py-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] sm:block">
            Docs
          </NavLink>
          <ThemeToggle />
          {user && <Avatar name={user.name} color={user.avatarColor} />}
        </div>
      </div>
    </header>
  );
}

export default function AppLayout() {
  useApplyTheme();
  const { user, loading, error, refresh } = useAuth();
  const loc = useLocation();
  const inEditor = loc.pathname.startsWith("/app/f/");

  let body;
  if (loading) {
    body = (
      <div className="flex flex-1 items-center justify-center text-[var(--fg-muted)]">
        <Spinner size={24} />
      </div>
    );
  } else if (!user) {
    body = (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Can't reach the easydraw server</h1>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {error ?? "The server did not respond."} The app expects it at <code className="mono">{API_URL}</code>.
          </p>
          <pre className="mono mt-4 rounded-lg bg-[var(--bg-soft)] p-3 text-left text-xs">cd server{"\n"}bun install{"\n"}bun index.ts</pre>
          <Button className="mt-5" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else body = <Outlet />;

  return (
    <div className="ed flex min-h-screen flex-col">
      {!inEditor && user && <TopBar />}
      {body}
    </div>
  );
}
