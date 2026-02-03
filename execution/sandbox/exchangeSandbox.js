// execution/sandbox/exchangeSandbox.js
const pool = require("../../config/db");

function shouldFailExchange() {
  return process.env.SIMULATE_EXCHANGE_FAILURE === "true";
}

async function simulateConversion(transactionId) {
  if (shouldFailExchange()) {
    throw new Error("EXCHANGE_FAILED");
  }

  const { rows } = await pool.query(
    `
    SELECT crypto_amount, inr_amount
    FROM transactions
    WHERE id = $1
    `,
    [transactionId]
  );

  if (!rows.length) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  return {
    cryptoAmount: Number(rows[0].crypto_amount),
    inrAmount: Number(rows[0].inr_amount),
  };
}

module.exports = { simulateConversion };
