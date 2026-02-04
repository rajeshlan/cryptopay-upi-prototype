// server.js
require("dotenv").config();

const express = require("express");
const pool = require("./config/db");

// 🛡️ Execution watchdog
const { startExecutionWatchdog } = require("./execution/watchdog");

// 🔁 Execution engine (DEBUG ONLY)
const { runExecution } = require("./execution/engine");

// =======================
// ROUTES
// =======================
const payRoute = require("./routes/pay");
const txRoute = require("./routes/transactions");
const executionRoutes = require("./routes/execution");          // ✅ execution API
const executionAuditRoutes = require("./routes/executionAudit");
const demoRoutes = require("./routes/demo");
const rateRoutes = require("./routes/rate");
const webhookRoutes = require("./routes/webhooks");
const auditRoutes = require("./routes/audit");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");                  // 🔌 ADMIN

const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.static("public"));

// =======================
// HEALTH CHECK
// =======================
app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      db_time: result.rows[0].now,
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(500).json({ status: "db_error" });
  }
});

// =======================
// 🔬 DEBUG EXECUTION (TESTING ONLY)
// =======================
app.post("/debug/execute/:id", async (req, res) => {
  const result = await runExecution(req.params.id);
  res.json(result);
});

// =======================
// ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/pay", payRoute);
app.use("/transactions", txRoute);

// 🔑 Execution APIs
app.use("/execution", executionRoutes);
app.use("/execution", executionAuditRoutes);

app.use("/audit", auditRoutes);
app.use("/demo", demoRoutes);
app.use("/rate", rateRoutes);

// 🔌 ADMIN (observability / ops / tooling)
app.use("/admin", adminRoutes);

// =======================
// PAYOUT WEBHOOK (PROVIDER-AGNOSTIC)
// =======================
app.use("/webhooks", require("./routes/webhooks/payout"));

// =======================
// RAZORPAYX WEBHOOK (RAW BODY REQUIRED)
// =======================
app.use(
  "/webhooks/razorpayx",
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  "/webhooks/razorpayx",
  require("./routes/webhooks/razorpayx")
);

// =======================
// GENERIC WEBHOOKS
// =======================
app.use("/webhooks", webhookRoutes);

// =======================
// SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CryptoPay API running on port ${PORT}`);

  // 🛡️ Start execution watchdog
  startExecutionWatchdog();
});
