// routes/executionAudit.js
const express = require("express");
const router = express.Router();

const {
  readExecutionTimeline,
} = require("../execution/audit/executionReader");

const {
  getExecutionDurations,
} = require("../execution/analytics/executionDurations");

/**
 * GET /execution/:transaction_id/audit
 * Read-only execution timeline
 */
router.get("/:transaction_id/audit", async (req, res) => {
  const { transaction_id } = req.params;

  try {
    const timeline = await readExecutionTimeline(transaction_id);

    if (!timeline.length) {
      return res.status(404).json({
        error: "No audit timeline found for transaction",
      });
    }

    res.json({
      transaction_id,
      timeline,
    });
  } catch (err) {
    console.error("Audit read failed:", err.message);
    res.status(500).json({ error: "Failed to read execution audit" });
  }
});

/**
 * GET /execution/:txId/duration
 * Read-only execution duration analytics
 */
router.get("/execution/:txId/duration", async (req, res) => {
  try {
    const data = await getExecutionDurations(req.params.txId);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: "Failed to compute execution duration",
      details: err.message,
    });
  }
});

module.exports = router;
