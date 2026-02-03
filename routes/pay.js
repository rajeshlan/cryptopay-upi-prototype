// routes/pay.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const authMiddleware = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const verifySignature = require("../middleware/verifySignature");

const { fetchUsdtInr } = require("../services/rateService");
const { debitWallet } = require("../services/ledgerService");

/**
 * POST /pay
 * Fully idempotent payment initiation
 * ❗ Execution is NOT triggered here
 * ❗ Watchdog is the sole executor
 */
router.post(
  "/",
  authMiddleware,
  rateLimit,
  verifySignature,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const user_id = req.user.id;
      const { upi_id, crypto_amount } = req.body;

      // 🔑 REQUIRED idempotency key
      const idempotencyKey = req.headers["x-idempotency-key"];
      if (!idempotencyKey) {
        return res.status(400).json({ error: "MISSING_IDEMPOTENCY_KEY" });
      }

      if (!user_id || !upi_id || !crypto_amount) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
      }

      await client.query("BEGIN");

      // 🔒 Check idempotency
      const existing = await client.query(
        `
        SELECT transaction_id
        FROM idempotency_keys
        WHERE key = $1
        FOR UPDATE
        `,
        [idempotencyKey]
      );

      // ♻️ Replay-safe response
      if (existing.rowCount > 0) {
        const txId = existing.rows[0].transaction_id;
        await client.query("COMMIT");

        return res.json({
          transaction_id: txId,
          status: "CREATED",
          message: "Idempotent replay — existing transaction returned",
        });
      }

      // 💱 Fetch rate
      const rate = await fetchUsdtInr();
      const inrAmount = crypto_amount * rate;

      // 💰 Debit wallet + create transaction
      const transactionId = await debitWallet({
        userId: user_id,
        cryptoAmount: crypto_amount,
        inrAmount,
        rate,
        upiId: upi_id,
      });

      // 🔐 Bind idempotency key → transaction
      await client.query(
        `
        INSERT INTO idempotency_keys (key, transaction_id)
        VALUES ($1, $2)
        `,
        [idempotencyKey, transactionId]
      );

      await client.query("COMMIT");

      // ❌ NO execution trigger here
      // ✅ Watchdog will pick it up safely

      return res.json({
        transaction_id: transactionId,
        status: "CREATED",
        rate_used: rate,
        message: "Payment initiated (idempotent)",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PAY ERROR]", err.message);

      return res.status(400).json({
        error: err.message || "PAYMENT_FAILED",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
