console.log("app.js loaded");

/* ================================
   CONFIG
================================ */
const DEMO_USER_ID = "6364eeb3-a710-4df6-b546-b80adabe1c75";

let currentBalance = 0;
let currentRate = null;
let activeTxId = null;
let pollingTimer = null;

/* ================================
   STATUS NORMALIZER (FIX)
================================ */
function renderStatus(state) {
  if (!state) return "UNKNOWN";

  switch (state) {
    case "CREATED":
      return "CREATED";

    case "RATE_LOCKED":
    case "CONVERSION_PENDING":
      return "PROCESSING";

    case "CONVERSION_CONFIRMED":
    case "PAYOUT_PENDING":
      return "PAYMENT_IN_PROGRESS";

    case "PAYOUT_SUCCESS":
      return "SUCCESS";

    case "PAYOUT_FAILED":
    case "CONVERSION_FAILED":
      return "FAILED";

    default:
      return state;
  }
}

/* ================================
   UI HELPERS
================================ */
function setExecutionStatus(rawState) {
  const pill = document.getElementById("executionStatus");
  if (!pill) return;

  const state = renderStatus(rawState);
  pill.className = "status-pill";

  if (state === "UNKNOWN") {
    pill.classList.add("idle");
    pill.textContent = "⏸ Idle";
    return;
  }

  if (state === "SUCCESS") {
    pill.classList.add("success");
    pill.textContent = "✅ Payment Successful";
    return;
  }

  if (state === "FAILED") {
    pill.classList.add("error");
    pill.textContent = "❌ Payment Failed";
    return;
  }

  pill.classList.add("pending");
  pill.textContent = `⏳ ${state.replaceAll("_", " ")}`;
}

function lockPayButton(lock) {
  const btn = document.querySelector("button[onclick='pay()']");
  if (!btn) return;
  btn.disabled = lock;
  btn.style.opacity = lock ? 0.6 : 1;
}

/* ================================
   DEMO WALLET
================================ */
async function loadDemoBalance() {
  try {
    const res = await fetch(`/demo/wallet/${DEMO_USER_ID}`);
    const data = await res.json();

    currentBalance = data.balance || 0;
    document.getElementById("walletBox").innerHTML =
      `💰 Demo Wallet (INR): <b>₹${currentBalance}</b>`;
  } catch {
    document.getElementById("walletBox").innerHTML =
      `💰 Demo Wallet (INR): <b>Error</b>`;
  }
}

/* ================================
   RATE
================================ */
async function loadLiveRate() {
  const res = await fetch("/rate/usdt-inr");
  const data = await res.json();
  currentRate = Number(data.rate);
}

/* ================================
   EXECUTION POLLING
================================ */
function pollExecutionState(txId) {
  if (pollingTimer) clearInterval(pollingTimer);

  pollingTimer = setInterval(async () => {
    const res = await fetch(`/execution/${txId}/status`);
    const { state } = await res.json();

    setExecutionStatus(state);

    const normalized = renderStatus(state);
    if (normalized === "SUCCESS" || normalized === "FAILED") {
      clearInterval(pollingTimer);
      pollingTimer = null;
      activeTxId = null;

      lockPayButton(false);
      loadDemoBalance();
      loadHistory();
    }
  }, 1500);
}

/* ================================
   QR HELPERS
================================ */
function extractUpiAndAmount(raw) {
  try {
    if (!raw) return {};
    const query = raw.includes("?") ? raw.split("?")[1] : raw;
    const params = new URLSearchParams(query);

    return {
      upi: params.get("pa"),
      amount: params.get("am"),
    };
  } catch {
    return {};
  }
}

function parseQR() {
  const qrText = document.getElementById("qrtext").value;
  if (!qrText) return alert("Paste QR text first");

  const { upi, amount } = extractUpiAndAmount(qrText);
  if (!upi) return alert("Invalid UPI QR text");

  document.getElementById("upi").value = upi;
  if (amount) document.getElementById("amount").value = amount;
}

function scanQRImage() {
  const fileInput = document.getElementById("qrimage");
  if (!fileInput.files.length) return alert("Select a QR image first");

  const file = fileInput.files[0];
  const reader = new FileReader();
  const img = new Image();

  reader.onload = () => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (!code) return alert("QR not detected");

      const { upi, amount } = extractUpiAndAmount(code.data);
      if (!upi) return alert("Invalid UPI QR");

      document.getElementById("upi").value = upi;
      if (amount) document.getElementById("amount").value = amount;
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(file);
}

/* ================================
   PAY
================================ */
async function pay() {
  if (activeTxId) return;

  const upi = document.getElementById("upi").value;
  const amount = Number(document.getElementById("amount").value);
  const resBox = document.getElementById("result");

  if (!upi || !amount || !currentRate) return;

  if (currentBalance < amount * currentRate) {
    resBox.textContent = "❌ Insufficient demo balance";
    return;
  }

  setExecutionStatus("CREATED");
  lockPayButton(true);

  const payload = {
    user_id: DEMO_USER_ID,
    upi_id: upi,
    crypto_amount: amount,
  };

  const res = await fetch("/pay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  resBox.textContent = JSON.stringify(data, null, 2);

  if (data.transaction_id) {
    activeTxId = data.transaction_id;
    pollExecutionState(activeTxId);
  } else {
    lockPayButton(false);
  }
}

/* ================================
   HISTORY
================================ */
async function loadHistory() {
  const box = document.getElementById("history");
  box.innerHTML = "Loading…";

  try {
    const res = await fetch("/transactions?limit=5");
    const list = await res.json();

    if (!Array.isArray(list) || list.length === 0) {
      box.innerHTML = "No transactions yet.";
      return;
    }

    box.innerHTML = list.map((tx) => {
      const state = renderStatus(tx.execution_state);
      const badge =
        state === "FAILED"
          ? "failed"
          : state === "SUCCESS"
          ? "success"
          : "pending";

      return `
        <div class="tx-card">
          <div><b>UPI:</b> ${tx.upi_id ?? "—"}</div>
          <div><b>Crypto:</b> ${tx.crypto_amount ?? "—"} USDT</div>
          <div><b>INR:</b> ₹${tx.inr_amount ?? "—"}</div>

          <div class="execution-row">
            <span class="badge badge-${badge}">
              ${state}
            </span>

            ${
              state === "FAILED"
                ? `<button class="retry-btn" onclick="retryExecution('${tx.id}')">Retry</button>`
                : ""
            }
          </div>

          <a href="#" onclick="viewTimeline('${tx.id}')">
            View execution timeline
          </a>
        </div>
      `;
    }).join("");
  } catch {
    box.innerHTML = "Failed to load history.";
  }
}

/* ================================
   TIMELINE
================================ */
async function viewTimeline(txId) {
  const res = await fetch(`/execution/${txId}/timeline`);
  const timeline = await res.json();

  const body = document.getElementById("timelineBody");

  body.innerHTML = Array.isArray(timeline) && timeline.length
    ? `
      <div class="timeline">
        ${timeline.map(row => `
          <div class="timeline-row">
            <div class="timeline-state">${row.to_state}</div>
            <div class="timeline-reason">${row.reason || ""}</div>
            <div class="timeline-time">
              ${new Date(row.created_at).toLocaleString()}
            </div>
          </div>
        `).join("")}
      </div>
    `
    : "<p>No timeline found.</p>";

  document.getElementById("timelineModal").classList.remove("hidden");
}

function closeTimeline() {
  document.getElementById("timelineModal").classList.add("hidden");
}

/* ================================
   RETRY
================================ */
async function retryExecution(txId) {
  const res = await fetch(`/execution/${txId}/retry`, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Retry not allowed");
    return;
  }

  setExecutionStatus("CREATED");
  pollExecutionState(txId);
}

/* ================================
   INIT
================================ */
setExecutionStatus(null);
lockPayButton(false);
loadDemoBalance();
loadLiveRate();
loadHistory();
