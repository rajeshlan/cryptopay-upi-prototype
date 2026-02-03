const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/ledger/:txId", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM ledger_entries WHERE transaction_id = $1 ORDER BY created_at`,
    [req.params.txId]
  );
  res.json(rows);
});

router.get("/reconcile", async (_req, res) => {
  const { rows } = await pool.query(
    `
    SELECT
      transaction_id,
      SUM(
        CASE
          WHEN direction = 'CREDIT' THEN amount
          ELSE -amount
        END
      ) AS net
    FROM ledger_entries
    GROUP BY transaction_id
    HAVING SUM(
      CASE
        WHEN direction = 'CREDIT' THEN amount
        ELSE -amount
      END
    ) <> 0
    `
  );
  res.json({ mismatches: rows });
});

module.exports = router;
