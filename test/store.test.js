'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { createServer } = require('../server');
const { priceCart, validateCustomer } = require('../lib/pricing');
const { paymentSignature, verifyPayment, verifyWebhook } = require('../lib/signature');

const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products.json'), 'utf8'));
const cfg = catalogue.config;
const customer = { name: 'Asha Verma', phone: '98888 95390', email: 'asha@example.com', address: '12 Model Town', city: 'Ludhiana', state: 'Punjab', pin: '141002' };

test('pricing: flat shipping under the free-shipping line, free above it', () => {
  const low = priceCart([{ id: 'rani', size: 'M', qty: 1 }], catalogue.products, cfg);
  assert.equal(low.subtotal, 4200);
  assert.equal(low.shipping, cfg.shippingFlat);
  assert.equal(low.total, 4200 + cfg.shippingFlat);
  const high = priceCart([{ id: 'rukmini', size: 'Free size', qty: 2 }], catalogue.products, cfg);
  assert.equal(high.total, 77000);
  assert.equal(high.shipping, 0);
});

test('pricing: rejects bad sizes, quantities, unknown items and empty bags', () => {
  assert.throws(() => priceCart([{ id: 'rani', size: 'XXXL', qty: 1 }], catalogue.products, cfg), /valid size/);
  assert.throws(() => priceCart([{ id: 'rani', size: 'M', qty: 11 }], catalogue.products, cfg), /Quantity/);
  assert.throws(() => priceCart([{ id: 'rani', size: 'M', qty: 1.5 }], catalogue.products, cfg), /Quantity/);
  assert.throws(() => priceCart([{ id: 'nope', size: 'M', qty: 1 }], catalogue.products, cfg), /no longer available/);
  assert.throws(() => priceCart([], catalogue.products, cfg), /empty/);
});

test('customer: cleans phone numbers and rejects bad details', () => {
  assert.equal(validateCustomer(customer).phone, '9888895390');
  assert.equal(validateCustomer(Object.assign({}, customer, { phone: '+91 98888-95390' })).phone, '9888895390');
  assert.throws(() => validateCustomer(Object.assign({}, customer, { phone: '12345' })), /mobile/);
  assert.throws(() => validateCustomer(Object.assign({}, customer, { pin: '1234' })), /PIN/);
  assert.throws(() => validateCustomer(Object.assign({}, customer, { email: 'nope' })), /email/);
});

test('signatures: payment and webhook checks', () => {
  const sig = paymentSignature('order_1', 'pay_1', 'secret');
  assert.ok(verifyPayment('order_1', 'pay_1', sig, 'secret'));
  assert.ok(!verifyPayment('order_1', 'pay_2', sig, 'secret'));
  assert.ok(!verifyPayment('order_1', 'pay_1', sig, 'other'));
  assert.ok(!verifyPayment('order_1', 'pay_1', '', 'secret'));
  const body = Buffer.from('{"event":"payment.captured"}');
  const good = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  assert.ok(verifyWebhook(body, good, 'whsec'));
  assert.ok(!verifyWebhook(body, good, 'wrong'));
});

function start(env, createOrder) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
  const server = createServer({ env: Object.assign({ DATA_DIR: dir }, env), createOrder });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, dir, port: server.address().port })));
}
function call(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}, headers) }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, text, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('server: payments report "not switched on" until keys are set', async () => {
  const { server, port } = await start({});
  try {
    const cat = await call(port, 'GET', '/api/catalogue');
    assert.equal(cat.status, 200);
    assert.equal(cat.json.products.length, 12);
    const r = await call(port, 'POST', '/api/orders', { items: [{ id: 'rani', size: 'M', qty: 1 }], customer });
    assert.equal(r.status, 503);
  } finally { server.close(); }
});

test('server: order amount comes from server prices, not the browser', async () => {
  let seen;
  const { server, port, dir } = await start({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'secret' }, async (o) => {
    seen = o;
    return { id: 'order_test1', amount: o.amountPaise, currency: 'INR' };
  });
  try {
    const r = await call(port, 'POST', '/api/orders', { items: [{ id: 'rani', size: 'M', qty: 2, price: 1 }], price: 1, total: 1, customer });
    assert.equal(r.status, 200);
    assert.equal(seen.amountPaise, (4200 * 2) * 100);
    assert.equal(r.json.amount, 840000);
    assert.equal(r.json.orderId, 'order_test1');
    assert.equal(r.json.keyId, 'rzp_test_x');
    assert.ok(!('keySecret' in r.json) && !JSON.stringify(r.json).includes('secret'));
    assert.match(seen.notes.phone, /^9888895390$/);

    const bad = await call(port, 'POST', '/api/orders', { items: [{ id: 'rani', size: 'M', qty: 1 }], customer: Object.assign({}, customer, { pin: 'x' }) });
    assert.equal(bad.status, 400);
    const badJson = await call(port, 'POST', '/api/orders', Buffer.from('{nope'));
    assert.equal(badJson.status, 400);
    await new Promise((r2) => setTimeout(r2, 50));
    assert.match(fs.readFileSync(path.join(dir, 'orders.jsonl'), 'utf8'), /order_created/);
  } finally { server.close(); }
});

test('server: verify and webhook accept only correctly signed requests', async () => {
  const { server, port } = await start({ RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 'secret', RAZORPAY_WEBHOOK_SECRET: 'whsec' });
  try {
    const sig = paymentSignature('order_1', 'pay_1', 'secret');
    const ok = await call(port, 'POST', '/api/verify', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sig });
    assert.equal(ok.status, 200);
    const no = await call(port, 'POST', '/api/verify', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_9', razorpay_signature: sig });
    assert.equal(no.status, 400);

    const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', status: 'captured' } } } }));
    const good = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
    assert.equal((await call(port, 'POST', '/api/razorpay-webhook', body, { 'x-razorpay-signature': good })).status, 200);
    assert.equal((await call(port, 'POST', '/api/razorpay-webhook', body, { 'x-razorpay-signature': 'bad' })).status, 400);
  } finally { server.close(); }
});

test('server: static files are served and path tricks are refused', async () => {
  const { server, port } = await start({});
  try {
    const home = await call(port, 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /text\/html/);
    assert.equal((await call(port, 'GET', '/..%2fserver.js')).status, 404);
    assert.equal((await call(port, 'GET', '/%2e%2e/server.js')).status, 404);
    assert.equal((await call(port, 'GET', '/../server.js')).status, 404);
    assert.equal((await call(port, 'GET', '/.env')).status, 404);
    assert.equal((await call(port, 'GET', '/products.json')).status, 404);
  } finally { server.close(); }
});
