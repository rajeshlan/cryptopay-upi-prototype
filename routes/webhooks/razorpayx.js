// routes/webhooks/razorpayx.js
const express = require("express");
const crypto = require("crypto");
const pool = require("../../config/db");

const {
  recordTransition,
} = require("../../execution/audit/executionTimeline");

const router = express.Router();

// ============================
// SIGNATURE VERIFICATION
// ============================
function verifySignature(req) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAYX_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  return expected === req.headers["x-razorpay-signature"];
}

// ============================
// WEBHOOK HANDLER
// ============================
router.post("/", async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).send("Invalid signature");
    }

    const event = req.body.event;
    const payout = req.body.payload?.payout?.entity;
    const txId = payout?.reference_id;

    if (!txId) {
      return res.status(400).json({ error: "missing_reference_id" });
    }

    // 🔐 Persist webhook (audit / replay / ops)
    await pool.query(
      `
      INSERT INTO webhook_events (provider, event_type, transaction_id, payload)
      VALUES ('RAZORPAYX', $1, $2, $3)
      `,
      [event, txId, req.body]
    );

    // ============================
    // PAYOUT SUCCESS
    // ============================
    if (event === "payout.processed") {
      await recordTransition({
        transactionId: txId,
        fromState: "PAYOUT_PENDING",
        toState: "PAYOUT_SUCCESS",
        reason: "RazorpayX confirmed payout",
      });
    }

    // ============================
    // PAYOUT FAILED
    // ============================
    if (event === "payout.failed") {
      await recordTransition({
        transactionId: txId,
        fromState: "PAYOUT_PENDING",
        toState: "PAYOUT_FAILED",
        reason: payout?.failure_reason || "RazorpayX failure",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ RazorpayX webhook error:", err);
    return res.status(500).json({ error: "webhook_processing_failed" });
  }
});

module.exports = router;
