// routes/execution.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { runExecution } = require("../execution/engine");

// ✅ CANONICAL IMPORT (matches executionReader.js)
const {
  getExecutionTimeline,
} = require("../execution/audit/executionReader");

/* ============================
   EXECUTION STATUS (FAST PATH)
============================ */
router.get("/:txId/status", async (req, res) => {
  const { txId } = req.params;

  const { rows } = await pool.query(
    `
    SELECT execution_state
    FROM transactions
    WHERE id = $1
    `,
    [txId]
  );

  res.json({
    state: rows[0]?.execution_state || "CREATED",
  });
});

/* ============================
   EXECUTION TIMELINE (AUDIT)
============================ */
router.get("/:txId/timeline", async (req, res) => {
  try {
    const { txId } = req.params;

    const timeline = await getExecutionTimeline(txId);

    // ✅ JSON only — UI / observability safe
    res.json(timeline);
  } catch (err) {
    console.error("[TIMELINE FETCH ERROR]", err);
    res.status(500).json({
      error: "timeline_fetch_failed",
    });
  }
});

/* ============================
   RETRY FAILED EXECUTION ONLY
============================ */
router.post("/:txId/retry", async (req, res) => {
  const { txId } = req.params;

  const { rows } = await pool.query(
    `SELECT execution_state FROM transactions WHERE id = $1`,
    [txId]
  );

  const state = rows[0]?.execution_state;

  // 🔒 Guard: retry only FAILED states
  if (!state || !state.endsWith("FAILED")) {
    return res.status(400).json({
      error: "retry_not_allowed",
    });
  }

  // 🔒 Reset state for retry
  await pool.query(
    `
    UPDATE transactions
    SET execution_state = 'CREATED'
    WHERE id = $1
    `,
    [txId]
  );

  // 🚀 Fire retry (engine is idempotent + locked)
  setImmediate(() => runExecution(txId));

  res.json({ status: "RETRYING" });
});

module.exports = router;
