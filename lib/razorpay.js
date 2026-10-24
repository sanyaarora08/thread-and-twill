'use strict';

// Creates a Razorpay order through their REST API (no SDK needed).
// Docs: https://razorpay.com/docs/api/orders/
async function createOrder({ keyId, keySecret, amountPaise, receipt, notes }) {
  const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data && data.error && data.error.description ? data.error.description : 'status ' + res.status;
    const err = new Error('Razorpay refused the order: ' + reason);
    err.status = 502;
    throw err;
  }
  return data;
}

module.exports = { createOrder };
