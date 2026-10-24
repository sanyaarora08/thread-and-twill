'use strict';

// Turns Razorpay order records into what the admin page shows.
const SIZE = '(?:XXS|XS|S|M|L|XL|XXL|3XL|Free size)';
const ITEM = new RegExp('^(.+) (' + SIZE + ') x(\\d+)$');
const DAY = 86400;

// Calendar date in India (UTC+5:30), so a 11pm sale counts for that day.
function istDay(sec) {
  return new Date((sec + 19800) * 1000).toISOString().slice(0, 10);
}
const text = (v) => (v == null ? '' : String(v));
const rupees = (paise) => Number(((Number(paise) || 0) / 100).toFixed(2));

function summarise(rawOrders, opts) {
  const days = opts.days;
  const nowSec = opts.nowSec;

  const orders = (rawOrders || []).map((o) => {
    const n = o.notes && !Array.isArray(o.notes) && typeof o.notes === 'object' ? o.notes : {};
    const paid = o.status === 'paid';
    const payments = o.payments && Array.isArray(o.payments.items) ? o.payments.items : [];
    const captured = payments.filter((p) => p && p.status === 'captured')[0];
    return {
      id: text(o.id),
      receipt: text(o.receipt),
      createdAt: new Date(o.created_at * 1000).toISOString(),
      day: istDay(o.created_at),
      status: paid ? 'paid' : 'unpaid',
      amount: rupees(paid ? o.amount_paid : o.amount),
      name: text(n.name),
      phone: text(n.phone),
      email: text(n.email),
      address: text(n.address),
      items: text(n.items),
      method: captured ? text(captured.method) : '',
      paymentId: captured ? text(captured.id) : ''
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const paidRows = orders.filter((o) => o.status === 'paid');
  const revenue = paidRows.reduce((sum, o) => sum + o.amount, 0);

  const units = {};
  paidRows.forEach((o) => {
    o.items.split(/,\s*/).forEach((part) => {
      const m = part.match(ITEM);
      if (m) units[m[1]] = (units[m[1]] || 0) + Number(m[3]);
    });
  });
  const topPieces = Object.keys(units)
    .map((name) => ({ name, units: units[name] }))
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
    .slice(0, 8);

  const byDay = {};
  paidRows.forEach((o) => {
    const d = byDay[o.day] || (byDay[o.day] = { orders: 0, revenue: 0 });
    d.orders += 1;
    d.revenue += o.amount;
  });
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = istDay(nowSec - i * DAY);
    const d = byDay[day] || { orders: 0, revenue: 0 };
    daily.push({ day, orders: d.orders, revenue: Number(d.revenue.toFixed(2)) });
  }

  return {
    orders,
    totals: {
      paidCount: paidRows.length,
      revenue: Number(revenue.toFixed(2)),
      average: paidRows.length ? Math.round(revenue / paidRows.length) : 0,
      unpaidCount: orders.length - paidRows.length
    },
    topPieces,
    daily
  };
}

module.exports = { summarise, istDay };
