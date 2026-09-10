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

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_url VARCHAR(256) NOT NULL UNIQUE,
      owner_id INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    `);
};

initDb();

const insertUserStmt = db.prepare(`
  INSERT INTO users (username, password_hash)
  VALUES (?, ?)
  `);

const selectUserStmt = db.prepare(`
  SELECT id, username, password_hash FROM users WHERE username = ?;
  `);

const insertRoomStmt = db.prepare(`
  INSERT INTO rooms (room_url, owner_id)
  VALUES (?, ?);
  `);

export const createUser = (username, passwordHash) => {
  const results = insertUserStmt.run(username, passwordHash);
  return results.changes;
};

export const getUserByUsername = (username) => {
  const result = selectUserStmt.get(username);
  return result;
};

export const createRoom = (roomUrl, ownerId) => {
  const result = insertRoomStmt.run(roomUrl, ownerId);
  return result.changes;
};
