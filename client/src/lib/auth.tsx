import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Team, User } from "./types";

// easydraw has no sign-in: the server gives every visitor the built-in local user and workspace.
interface AuthCtx {
  user: User | null;
  teams: Team[];
  /** true until the first /me request finishes */
  loading: boolean;
  /** set when the server could not be reached */
  error: string | null;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.auth.me();
      setUser(r.user);
      setTeams(r.teams);
      setError(null);
    } catch (e) {
      setUser(null);
      setTeams([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ user, teams, loading, error, refresh, setUser }), [user, teams, loading, error, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
