const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

async function debitWallet({ userId, cryptoAmount, inrAmount, rate }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const walletRes = await client.query(
      "SELECT crypto_balance_usdt FROM wallets WHERE user_id=$1 FOR UPDATE",
      [userId]
    );

    if (walletRes.rows.length === 0) {
      throw new Error("Wallet not found");
    }

    const balance = walletRes.rows[0].crypto_balance_usdt;

    if (balance < cryptoAmount) {
      throw new Error("Insufficient balance");
    }

    await client.query(
      "UPDATE wallets SET crypto_balance_usdt = crypto_balance_usdt - $1 WHERE user_id=$2",
      [cryptoAmount, userId]
    );

    const txId = uuidv4();

    await client.query(
      `INSERT INTO transactions 
       (id, user_id, crypto_amount, inr_amount, rate_used, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [txId, userId, cryptoAmount, inrAmount, rate, "DEBITED"]
    );

    await client.query("COMMIT");
    return txId;

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { debitWallet };
