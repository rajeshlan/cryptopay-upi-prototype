// providers/razorpayx.js

const axios = require("axios");

const BASE_URL = "https://api.razorpay.com/v1";

function authHeader() {
  const key = process.env.RAZORPAYX_KEY_ID;
  const secret = process.env.RAZORPAYX_KEY_SECRET;
  const token = Buffer.from(`${key}:${secret}`).toString("base64");

  return {
    Authorization: `Basic ${token}`,
  };
}

/**
 * Send payout request to RazorpayX
 *
 * IMPORTANT:
 * - No locks
 * - No state changes
 * - No retries
 * - Idempotency handled by RazorpayX
 *
 * Final outcome is decided via webhook.
 */
async function payoutViaRazorpayX({ transactionId, amount, upi }) {
  const payload = {
    account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
    amount: Math.round(amount * 100), // INR → paise
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
    fund_account: {
      account_type: "vpa",
      vpa: {
        address: upi,
      },
    },
    queue_if_low_balance: true,
    reference_id: transactionId,
  };

  // 🔍 TEMP DEBUG — VERIFY ENV + INPUTS
  console.log("🚀 RazorpayX payout attempt", {
    transactionId,
    amount,
    upi,
    account: process.env.RAZORPAYX_ACCOUNT_NUMBER,
  });

  await axios.post(`${BASE_URL}/payouts`, payload, {
    headers: {
      ...authHeader(),
      "X-Payout-Idempotency": `payout_${transactionId}`,
      "Content-Type": "application/json",
    },
  });

  return { sent: true };
}

module.exports = {
  payoutViaRazorpayX,
};
