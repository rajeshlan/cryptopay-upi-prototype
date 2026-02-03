// execution/sandbox/payoutSandbox.js
const pool = require("../../config/db");

async function simulatePayout(transactionId) {
  const { rows } = await pool.query(
    `SELECT inr_amount FROM transactions WHERE id = $1`,
    [transactionId]
  );

  if (!rows.length) {
    throw new Error("PAYOUT_FAILED");
  }

  return {
    inrAmount: Number(rows[0].inr_amount),
  };
}

module.exports = { simulatePayout };
