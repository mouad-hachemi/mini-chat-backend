import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const basedir = import.meta.dirname;
const dbFile = path.join(basedir, "app.db");

const db = new DatabaseSync(dbFile);

const initDb = () => {
  db.exec(`
    PRAGMA foreign_key = ON;
    
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(32) NOT NULL UNIQUE,
      password_hash VARCHAR(256) NOT NULL
    );
    `);
};

initDb();

const insertUserStmt = db.prepare(`
  INSERT INTO users (username, password_hash)
  VALUES (?, ?)
  `);

export const createUser = (username, passwordHash) => {
  const results = insertUserStmt.run(username, passwordHash);
  return results.changes;
};
