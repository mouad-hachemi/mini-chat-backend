import { WebSocketServer } from "ws";
import jsonwebtoken from "jsonwebtoken";
import { insertMessage } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";
const rooms = new Map();
let wss = null;

function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

export const initServer = (server) => {
  wss = new WebSocketServer({ server });
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
          insertMessage(content, room_url, ws.user.userId);
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
};
