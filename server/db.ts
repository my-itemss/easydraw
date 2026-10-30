import { Database } from "bun:sqlite";
import type {
  ApiTokenInfo,
  Comment,
  Folder,
  Team,
  User,
  Role,
  VersionSummary,
  FileContent,
  FileSummary,
  CanvasElement,
  LinkAccess,
} from "../client/src/lib/types";

export const DB_PATH = process.env.DB_PATH ?? "canvas.db";
export const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

// ---------- schema ----------
db.run(`CREATE TABLE IF NOT EXISTS canvas (id TEXT PRIMARY KEY, data TEXT)`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  active_team_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  allowed_domain TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_team ON folders(team_id);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  folder_id TEXT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  private INTEGER NOT NULL DEFAULT 0,
  trashed INTEGER NOT NULL DEFAULT 0,
  link_access TEXT NOT NULL DEFAULT 'none',
  share_token TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  preview TEXT,
  last_auto_version_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_team ON files(team_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE TABLE IF NOT EXISTS file_members (
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (file_id, user_id)
);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  auto INTEGER NOT NULL DEFAULT 0,
  author_id TEXT,
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_file ON versions(file_id, created_at);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  parent_id TEXT,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  anchor TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_file ON comments(file_id, created_at);
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_team ON audit_log(team_id, created_at);
CREATE TABLE IF NOT EXISTS diagrams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagram_type TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  diagram_type TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_requests(user_id, created_at);
`);

// ---------- helpers ----------
export const now = () => Date.now();
export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
export const randomHex = (bytes: number) => {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
export const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
export const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

type P = string | number | null | bigint;
export const get = <T>(sql: string, ...p: P[]): T | null => (db.query(sql).get(...p) as T | null) ?? null;
export const all = <T>(sql: string, ...p: P[]): T[] => db.query(sql).all(...p) as T[];
export const run = (sql: string, ...p: P[]) => db.query(sql).run(...p);

// ---------- rows ----------
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  avatar_color: string;
  active_team_id: string;
  created_at: number;
}
export interface TeamRow {
  id: string;
  name: string;
  plan: string;
  allowed_domain: string | null;
  created_at: number;
}
export interface FileRow {
  id: string;
  title: string;
  folder_id: string | null;
  team_id: string;
  owner_id: string;
  private: number;
  trashed: number;
  link_access: LinkAccess;
  share_token: string;
  content: string;
  preview: string | null;
  last_auto_version_at: number;
  created_at: number;
  updated_at: number;
  owner_name?: string;
}

export const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  avatarColor: r.avatar_color,
  activeTeamId: r.active_team_id,
  createdAt: r.created_at,
});

export const toTeam = (r: TeamRow, role: Role): Team => ({
  id: r.id,
  name: r.name,
  plan: "free",
  allowedDomain: r.allowed_domain,
  role,
});

export const teamsForUser = (userId: string): Team[] =>
  all<TeamRow & { role: Role }>(
    `SELECT t.*, m.role AS role FROM teams t JOIN team_members m ON m.team_id = t.id
     WHERE m.user_id = ? AND m.status = 'active' ORDER BY t.created_at`,
    userId,
  ).map((r) => toTeam(r, r.role));

export const teamRole = (teamId: string, userId: string): Role | null =>
  get<{ role: Role }>(
    "SELECT role FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'active'",
    teamId,
    userId,
  )?.role ?? null;

export const toFolder = (r: { id: string; name: string; parent_id: string | null; team_id: string; created_at: number }): Folder => ({
  id: r.id,
  name: r.name,
  parentId: r.parent_id,
  teamId: r.team_id,
  createdAt: r.created_at,
});

export const toVersion = (r: {
  id: string;
  file_id: string;
  label: string;
  auto: number;
  author_name: string;
  created_at: number;
}): VersionSummary => ({
  id: r.id,
  fileId: r.file_id,
  label: r.label,
  auto: !!r.auto,
  authorName: r.author_name,
  createdAt: r.created_at,
});

export const toTokenInfo = (r: {
  id: string;
  name: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
}): ApiTokenInfo => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

export const toComment = (r: {
  id: string;
  file_id: string;
  parent_id: string | null;
  author_id: string;
  author_name: string;
  avatar_color: string;
  body: string;
  anchor: string | null;
  resolved: number;
  created_at: number;
}): Comment => {
  let anchor: Comment["anchor"] = null;
  try {
    anchor = r.anchor ? JSON.parse(r.anchor) : null;
  } catch {
    anchor = null;
  }
  return {
    id: r.id,
    fileId: r.file_id,
    parentId: r.parent_id,
    authorId: r.author_id,
    authorName: r.author_name,
    avatarColor: r.avatar_color,
    body: r.body,
    anchor,
    resolved: !!r.resolved,
    createdAt: r.created_at,
  };
};

export const DEFAULT_CONTENT = (): FileContent => ({ doc: "# Untitled\n", canvas: { elements: [] } });

export function getFile(id: string): FileRow | null {
  return get<FileRow>(
    "SELECT f.*, u.name AS owner_name FROM files f JOIN users u ON u.id = f.owner_id WHERE f.id = ?",
    id,
  );
}

export function parseContent(row: Pick<FileRow, "content">): FileContent {
  try {
    const c = JSON.parse(row.content) as FileContent;
    if (typeof c.doc === "string" && Array.isArray(c.canvas?.elements)) return c;
  } catch {
    /* fallthrough */
  }
  return DEFAULT_CONTENT();
}

export function previewOf(content: FileContent): string | null {
  const d = content.canvas.elements.find((e): e is Extract<CanvasElement, { kind: "diagram" }> => e.kind === "diagram");
  return d ? JSON.stringify({ diagramType: d.diagramType, code: String(d.code ?? "").slice(0, 6000) }) : null;
}

/** Replaces a file's content (and cached preview) and bumps updated_at. */
export function writeContent(fileId: string, content: FileContent, extra: { title?: string } = {}): number {
  const t = now();
  if (extra.title !== undefined) {
    run("UPDATE files SET content = ?, preview = ?, title = ?, updated_at = ? WHERE id = ?", JSON.stringify(content), previewOf(content), extra.title, t, fileId);
  } else {
    run("UPDATE files SET content = ?, preview = ?, updated_at = ? WHERE id = ?", JSON.stringify(content), previewOf(content), t, fileId);
  }
  return t;
}

export function toSummary(r: FileRow, access: FileSummary["access"]): FileSummary {
  let preview: FileSummary["preview"] = null;
  try {
    preview = r.preview ? JSON.parse(r.preview) : null;
  } catch {
    preview = null;
  }
  return {
    id: r.id,
    title: r.title,
    folderId: r.folder_id,
    teamId: r.team_id,
    ownerId: r.owner_id,
    ownerName: r.owner_name ?? "",
    private: !!r.private,
    trashed: !!r.trashed,
    linkAccess: r.link_access,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    preview,
    access,
  };
}

/** Snapshot of the current content. Auto snapshots are pruned to the newest 100 per file. */
export function snapshot(file: FileRow, opts: { auto: boolean; label?: string; authorId?: string | null; authorName?: string }): VersionSummary {
  const id = newId();
  const t = now();
  run(
    "INSERT INTO versions (id, file_id, label, auto, author_id, author_name, content, created_at) VALUES (?,?,?,?,?,?,?,?)",
    id,
    file.id,
    opts.label ?? (opts.auto ? "Auto-save" : ""),
    opts.auto ? 1 : 0,
    opts.authorId ?? null,
    opts.authorName ?? "",
    file.content,
    t,
  );
  if (opts.auto) {
    run("UPDATE files SET last_auto_version_at = ? WHERE id = ?", t, file.id);
    run(
      `DELETE FROM versions WHERE file_id = ? AND auto = 1 AND id NOT IN
       (SELECT id FROM versions WHERE file_id = ? AND auto = 1 ORDER BY created_at DESC, rowid DESC LIMIT 100)`,
      file.id,
      file.id,
    );
  }
  return toVersion({ id, file_id: file.id, label: opts.label ?? (opts.auto ? "Auto-save" : ""), auto: opts.auto ? 1 : 0, author_name: opts.authorName ?? "", created_at: t });
}

export const AUTO_VERSION_MS = 5 * 60 * 1000;
export function maybeAutoVersion(file: FileRow, authorId: string | null, authorName: string) {
  if (now() - file.last_auto_version_at > AUTO_VERSION_MS) snapshot(file, { auto: true, authorId, authorName });
}
