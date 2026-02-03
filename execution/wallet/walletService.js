// execution/wallet/walletService.js
const pool = require("../../config/db");

/**
 * Fetch wallet for user.
 */
async function getWallet(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, balance FROM demo_wallets WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Ensure user has enough balance.
 */
async function assertSufficientBalance(userId, amount) {
  const wallet = await getWallet(userId);

  if (!wallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  if (Number(wallet.balance) < Number(amount)) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  return wallet;
}

/**
 * Debit wallet (idempotent-safe via transaction).
 */
async function debitBalance(userId, amount, client) {
  const db = client || pool;

  await db.query(
    `
    UPDATE demo_wallets
    SET balance = balance - $2,
        updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, amount]
  );
}

/**
 * Credit wallet (refund).
 */
async function creditBalance(userId, amount, client) {
  const db = client || pool;

  await db.query(
    `
    UPDATE demo_wallets
    SET balance = balance + $2,
        updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, amount]
  );
}

module.exports = {
  getWallet,
  assertSufficientBalance,
  debitBalance,
  creditBalance,
};
