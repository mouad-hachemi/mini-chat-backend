import express from "express";
import { createUser } from "./db.js";
import bcrypt from "bcrypt";

const PORT = 8080;

const app = express();
app.use(express.json());

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

app.listen(PORT, (error) => {
  console.log(
    `REST API server currently running at: http://localhost:8080/api/v1`,
  );
});
