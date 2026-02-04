// execution/watchdog.js
const pool = require("../config/db");
const { runExecution } = require("./engine");

const {
  createWatchdogStats,
} = require("./telemetry/watchdogStats");

const {
  writeWatchdogHeartbeat,
} = require("./telemetry/watchdogHeartbeat");

const WATCHDOG_INTERVAL_MS = 30_000;

async function findStuckTransactions() {
  const { rows } = await pool.query(`
    SELECT
      t.id,
      COALESCE(MAX(et.created_at), t.created_at) AS last_event_at
    FROM transactions t
    LEFT JOIN execution_timeline et
      ON et.transaction_id = t.id
    LEFT JOIN execution_locks l
      ON l.transaction_id = t.id
    WHERE
      -- 🔒 no active executor
      (l.lease_until IS NULL OR l.lease_until < NOW())

      -- 🛡️ ABSOLUTE DB-LEVEL TERMINAL SAFETY
      AND t.execution_state NOT IN (
        'PAYOUT_SUCCESS',
        'PAYOUT_FAILED',
        'CANCELLED',
        'EXPIRED'
      )

      -- 🔒 ignore payouts already attempted
      AND NOT (
        t.execution_state = 'PAYOUT_PENDING'
        AND t.payout_attempted_at IS NOT NULL
      )
    GROUP BY t.id, t.created_at
    HAVING COALESCE(MAX(et.created_at), t.created_at)
           < NOW() - INTERVAL '10 seconds'
    ORDER BY last_event_at ASC
    LIMIT 5
  `);

  return rows;
}

async function watchdogTick() {
  const stats = createWatchdogStats();

  try {
    const stuck = await findStuckTransactions();
    stats.checked = stuck.length;

    for (const tx of stuck) {
      try {
        console.log(`🛡️ WATCHDOG: executing tx=${tx.id}`);
        await runExecution(tx.id);
        stats.executed++;
      } catch (err) {
        if (err.message === "EXECUTION_ALREADY_IN_PROGRESS") {
          stats.skippedLocked++;
        } else {
          stats.errors++;
          console.error(
            `❌ WATCHDOG ERROR tx=${tx.id}:`,
            err.message
          );
        }
      }
    }
  } catch (err) {
    stats.errors++;
    console.error("❌ WATCHDOG TICK FAILURE:", err.message);
  } finally {
    // 🔭 observability only — never blocks execution
    await writeWatchdogHeartbeat(stats);
  }
}

function startExecutionWatchdog() {
  console.log("🛡️ Execution Watchdog started");
  setInterval(watchdogTick, WATCHDOG_INTERVAL_MS);
}

module.exports = { startExecutionWatchdog };
