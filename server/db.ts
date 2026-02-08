import { Database } from "bun:sqlite";

export const db = new Database("canvas.db");

db.run(`
  CREATE TABLE IF NOT EXISTS canvas (
    id TEXT PRIMARY KEY,
    data TEXT
  )
`);
