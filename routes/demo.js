// routes/demo.js

const express = require("express");
const router = express.Router();
const { getWalletBalance } = require("../services/ledgerService");

/**
 * Get demo wallet balance for a user.
 * SINGLE SOURCE OF TRUTH (ledgerService)
 */
router.get("/wallet/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "INVALID_USER_ID" });
  }

  try {
    const wallet = await getWalletBalance(userId);

    return res.json({
      balance: wallet.balance,
    });
  } catch (error) {
    console.error("Wallet fetch failed:", error);
    return res.status(500).json({ error: "WALLET_FETCH_FAILED" });
  }
});

module.exports = router;
