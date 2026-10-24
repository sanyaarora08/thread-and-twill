'use strict';

// Talks to Razorpay's REST API directly (no SDK needed).
// Docs: https://razorpay.com/docs/api/orders/

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true; // safe to show to the customer or admin
  return err;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One API call with up to 2 retries (with a growing pause) when Razorpay is slow
// or returns a 5xx error. 4xx errors are never retried.
async function call(method, path, o) {
  const fetchImpl = o.fetchImpl || fetch;
  const sleep = o.sleep || defaultSleep;
  const base = o.base || 'https://api.razorpay.com';
  const retries = o.retries == null ? 2 : o.retries;
  const auth = 'Basic ' + Buffer.from(o.keyId + ':' + o.keySecret).toString('base64');

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers: Object.assign({ Authorization: auth }, o.body ? { 'Content-Type': 'application/json' } : {}),
        body: o.body ? JSON.stringify(o.body) : undefined,
        signal: AbortSignal.timeout(15000)
      });
    } catch (e) {
      if (attempt < retries) { await sleep(300 * Math.pow(2, attempt)); continue; }
      console.error('Razorpay request failed (' + (e && e.name) + ')');
      throw httpError(503, 'The payment service is not responding. Please try again in a moment.');
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;

    const error = (data && data.error) || {};
    if (res.status >= 500 && attempt < retries) { await sleep(300 * Math.pow(2, attempt)); continue; }

    if (res.status === 401) {
      console.error('Razorpay rejected the API keys (401). Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your host settings.');
      throw httpError(500, 'Payment provider misconfigured.');
    }
    if (res.status === 400) {
      throw httpError(400, error.description || 'The payment service could not accept this request.');
    }
    console.error('Razorpay error', res.status, error.code || '', error.description || '');
    if (res.status >= 500) throw httpError(503, 'The payment service is busy. Please try again in a moment.');
    throw httpError(502, 'The payment service could not complete this request.');
  }
}

async function createOrder(o) {
  if (!Number.isInteger(o.amountPaise) || o.amountPaise < 100) {
    throw httpError(400, 'The order total is too low to charge.');
  }
  const order = await call('POST', '/v1/orders', Object.assign({}, o, {
    body: { amount: o.amountPaise, currency: 'INR', receipt: o.receipt, notes: o.notes }
  }));
  if (!order || !order.id) {
    console.error('Razorpay order response had no id.');
    throw httpError(502, 'The payment service gave an unexpected answer. Please try again.');
  }
  return order;
}

// Lists orders created between two Unix times (seconds), newest pages first as
// Razorpay returns them. Reads up to 500 orders; `truncated` says if there are more.
async function listOrders(o) {
  const pageSize = 100;
  const maxPages = 5;
  const items = [];
  for (let page = 0; page < maxPages; page++) {
    const path = '/v1/orders?from=' + o.fromSec + '&to=' + o.toSec + '&count=' + pageSize +
      '&skip=' + page * pageSize + '&' + encodeURIComponent('expand[]') + '=payments';
    const data = await call('GET', path, o);
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push.apply(items, batch);
    if (batch.length < pageSize) return { items, truncated: false };
  }
  return { items, truncated: true };
}

module.exports = { createOrder, listOrders, call, httpError };
