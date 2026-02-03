// middleware/auth.js

const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  /**
   * 🧪 SANDBOX MODE
   * Auto-auth demo user, bypass JWT
   */
  if (process.env.EXECUTION_MODE === "sandbox") {
    req.user = {
      id: "6364eeb3-a710-4df6-b546-b80adabe1c75",
      role: "demo",
    };
    return next();
  }

  /**
   * 🔐 REAL MODE (JWT REQUIRED)
   */
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_auth_header" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.APP_SECRET);

    if (!decoded?.id) {
      return res.status(401).json({ error: "invalid_token" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

module.exports = auth;
