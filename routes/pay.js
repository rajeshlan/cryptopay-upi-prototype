// routes/pay.js
const express = require("express");
const router = express.Router();

const { fetchUsdtInr } = require("../services/rateService");
const { debitWallet } = require("../services/ledgerService");
const { simulateUpiPayout } = require("../services/payoutSimulator");

router.post("/", async (req, res) => {
  try {
    const { user_id, upi_id, crypto_amount } = req.body;

    const rate = await fetchUsdtInr();
    const inrAmount = crypto_amount * rate;

    const transactionId = await debitWallet({
      userId: user_id,
      cryptoAmount: crypto_amount,
      inrAmount,
      rate,
    });

    await simulateUpiPayout({
      transactionId,
      upiId: upi_id,
    });

    res.json({
      transaction_id: transactionId,
      crypto_debited: crypto_amount,
      inr_credited: inrAmount,
      rate_used: rate,
      payout_status: "SIMULATED_SUCCESS",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
