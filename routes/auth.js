// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const APP_SECRET = process.env.APP_SECRET;

/* ============================
   REGISTER
============================ */
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "missing_fields" });

  const hash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id`,
      [email, hash]
    );

    res.json({ user_id: rows[0].id });
  } catch {
    res.status(400).json({ error: "email_exists" });
  }
});

/* ============================
   LOGIN (REAL)
============================ */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  if (!rows.length) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    APP_SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token });
});

/* ============================
   DEV ONLY — AUTO LOGIN
   ⚠️ DO NOT USE IN PROD
============================ */
router.get("/dev-login", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email FROM users LIMIT 1`
  );

  if (!rows.length) {
    return res.status(400).json({ error: "no_users_found" });
  }

  const user = rows[0];

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.APP_SECRET,
    { expiresIn: "24h" }
  );

  res.json({ token });
});

module.exports = router;
