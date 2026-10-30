import type { DiagramType } from "../types";

export const DIAGRAM_TYPES: { id: DiagramType; label: string; blurb: string }[] = [
  { id: "flowchart", label: "Flow chart", blurb: "Processes, decisions and user journeys" },
  { id: "architecture", label: "Cloud architecture", blurb: "Services, infrastructure and data flow" },
  { id: "sequence", label: "Sequence diagram", blurb: "Messages between systems over time" },
  { id: "erd", label: "Entity relationship", blurb: "Database tables and their relations" },
];

export const samples: Record<DiagramType, string> = {
  flowchart: `title "Sign-up flow"
direction right

Start [shape: oval, color: green]
"Enter email" [icon: mail]
"Valid email?" [shape: diamond, color: yellow]
"Send code" [icon: bolt]
"Verify code" [shape: diamond, color: yellow]
Welcome [shape: oval, color: green]

Start > "Enter email" > "Valid email?"
"Valid email?" > "Send code": yes
"Valid email?" > "Enter email": no
"Send code" > "Verify code"
"Verify code" > Welcome: ok
"Verify code" > "Send code": retry
`,
  architecture: `title "Web application on AWS"
direction right

Users [icon: users, color: gray]
CDN [icon: cdn]

"AWS VPC" [icon: cloud, color: blue] {
  "Load balancer" [icon: loadbalancer]
  "App servers" [icon: server] {
    "API 1" [icon: container]
    "API 2" [icon: container]
  }
  Data [icon: database, color: green] {
    Postgres [icon: database, shape: cylinder]
    Redis [icon: cache]
  }
}

Users > CDN > "Load balancer"
"Load balancer" > "API 1", "API 2"
"API 1" > Postgres: SQL
"API 2" > Postgres: SQL
"API 1" > Redis: cache
"API 2" > Redis: cache
`,
  sequence: `title "Login"
autoNumber on

Browser [icon: monitor]
API [icon: server]
DB [icon: database]

Browser > API: POST /login
activate API
API > DB: find user
DB --> API: user row
alt [label: valid password] {
  API --> Browser: 200 + session token
}
else [label: invalid password] {
  API --> Browser: 401 Unauthorized
}
deactivate API
loop [label: every 30s] {
  Browser > API: heartbeat
}
`,
  erd: `title "Blog schema"

users [icon: user, color: blue] {
  id string pk
  name string
  email string unique
}
posts [icon: file, color: green] {
  id string pk
  authorId string fk
  title string
  body text
  publishedAt timestamp nullable
}
comments [icon: chat, color: orange] {
  id string pk
  postId string fk
  authorId string fk
  body text
}
tags {
  id string pk
  name string
}

posts.authorId > users.id
comments.postId > posts.id
comments.authorId > users.id
posts <> tags
`,
};

export interface Example {
  slug: string;
  title: string;
  description: string;
  diagramType: DiagramType;
  code: string;
}

export const examples: Example[] = [
  {
    slug: "signup-flow",
    title: "Sign-up flow",
    description: "A product onboarding flow with validation and retries.",
    diagramType: "flowchart",
    code: samples.flowchart,
  },
  {
    slug: "aws-web-app",
    title: "Web app on AWS",
    description: "CDN, load balancer, containers and data stores inside a VPC.",
    diagramType: "architecture",
    code: samples.architecture,
  },
  {
    slug: "login-sequence",
    title: "Login sequence",
    description: "Browser, API and database with alt and loop blocks.",
    diagramType: "sequence",
    code: samples.sequence,
  },
  {
    slug: "blog-schema",
    title: "Blog database schema",
    description: "Users, posts, comments and tags with relations.",
    diagramType: "erd",
    code: samples.erd,
  },
  {
    slug: "ci-cd",
    title: "CI/CD pipeline",
    description: "Commit to production with tests, review and rollbacks.",
    diagramType: "flowchart",
    code: `title "CI/CD pipeline"
direction right

Commit [icon: git]
"Run tests" [icon: gear]
"Tests pass?" [shape: diamond, color: yellow]
"Build image" [icon: docker]
Staging [icon: cloud, color: blue]
"Manual approval" [shape: diamond, color: yellow]
Production [icon: cloud, color: green]
Rollback [icon: clock, color: red]

Commit > "Run tests" > "Tests pass?"
"Tests pass?" > "Build image": yes
"Tests pass?" > Commit: no
"Build image" > Staging > "Manual approval"
"Manual approval" > Production: approve
Production > Rollback: errors [color: red]
`,
  },
  {
    slug: "microservices",
    title: "Microservices platform",
    description: "Gateway, services, queue and per-service databases.",
    diagramType: "architecture",
    code: `title "Microservices"
direction down

Client [icon: browser]
Gateway [icon: api]

Services [icon: kubernetes, color: purple] {
  Orders [icon: container]
  Payments [icon: container]
  Inventory [icon: container]
}
Messaging [icon: queue, color: orange] {
  "Event bus" [icon: queue]
}
Storage [icon: database, color: green] {
  "Orders DB" [shape: cylinder]
  "Payments DB" [shape: cylinder]
  "Inventory DB" [shape: cylinder]
}

Client > Gateway
Gateway > Orders, Payments, Inventory
Orders > "Orders DB"
Payments > "Payments DB"
Inventory > "Inventory DB"
Orders > "Event bus": publishes
"Event bus" > Payments, Inventory: consumes
`,
  },
  {
    slug: "oauth",
    title: "OAuth 2.0 code flow",
    description: "Authorization code flow between user, app, auth server and API.",
    diagramType: "sequence",
    code: `title "OAuth 2.0 authorization code"
autoNumber on

User [icon: user]
App [icon: browser]
"Auth server" [icon: lock]
API [icon: server]

User > App: Click "Sign in"
App > "Auth server": Redirect with client_id
"Auth server" > User: Login + consent
User > "Auth server": Approve
"Auth server" --> App: code
App > "Auth server": Exchange code
"Auth server" --> App: access token
App > API: Request + token
API --> App: Protected data
`,
  },
  {
    slug: "ecommerce",
    title: "E-commerce schema",
    description: "Customers, orders, line items and products.",
    diagramType: "erd",
    code: `title "E-commerce"

customers [icon: users, color: blue] {
  id string pk
  name string
  email string unique
}
orders [icon: cart, color: green] {
  id string pk
  customerId string fk
  status string
  createdAt timestamp
}
order_items {
  id string pk
  orderId string fk
  productId string fk
  quantity int
}
products [icon: file, color: orange] {
  id string pk
  name string
  price decimal
}

orders.customerId > customers.id
order_items.orderId > orders.id
order_items.productId > products.id
`,
  },
];
