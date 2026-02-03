const crypto = require("crypto");
const axios = require("axios");
const pool = require("../config/db");

const BASE_URL = "https://api.razorpay.com/v1";

function authHeader() {
  const key = process.env.RAZORPAYX_KEY_ID;
  const secret = process.env.RAZORPAYX_KEY_SECRET;
  const token = Buffer.from(`${key}:${secret}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function payoutViaRazorpayX({ transactionId, amount, upi }) {
  const idempotencyKey = `payout_${transactionId}`;

  // 🔒 Prevent duplicate payouts
  const lock = await pool.query(
    `INSERT INTO execution_locks (transaction_id)
     VALUES ($1)
     ON CONFLICT DO NOTHING`,
    [transactionId]
  );

  if (lock.rowCount === 0) {
    return { skipped: true };
  }

  const payload = {
    account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
    fund_account: {
      account_type: "vpa",
      vpa: { address: upi },
    },
    queue_if_low_balance: true,
    reference_id: transactionId,
  };

  await axios.post(`${BASE_URL}/payouts`, payload, {
    headers: {
      ...authHeader(),
      "X-Payout-Idempotency": idempotencyKey,
      "Content-Type": "application/json",
    },
  });

  return { sent: true };
}

module.exports = {
  payoutViaRazorpayX,
};
