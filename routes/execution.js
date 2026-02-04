// routes/execution.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const { runExecution } = require("../execution/engine");

// ✅ Canonical import (matches executionReader.js)
const {
  getExecutionTimeline,
} = require("../execution/audit/executionReader");

// ============================
// EXECUTION STATUS (FAST PATH)
// ============================
router.get("/:txId/status", async (req, res) => {
  // 🔒 Prevent browser / CDN caching
  res.set("Cache-Control", "no-store");

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

// ============================
// EXECUTION TIMELINE (AUDIT)
// ============================
router.get("/:txId/timeline", async (req, res) => {
  try {
    const { txId } = req.params;

    const timeline = await getExecutionTimeline(txId);

    // ✅ JSON only — UI / observability safe
    res.json(timeline);
  } catch (err) {
    console.error("[TIMELINE FETCH ERROR]", err.message);
    res.status(500).json({
      error: "timeline_fetch_failed",
    });
  }
});

// ============================
// EXECUTION DURATION (ANALYTICS)
// ============================
const {
  getExecutionDuration,
} = require("../execution/analytics/executionMetrics");

router.get("/:txId/duration", async (req, res) => {
  try {
    const { txId } = req.params;
    const metrics = await getExecutionDuration(txId);

    res.json(metrics);
  } catch (err) {
    console.error("[DURATION ERROR]", err.message);
    res.status(404).json({
      error: "duration_not_available",
    });
  }
});

// ============================
// EXECUTION ANOMALIES (OBSERVABILITY)
// ============================
router.get("/:txId/anomalies", async (req, res) => {
  const { txId } = req.params;

  const { rows } = await pool.query(
    `
    SELECT
      anomaly_type,
      severity,
      details,
      detected_at
    FROM execution_anomalies
    WHERE transaction_id = $1
    ORDER BY detected_at ASC
    `,
    [txId]
  );

  res.json(rows);
});

// ============================
// RETRY FAILED EXECUTION ONLY
// ============================
router.post("/:txId/retry", async (req, res) => {
  const { txId } = req.params;

  const { rows } = await pool.query(
    `
    SELECT execution_state
    FROM transactions
    WHERE id = $1
    `,
    [txId]
  );

  const state = rows[0]?.execution_state;

  // 🔒 Retry allowed ONLY for failed states
  if (!state || !state.endsWith("FAILED")) {
    return res.status(400).json({
      error: "retry_not_allowed",
    });
  }

  // 🔒 Reset execution state
  await pool.query(
    `
    UPDATE transactions
    SET execution_state = 'CREATED'
    WHERE id = $1
    `,
    [txId]
  );

  // 🚀 Fire retry (engine is idempotent + lock-protected)
  setImmediate(() => runExecution(txId));

  res.json({ status: "RETRYING" });
});

module.exports = router;
