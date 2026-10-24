'use strict';
// Thread and Twill storefront server. Uses only Node's built-in modules.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { priceCart, validateCustomer } = require('./lib/pricing');
const { verifyPayment, verifyWebhook } = require('./lib/signature');
const { createStore } = require('./lib/store');
const { createLimiter } = require('./lib/ratelimit');
const razorpay = require('./lib/razorpay');

// Local development only: read KEY=value lines from .env if the file exists.
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

function createServer(opts) {
  const env = opts.env;
  const publicDir = path.join(__dirname, 'public');
  const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
  const store = createStore(env.DATA_DIR || path.join(__dirname, 'data'));
  const createOrder = opts.createOrder || razorpay.createOrder;
  const orderLimiter = createLimiter(20, 15 * 60 * 1000);
  const verifyLimiter = createLimiter(60, 15 * 60 * 1000);
  const trustProxy = env.TRUST_PROXY === '1';

  function clientIp(req) {
    if (trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  function send(res, status, body, headers) {
    const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
    const payload = isJson ? JSON.stringify(body) : body;
    res.writeHead(status, Object.assign({
      'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN'
    }, headers));
    res.end(payload);
  }

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > limit) {
          const err = new Error('Request too large.');
          err.status = 413;
          reject(err);
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  async function readJson(req) {
    const raw = await readBody(req, 100 * 1024);
    try { return JSON.parse(raw.toString('utf8') || '{}'); } catch (e) {
      const err = new Error('Invalid request.');
      err.status = 400;
      throw err;
    }
  }

  async function handleApi(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/catalogue') {
      return send(res, 200, catalogue, { 'Cache-Control': 'no-cache' });
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      if (!orderLimiter(clientIp(req))) return send(res, 429, { error: 'Too many attempts. Please try again in a few minutes.' });
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        return send(res, 503, { error: 'Online payment is not switched on yet.' });
      }
      const body = await readJson(req);
      const cart = priceCart(body.items, catalogue.products, catalogue.config);
      const customer = validateCustomer(body.customer);
      const receipt = 'TT' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
      const summary = cart.lines.map((l) => l.name + ' ' + l.size + ' x' + l.qty).join(', ');
      const order = await createOrder({
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
        amountPaise: cart.total * 100,
        receipt,
        notes: {
          name: customer.name, phone: customer.phone, email: customer.email,
          address: (customer.address + ', ' + customer.city + ', ' + customer.state + ' ' + customer.pin).slice(0, 250),
          items: summary.slice(0, 250)
        }
      });
      store.append({ event: 'order_created', receipt, orderId: order.id, total: cart.total, shipping: cart.shipping, lines: cart.lines, customer });
      return send(res, 200, {
        orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID,
        receipt, total: cart.total, shipping: cart.shipping
      });
    }

    if (req.method === 'POST' && pathname === '/api/verify') {
      if (!verifyLimiter(clientIp(req))) return send(res, 429, { error: 'Too many attempts.' });
      if (!env.RAZORPAY_KEY_SECRET) return send(res, 503, { error: 'Online payment is not switched on yet.' });
      const b = await readJson(req);
      const ok = verifyPayment(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature, env.RAZORPAY_KEY_SECRET);
      if (!ok) {
        store.append({ event: 'verify_failed', orderId: String(b.razorpay_order_id || '').slice(0, 40) });
        return send(res, 400, { error: 'We could not confirm this payment.' });
      }
      store.append({ event: 'payment_verified', orderId: b.razorpay_order_id, paymentId: b.razorpay_payment_id });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/razorpay-webhook') {
      if (!env.RAZORPAY_WEBHOOK_SECRET) return send(res, 503, { error: 'Webhook not configured.' });
      const raw = await readBody(req, 256 * 1024);
      if (!verifyWebhook(raw, req.headers['x-razorpay-signature'], env.RAZORPAY_WEBHOOK_SECRET)) {
        return send(res, 400, { error: 'Bad signature.' });
      }
      let event = {};
      try { event = JSON.parse(raw.toString('utf8')); } catch (e) { return send(res, 400, { error: 'Bad body.' }); }
      const payment = event.payload && event.payload.payment && event.payload.payment.entity;
      store.append({
        event: 'webhook:' + event.event,
        orderId: payment && payment.order_id, paymentId: payment && payment.id,
        status: payment && payment.status, method: payment && payment.method
      });
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/healthz') return send(res, 200, { ok: true });
    return send(res, 404, { error: 'Not found.' });
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let rel;
    try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(publicDir, rel));
    const inside = file === publicDir || file.startsWith(publicDir + path.sep);
    const hidden = path.relative(publicDir, file).split(path.sep).some((p) => p.startsWith('.'));
    if (!inside || hidden) return send(res, 404, 'Not found');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found');
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const cache = path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600';
      res.writeHead(200, {
        'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
      return serveStatic(req, res, url.pathname);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      send(res, status, { error: status >= 500 && status !== 502 ? 'Something went wrong. Please try again.' : err.message });
    }
  });
}

module.exports = { createServer, loadDotEnv };

if (require.main === module) {
  loadDotEnv(path.join(__dirname, '.env'));
  const port = Number(process.env.PORT) || 3000;
  createServer({ env: process.env }).listen(port, () => {
    const live = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
    console.log('Thread and Twill running on port ' + port + (live ? '' : ' (payments off: add Razorpay keys)'));
  });
}
