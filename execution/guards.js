function ensureSandbox() {
  if (process.env.REAL_MODE === "true") {
    throw new Error("REAL MODE NOT ALLOWED YET");
  }
}

module.exports = { ensureSandbox };
