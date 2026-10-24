'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { createServer } = require('../server');
const { summarise, istDay } = require('../lib/summary');
const razorpay = require('../lib/razorpay');

const NOW = Math.floor(Date.UTC(2026, 9, 24, 12, 0, 0) / 1000); // 24 Oct 2026, 17:30 IST
const orders = [
  { id: 'order_1', receipt: 'TT1', created_at: NOW - 3600, status: 'paid', amount: 460000, amount_paid: 460000,
    notes: { name: 'Asha Verma', phone: '9888895390', email: 'a@example.com', address: '12 Model Town, Ludhiana, Punjab 141002', items: 'Rani M x2, Rukmini Free size x1' },
    payments: { items: [{ id: 'pay_1', status: 'captured', method: 'upi' }] } },
  { id: 'order_2', receipt: 'TT2', created_at: NOW - 86400 * 2, status: 'paid', amount: 640000, amount_paid: 640000,
    notes: { name: 'Meera', phone: '9000000001', email: 'm@example.com', address: 'Delhi', items: 'Meher L x1' }, payments: { items: [] } },
  { id: 'order_3', receipt: 'TT3', created_at: NOW - 7200, status: 'attempted', amount: 99900, amount_paid: 0,
    notes: { name: '=HYPERLINK("http://x")', items: 'Chai S x1' } },
  { id: 'order_4', receipt: 'TT4', created_at: NOW - 10, status: 'created', amount: 50000, amount_paid: 0, notes: [] }
];

test('summary: totals, top pieces, daily buckets and unpaid orders', () => {
  const s = summarise(orders, { days: 7, nowSec: NOW });
  assert.equal(s.totals.paidCount, 2);
  assert.equal(s.totals.revenue, 4600 + 6400);
  assert.equal(s.totals.average, 5500);
  assert.equal(s.totals.unpaidCount, 2);
  assert.deepEqual(s.topPieces[0], { name: 'Rani', units: 2 });
  assert.ok(s.topPieces.some((p) => p.name === 'Rukmini Free size'.replace(' Free size', '') && p.units === 1));
  assert.equal(s.daily.length, 7);
  assert.equal(s.daily[6].day, istDay(NOW));
  assert.equal(s.daily[6].revenue, 4600);
  assert.equal(s.daily.reduce((n, d) => n + d.revenue, 0), 11000);
  assert.equal(s.orders[0].receipt, 'TT4'); // newest first
  assert.equal(s.orders.find((o) => o.receipt === 'TT1').method, 'upi');
  assert.equal(s.orders.find((o) => o.receipt === 'TT4').name, ''); // notes may arrive as []
  assert.equal(s.orders.find((o) => o.receipt === 'TT3').amount, 999); // unpaid shows the amount tried
});

test('summary: a late-night sale in India counts for the Indian date', () => {
  const lateIst = Math.floor(Date.UTC(2026, 9, 24, 19, 0, 0) / 1000); // 00:30 IST on the 25th
  assert.equal(istDay(lateIst), '2026-10-25');
});

function start(env, extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
  const server = createServer(Object.assign({ env: Object.assign({ DATA_DIR: dir }, env) }, extra));
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
function call(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
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

const ENV = { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'secret', RAZORPAY_WEBHOOK_SECRET: 'wh', ADMIN_PASSWORD: 'correct horse battery' };

test('admin: password gate, session cookie and order data', async () => {
  let listCalls = 0;
  const { server, port } = await start(ENV, { listOrders: async () => { listCalls++; return { items: orders, truncated: false }; } });
  try {
    assert.equal((await call(port, 'GET', '/api/admin/orders')).status, 401);
    assert.equal((await call(port, 'GET', '/api/admin/orders', undefined, { Cookie: 'tt_admin=123.abc' })).status, 401);

    const wrong = await call(port, 'POST', '/api/admin/login', { password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.ok(!wrong.headers['set-cookie']);

    const ok = await call(port, 'POST', '/api/admin/login', { password: ENV.ADMIN_PASSWORD });
    assert.equal(ok.status, 200);
    const setCookie = ok.headers['set-cookie'][0];
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = setCookie.split(';')[0];

    const data = await call(port, 'GET', '/api/admin/orders?days=7', undefined, { Cookie: cookie });
    assert.equal(data.status, 200);
    assert.equal(data.json.totals.paidCount, 2);
    assert.equal(data.json.daily.length, 7);
    assert.equal(data.json.status.mode, 'test');
    assert.equal(data.json.status.webhook, true);
    assert.equal(data.headers['cache-control'], 'no-store');
    assert.ok(!JSON.stringify(data.json).includes('secret'));

    await call(port, 'GET', '/api/admin/orders?days=7', undefined, { Cookie: cookie });
    assert.equal(listCalls, 1); // second request served from the 20-second cache

    // a cookie signed by a different server (or tampered with) is refused
    const parts = cookie.split('=')[1].split('.');
    const forged = 'tt_admin=' + (Number(parts[0]) + 1000) + '.' + parts[1];
    assert.equal((await call(port, 'GET', '/api/admin/orders', undefined, { Cookie: forged })).status, 401);

    const out = await call(port, 'POST', '/api/admin/logout');
    assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
  } finally { server.close(); }
});

test('admin: stays off without a strong password, and limits guessing', async () => {
  const off = await start(Object.assign({}, ENV, { ADMIN_PASSWORD: 'short' }));
  try {
    assert.equal((await call(off.port, 'POST', '/api/admin/login', { password: 'short' })).status, 503);
    assert.equal((await call(off.port, 'GET', '/api/admin/orders')).status, 503);
  } finally { off.server.close(); }

  const { server, port } = await start(ENV, { listOrders: async () => ({ items: [], truncated: false }) });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await call(port, 'POST', '/api/admin/login', { password: 'guess' + i })).status, 401);
    // after 5 tries even the right password is refused for a while
    assert.equal((await call(port, 'POST', '/api/admin/login', { password: ENV.ADMIN_PASSWORD })).status, 429);
  } finally { server.close(); }
});

test('admin: page is served without indexing, and a Razorpay failure shows a clear message', async () => {
  const { server, port } = await start(ENV, { listOrders: async () => { throw razorpay.httpError(503, 'The payment service is busy. Please try again in a moment.'); } });
  try {
    const page = await call(port, 'GET', '/admin');
    assert.equal(page.status, 200);
    assert.match(page.headers['x-robots-tag'], /noindex/);
    assert.match(page.text, /Sign in/);
    const login = await call(port, 'POST', '/api/admin/login', { password: ENV.ADMIN_PASSWORD });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const r = await call(port, 'GET', '/api/admin/orders', undefined, { Cookie: cookie });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /busy/);
  } finally { server.close(); }
});

test('razorpay: retries brief outages, maps errors, never retries a rejection', async () => {
  const noWait = () => Promise.resolve();
  const base = { keyId: 'k', keySecret: 's', amountPaise: 500000, receipt: 'R1', notes: {}, sleep: noWait };
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

  let n = 0;
  const flaky = await razorpay.createOrder(Object.assign({}, base, {
    fetchImpl: async () => { n++; return n < 3 ? reply(502, {}) : reply(200, { id: 'order_ok', amount: 500000 }); }
  }));
  assert.equal(flaky.id, 'order_ok');
  assert.equal(n, 3);

  n = 0;
  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { fetchImpl: async () => { n++; return reply(500, {}); } })), (e) => e.status === 503);
  assert.equal(n, 3); // first try plus two retries

  n = 0;
  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { fetchImpl: async () => { n++; return reply(401, { error: { description: 'Authentication failed' } }); } })),
    (e) => e.status === 500 && /misconfigured/.test(e.message) && !/Authentication/.test(e.message));
  assert.equal(n, 1);

  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { fetchImpl: async () => reply(400, { error: { description: 'Amount exceeds maximum' } }) })),
    (e) => e.status === 400 && /Amount exceeds/.test(e.message));
  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { fetchImpl: async () => reply(200, {}) })), (e) => e.status === 502);
  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { amountPaise: 50, fetchImpl: async () => reply(200, {}) })), (e) => e.status === 400);
  await assert.rejects(razorpay.createOrder(Object.assign({}, base, { fetchImpl: async () => { throw new Error('boom'); } })), (e) => e.status === 503);
});

test('razorpay: order list asks for the right dates and keeps paging until the last page', async () => {
  const seen = [];
  const page = (len) => Array.from({ length: len }, (_, i) => ({ id: 'o' + i }));
  const result = await razorpay.listOrders({
    keyId: 'k', keySecret: 's', fromSec: 100, toSec: 200, sleep: () => Promise.resolve(),
    fetchImpl: async (url) => { seen.push(url); return { ok: true, status: 200, json: async () => ({ items: page(seen.length === 1 ? 100 : 40) }) }; }
  });
  assert.equal(result.items.length, 140);
  assert.equal(result.truncated, false);
  assert.match(seen[0], /from=100&to=200&count=100&skip=0/);
  assert.match(seen[1], /skip=100/);
});
