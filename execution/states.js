// execution/states.js

// ============================
// CANONICAL STATE NAMES
// ============================
const STATE = {
  CREATED: "CREATED",
  RATE_LOCKED: "RATE_LOCKED",
  CONVERSION_PENDING: "CONVERSION_PENDING",
  CONVERSION_CONFIRMED: "CONVERSION_CONFIRMED",
  PAYOUT_PENDING: "PAYOUT_PENDING",

  PAYOUT_SUCCESS: "PAYOUT_SUCCESS",
  PAYOUT_FAILED: "PAYOUT_FAILED",

  EXCHANGE_FAILED: "EXCHANGE_FAILED",
  FAILED: "FAILED",
  UNKNOWN_FAILED: "UNKNOWN_FAILED",

  // future-safe
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

// ============================
// TERMINAL STATES (AUTHORITY)
// ============================
const TERMINAL_STATES = new Set([
  STATE.PAYOUT_SUCCESS,
  STATE.PAYOUT_FAILED,
  STATE.CANCELLED,
  STATE.EXPIRED,
]);

function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

// ============================
// ALLOWED TRANSITIONS GRAPH
// ============================
const STATE_GRAPH = {
  [STATE.CREATED]: [STATE.RATE_LOCKED, STATE.FAILED],
  [STATE.RATE_LOCKED]: [STATE.CONVERSION_PENDING],
  [STATE.CONVERSION_PENDING]: [
    STATE.CONVERSION_CONFIRMED,
    STATE.EXCHANGE_FAILED,
  ],
  [STATE.CONVERSION_CONFIRMED]: [STATE.PAYOUT_PENDING],
  [STATE.PAYOUT_PENDING]: [
    STATE.PAYOUT_SUCCESS,
    STATE.PAYOUT_FAILED,
  ],

  // terminal
  [STATE.PAYOUT_SUCCESS]: [],
  [STATE.PAYOUT_FAILED]: [],
  [STATE.EXCHANGE_FAILED]: [],
  [STATE.FAILED]: [],
  [STATE.UNKNOWN_FAILED]: [],
  [STATE.CANCELLED]: [],
  [STATE.EXPIRED]: [],
};

// ============================
// RETRY RULES
// ============================
function isRetryAllowed(state) {
  return [
    STATE.EXCHANGE_FAILED,
    STATE.PAYOUT_FAILED,
    STATE.UNKNOWN_FAILED,
  ].includes(state);
}

module.exports = {
  STATE,
  STATE_GRAPH,
  TERMINAL_STATES,
  isTerminalState,
  isRetryAllowed,
};
