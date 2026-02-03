// middleware/verifySignature.js

const crypto = require("crypto");

module.exports = function verifySignature(req, res, next) {
  // ✅ BYPASS SIGNATURE IN SANDBOX MODE
  if (process.env.EXECUTION_MODE === "sandbox") {
    return next();
  }

  const signature = req.headers["x-signature"];
  const nonce = req.headers["x-nonce"];
  const timestamp = req.headers["x-timestamp"];

  if (!signature || !nonce || !timestamp) {
    return res.status(401).json({ error: "missing_signature" });
  }

  // ⏱️ 5-minute replay window
  const now = Date.now();
  if (Math.abs(now - Number(timestamp)) > 5 * 60 * 1000) {
    return res.status(401).json({ error: "expired_request" });
  }

  const payload = JSON.stringify({
    body: req.body,
    nonce,
    timestamp,
  });

  const expectedSignature = crypto
    .createHmac("sha256", process.env.APP_SECRET)
    .update(payload)
    .digest("hex");

  if (expectedSignature !== signature) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  next();
};
