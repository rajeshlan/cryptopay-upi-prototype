// routes/executionAudit.js

const express = require("express");
const router = express.Router();
const { readExecutionTimeline } = require("../execution/audit/executionReader");

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

module.exports = router;
