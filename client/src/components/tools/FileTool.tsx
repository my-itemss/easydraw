import { useId, useRef, useState, type DragEvent } from "react";
import { convertToDiagram, detectFileKind, type ImportKind } from "../../lib/convert";
import type { DiagramType } from "../../lib/types";
import { Button, cx } from "../ui";
import ResultPanel, { type ToolResult } from "./ResultPanel";

const KIND_LABEL: Record<ImportKind, string> = { sql: "SQL schema", terraform: "Terraform", compose: "docker-compose" };
const MAX_BYTES = 2 * 1024 * 1024;

interface Converted {
  r: ToolResult;
  warnings: string[];
  kind: ImportKind;
  name: string;
  n: number;
}

const SAMPLES: { label: string; filename: string; text: string }[] = [
  {
    label: "SQL schema",
    filename: "schema.sql",
    text: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES posts(id),
  user_id INT REFERENCES users(id),
  body TEXT NOT NULL
);
`,
  },
  {
    label: "docker-compose",
    filename: "docker-compose.yml",
    text: `services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api
  api:
    build: ./api
    depends_on:
      - db
      - cache
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
  cache:
    image: redis:7
volumes:
  pgdata:
`,
  },
  {
    label: "Terraform",
    filename: "main.tf",
    text: `resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id = aws_vpc.main.id
}

resource "aws_instance" "web" {
  ami       = "ami-0abcdef"
  subnet_id = aws_subnet.public.id
}

resource "aws_db_instance" "db" {
  engine = "postgres"
}

resource "aws_s3_bucket" "assets" {}
`,
  },
];

export default function FileTool() {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const n = useRef(0);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Converted | null>(null);

  function convert(name: string, body: string) {
    setError(null);
    if (!body.trim()) {
      setError("That file is empty.");
      return;
    }
    const kind = detectFileKind(name, body);
    if (!kind) {
      setError("We could not tell what this is. Supported inputs: .sql schema files, Terraform .tf files and docker-compose.yml.");
      setOut(null);
      return;
    }
    try {
      const r = convertToDiagram(kind, body);
      n.current += 1;
      setOut({
        r: { code: r.code, diagramType: r.diagramType as DiagramType, mode: "local" },
        warnings: r.warnings,
        kind,
        name: name || KIND_LABEL[kind],
        n: n.current,
      });
    } catch {
      setError("Something in this file could not be converted. Check that it is complete and try again.");
      setOut(null);
    }
  }

  async function onFile(f: File | undefined | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Try a smaller file or paste the relevant part.");
      return;
    }
    try {
      const body = await f.text();
      setText(body);
      setFilename(f.name);
      convert(f.name, body);
    } catch {
      setError("Could not read that file.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    void onFile(e.dataTransfer.files?.[0]);
  }

  const title = out ? out.name.replace(/\.[^.]+$/, "") || KIND_LABEL[out.kind] : "";

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          "rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-8",
          drag ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8" : "border-[var(--border)] bg-[var(--bg-elev)]",
        )}
      >
        <p className="text-[15px] font-medium">Drop a .sql, .tf or docker-compose.yml file here</p>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">or choose a file, or paste the contents below.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <input
            ref={inputRef}
            id={`${uid}-file`}
            type="file"
            accept=".sql,.tf,.yml,.yaml,.txt,text/plain"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`${uid}-paste`} className="mb-2 block text-sm font-medium">
          Or paste file contents
          {filename && <span className="ml-2 font-normal text-[var(--fg-muted)]">({filename})</span>}
        </label>
        <textarea
          id={`${uid}-paste`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFilename("");
          }}
          rows={8}
          spellCheck={false}
          placeholder={'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email TEXT NOT NULL\n);'}
          className="mono block w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3.5 text-[13px] leading-relaxed outline-none focus:border-[var(--color-brand)]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => convert(filename, text)} disabled={!text.trim()}>
            Convert to diagram
          </Button>
          <span className="text-xs text-[var(--fg-muted)]">Samples:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setText(s.text);
                setFilename(s.filename);
                convert(s.filename, s.text);
              }}
              className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-[13px] text-[var(--fg-muted)] hover:border-[var(--color-brand)] hover:text-[var(--fg)]"
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--fg-muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Private by design: files are parsed entirely in your browser and never uploaded. No AI is involved, so the same input always gives the same diagram.
        </p>
      </div>

      <div className="mt-6" aria-live="polite">
        {error && (
          <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        {out && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--fg-muted)]">
              Detected <strong className="text-[var(--fg)]">{KIND_LABEL[out.kind]}</strong>
              {out.name ? ` in ${out.name}` : ""}.
            </p>
            {out.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">
                  {out.warnings.length} note{out.warnings.length === 1 ? "" : "s"} from the converter
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {out.warnings.slice(0, 12).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {out.warnings.length > 12 && <li>and {out.warnings.length - 12} more</li>}
                </ul>
              </div>
            )}
            <ResultPanel key={out.n} result={out.r} prompt="" title={title} history={[]} allowRefine={false} />
          </div>
        )}
      </div>
    </div>
  );
}
