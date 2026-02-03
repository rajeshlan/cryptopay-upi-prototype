require("dotenv").config();

const { recordTransition } = require("../execution/audit/executionTimeline");

(async () => {
  await recordTransition({
    transactionId: "11111111-1111-1111-1111-111111111111",
    fromState: "CREATED",
    toState: "RATE_LOCKED",
    reason: "Manual test",
    meta: { rate: 91.79 },
  });

  console.log("Timeline entry inserted");
  process.exit(0);
})();
