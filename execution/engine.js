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

const { STATE, STATE_GRAPH } = require("./states");

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
   EXECUTION ENGINE (FIXED)
================================ */
async function runExecution(transactionId) {
  let heartbeat;

  try {
    await acquireExecutionLock(transactionId);

    heartbeat = setInterval(
      () => heartbeatExecutionLock(transactionId),
      10_000
    );

    // 🔑 CORRECT CONTRACT HANDLING
    const {
      terminal_state,
      resume_state,
    } = await rebuildStateFromTimeline(transactionId);

    // ⛔ Already completed — do nothing
    if (terminal_state === STATE.PAYOUT_SUCCESS) {
      return { transactionId, state: terminal_state };
    }

    // Decide where to start
    let state = resume_state;

    // Brand new transaction
    if (!state) {
      state = await transition(transactionId, null, STATE.CREATED, "Init");
    }

    /* ============================
       EXECUTION FLOW
    ============================ */

    if (state === STATE.CREATED) {
      state = await transition(
        transactionId,
        state,
        STATE.RATE_LOCKED,
        "Rate locked"
      );
    }

    if (state === STATE.RATE_LOCKED) {
      state = await transition(
        transactionId,
        state,
        STATE.CONVERSION_PENDING,
        "Conversion started"
      );
    }

    if (state === STATE.CONVERSION_PENDING) {
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

      state = await transition(
        transactionId,
        state,
        STATE.CONVERSION_CONFIRMED,
        "Conversion confirmed"
      );
    }

    if (state === STATE.CONVERSION_CONFIRMED) {
      state = await transition(
        transactionId,
        state,
        STATE.PAYOUT_PENDING,
        "Payout initiated"
      );
    }

    if (state === STATE.PAYOUT_PENDING) {
      maybeCrash(STATE.PAYOUT_PENDING);

      const { rows } = await pool.query(
        `SELECT upi_id, inr_amount FROM transactions WHERE id = $1`,
        [transactionId]
      );

      await executePayout({
        transactionId,
        amount: Number(rows[0].inr_amount),
        upi: rows[0].upi_id,
      });

      await postDoubleEntry({
        transactionId,
        entries: [
          {
            account: "SYSTEM_INR",
            direction: "DEBIT",
            amount: rows[0].inr_amount,
            currency: "INR",
          },
          {
            account: "PAYOUT",
            direction: "CREDIT",
            amount: rows[0].inr_amount,
            currency: "INR",
          },
        ],
      });

      state = await transition(
        transactionId,
        state,
        STATE.PAYOUT_SUCCESS,
        "Payout successful"
      );
    }

    return { transactionId, state };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await releaseExecutionLock(transactionId);
  }
}

module.exports = { runExecution };
