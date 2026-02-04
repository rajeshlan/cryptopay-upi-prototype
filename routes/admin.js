// routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

/* =========================
   SYSTEM HEALTH
========================= */
router.get("/health", async (_req, res) => {
  const db = await pool.query("SELECT NOW()");
  res.json({
    status: "ok",
    db_time: db.rows[0].now,
  });
});

/* =========================
   WATCHDOG TELEMETRY
========================= */
router.get("/watchdog", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT *
    FROM watchdog_heartbeat
    ORDER BY tick_at DESC
    LIMIT 20
  `);

  res.json(rows);
});

/* =========================
   RECENT EXECUTIONS
========================= */
router.get("/executions", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      id,
      execution_state,
      created_at,
      last_progress_at
    FROM transactions
    ORDER BY created_at DESC
    LIMIT 25
  `);

  res.json(rows);
});

/* =========================
   SINGLE EXECUTION VIEW
========================= */
router.get("/execution/:txId", async (req, res) => {
  const { txId } = req.params;

  const [timeline, metrics, anomalies] = await Promise.all([
    pool.query(
      `SELECT * FROM execution_timeline WHERE transaction_id = $1 ORDER BY created_at`,
      [txId]
    ),
    pool.query(
      `SELECT * FROM execution_metrics WHERE transaction_id = $1`,
      [txId]
    ),
    pool.query(
      `SELECT * FROM execution_anomalies WHERE transaction_id = $1`,
      [txId]
    ),
  ]);

  res.json({
    timeline: timeline.rows,
    metrics: metrics.rows[0] || null,
    anomalies: anomalies.rows,
  });
});

module.exports = router;
