const pool = require("../../config/db");

const DEFAULT_BALANCE = 1000; // 1000 USDT demo money

/**
 * Ensure demo wallet exists for user.
 * Creates wallet with DEFAULT_BALANCE if missing.
 */
async function ensureWallet(userId) {
  await pool.query(
    `
    INSERT INTO demo_wallets (user_id, balance)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO NOTHING
    `,
    [userId, DEFAULT_BALANCE]
  );
}

/**
 * Refill demo wallet balance.
 *
 * @param {string} userId
 * @param {number} amount
 * @returns {number} updated balance
 */
async function refillWallet(userId, amount) {
  await ensureWallet(userId);

  const { rows } = await pool.query(
    `
    UPDATE demo_wallets
    SET balance = balance + $2
    WHERE user_id = $1
    RETURNING balance
    `,
    [userId, amount]
  );

  return rows[0].balance;
}

module.exports = {
  refillWallet,
};
