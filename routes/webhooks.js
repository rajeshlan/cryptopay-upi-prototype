// routes/webhooks.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const {
  recordTransition,
} = require("../execution/audit/executionTimeline");

const {
  promoteExecutionState,
} = require("../execution/audit/promoteExecutionState");

router.post("/:provider", async (req, res) => {
  const provider = req.params.provider;
  const payload = req.body;

  const transactionId =
    payload.transaction_id || payload.tx_id || null;

  try {
    await pool.query(
      `
      INSERT INTO webhook_events
        (provider, event_type, transaction_id, payload)
      VALUES ($1, $2, $3, $4)
      `,
      [
        provider,
        payload.event || "UNKNOWN",
        transactionId,
        payload,
      ]
    );

    // ============================
    // PAYOUT SUCCESS
    // ============================
    if (transactionId && payload.event === "PAYOUT_SUCCESS") {
      // 1️⃣ Promote canonical state
      await promoteExecutionState(
        transactionId,
        "PAYOUT_SUCCESS"
      );

      // 2️⃣ Record audit trail
      await recordTransition({
        transactionId,
        fromState: "PAYOUT_PENDING",
        toState: "PAYOUT_SUCCESS",
        reason: "Webhook confirmed payout",
      });
    }

    // ============================
    // PAYOUT FAILED
    // ============================
    if (transactionId && payload.event === "PAYOUT_FAILED") {
      // 1️⃣ Promote canonical state
      await promoteExecutionState(
        transactionId,
        "PAYOUT_FAILED"
      );

      // 2️⃣ Record audit trail
      await recordTransition({
        transactionId,
        fromState: "PAYOUT_PENDING",
        toState: "PAYOUT_FAILED",
        reason: "Webhook reported failure",
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK ERROR]", err);
    res.status(400).json({ error: "webhook_failed" });
  }
});

module.exports = router;
