// server.js
require("dotenv").config();

const express = require("express");
const pool = require("./config/db");
const payRoute = require("./routes/pay");
const txRoute = require("./routes/transactions"); // STEP 37.2

const app = express();

// middleware
app.use(express.json());
app.use(express.static("public"));

// health check
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      db_time: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "db_error" });
  }
});

// routes
app.use("/pay", payRoute);
app.use("/transactions", txRoute); // STEP 37.2

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CryptoPay API running on port ${PORT}`);
});
