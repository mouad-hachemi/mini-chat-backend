import { Router } from "express";
import jsonwebtoken from "jsonwebtoken";
import { createUser, getUserByUsername } from "../db.js";
import bcrypt from "bcrypt";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

router.post("/register", async (req, res) => {
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

router.post("/login", async (req, res) => {
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

  return res.status(200).json({
    success: true,
    message: "Logged in successfuly",
    user: { username },
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  return res
    .status(200)
    .json({ success: true, message: "Successfuly logged out." });
});

export default router;
