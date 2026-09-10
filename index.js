import express from "express";
import { createRoom, createUser, getUserByUsername } from "./db.js";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { nanoid } from "nanoid";

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

const app = express();
app.use(express.json());
app.use(cookieParser());

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
    .json({ success: true, message: "Logged in successfuly" });
});

app.get("/api/v1/protected", authenticateToken, (req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "You're authenticated." });
});

app.get("/api/v1/create-room", authenticateToken, (req, res) => {
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

app.listen(PORT, (error) => {
  console.log(
    `REST API server currently running at: http://localhost:8080/api/v1`,
  );
});
