const crypto = require("crypto");

module.exports = function verifySignature(req, res, next) {
  const sig = req.headers["x-signature"];
  if (!sig) return res.status(401).json({ error: "missing_signature" });

  const payload = JSON.stringify(req.body || {});
  const expected = crypto
    .createHmac("sha256", process.env.APP_SECRET)
    .update(payload)
    .digest("hex");

  if (sig !== expected) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  next();
};
