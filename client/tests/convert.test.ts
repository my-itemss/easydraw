import { describe, expect, test } from "bun:test";
import { convertToDiagram, detectFileKind } from "../src/lib/convert";
import { renderDiagram } from "../src/lib/engine";

const SQL = `
-- schema
CREATE TABLE IF NOT EXISTS public."users" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE \`posts\` (
  id INT AUTO_INCREMENT,
  user_id INT NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  PRIMARY KEY (id)
) ENGINE=InnoDB;
CREATE TABLE comments (
  id integer primary key,
  post_id integer not null,
  author_id integer,
  CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES public.users (id)
);
CREATE TABLE post_tags (
  post_id int, tag_id int,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_posts_user ON posts(user_id);
COMMENT ON TABLE users IS 'people';
`;

const TF = `
provider "aws" { region = "us-east-1" }
# network
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}
resource "aws_subnet" "public" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "a { brace" }
}
resource "aws_instance" "web" {
  ami       = "ami-123"
  subnet_id = aws_subnet.public.id
  user_data = <<-EOT
    #!/bin/bash
    echo "{ not a block"
  EOT
}
resource "aws_db_instance" "db" {
  vpc_security_group_ids = [aws_security_group.db.id]
  /* multi { line */
}
resource "aws_security_group" "db" {
  vpc_id = aws_vpc.main.id
}
resource "aws_s3_bucket" "assets" {}
resource "aws_lb" "front" {
  subnets = [aws_subnet.public.id]
}
resource "aws_lambda_function" "fn" {
  role = aws_iam_role.r.arn
  environment { variables = { BUCKET = aws_s3_bucket.assets.id } }
}
resource "aws_sqs_queue" "jobs" {}
resource "google_storage_bucket" "gcs" {}
resource "azurerm_virtual_machine" "vm" {}
module "network" {
  source = "./modules/net"
  vpc = aws_vpc.main.id
}
`;

const COMPOSE = `
version: "3.8"
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
      - 443:443
    depends_on:
      - api
    volumes:
      - ./html:/usr/share/nginx/html
  api:
    build: ./api
    ports: ["3000:3000"]
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    links:
      - queue
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
  cache:
    image: redis:7 # comment
  queue:
    image: "rabbitmq:3"
volumes:
  pgdata:
`;

function noErrors(code: string, type: Parameters<typeof renderDiagram>[1]) {
  const r = renderDiagram(code, type);
  expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
}

describe("detectFileKind", () => {
  test("by name", () => {
    expect(detectFileKind("schema.sql", "")).toBe("sql");
    expect(detectFileKind("main.tf", "")).toBe("terraform");
    expect(detectFileKind("docker-compose.yml", "")).toBe("compose");
    expect(detectFileKind("compose.yaml", "")).toBe("compose");
  });
  test("by content", () => {
    expect(detectFileKind("paste.txt", SQL)).toBe("sql");
    expect(detectFileKind("paste.txt", TF)).toBe("terraform");
    expect(detectFileKind("paste.txt", COMPOSE)).toBe("compose");
    expect(detectFileKind("x.txt", "hello")).toBeNull();
  });
});

describe("sql", () => {
  const r = convertToDiagram("sql", SQL);
  test("tables, keys, relationships", () => {
    expect(r.diagramType).toBe("erd");
    expect(r.code).toMatch(/users/);
    expect(r.code).toMatch(/id \w+ pk/);
    expect(r.code).toMatch(/email .*required/);
    expect(r.code).toMatch(/email .*unique/);
    expect(r.code).toMatch(/posts\.user_id > users\.id/);
    expect(r.code).toMatch(/comments\.post_id > posts\.id/);
    expect(r.code).toMatch(/comments\.author_id > users\.id/);
    expect(r.code).toMatch(/post_id .*pk/);
    expect(r.code).not.toMatch(/idx_posts/);
  });
  test("valid", () => noErrors(r.code, "erd"));
});

describe("terraform", () => {
  const r = convertToDiagram("terraform", TF);
  test("nodes and edges", () => {
    expect(r.diagramType).toBe("architecture");
    expect(r.code).toMatch(/aws_instance\.web/);
    expect(r.code).toMatch(/icon: server/);
    expect(r.code).toMatch(/icon: storage/);
    expect(r.code).toMatch(/icon: database/);
    expect(r.code).toMatch(/icon: loadbalancer/);
    expect(r.code).toMatch(/icon: function/);
    expect(r.code).toMatch(/icon: queue/);
    expect(r.code).toMatch(/"aws_instance\.web" > "aws_subnet\.public"/);
    expect(r.code).toMatch(/module\.network/);
    expect(r.code).toMatch(/google_storage_bucket\.gcs/);
  });
  test("valid", () => noErrors(r.code, "architecture"));
});

describe("compose", () => {
  const r = convertToDiagram("compose", COMPOSE);
  test("services and edges", () => {
    expect(r.diagramType).toBe("architecture");
    expect(r.code).toMatch(/icon: database/);
    expect(r.code).toMatch(/icon: cache/);
    expect(r.code).toMatch(/"web" > "api"/);
    expect(r.code).toMatch(/"api" > "db"/);
    expect(r.code).toMatch(/"api" > "cache"/);
    expect(r.code).toMatch(/"api" > "queue"/);
    expect(r.code).toMatch(/80/);
  });
  test("valid", () => noErrors(r.code, "architecture"));
});

test("garbage input does not throw", () => {
  for (const k of ["sql", "terraform", "compose"] as const) {
    const r = convertToDiagram(k, "nothing here {{{ ((");
    expect(typeof r.code).toBe("string");
    expect(r.warnings.length).toBeGreaterThan(0);
  }
});
