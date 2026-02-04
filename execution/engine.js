// execution/engine.js
const pool = require("../config/db");

const {
  acquireExecutionLock,
  heartbeatExecutionLock,
  releaseExecutionLock,
} = require("./guards/executionLock");

const { simulateConversion } = require("./sandbox/exchangeSandbox");
const { executePayout } = require("./payoutAdapter");

const { recordTransition } = require("./audit/executionTimeline");
const { rebuildStateFromTimeline } = require("./replay/rebuildState");
const { postDoubleEntry } = require("../services/ledgerAccounting");

const {
  STATE,
  STATE_GRAPH,
  isTerminalState, // ✅ SINGLE AUTHORITY
} = require("./states");

/* ================================
   STATE SAFETY
================================ */
function assertTransition(from, to) {
  const allowed = STATE_GRAPH[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

async function transition(txId, from, to, reason) {
  if (from) assertTransition(from, to);

  await recordTransition({
    transactionId: txId,
    fromState: from,
    toState: to,
    reason,
  });

  return to;
}

function maybeCrash(state) {
  if (process.env.SIMULATE_CRASH_AT === state) {
    console.error(`💥 SIMULATED CRASH at ${state}`);
    process.exit(1);
  }
}

/* ================================
   EXECUTION ENGINE (PHASE 5.1)
================================ */
async function runExecution(transactionId) {
  // 🔒 ABSOLUTE TERMINAL GUARD — MUST RUN FIRST
  const { rows } = await pool.query(
    `SELECT execution_state FROM transactions WHERE id = $1`,
    [transactionId]
  );

  if (!rows.length) return;

  const currentState = rows[0].execution_state;

  if (isTerminalState(currentState)) {
    console.log(
      `⏭️ Skipping terminal tx=${transactionId} state=${currentState}`
    );
    return;
  }

  let heartbeat;

  try {
    await acquireExecutionLock(transactionId);

    heartbeat = setInterval(
      () => heartbeatExecutionLock(transactionId),
      10_000
    );

    // 🔑 Rebuild execution intent (timeline-driven)
    const {
      terminal_state,
      resume_state,
    } = await rebuildStateFromTimeline(transactionId);

    // Defensive — timeline already shows terminal
    if (isTerminalState(terminal_state)) {
      return { transactionId, state: terminal_state };
    }

    let current = resume_state;

    // Brand new transaction
    if (!current) {
      current = await transition(
        transactionId,
        null,
        STATE.CREATED,
        "Init"
      );
    }

    /* ============================
       EXECUTION FLOW
    ============================ */

    if (current === STATE.CREATED) {
      current = await transition(
        transactionId,
        current,
        STATE.RATE_LOCKED,
        "Rate locked"
      );
    }

    if (current === STATE.RATE_LOCKED) {
      current = await transition(
        transactionId,
        current,
        STATE.CONVERSION_PENDING,
        "Conversion started"
      );
    }

    if (current === STATE.CONVERSION_PENDING) {
      maybeCrash(STATE.CONVERSION_PENDING);

      const { cryptoAmount, inrAmount } =
        await simulateConversion(transactionId);

      await postDoubleEntry({
        transactionId,
        entries: [
          {
            account: "USER_CRYPTO",
            direction: "DEBIT",
            amount: cryptoAmount,
            currency: "USDT",
          },
          {
            account: "SYSTEM_INR",
            direction: "CREDIT",
            amount: inrAmount,
            currency: "INR",
          },
        ],
      });

      current = await transition(
        transactionId,
        current,
        STATE.CONVERSION_CONFIRMED,
        "Conversion confirmed"
      );
    }

    if (current === STATE.CONVERSION_CONFIRMED) {
      current = await transition(
        transactionId,
        current,
        STATE.PAYOUT_PENDING,
        "Payout initiated"
      );
    }

    // ✅ FIXED PAYOUT BLOCK (SIMULATION-AWARE)
    if (current === STATE.PAYOUT_PENDING) {
      maybeCrash(STATE.PAYOUT_PENDING);

      const { rows } = await pool.query(
        `
        SELECT upi_id, inr_amount
        FROM transactions
        WHERE id = $1
        `,
        [transactionId]
      );

      await executePayout({
        transactionId,
        amount: Number(rows[0].inr_amount),
        upi: rows[0].upi_id,
      });

      // ✅ SIMULATION MODE → ENGINE FINALIZES
      if (process.env.PAYOUT_MODE === "SIMULATION") {
        current = await transition(
          transactionId,
          STATE.PAYOUT_PENDING,
          STATE.PAYOUT_SUCCESS,
          "Simulated payout success"
        );

        return { transactionId, state: current };
      }

      // REAL MODE → webhook decides
      return { transactionId, state: STATE.PAYOUT_PENDING };
    }

    return { transactionId, state: current };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await releaseExecutionLock(transactionId);
  }
}

module.exports = { runExecution };
