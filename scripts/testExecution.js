require("dotenv").config();

const { runExecution } = require("../execution/engine");

(async () => {
  const tx = "153c03d1-1c10-4034-9842-a57b25c8c66d";
  const finalState = await runExecution(tx);
  console.log("Final state:", finalState);
})();
