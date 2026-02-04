// execution/telemetry/watchdogHeartbeat.js
const fs = require("fs");
const path = require("path");
const pool = require("../../config/db");

const TELEMETRY_DIR = path.join(__dirname);
const SNAPSHOT_FILE = path.join(TELEMETRY_DIR, "watchdog.json");

async function writeWatchdogHeartbeat(stats) {
  const payload = {
    tick_at: new Date().toISOString(),
    checked: stats.checked,
    executed: stats.executed,
    skipped_locked: stats.skippedLocked,
    errors: stats.errors,
  };

  // 1️⃣ JSON snapshot (best effort)
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    fs.writeFileSync(
      SNAPSHOT_FILE,
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("⚠️ Watchdog JSON telemetry failed:", err.message);
  }

  // 2️⃣ DB heartbeat (best effort)
  try {
    await pool.query(
      `
      INSERT INTO watchdog_heartbeat
        (checked_count, executed_count, skipped_locked, error_count)
      VALUES ($1, $2, $3, $4)
      `,
      [
        stats.checked,
        stats.executed,
        stats.skippedLocked,
        stats.errors,
      ]
    );
  } catch (err) {
    console.error("⚠️ Watchdog DB telemetry failed:", err.message);
  }
}

module.exports = {
  writeWatchdogHeartbeat,
};
