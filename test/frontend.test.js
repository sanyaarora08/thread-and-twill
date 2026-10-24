'use strict';
// Runs the real public/app.js against a tiny fake page and a fake Razorpay window.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'products.json'), 'utf8'));
const code = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

function makePage() {
  const els = {};
  const handlers = {};
  const makeEl = () => {
    const classes = new Set();
    const attrs = {};
    return {
      innerHTML: '', textContent: '', value: '', disabled: false,
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
      setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k], focus() {}, addEventListener() {}
    };
  };
  const document = {
    querySelector: (sel) => (els[sel] = els[sel] || makeEl()),
    querySelectorAll: () => [],
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); }
  };
  const fire = (type, ev) => (handlers[type] || []).forEach((fn) => fn(ev));
  const click = (spec) => {
    const attrs = spec.attrs || {};
    const target = { id: spec.id || '', closest() { return target; }, hasAttribute: (n) => n in attrs, getAttribute: (n) => attrs[n] };
    fire('click', { target });
  };
  const type = (field, value) => fire('input', { target: { getAttribute: (n) => (n === 'data-field' ? field : null), value } });
  return { document, els, click, type };
}

test('storefront: browse, add to bag, fill the form, pay, see confirmation', async () => {
  const page = makePage();
  const calls = [];
  const store = {};
  let rzOptions = null;

  class FakeRazorpay {
    constructor(opts) { rzOptions = opts; this.handlers = {}; }
    on(name, fn) { this.handlers[name] = fn; }
    open() { this.opened = true; }
  }
  const sandbox = {
    document: page.document,
    window: { Razorpay: FakeRazorpay },
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    fetch: async (url, init) => {
      calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      if (url === '/api/catalogue') return { ok: true, json: async () => catalogue };
      if (url === '/api/orders') return { ok: true, json: async () => ({ orderId: 'order_9', amount: 460000, currency: 'INR', keyId: 'rzp_test_x', receipt: 'TTABC123', total: 4600, shipping: 99 }) };
      if (url === '/api/verify') return { ok: true, json: async () => ({ ok: true }) };
      throw new Error('unexpected ' + url);
    },
    console, Number, String, Math, JSON, Array, Object
  };
  vm.runInNewContext(code, sandbox);
  await tick();

  assert.equal((page.els['#grid'].innerHTML.match(/data-open=/g) || []).length, 12);
  assert.match(page.els['#hero-arches'].innerHTML, /<svg/);

  // Open a piece, try to add without a size, then choose one
  page.click({ attrs: { 'data-open': 'rani' } });
  assert.match(page.els['#modal'].innerHTML, /Rani/);
  page.click({ id: 'add-bag' });
  assert.match(page.els['#err'].textContent, /Choose a size/);
  page.click({ attrs: { 'data-size': 'M' } });
  page.click({ id: 'add-bag' });
  assert.equal(page.els['#bag-count'].textContent, 1);
  assert.match(page.els['#lines'].innerHTML, /Rani/);
  assert.match(page.els['#sum'].innerHTML, /Checkout/);
  assert.match(page.els['#sum'].innerHTML, /₹99/); // ₹4,200 is under the free-shipping line

  // Checkout form
  page.click({ id: 'checkout' });
  assert.equal(page.els['#drawer-title'].textContent, 'Delivery and payment');
  assert.match(page.els['#lines'].innerHTML, /id="f-pin"/);
  page.click({ id: 'pay' });
  assert.match(page.els['#form-err'].textContent, /full name/);

  page.type('name', 'Asha Verma'); page.type('phone', '98888 95390'); page.type('email', 'asha@example.com');
  page.type('address', '12 Model Town'); page.type('city', 'Ludhiana'); page.type('state', 'Punjab'); page.type('pin', '14100');
  page.click({ id: 'pay' });
  assert.match(page.els['#form-err'].textContent, /PIN/);

  page.type('pin', '141002');
  page.click({ id: 'pay' });
  await tick();
  const orderCall = calls.filter((c) => c.url === '/api/orders')[0];
  assert.deepEqual(orderCall.body.items, [{ id: 'rani', size: 'M', qty: 1 }]); // no prices are sent
  assert.equal(orderCall.body.customer.city, 'Ludhiana');
  assert.equal(rzOptions.order_id, 'order_9');
  assert.equal(rzOptions.key, 'rzp_test_x');
  assert.equal(rzOptions.prefill.contact, '9888895390');

  // Razorpay reports success; the page must confirm it with the server before thanking the customer
  rzOptions.handler({ razorpay_order_id: 'order_9', razorpay_payment_id: 'pay_9', razorpay_signature: 'sig' });
  await tick();
  assert.equal(calls.filter((c) => c.url === '/api/verify')[0].body.razorpay_payment_id, 'pay_9');
  assert.equal(page.els['#drawer-title'].textContent, 'Order placed');
  assert.match(page.els['#lines'].innerHTML, /TTABC123/);
  assert.equal(page.els['#bag-count'].textContent, 0);
  assert.equal(store['tt-cart'], '[]');
});

test('storefront: shows a clear message when the server refuses to start a payment', async () => {
  const page = makePage();
  let n = 0;
  const sandbox = {
    document: page.document, window: {},
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async (url) => {
      if (url === '/api/catalogue') return { ok: true, json: async () => catalogue };
      n += 1;
      return { ok: false, json: async () => ({ error: 'Online payment is not switched on yet.' }) };
    },
    console, Number, String, Math, JSON, Array, Object
  };
  vm.runInNewContext(code, sandbox);
  await tick();
  page.click({ attrs: { 'data-open': 'dhoop' } });
  page.click({ attrs: { 'data-size': 'S' } });
  page.click({ id: 'add-bag' });
  page.click({ id: 'checkout' });
  [['name', 'Asha Verma'], ['phone', '9888895390'], ['email', 'a@b.co'], ['address', '12 Model Town'], ['city', 'Ludhiana'], ['state', 'Punjab'], ['pin', '141002']]
    .forEach(([k, v]) => page.type(k, v));
  page.click({ id: 'pay' });
  await tick();
  assert.equal(n, 1);
  assert.match(page.els['#form-err'].textContent, /not switched on/);
});
