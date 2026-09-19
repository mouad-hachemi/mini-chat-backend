import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import authRoutes from "./routes/auth.js";
import roomsRoutes from "./routes/rooms.js";
import { authenticateToken } from "./middlewares/authcheck.js";
import { initServer } from "./services/websocket.js";

const PORT = 8080;
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
initServer(server);

app.get("/api/v1/", (req, res) => {
  return res.status(200).json({ success: true, message: "Hello, Web" });
});

app.get("/api/v1/protected", authenticateToken, (req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "You're authenticated.", user: req.user });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/rooms", roomsRoutes);

server.listen(PORT, "0.0.0.0", (error) => {
  console.log(
    `REST API server currently running at: http://localhost:8080/api/v1`,
  );
});
