const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  const limit = Number(req.query.limit) || 10;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        t.id,
        t.crypto_amount,
        t.inr_amount,
        t.rate_used,
        t.created_at,
        p.upi_id,
        p.status AS payout_status
      FROM transactions t
      LEFT JOIN payouts p
        ON p.transaction_id = t.id
      ORDER BY t.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

module.exports = router;
