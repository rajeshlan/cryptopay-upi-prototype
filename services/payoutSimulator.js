const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

async function simulateUpiPayout({ transactionId, upiId }) {
  const payoutId = uuidv4();

  await pool.query(
    `INSERT INTO payouts (id, transaction_id, upi_id, status)
     VALUES ($1, $2, $3, $4)`,
    [payoutId, transactionId, upiId, "SIMULATED_SUCCESS"]
  );

  return payoutId;
}

module.exports = { simulateUpiPayout };
