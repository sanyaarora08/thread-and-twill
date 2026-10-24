'use strict';
const crypto = require('crypto');

function safeEqual(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Razorpay signs "order_id|payment_id" with your key secret after a payment.
function paymentSignature(orderId, paymentId, secret) {
  return crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
}

function verifyPayment(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  return safeEqual(paymentSignature(orderId, paymentId, secret), signature);
}

// Webhooks are signed over the raw request body with the webhook secret.
function verifyWebhook(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { paymentSignature, verifyPayment, verifyWebhook, safeEqual };
