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
      owner_id INTEGER NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rooms_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rooms_url
    ON rooms(room_url);

    CREATE INDEX IF NOT EXISTS idx_rooms_members_room_id
    ON rooms_members(room_id);

    CREATE INDEX IF NOT EXISTS idx_rooms_members_room_user_id
    ON rooms_members(room_id, user_id);

    CREATE INDEX IF NOT EXISTS idx_rooms_members_user_id
    ON rooms_members(user_id);
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

const selectRoomByURLStmt = db.prepare(`
  SELECT id, room_url, owner_id FROM rooms WHERE room_url = ?;
  `);

const selectUsersByRoom = db.prepare(`
  SELECT user_id FROM rooms_members WHERE room_id = ?;
  `);

const selectUserByRoomStmt = db.prepare(`
  SELECT 1 FROM rooms_members WHERE room_id = ? AND user_id = ?;
  `);

const selectRoomsByUserStmt = db.prepare(`
  SELECT rooms.room_url FROM rooms
  INNER JOIN rooms_members ON rooms.id = rooms_members.room_id
  WHERE rooms_members.user_id = ?;
  `);

const selectRoomsByOwnerStmt = db.prepare(`
  SELECT room_url FROM rooms
  WHERE owner_id = ?;
  `);

const insertRoomMemberStmt = db.prepare(`
  INSERT INTO rooms_members (room_id, user_id)
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

export const getRoomByURL = (roomURL) => {
  const row = selectRoomByURLStmt.get(roomURL);
  return row;
};

export const getUsersByRoom = (roomId) => {
  const rows = selectUsersByRoom.all(roomId);
  return rows;
};

export const getUserByRoom = (roomId, userId) => {
  const row = selectUserByRoomStmt.get(roomId, userId);
  return row;
};

export const addRoomMember = (roomId, userId) => {
  const result = insertRoomMemberStmt.run(roomId, userId);
  return result.changes;
};

export const getRoomsByUser = (userId) => {
  const roomsJoined = selectRoomsByUserStmt.all(userId);
  const roomsOwned = selectRoomsByOwnerStmt.all(userId);
  return { roomsJoined, roomsOwned };
};
