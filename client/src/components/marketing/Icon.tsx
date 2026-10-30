import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
  code: <><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M14 4l-4 16" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 01-12 0z" /><path d="M12 17v4" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9l3 3-3 3M13 15h4" /></>,
  git: <><circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="9" r="2.2" /><path d="M6 7.2v9.6M18 11.2c0 4-6 2.5-11 6" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></>,
  canvas: <><rect x="3" y="4" width="18" height="16" rx="3" /><rect x="6.5" y="8" width="4.5" height="3.5" rx="1" /><rect x="13" y="12.5" width="4.5" height="3.5" rx="1" /><path d="M11 9.8h2.5v4" /></>,
  doc: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  bolt: <><path d="M13 3L5 13h6l-1 8 8-10h-6z" /></>,
  cloud: <><path d="M7 18a4.5 4.5 0 01-.5-9A6 6 0 0118 10a4 4 0 01-1 8z" /></>,
  db: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  chevron: <><path d="M6 9l6 6 6-6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  github: <><path d="M9 19c-4 1.2-4-2-6-2.5m12 4.5v-3.2a2.8 2.8 0 00-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1-.3-3.3 1.3a11.4 11.4 0 00-6 0C6.7 3.9 5.7 4.2 5.7 4.2a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 004.3 10.6c0 4.6 2.8 5.6 5.5 6a2.8 2.8 0 00-.8 2.2V22" /></>,
  server: <><rect x="3" y="4" width="18" height="6.5" rx="2" /><rect x="3" y="13.5" width="18" height="6.5" rx="2" /><path d="M7 7.250h.01M7 16.750h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  folder: <><path d="M3 6.5A2.5 2.5 0 015.5 4H10l2 2.5h6.5A2.5 2.5 0 0121 9v8.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M4 18l5-4.5 3.5 3 3-2.5L20 17" /></>,
  link: <><path d="M10 14a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6l-1 1" /><path d="M14 10a4 4 0 00-5.6 0l-3 3a4 4 0 005.6 5.6l1-1" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></>,
  rocket: <><path d="M5 19c-.5-2.5.2-4 2-5.5M13 6c3-3 7-3 8-3 0 1 0 5-3 8l-5 5-5-5z" /><circle cx="15.5" cy="8.5" r="1.2" /><path d="M9 20l-1-4M4 15l4 1" /></>,
  pen: <><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" /><path d="M14.5 6.5l3 3" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 102.5-6M3 4v4.5h4.5" /><path d="M12 8v4.5l3 1.5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
};

export type IconName = keyof typeof paths | (string & {});

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name] ?? null}
    </svg>
  );
}
