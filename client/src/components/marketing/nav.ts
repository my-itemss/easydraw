export interface NavItem {
  to: string;
  label: string;
  desc?: string;
  icon?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const REPO_URL = "https://github.com/my-itemss/easydraw";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Product",
    items: [
      { to: "/product", label: "Overview", desc: "Docs and diagrams in one workspace", icon: "layers" },
      { to: "/product/ai-diagrams", label: "AI diagrams", desc: "Prompt in, editable diagram out", icon: "sparkles" },
      { to: "/product/diagram-as-code", label: "Diagram as code", desc: "One small language, four diagram types", icon: "code" },
      { to: "/product/api", label: "Diagramming API", desc: "Render and store diagrams over REST", icon: "terminal" },
      { to: "/product/integrations", label: "Integrations", desc: "CI, MCP, READMEs, Notion, Confluence", icon: "plug" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/diagramgpt", label: "DiagramGPT", desc: "Describe it, get a diagram", icon: "sparkles" },
      { to: "/ai/flowchart-generator", label: "Flowchart generator", icon: "git" },
      { to: "/ai/sequence-diagram-generator", label: "Sequence diagram generator", icon: "list" },
      { to: "/ai/erd-generator", label: "ERD generator", icon: "db" },
      { to: "/ai/architecture-diagram-generator", label: "Architecture diagram generator", icon: "cloud" },
      { to: "/ai/git-diagrammer", label: "Git diagrammer", desc: "GitHub repo to architecture", icon: "github" },
      { to: "/ai/file-to-diagram", label: "File to diagram", desc: "SQL, Terraform, docker-compose", icon: "upload" },
    ],
  },
  {
    label: "Resources",
    items: [
      { to: "/docs", label: "Documentation", desc: "Guides and reference", icon: "doc" },
      { to: "/examples", label: "Examples", desc: "Ready-made diagrams to copy", icon: "canvas" },
      { to: "/docs/syntax-flowchart", label: "Syntax reference", desc: "Flow, architecture, sequence, ERD", icon: "code" },
    ],
  },
];

export const NAV_LINKS: NavItem[] = [
  { to: "/pricing", label: "Pricing" },
  { to: "/enterprise", label: "Enterprise" },
];
