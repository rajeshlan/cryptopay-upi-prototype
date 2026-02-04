const express = require("express");
const router = express.Router();

const {
  handlePayoutWebhook,
} = require("../../execution/webhooks/payoutWebhookHandler");

router.post(
  "/payout",
  express.json({ verify: (req, _res, buf) => {
    req.rawBody = buf;
  }}),
  async (req, res) => {
    try {
      await handlePayoutWebhook(req);
      res.json({ status: "OK" });
    } catch (err) {
      console.error("[WEBHOOK ERROR]", err.message);
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
