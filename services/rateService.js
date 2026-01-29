let cachedRate = 83;
let lastFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function fetchUsdtInr() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    // Public, no-auth endpoint
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr"
    );
    const data = await res.json();

    const rate = Number(data?.tether?.inr);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid rate");
    }

    cachedRate = rate;
    lastFetch = now;
    return cachedRate;
  } catch (err) {
    // Fallback to last known good rate
    return cachedRate;
  }
}

module.exports = { fetchUsdtInr };
