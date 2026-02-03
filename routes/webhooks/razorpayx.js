const express = require("express");
const crypto = require("crypto");
const pool = require("../../config/db");
const { recordTransition } = require("../../execution/audit/executionTimeline");

const router = express.Router();

function verifySignature(req) {
  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAYX_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return expected === req.headers["x-razorpay-signature"];
}

router.post("/", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body.event;
  const payout = req.body.payload?.payout?.entity;
  const txId = payout?.reference_id;

  await pool.query(
    `INSERT INTO webhook_events (provider, event_type, transaction_id, payload)
     VALUES ('RAZORPAYX', $1, $2, $3)`,
    [event, txId, req.body]
  );

  if (event === "payout.processed") {
    await recordTransition({
      transactionId: txId,
      fromState: "PAYOUT_PENDING",
      toState: "PAYOUT_SUCCESS",
      reason: "RazorpayX confirmed",
    });
  }

  if (event === "payout.failed") {
    await recordTransition({
      transactionId: txId,
      fromState: "PAYOUT_PENDING",
      toState: "PAYOUT_FAILED",
      reason: payout?.failure_reason || "RazorpayX failure",
    });
  }

  res.json({ ok: true });
});

module.exports = router;
