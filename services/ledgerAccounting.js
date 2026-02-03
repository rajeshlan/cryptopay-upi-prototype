const pool = require("../config/db");

async function postEntry({
  transactionId,
  account,
  direction,
  amount,
  currency,
}) {
  await pool.query(
    `
    INSERT INTO ledger_entries
      (transaction_id, account, direction, amount, currency)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [transactionId, account, direction, amount, currency]
  );
}

async function postDoubleEntry({ transactionId, entries }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      await client.query(
        `
        INSERT INTO ledger_entries
          (transaction_id, account, direction, amount, currency)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          transactionId,
          e.account,
          e.direction,
          e.amount,
          e.currency,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  postEntry,
  postDoubleEntry,
};
