function verifyWebhookSignature(req) {
  // Phase 5.1 = sandbox
  // Accept all, but structure is ready

  // Later:
  // - HMAC
  // - Timestamp
  // - Replay protection

  return true;
}

module.exports = { verifyWebhookSignature };
