import type {
  AiHistoryItem,
  AiResult,
  ApiTokenInfo,
  AuditEvent,
  CanvasElement,
  Comment,
  DiagramType,
  FileContent,
  FileFull,
  FileSummary,
  Folder,
  LinkAccess,
  Member,
  PublicDiagram,
  Role,
  ShareInfo,
  Team,
  Usage,
  User,
  VersionSummary,
} from "./types";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
export const WS_URL = API_URL.replace(/^http/, "ws");

const TOKEN_KEY = "easydraw.token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* private mode */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the easydraw server. Is it running on " + API_URL + "?");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(p: string) => request<T>("GET", p);
const post = <T>(p: string, b?: unknown) => request<T>("POST", p, b ?? {});
const patch = <T>(p: string, b: unknown) => request<T>("PATCH", p, b);
const put = <T>(p: string, b: unknown) => request<T>("PUT", p, b);
const del = <T>(p: string) => request<T>("DELETE", p);

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface OpsBody {
  upsert?: CanvasElement[];
  remove?: string[];
  doc?: string;
  title?: string;
}

export const api = {
  auth: {
    register: (b: { name: string; email: string; password: string }) =>
      post<{ token: string; user: User; teams: Team[] }>("/api/auth/register", b),
    login: (b: { email: string; password: string }) =>
      post<{ token: string; user: User; teams: Team[] }>("/api/auth/login", b),
    logout: () => post<{ ok: true }>("/api/auth/logout"),
    me: () => get<{ user: User; teams: Team[] }>("/api/auth/me"),
    update: (b: { name?: string; password?: string; currentPassword?: string }) =>
      patch<{ user: User }>("/api/auth/me", b),
    switchTeam: (teamId: string) => put<{ user: User }>("/api/me/team", { teamId }),
  },
  files: {
    list: (o: { folderId?: string; q?: string; filter?: "all" | "mine" | "shared" | "recent" | "trash" } = {}) =>
      get<FileSummary[]>("/api/files" + qs(o)),
    create: (b: { title?: string; folderId?: string | null; content?: FileContent } = {}) =>
      post<FileFull>("/api/files", b),
    get: (id: string) => get<FileFull>(`/api/files/${id}`),
    update: (
      id: string,
      b: { title?: string; folderId?: string | null; private?: boolean; trashed?: boolean; content?: FileContent },
    ) => patch<FileSummary>(`/api/files/${id}`, b),
    ops: (id: string, b: OpsBody) => post<{ updatedAt: number }>(`/api/files/${id}/ops`, b),
    duplicate: (id: string) => post<FileFull>(`/api/files/${id}/duplicate`),
    remove: (id: string) => del<{ ok: true }>(`/api/files/${id}`),
    exportUrl: (id: string, format: "json" | "md" | "svg", extra: { figure?: string; theme?: string } = {}) =>
      `${API_URL}/api/files/${id}/export` + qs({ format, ...extra }),
    exportText: async (id: string, format: "json" | "md" | "svg", extra: { figure?: string; theme?: string } = {}) => {
      const headers: Record<string, string> = {};
      const t = tokenStore.get();
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(`${API_URL}/api/files/${id}/export` + qs({ format, ...extra }), { headers });
      if (!res.ok) throw new ApiError(res.status, "Export failed");
      return res.text();
    },
  },
  folders: {
    list: () => get<Folder[]>("/api/folders"),
    create: (b: { name: string; parentId?: string | null }) => post<Folder>("/api/folders", b),
    update: (id: string, b: { name?: string; parentId?: string | null }) => patch<Folder>(`/api/folders/${id}`, b),
    remove: (id: string) => del<{ ok: true }>(`/api/folders/${id}`),
  },
  versions: {
    list: (fileId: string) => get<VersionSummary[]>(`/api/files/${fileId}/versions`),
    create: (fileId: string, label?: string) => post<VersionSummary>(`/api/files/${fileId}/versions`, { label }),
    get: (fileId: string, vid: string) =>
      get<{ version: VersionSummary; content: FileContent }>(`/api/files/${fileId}/versions/${vid}`),
    restore: (fileId: string, vid: string) => post<FileFull>(`/api/files/${fileId}/versions/${vid}/restore`),
  },
  comments: {
    list: (fileId: string) => get<Comment[]>(`/api/files/${fileId}/comments`),
    create: (fileId: string, b: { body: string; anchor?: Comment["anchor"]; parentId?: string | null }) =>
      post<Comment>(`/api/files/${fileId}/comments`, b),
    update: (id: string, b: { resolved?: boolean; body?: string }) => patch<Comment>(`/api/comments/${id}`, b),
    remove: (id: string) => del<{ ok: true }>(`/api/comments/${id}`),
  },
  share: {
    get: (fileId: string) => get<ShareInfo>(`/api/files/${fileId}/share`),
    setLink: (fileId: string, linkAccess: LinkAccess) => put<ShareInfo>(`/api/files/${fileId}/share`, { linkAccess }),
    addMember: (fileId: string, email: string, role: "viewer" | "editor") =>
      post<ShareInfo>(`/api/files/${fileId}/members`, { email, role }),
    removeMember: (fileId: string, userId: string) => del<ShareInfo>(`/api/files/${fileId}/members/${userId}`),
    /** Public */
    open: (token: string) => get<FileFull>(`/api/shared/${token}`),
    ops: (token: string, b: OpsBody) => post<{ updatedAt: number }>(`/api/shared/${token}/ops`, b),
    figureUrl: (token: string, elementId: string, theme: "light" | "dark" = "light") =>
      `${API_URL}/api/shared/${token}/figure/${elementId}.svg?theme=${theme}`,
  },
  team: {
    get: () => get<{ team: Team; members: Member[] }>("/api/team"),
    update: (b: { name?: string; allowedDomain?: string | null }) => patch<Team>("/api/team", b),
    invite: (email: string, role: Exclude<Role, "owner">) => post<{ members: Member[] }>("/api/team/invite", { email, role }),
    setRole: (userId: string, role: Role) => patch<{ members: Member[] }>(`/api/team/members/${userId}`, { role }),
    removeMember: (userId: string) => del<{ members: Member[] }>(`/api/team/members/${userId}`),
    removeInvite: (email: string) => del<{ members: Member[] }>(`/api/team/invites/${encodeURIComponent(email)}`),
    audit: (limit = 100) => get<AuditEvent[]>(`/api/team/audit?limit=${limit}`),
  },
  usage: () => get<Usage>("/api/usage"),
  tokens: {
    list: () => get<ApiTokenInfo[]>("/api/tokens"),
    create: (name: string) => post<{ token: string; info: ApiTokenInfo }>("/api/tokens", { name }),
    remove: (id: string) => del<{ ok: true }>(`/api/tokens/${id}`),
  },
  diagrams: {
    create: (b: {
      text?: string;
      code?: string;
      diagramType: DiagramType;
      theme?: "light" | "dark";
      background?: boolean;
      returnFile?: boolean;
    }) => post<{ id: string; code: string; diagramType: DiagramType; svg?: string; fileUrl: string }>("/api/v1/diagrams", b),
    get: (id: string) => get<PublicDiagram>(`/api/v1/diagrams/${id}`),
    render: (b: { code: string; diagramType: DiagramType; theme?: "light" | "dark"; background?: boolean }) =>
      post<{ svg: string; width: number; height: number }>("/api/v1/render", b),
  },
  ai: {
    diagram: (b: {
      prompt: string;
      diagramType?: DiagramType;
      currentCode?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    }) => post<AiResult>("/api/ai/diagram", b),
    doc: (prompt: string) => post<{ markdown: string; mode: "claude" | "offline" }>("/api/ai/doc", { prompt }),
    repo: (url: string) => post<AiResult>("/api/ai/repo", { url }),
    history: () => get<AiHistoryItem[]>("/api/ai/history"),
  },
};
