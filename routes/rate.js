const express = require("express");
const router = express.Router();
const { fetchUsdtInr } = require("../services/rateService");

router.get("/usdt-inr", async (req, res) => {
  try {
    const rate = await fetchUsdtInr();
    res.json({ rate });
  } catch (err) {
    res.status(500).json({ error: "rate_fetch_failed" });
  }
});

module.exports = router;
