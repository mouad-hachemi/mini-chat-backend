import { Router } from "express";
import { nanoid } from "nanoid";
import {
  addRoomMember,
  createRoom,
  getRoomByURL,
  getRoomsByUser,
  getUserByRoom,
} from "../db.js";
import { authenticateToken } from "../middlewares/authcheck.js";

const router = Router();

router.get("/", authenticateToken, (req, res) => {
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

router.get("/:room_url", authenticateToken, (req, res) => {
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

router.post("/create-room", authenticateToken, (req, res) => {
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

export default router;
