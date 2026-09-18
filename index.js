import express from "express";
import cors from "cors";
import {
  addRoomMember,
  createRoom,
  createUser,
  getRoomByURL,
  getRoomsByUser,
  getUserByRoom,
  getUserByUsername,
} from "./db.js";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { nanoid } from "nanoid";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

const PORT = 8080;
const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(403).json({ success: false, error: "Please login." });
  }

  jsonwebtoken.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      });
      return res
        .status(403)
        .json({ success: false, error: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
}

function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^https?:\/\/(?:localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$/.test(
          origin,
        )
      ) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by Cors Policy."));
      }
    },
    credentials: true,
  }),
);

const server = createServer(app);

const wss = new WebSocketServer({ server: server });
const rooms = new Map();

wss.on("connection", (ws, req) => {
  console.log("User connected.");

  const cookieHeader = req.headers.cookie;
  const token = getTokenFromCookie(cookieHeader);
  if (!token) return ws.close(4001, "No authentication cookie provided.");

  try {
    const decoded = jsonwebtoken.verify(token, JWT_SECRET);
    ws.user = decoded;
  } catch (error) {
    return ws.close(4003, "Invalid or expired token.");
  }

  ws.on("message", (data, isBinary) => {
    // Handle JOIN_ROOM, SEND_MSG and REC_MSG events.
    const { type, room_url, content } = JSON.parse(data.toString("utf-8"));
    if (!type || !room_url) return ws.send("Invalid request.");

    switch (type) {
      case "JOIN_ROOM": {
        const participants = rooms.get(room_url);
        if (participants) participants.add(ws);
        else rooms.set(room_url, new Set([ws]));
        ws.send(
          JSON.stringify({
            content: `User ${ws.user.username} joined successfuly.`,
          }),
        );
        break;
      }
      case "SEND_MSG": {
        if (!content) return;
        let participants = rooms.get(room_url);
        if (!participants) {
          participants = new Set([ws]);
          rooms.set(room_url, participants);
        } else if (!participants.has(ws)) {
          participants.add(ws);
        }
        const payload = {
          type: "REC_MSG",
          room_url,
          content,
          from: ws.user.username,
          timeStamp: Date.now(),
        };
        participants.forEach((participant) => {
          participant.send(JSON.stringify(payload));
        });
        break;
      }
      case "QUIT_ROOM": {
        // to be implemented.
      }
    }
  });

  ws.on("close", (code, reason) => {
    for (const [roomUrl, participants] of rooms) {
      if (participants.has(ws)) {
        participants.delete(ws);

        if (participants.size === 0) {
          rooms.delete(roomUrl);
        }
      }
    }
    console.log("User disconnected and removed from active room sets.");
  });
});

app.get("/api/v1/", (req, res) => {
  return res.status(200).json({ success: true, message: "Hello, Web" });
});

app.post("/api/v1/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Please provide a username and a password.",
    });
  }

  const user = getUserByUsername(username);
  if (user)
    return res
      .status(400)
      .json({ success: false, error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const row = createUser(username, passwordHash);

    if (!row) {
      return res.status(400).json({
        success: false,
        error: "User couldn't be created.",
      });
    }

    return res.status(201).json({
      success: true,
      message: `User ${username} created successfuly.`,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, error: "Internale error occured." });
  }
});

app.post("/api/v1/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Please provide a valid username and password.",
    });
  }

  const user = getUserByUsername(username);

  if (!user)
    return res.status(404).json({
      success: false,
      error: "No user found.",
    });

  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword)
    return res.status(401).json({
      success: false,
      error: "Incorrect password, please enter the valid one.",
    });

  const token = jsonwebtoken.sign(
    {
      userId: user.id,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res
    .status(200)
    .json({
      success: true,
      message: "Logged in successfuly",
      user: { username },
    });
});

app.post("/api/v1/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  return res
    .status(200)
    .json({ success: true, message: "Successfuly logged out." });
});

app.get("/api/v1/protected", authenticateToken, (req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "You're authenticated.", user: req.user });
});

app.post("/api/v1/create-room", authenticateToken, (req, res) => {
  const url = nanoid();
  const ownerId = req.user.userId;
  try {
    const rows = createRoom(url, ownerId);
    if (!rows)
      return res
        .status(400)
        .json({ success: false, error: "Couldn't create a room." });

    return res.status(201).json({ success: true, url });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal error occured." });
  }
});

app.get("/api/v1/rooms", authenticateToken, (req, res) => {
  const { user } = req;
  try {
    const { roomsJoined, roomsOwned } = getRoomsByUser(user.userId);
    return res
      .status(200)
      .json({ success: true, rooms: roomsJoined.concat(roomsOwned) });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal error occured." });
  }
});

app.get("/api/v1/rooms/:room_url", authenticateToken, (req, res) => {
  const roomURL = req.params.room_url;
  try {
    const roomRow = getRoomByURL(roomURL);
    if (!roomRow)
      return res.status(404).json({ success: false, error: "Room not found." });
    const userRow = getUserByRoom(roomRow.id, req.user.userId);
    if (!userRow && req.user.userId != roomRow.owner_id) {
      addRoomMember(roomRow.id, req.user.userId);
      return res
        .status(201)
        .json({ success: true, message: "Room joined successfuly." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Already in the room." });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, error: "Internal error occured." });
  }
});

server.listen(PORT, "0.0.0.0", (error) => {
  console.log(
    `REST API server currently running at: http://localhost:8080/api/v1`,
  );
});
