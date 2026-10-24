'use strict';

// All money is whole rupees here. The server always prices the bag itself, so a
// customer cannot change a price by editing the page.

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function priceCart(items, products, config) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw bad('Your bag is empty or has too many items.');
  }
  const lines = [];
  let subtotal = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === (item && item.id));
    if (!product) throw bad('One of the items in your bag is no longer available.');
    if (!product.sizes.includes(item.size)) throw bad('Choose a valid size for ' + product.name + '.');
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw bad('Quantity must be between 1 and 10.');
    lines.push({ id: product.id, name: product.name, size: item.size, qty, unit: product.price });
    subtotal += product.price * qty;
  }
  const shipping = subtotal >= config.freeShippingAbove ? 0 : config.shippingFlat;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

function clean(value, min, max, label) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw bad('Please check the ' + label + '.');
  return text;
}

function validateCustomer(input) {
  const c = input || {};
  const phone = String(c.phone || '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) throw bad('Enter a 10-digit Indian mobile number.');
  const email = clean(c.email, 5, 120, 'email address');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Enter a valid email address.');
  const pin = String(c.pin || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) throw bad('Enter a 6-digit PIN code.');
  return {
    name: clean(c.name, 2, 80, 'name'),
    phone,
    email,
    address: clean(c.address, 5, 200, 'address'),
    city: clean(c.city, 2, 60, 'city'),
    state: clean(c.state, 2, 60, 'state'),
    pin
  };
}

module.exports = { priceCart, validateCustomer, bad };
