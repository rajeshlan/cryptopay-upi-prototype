// execution/guards/executionLock.js
const pool = require("../../config/db");

const LEASE_SECONDS = 60;

async function acquireExecutionLock(transactionId) {
  const { rowCount } = await pool.query(
    `
    INSERT INTO execution_locks (transaction_id, lease_until)
    VALUES ($1, NOW() + INTERVAL '${LEASE_SECONDS} seconds')
    ON CONFLICT (transaction_id)
    DO UPDATE SET lease_until = EXCLUDED.lease_until
    WHERE execution_locks.lease_until < NOW()
    `,
    [transactionId]
  );

  if (rowCount === 0) {
    throw new Error("EXECUTION_ALREADY_IN_PROGRESS");
  }
}

async function heartbeatExecutionLock(transactionId) {
  await pool.query(
    `
    UPDATE execution_locks
    SET lease_until = NOW() + INTERVAL '${LEASE_SECONDS} seconds'
    WHERE transaction_id = $1
    `,
    [transactionId]
  );
}

async function releaseExecutionLock(transactionId) {
  await pool.query(
    `DELETE FROM execution_locks WHERE transaction_id = $1`,
    [transactionId]
  );
}

module.exports = {
  acquireExecutionLock,
  heartbeatExecutionLock,
  releaseExecutionLock,
};
