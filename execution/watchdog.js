// execution/watchdog.js
const pool = require("../config/db");
const { runExecution } = require("./engine");

const WATCHDOG_INTERVAL_MS = 30_000;

/**
 * Find transactions that:
 * - Have no active execution lock (or expired)
 * - Are NOT terminal (PAYOUT_SUCCESS)
 * - Have NOT progressed for N seconds
 * - Work even if execution_timeline is EMPTY
 *
 * Source of truth:
 *   COALESCE(MAX(execution_timeline.created_at), transactions.created_at)
 */
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
      (l.lease_until IS NULL OR l.lease_until < NOW())
      AND t.execution_state IS DISTINCT FROM 'PAYOUT_SUCCESS'
    GROUP BY t.id, t.created_at
    HAVING COALESCE(MAX(et.created_at), t.created_at)
           < NOW() - INTERVAL '10 seconds'
    ORDER BY last_event_at ASC
    LIMIT 5
  `);

  return rows;
}

async function watchdogTick() {
  const stuck = await findStuckTransactions();
  if (!stuck.length) return;

  for (const tx of stuck) {
    try {
      console.log(`🛡️ WATCHDOG: executing tx=${tx.id}`);
      await runExecution(tx.id);
    } catch (err) {
      if (err.message === "EXECUTION_ALREADY_IN_PROGRESS") {
        console.log(`⏳ tx=${tx.id} locked, skipping`);
      } else {
        console.error(
          `❌ WATCHDOG ERROR tx=${tx.id}:`,
          err.message
        );
      }
    }
  }
}

function startExecutionWatchdog() {
  console.log("🛡️ Execution Watchdog started");
  setInterval(watchdogTick, WATCHDOG_INTERVAL_MS);
}

module.exports = { startExecutionWatchdog };
