// services/ledgerService.js

const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const EXECUTION_MODE = process.env.EXECUTION_MODE || "sandbox";
const IS_SANDBOX = EXECUTION_MODE === "sandbox";

/**
 * Read-only wallet balance accessor.
 * Sandbox → infinite demo balance
 * Real → DB-backed balance
 */
async function getWalletBalance(userId) {
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  if (IS_SANDBOX) {
    return {
      user_id: userId,
      balance: 1_000_000_000,
      mode: "sandbox",
    };
  }

  const result = await pool.query(
    `
    SELECT balance
    FROM demo_wallets
    WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error("WALLET_NOT_FOUND");
  }

  return {
    user_id: userId,
    balance: Number(result.rows[0].balance),
    mode: "real",
  };
}

/**
 * Atomically debits wallet and creates a transaction.
 * Single source of truth for balance mutation.
 */
async function debitWallet({
  userId,
  cryptoAmount,
  inrAmount,
  rate,
  upiId,
}) {
  if (!userId || !cryptoAmount || !inrAmount || !rate || !upiId) {
    throw new Error("INVALID_INPUT");
  }

  // ─────────────────────────────
  // SANDBOX MODE (NO REAL DEBIT)
  // ─────────────────────────────
  if (IS_SANDBOX) {
    const transactionId = uuidv4();

    await pool.query(
      `
      INSERT INTO transactions (
        id,
        user_id,
        upi_id,
        crypto_amount,
        inr_amount,
        rate_used,
        payout_status,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'CREATED', NOW()
      )
      `,
      [
        transactionId,
        userId,
        upiId,
        cryptoAmount,
        inrAmount,
        rate,
      ]
    );

    return transactionId;
  }

  // ─────────────────────────────
  // REAL MODE (STRICT TXN)
  // ─────────────────────────────
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const walletResult = await client.query(
      `
      SELECT balance
      FROM demo_wallets
      WHERE user_id = $1
      FOR UPDATE
      `,
      [userId]
    );

    if (walletResult.rowCount === 0) {
      throw new Error("WALLET_NOT_FOUND");
    }

    const currentBalance = Number(walletResult.rows[0].balance);

    if (currentBalance < inrAmount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    await client.query(
      `
      UPDATE demo_wallets
      SET balance = balance - $1,
          updated_at = NOW()
      WHERE user_id = $2
      `,
      [inrAmount, userId]
    );

    const transactionId = uuidv4();

    await client.query(
      `
      INSERT INTO transactions (
        id,
        user_id,
        upi_id,
        crypto_amount,
        inr_amount,
        rate_used,
        payout_status,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'CREATED', NOW()
      )
      `,
      [
        transactionId,
        userId,
        upiId,
        cryptoAmount,
        inrAmount,
        rate,
      ]
    );

    await client.query("COMMIT");
    return transactionId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getWalletBalance,
  debitWallet,
};
