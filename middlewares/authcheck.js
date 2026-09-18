import jsonwebtoken from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "you-cant-guess-this";

export function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token)
    return res.status(403).json({ success: false, error: "Please login" });

  jsonwebtoken.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.clearCooki("token", {
        samesite: "lax",
        httpOnly: true,
        secure: false,
      });

      return res
        .status(403)
        .json({ success: false, error: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
}
