const pool = require("../../config/db");
const { recordTransition } = require("../audit/executionTimeline");
const { verifyWebhookSignature } = require("./verifyWebhookSignature");

async function handlePayoutWebhook(req) {
  // 1️⃣ Verify signature (sandbox-safe for now)
  verifyWebhookSignature(req);

  const {
    transaction_id,
    status, // SUCCESS | FAILED
    provider_ref,
  } = req.body;

  if (!transaction_id || !status) {
    throw new Error("INVALID_WEBHOOK_PAYLOAD");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2️⃣ Idempotency check
    const { rows } = await client.query(
      `
      SELECT execution_state
      FROM transactions
      WHERE id = $1
      FOR UPDATE
      `,
      [transaction_id]
    );

    if (!rows.length) {
      throw new Error("UNKNOWN_TRANSACTION");
    }

    const currentState = rows[0].execution_state;

    // ✅ Already finalized → ignore safely
    if (
      currentState === "PAYOUT_SUCCESS" ||
      currentState === "PAYOUT_FAILED"
    ) {
      await client.query("COMMIT");
      return;
    }

    // 3️⃣ Apply terminal transition
    if (status === "SUCCESS") {
      await recordTransition({
        transactionId: transaction_id,
        fromState: currentState,
        toState: "PAYOUT_SUCCESS",
        reason: "Webhook confirmed payout",
      });
    } else {
      await recordTransition({
        transactionId: transaction_id,
        fromState: currentState,
        toState: "PAYOUT_FAILED",
        reason: "Webhook reported failure",
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { handlePayoutWebhook };
