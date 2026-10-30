// Simple stroke icons on a 24x24 grid, drawn with currentColor-style stroke supplied by the renderer.
const I: Record<string, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  server: '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  cache: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  queue: '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="10" y="6" width="5" height="12" rx="1"/><path d="M18 9l3 3-3 3"/>',
  storage: '<path d="M3 8l2-4h14l2 4v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 8h18M10 12h4"/>',
  bucket: '<path d="M4 6c0 1.4 3.6 2.5 8 2.5S20 7.4 20 6s-3.6-2.5-8-2.5S4 4.6 4 6z"/><path d="M4 6l2 14h12l2-14"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.7 8.4 4.8 4.8 0 0 1 17 18z"/>',
  api: '<path d="M8 8 3 12l5 4M16 8l5 4-5 4M13.5 5l-3 14"/>',
  function: '<path d="M9 4C6 4 6 6 6 8v3c0 1-1 1.5-2 1.5 1 0 2 .5 2 1.5v3c0 2 0 4 3 4M15 4c3 0 3 2 3 4v3c0 1 1 1.5 2 1.5-1 0-2 .5-2 1.5v3c0 2 0 4-3 4"/>',
  lambda: '<path d="M5 20 11 8l2 5M9.5 4h2.5l8 16"/>',
  container: '<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z"/><path d="M12 12 3.5 7M12 12l8.5-5M12 12v9.5"/>',
  docker: '<path d="M3 12h18c0 4-3 7-8 7s-8-2-10-7z"/><path d="M6 8.5h3v3H6zM10 8.5h3v3h-3zM10 5h3v3h-3zM14 8.5h3v3h-3z"/>',
  kubernetes: '<path d="M12 2.5 20 6.5l2 8.5-5.5 6.5h-9L2 15l2-8.5z"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5v4.5M12 14.5V19M6 9l4 2M14 13l4 2M18 9l-4 2M10 13l-4 2"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4.5M12 12 6 17M12 12l6 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m9 12 2 2 4-4"/>',
  firewall: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  git: '<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M6 7.2v9.6M18 11.2c0 4-6 3-11 6"/>',
  github: '<path d="M9 19c-4 1.2-4-2-6-2.5m12 4.5v-3a2.6 2.6 0 0 0-.7-2c3-.3 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.2-.3-3.8 1.4a13 13 0 0 0-7 0C6.6 3.4 5.4 3.7 5.4 3.7a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 3.9 11c0 5.2 3.2 6.4 6.2 6.7a2.6 2.6 0 0 0-.7 2v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5H5l2.5 11h11L21 7H6"/>',
  "credit-card": '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.5" r=".8"/>',
  router: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 13V8M16 13V8M12 13V5"/>',
  loadbalancer: '<rect x="9" y="2.5" width="6" height="5" rx="1"/><rect x="2.5" y="16.5" width="6" height="5" rx="1"/><rect x="15.5" y="16.5" width="6" height="5" rx="1"/><path d="M12 7.5v4.5M12 12H5.5v4.5M12 12h6.5v4.5"/>',
  cdn: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="3.8" r="1.6"/><circle cx="12" cy="20.2" r="1.6"/><circle cx="3.8" cy="12" r="1.6"/><circle cx="20.2" cy="12" r="1.6"/><path d="M12 5.4V9M12 15v3.6M5.4 12H9M15 12h3.6"/>',
  dns: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18" opacity=".5"/>',
  stripe: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15.5 9.5c-.8-.7-2-.9-3-.7-1.3.2-1.8 1.4-1 2.2 1 .9 3.5.8 3.7 2.5.2 1.5-1.6 2.3-3.4 2.1-.9-.1-1.7-.4-2.3-.9"/>',
  slack: '<path d="M9 3v8M15 13v8M3 15h8M13 9h8"/><rect x="4" y="9" width="5" height="0.01"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/><circle cx="12" cy="3.5" r="1"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
};

const ALIAS: Record<string, string> = {
  person: "user",
  phone: "mobile",
  vm: "server",
  ec2: "server",
  compute: "server",
  instance: "server",
  db: "database",
  sql: "database",
  rds: "database",
  dynamodb: "database",
  postgres: "database",
  postgresql: "database",
  mysql: "database",
  mongo: "database",
  mongodb: "database",
  bigquery: "database",
  cosmos: "database",
  redis: "cache",
  memcached: "cache",
  elasticache: "cache",
  s3: "bucket",
  blob: "bucket",
  sqs: "queue",
  sns: "queue",
  pubsub: "queue",
  kafka: "queue",
  eventhub: "queue",
  rabbitmq: "queue",
  lb: "loadbalancer",
  elb: "loadbalancer",
  alb: "loadbalancer",
  "load-balancer": "loadbalancer",
  cloudfront: "cdn",
  route53: "dns",
  vpc: "network",
  subnet: "network",
  lan: "network",
  iam: "key",
  kms: "key",
  secret: "key",
  secrets: "key",
  eks: "kubernetes",
  gke: "kubernetes",
  aks: "kubernetes",
  k8s: "kubernetes",
  pod: "kubernetes",
  ecs: "container",
  gateway: "api",
  apigateway: "api",
  rest: "api",
  graphql: "api",
  web: "browser",
  frontend: "browser",
  backend: "server",
  settings: "gear",
  config: "gear",
  payment: "credit-card",
  payments: "credit-card",
  email: "mail",
  notification: "bell",
  notifications: "bell",
  ai: "bot",
  llm: "bot",
  repo: "git",
  gitlab: "git",
  analytics: "chart",
  graph: "chart",
  security: "shield",
  auth: "lock",
  storage2: "storage",
};

const VENDOR = /^(aws|gcp|google|azure|az|gke|k8s|oci|do|cf)[-_]/i;
const KEYWORDS: [RegExp, string][] = [
  [/ec2|vm|instance|compute|server|host/, "server"],
  [/s3|bucket|blob|object/, "bucket"],
  [/rds|sql|dynamo|database|postgres|mysql|mongo|bigquery|cosmos|spanner|aurora|firestore/, "database"],
  [/lambda|function/, "lambda"],
  [/sqs|sns|queue|pubsub|kafka|eventhub|kinesis|eventbridge/, "queue"],
  [/elb|alb|nlb|lb|loadbalanc/, "loadbalancer"],
  [/cloudfront|cdn/, "cdn"],
  [/route53|dns/, "dns"],
  [/vpc|network|subnet|vnet/, "network"],
  [/iam|kms|secret|key|cognito|auth/, "key"],
  [/k8s|pod|eks|gke|aks|kube/, "kubernetes"],
  [/ecs|fargate|container|docker/, "container"],
  [/redis|memcache|elasticache|cache/, "cache"],
  [/api|gateway/, "api"],
  [/cloudwatch|monitor|log|metric/, "chart"],
  [/waf|firewall|shield/, "firewall"],
];

export function iconNames(): string[] {
  return Object.keys(I);
}

/** Returns the icon's inner SVG markup, or null when unknown (caller decides whether to warn). */
export function resolveIcon(name: string | undefined): { key: string; svg: string } | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (I[n]) return { key: n, svg: I[n] as string };
  const al = ALIAS[n];
  if (al && I[al]) return { key: al, svg: I[al] as string };
  if (VENDOR.test(n)) {
    const rest = n.replace(VENDOR, "");
    for (const [re, k] of KEYWORDS) if (re.test(rest) && I[k]) return { key: k, svg: I[k] as string };
    return { key: "cloud", svg: I.cloud as string };
  }
  for (const [re, k] of KEYWORDS) if (re.test(n) && I[k]) return { key: k, svg: I[k] as string };
  return null;
}

export function iconSvg(name: string | undefined, x: number, y: number, size: number, color: string): string {
  const ic = resolveIcon(name);
  if (!ic) return "";
  const s = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="${(1.7 / s) * s}" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</g>`;
}
