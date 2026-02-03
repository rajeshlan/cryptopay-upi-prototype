// execution/adapters/exchangeAdapter.js
const { simulateConversion } = require("../sandbox/exchangeSandbox");

async function realConversion() {
  // 🔒 Placeholder for real exchange integration
  // Later: Binance / CoinDCX / Bybit spot convert
  return true;
}

async function convert() {
  const mode = process.env.EXECUTION_MODE || "sandbox";

  if (mode === "real") {
    return realConversion();
  }

  return simulateConversion();
}

module.exports = { convert };
