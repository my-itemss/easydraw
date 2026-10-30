import type { DiagramType } from "../../client/src/lib/types";

const COMMON = `Syntax rules (all types):
- Comments start with //. Blank lines are free.
- Names containing spaces or reserved characters (> < - : , { } [ ] ") must be wrapped in double quotes.
- Properties go in [key: value, key: value] after a name. Common keys: label, icon, color (blue, green, red, orange, yellow, purple, pink, teal, gray, black, white or hex), shape, link.
- Optional first lines: title "Text"; direction right|down|up|left (flowchart, architecture); colorMode pastel|bold|outline; styleMode shadow|plain; typeface clean|mono|rough; autoNumber on (sequence).
- Icons: user, users, person, browser, monitor, mobile, phone, server, database, cache, queue, storage, bucket, cloud, api, function, lambda, container, docker, kubernetes, network, globe, lock, key, shield, firewall, mail, bell, clock, file, folder, code, git, github, search, chart, gear, cart, credit-card, bolt, cpu, wifi, router, loadbalancer, cdn, dns, stripe, slack, bot. Vendor prefixed names (aws-ec2, gcp-bigquery, azure-vm, k8s-pod) are allowed.`;

const GRAPH = `Grammar (flowchart and architecture share it):
  direction right
  Start [shape: oval, color: green]
  Valid? [shape: diamond, color: yellow]
  Backend [icon: server] {          // group, may nest
    API [icon: aws-lambda]
    DB [shape: cylinder, icon: database, label: "Main DB"]
  }
  Start > Valid?
  Valid? > API: yes
  API > DB: queries
  API <> Cache: reads
  Web --> API: optional call
  Web - API: plain line
  Web -- Metrics: dotted line
  A > B > C            // chain
  A > B, C, D          // branch
- Shapes: rectangle (default), oval, diamond, cylinder, hexagon, document, parallelogram, circle.
- Operators: > arrow, < reverse arrow, <> double arrow, - plain line, -- dotted line, --> dotted arrow. Optional label after ":". Connection properties may follow the label: A > B: text [color: red].
- Node names are unique; a name used only in a connection creates a default node.`;

const GRAMMAR: Record<DiagramType, string> = {
  flowchart: `Diagram type: flowchart (process / decision flow).\n${GRAPH}\nUse oval for start/end, diamond for decisions (label the outgoing edges yes/no).`,
  architecture: `Diagram type: architecture (systems and infrastructure).\n${GRAPH}\nUse groups for boundaries (cloud, VPC, cluster, team), icons on every node, and edge labels for protocols or data flow. Prefer direction right.`,
  sequence: `Diagram type: sequence (messages between actors over time).
Grammar:
  title "Login"
  autoNumber on
  Browser [icon: monitor]
  API [icon: server]
  DB [icon: database]
  Browser > API: POST /login
  activate API
  API > DB: find user
  DB --> API: user row
  alt [label: valid password] {
    API --> Browser: 200 + token
  }
  else [label: invalid] {
    API --> Browser: 401
  }
  deactivate API
  loop [label: every 30s] {
    Browser > API: heartbeat
  }
- Actors are created on first mention or declared with properties. Message: Sender > Receiver: text. Operators: > solid, --> dashed (replies), < , <>, -, --. A > A: text is a self message.
- activate X / deactivate X draw activation bars.
- Blocks: loop, alt (+ else), opt, par (+ and), break, each: type [label: text] { ... }. else/and follow the closing brace of the previous branch. Blocks nest.`,
  erd: `Diagram type: erd (entity relationship diagram).
Grammar:
  users [icon: user, color: blue] {
    id string pk
    email string unique
    teamId string fk
  }
  teams {
    id string pk
    name string
  }
  users.teamId > teams.id     // many-to-one
  teams < users                // one-to-many (entity level)
  users <> roles               // many-to-many
  posts - drafts               // one-to-one
- Attribute line: name type flags. Type and flags are optional. Flags: pk, fk, unique, nullable, required.
- Relationship: source > target, < , -, <>, optionally with entity.attribute paths and a ": label".`,
};

export function systemPrompt(type: DiagramType): string {
  return `You are the diagram engine of easydraw, a diagram-as-code tool. You write diagrams in easydraw's small text DSL.

${GRAMMAR[type]}

${COMMON}

Reply with ONLY the diagram code, no markdown fences, no commentary. Keep diagrams focused: roughly 5 to 20 nodes. When the user supplies current code, modify it according to their request and return the complete updated code.`;
}

export const EXPLAIN_SUFFIX = "";

export const DOC_SYSTEM = `You write concise technical design documents in Markdown. Structure: a top-level title, then sections Overview, Goals, Non-goals, Background, Design (with subsections as useful), Alternatives considered, Risks, Open questions, Rollout / milestones. Use short paragraphs and bullet lists. Where a diagram would help, add a placeholder line like "_Diagram: <what it shows>_". Reply with ONLY the markdown.`;

/** Picks a diagram type from free text (used when the caller did not specify one). */
export function pickType(prompt: string): DiagramType {
  const p = prompt.toLowerCase();
  if (/\b(sequence|handshake)\b/.test(p) || /\b(flow of requests?|requests? flow|request flow|calls? between|messages? between|interaction between|between (the )?(services|client|server|api))\b/.test(p)) return "sequence";
  if (/\b(erd|er diagram|entity|entities|schema|tables?|database design|data model)\b/.test(p)) return "erd";
  if (/\b(architecture|infrastructure|aws|gcp|azure|cloud|vpc|kubernetes|k8s|microservices?|deployment|terraform)\b/.test(p)) return "architecture";
  return "flowchart";
}
