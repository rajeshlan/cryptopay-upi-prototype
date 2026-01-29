// public/app.js

async function scanQRImage() {
  const fileInput = document.getElementById("qrimage");
  const upiInput = document.getElementById("upi");

  if (!fileInput.files.length) {
    alert("Select a QR image first");
    return;
  }

  const file = fileInput.files[0];
  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (!code) {
        alert("QR not detected");
        return;
      }

      try {
        const params = new URL(code.data).searchParams;
        const upiId = params.get("pa");

        if (!upiId) {
          alert("UPI ID not found in QR");
          return;
        }

        upiInput.value = upiId;
      } catch {
        alert("Invalid QR format");
      }
    };

    img.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function parseQR() {
  const qr = document.getElementById("qrtext").value;
  const upiInput = document.getElementById("upi");

  if (!qr) {
    alert("Paste QR text first");
    return;
  }

  try {
    const params = new URL(qr).searchParams;
    const upiId = params.get("pa");

    if (!upiId) {
      alert("UPI ID not found in QR");
      return;
    }

    upiInput.value = upiId;
  } catch {
    alert("Invalid QR format");
  }
}

async function pay() {
  const upi = document.getElementById("upi").value;
  const amount = document.getElementById("amount").value;

  const resBox = document.getElementById("result");
  resBox.textContent = "Processing...";

  try {
    const res = await fetch("/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "6364eeb3-a710-4df6-b546-b80adabe1c75",
        upi_id: upi,
        crypto_amount: Number(amount),
      }),
    });

    const data = await res.json();
    resBox.textContent = JSON.stringify(data, null, 2);

    loadHistory(); // STEP 39.3 — refresh after pay
  } catch (err) {
    resBox.textContent = err.message;
  }
}

async function loadHistory() {
  const box = document.getElementById("history");
  box.textContent = "Loading...";

  try {
    const res = await fetch("/transactions?limit=5");
    const data = await res.json();

    if (!data.length) {
      box.textContent = "No transactions yet.";
      return;
    }

    box.innerHTML = data
      .map(
        (tx) => `
      <div style="border:1px solid #1f2937; border-radius:6px; padding:8px; margin-bottom:6px;">
        <div><b>UPI:</b> ${tx.upi_id || "-"}</div>
        <div><b>Crypto:</b> ${tx.crypto_amount} USDT</div>
        <div><b>INR:</b> ₹${tx.inr_amount}</div>
        <div><b>Rate:</b> ${tx.rate_used}</div>
        <div><b>Status:</b> ${tx.payout_status}</div>
        <div style="font-size:11px; opacity:0.7;">
          ${new Date(tx.created_at).toLocaleString()}
        </div>
      </div>
    `
      )
      .join("");
  } catch {
    box.textContent = "Failed to load history.";
  }
}

// STEP 39.3 — auto-load on page load
loadHistory();
