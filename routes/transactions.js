// routes/transactions.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  const limit = Number(req.query.limit || 10);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        upi_id,
        crypto_amount,
        inr_amount,
        rate_used,
        execution_state,
        created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error("[TRANSACTIONS FETCH ERROR]", err);
    res.status(500).json({
      error: "failed_to_fetch_transactions",
    });
  }
});

module.exports = router;
