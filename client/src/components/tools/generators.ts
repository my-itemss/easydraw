import type { DiagramType } from "../../lib/types";
import type { ToolExample } from "./DiagramTool";

export interface GeneratorConfig {
  slug: string;
  kind: "prompt";
  type: DiagramType;
  title: string;
  h1: string;
  sub: string;
  metaTitle: string;
  placeholder: string;
  examples: ToolExample[];
  faq: { q: string; a: string }[];
}

export const PROMPT_GENERATORS: GeneratorConfig[] = [
  {
    slug: "flowchart-generator",
    kind: "prompt",
    type: "flowchart",
    title: "Flowchart generator",
    h1: "Turn a process into a flowchart",
    sub: "Describe the steps and decisions in plain language. Get a clean, editable flowchart with automatic layout.",
    metaTitle: "Flowchart generator",
    placeholder: "A customer places an order. If payment succeeds, ship it, otherwise email the customer and cancel...",
    examples: [
      { label: "Order fulfilment", prompt: "A customer places an order. If payment succeeds we pack and ship it, otherwise we email the customer and cancel the order." },
      { label: "Bug triage", prompt: "A bug report arrives, we try to reproduce it. If reproducible, assign severity and add to the sprint; if not, ask the reporter for more info." },
      { label: "Password reset", prompt: "User requests a password reset, we send an email link, the user opens the link, enters a new password, we validate strength and save it." },
    ],
    faq: [
      { q: "How do decisions work?", a: "Write them as questions or conditions, for example: 'if payment succeeds, ship it, otherwise cancel'. They become diamond shapes with labelled branches." },
      { q: "Can I change the direction or colours?", a: "Yes. Open the Code tab and add statements such as direction right, or color: green on a step. The syntax reference in the docs lists everything." },
      { q: "Can I use it for swimlanes or large processes?", a: "Groups let you cluster related steps. For very large processes, generate one section at a time and combine them on the canvas." },
    ],
  },
  {
    slug: "sequence-diagram-generator",
    kind: "prompt",
    type: "sequence",
    title: "Sequence diagram generator",
    h1: "Show who talks to whom, and when",
    sub: "Describe an interaction between people or services and get a sequence diagram with lifelines, messages and activation bars.",
    metaTitle: "Sequence diagram generator",
    placeholder: "The browser sends credentials to the API, the API looks up the user in the database and returns a token...",
    examples: [
      { label: "Login flow", prompt: "The browser posts credentials to the API. The API looks up the user in the database, checks the password and returns a token." },
      { label: "Checkout with Stripe", prompt: "The client calls the checkout API, which charges Stripe, saves the order in the database and publishes an event to a queue." },
      { label: "OAuth sign-in", prompt: "User clicks sign in, the app redirects to the identity provider, the user approves, the provider redirects back with a code, and the app exchanges the code for a token." },
    ],
    faq: [
      { q: "Who are the participants?", a: "Anything you name as an actor or service, such as user, browser, API or database, becomes a column. Order follows first mention." },
      { q: "Can it show loops and alternatives?", a: "Yes. Ask for 'retry every 30 seconds' or 'if the password is wrong, return 401' and you will get loop or alt blocks. You can also write them directly in the Code tab." },
      { q: "Can I number the messages?", a: "Add autoNumber on as a line in the code to number every message." },
    ],
  },
  {
    slug: "erd-generator",
    kind: "prompt",
    type: "erd",
    title: "ERD generator",
    h1: "Sketch a database schema in seconds",
    sub: "List the entities and how they relate. Get an entity relationship diagram with primary keys, foreign keys and cardinality.",
    metaTitle: "ERD generator",
    placeholder: "A blog with users, posts, comments and tags. Posts belong to a user and can have many tags...",
    examples: [
      { label: "Blog", prompt: "A blog with users, posts, comments and tags. A post belongs to a user, has many comments and many tags." },
      { label: "Online shop", prompt: "An online shop with customers, orders, order items and products. An order belongs to a customer and has many order items, each pointing to a product." },
      { label: "SaaS teams", prompt: "A SaaS app with teams, users, memberships with a role, projects and invoices. Users belong to many teams through memberships." },
    ],
    faq: [
      { q: "Does it write SQL?", a: "No. It produces an entity relationship diagram. To go the other way, use File to diagram to turn existing CREATE TABLE statements into an ERD." },
      { q: "How are relationships shown?", a: "With crow's-foot style cardinality: many-to-one, one-to-many, one-to-one and many-to-many. Foreign key columns are marked fk." },
      { q: "Can I tweak columns?", a: "Open the Code tab. Each column is a line like 'email string unique required'. The preview updates as you type." },
    ],
  },
  {
    slug: "architecture-diagram-generator",
    kind: "prompt",
    type: "architecture",
    title: "Architecture diagram generator",
    h1: "From description to system architecture",
    sub: "Name the services, data stores and infrastructure. Get an architecture diagram with icons, groups and labelled connections.",
    metaTitle: "Architecture diagram generator",
    placeholder: "A React app behind a CDN calls an API on Kubernetes, which uses Postgres and Redis and publishes jobs to a queue...",
    examples: [
      { label: "Web app on AWS", prompt: "A web app on AWS: CloudFront serves a React frontend from S3, an ALB routes API calls to ECS services in a VPC, which use RDS Postgres and ElastiCache Redis." },
      { label: "Event-driven pipeline", prompt: "Mobile clients send events to an API gateway, a Lambda function validates them and writes to a queue, a worker consumes the queue and stores results in a database." },
      { label: "Kubernetes microservices", prompt: "An ingress routes traffic to an auth service, an orders service and a catalog service on Kubernetes. Orders and catalog use separate Postgres databases, and orders publishes to Kafka." },
    ],
    faq: [
      { q: "Which icons are available?", a: "Generic ones such as server, database, cache, queue, storage, function and loadbalancer, plus vendor names like aws-ec2 or gcp-bigquery that map to the closest match." },
      { q: "Can I group things into a VPC or cluster?", a: "Yes. Mention the boundary in your prompt and the nodes inside become a group. In code, a group is a name followed by braces." },
      { q: "Can I generate this from Terraform instead?", a: "Yes. File to diagram converts .tf files to an architecture diagram directly in your browser, with no AI involved." },
    ],
  },
];

export const GENERATOR_SLUGS = [...PROMPT_GENERATORS.map((g) => g.slug), "git-diagrammer", "file-to-diagram"];
