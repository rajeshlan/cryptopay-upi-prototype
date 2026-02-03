// execution/retryExecution.js

const pool = require("../config/db");
const { runExecutionFlow } = require("./runExecutionFlow");

const RETRYABLE_STATES = [
  "EXCHANGE_FAILED",
  "PAYOUT_FAILED",
];

async function retryExecution(transactionId) {
  if (!transactionId) {
    throw new Error("transactionId required");
  }

  const { rows } = await pool.query(
    `SELECT execution_state FROM transactions WHERE id = $1`,
    [transactionId]
  );

  if (rows.length === 0) {
    throw new Error("Transaction not found");
  }

  const currentState = rows[0].execution_state;

  if (!RETRYABLE_STATES.includes(currentState)) {
    throw new Error(`Retry not allowed from state: ${currentState}`);
  }

  console.log(`🔁 RETRYING tx=${transactionId} from state=${currentState}`);

  // IMPORTANT: do NOT reset state manually
  // Execution engine will continue forward safely
  await runExecutionFlow(transactionId);

  return { ok: true };
}

module.exports = {
  retryExecution,
};
