// execution/telemetry/watchdogStats.js

function createWatchdogStats() {
  return {
    checked: 0,
    executed: 0,
    skippedLocked: 0,
    errors: 0,
  };
}

module.exports = {
  createWatchdogStats,
};
