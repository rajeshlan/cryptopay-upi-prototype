const axios = require("axios");

const CASHFREE_BASE =
  process.env.CASHFREE_ENV === "PROD"
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com";

async function executeCashfreePayout({ transactionId, amount, upi }) {
  try {
    const res = await axios.post(
      `${CASHFREE_BASE}/payout/v1/requestTransfer`,
      {
        transferId: transactionId,
        amount: amount,
        instrument: {
          type: "upi",
          vpa: upi,
        },
      },
      {
        headers: {
          "X-Client-Id": process.env.CASHFREE_CLIENT_ID,
          "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.data.status !== "SUCCESS") {
      throw new Error("PAYOUT_FAILED");
    }

    return {
      provider: "CASHFREE",
      reference_id: res.data.data.referenceId,
      status: "SUCCESS",
    };
  } catch (err) {
    console.error("[CASHFREE ERROR]", err.response?.data || err.message);
    throw new Error("PAYOUT_FAILED");
  }
}

module.exports = { executeCashfreePayout };
