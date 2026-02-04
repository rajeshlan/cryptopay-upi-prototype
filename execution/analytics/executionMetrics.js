const pool = require("../../config/db");

async function getExecutionDuration(transactionId) {
  const { rows } = await pool.query(
    `
    SELECT
      from_state,
      to_state,
      created_at
    FROM execution_timeline
    WHERE transaction_id = $1
    ORDER BY created_at ASC
    `,
    [transactionId]
  );

  if (!rows.length) {
    throw new Error("NO_TIMELINE");
  }

  const durations = {};
  let prevTime = null;

  for (const row of rows) {
    if (prevTime) {
      const delta =
        new Date(row.created_at) - new Date(prevTime);

      durations[row.from_state || "CREATED"] =
        (durations[row.from_state || "CREATED"] || 0) + delta;
    }
    prevTime = row.created_at;
  }

  const totalMs =
    new Date(rows[rows.length - 1].created_at) -
    new Date(rows[0].created_at);

  return {
    transactionId,
    totalMs,
    perStateMs: durations,
  };
}

module.exports = { getExecutionDuration };
