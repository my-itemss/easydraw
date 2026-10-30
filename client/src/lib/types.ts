// Single source of truth for data shapes shared by the client and the server.
// The server imports these as types only: `import type { ... } from "../client/src/lib/types"`.

export type DiagramType = "flowchart" | "architecture" | "sequence" | "erd";

export type Role = "owner" | "admin" | "member" | "guest";
export type LinkAccess = "none" | "view" | "edit";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  activeTeamId: string;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  plan: "free";
  /** When set, anyone who signs up with this email domain joins the team automatically. */
  allowedDomain: string | null;
  role: Role; // role of the requesting user in this team
}

export interface Member {
  userId: string | null; // null while the invite is pending
  name: string;
  email: string;
  avatarColor: string;
  role: Role;
  status: "active" | "pending";
}

// ---------- canvas content ----------

interface ElBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CanvasElement =
  | (ElBase & { kind: "diagram"; diagramType: DiagramType; code: string; title?: string })
  | (ElBase & { kind: "note"; text: string; color: string })
  | (ElBase & { kind: "text"; text: string; fontSize: number; color: string })
  | (ElBase & {
      kind: "shape";
      shape: "rect" | "ellipse" | "diamond";
      text: string;
      stroke: string;
      fill: string;
    })
  | (ElBase & { kind: "arrow"; x2: number; y2: number; color: string; dashed?: boolean })
  | (ElBase & { kind: "stroke"; points: number[]; color: string; size: number })
  | (ElBase & { kind: "image"; src: string });

export interface CanvasState {
  elements: CanvasElement[];
}

export interface FileContent {
  /** Markdown. A fenced block ```diagram:<elementId> embeds a canvas diagram. */
  doc: string;
  canvas: CanvasState;
}

export interface FileSummary {
  id: string;
  title: string;
  folderId: string | null;
  teamId: string;
  ownerId: string;
  ownerName: string;
  private: boolean;
  trashed: boolean;
  linkAccess: LinkAccess;
  createdAt: number;
  updatedAt: number;
  /** First diagram of the file (code truncated to 6 KB) – used for dashboard thumbnails. */
  preview: { diagramType: DiagramType; code: string } | null;
  /** What the requesting user may do with this file. */
  access: "owner" | "edit" | "view";
}

export interface FileFull extends FileSummary {
  content: FileContent;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  teamId: string;
  createdAt: number;
}

export interface VersionSummary {
  id: string;
  fileId: string;
  label: string;
  auto: boolean;
  authorName: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  fileId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  avatarColor: string;
  body: string;
  /** Where on the canvas / which element the comment is pinned to. */
  anchor: { elementId?: string; x?: number; y?: number } | null;
  resolved: boolean;
  createdAt: number;
}

export interface ShareInfo {
  linkAccess: LinkAccess;
  token: string;
  private: boolean;
  members: { userId: string; name: string; email: string; avatarColor: string; role: "viewer" | "editor" }[];
}

export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string; // first chars, e.g. "ek_1a2b3c4d"
  createdAt: number;
  lastUsedAt: number | null;
}

export interface AuditEvent {
  id: string;
  actorName: string;
  action: string; // e.g. "file.create", "file.delete", "share.update", "member.invite", "token.create", "auth.login"
  target: string;
  createdAt: number;
}

export interface AiResult {
  code: string;
  diagramType: DiagramType;
  explanation: string;
  /** "claude" when ANTHROPIC_API_KEY is configured on the server, otherwise "offline" (rule-based). */
  mode: "claude" | "offline";
}

export interface AiHistoryItem {
  id: string;
  kind: "diagram" | "doc" | "repo";
  prompt: string;
  diagramType: DiagramType | null;
  createdAt: number;
}

export interface Usage {
  files: number;
  members: number;
  aiRequestsThisMonth: number;
  plan: "free";
}

export interface PublicDiagram {
  id: string;
  diagramType: DiagramType;
  code: string;
  createdAt: number;
  updatedAt: number;
}

/** Realtime messages relayed through /ws/file:<id> */
export type RtMessage =
  | { type: "hello"; clientId: string; users: RtUser[] }
  | { type: "presence"; users: RtUser[] }
  | { type: "cursor"; clientId: string; x: number; y: number }
  | { type: "ops"; clientId: string; upsert?: CanvasElement[]; remove?: string[] }
  | { type: "doc"; clientId: string; doc: string }
  | { type: "saved"; clientId: string; updatedAt: number };

export interface RtUser {
  clientId: string;
  name: string;
  color: string;
}
