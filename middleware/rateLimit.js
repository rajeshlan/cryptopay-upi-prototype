// middleware/rateLimit.js
// Simple in-memory rate limiter (no external deps)

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;     // per IP per window

const hits = new Map();

module.exports = function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  if (!hits.has(ip)) {
    hits.set(ip, { count: 1, start: now });
    return next();
  }

  const record = hits.get(ip);

  if (now - record.start > WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    return next();
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: "rate_limit_exceeded",
      message: "Too many requests. Slow down.",
    });
  }

  next();
};
