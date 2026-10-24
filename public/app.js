(function () {
  var SIL = {
    kurta: [
      ['d', 'M76 204 L98 204 L94 266 L80 266 Z'], ['d', 'M102 204 L124 204 L120 266 L106 266 Z'],
      ['b', 'M84 36 Q100 50 116 36 L132 46 L150 122 L136 126 L128 86 L132 204 L68 204 L72 86 L64 126 L50 122 L68 46 Z'],
      ['s', 'M84 36 Q100 50 116 36'], ['s', 'M100 46 L100 126'], ['s', 'M69 198 L131 198']
    ],
    anarkali: [
      ['b', 'M84 36 Q100 50 116 36 L130 46 L146 128 L134 132 L124 88 L122 108 L172 252 L28 252 L78 108 L76 88 L66 132 L54 128 L70 46 Z'],
      ['s', 'M84 36 Q100 50 116 36'], ['s', 'M78 108 L122 108'], ['s', 'M34 236 L166 236']
    ],
    dress: [
      ['b', 'M84 36 Q100 50 116 36 L130 46 L140 100 L128 104 L124 84 L122 112 L148 236 L52 236 L78 112 L76 84 L72 104 L60 100 L70 46 Z'],
      ['s', 'M84 36 Q100 50 116 36'], ['s', 'M77 112 L123 112'], ['s', 'M54 224 L146 224']
    ],
    saree: [
      ['b', 'M86 36 Q100 48 114 36 L128 46 L126 110 L134 252 L66 252 L74 110 L72 46 Z'],
      ['a', 'M86 36 Q100 48 114 36 L128 46 L124 78 L76 78 L72 46 Z'],
      ['a', 'M72 46 L88 40 L138 168 L124 176 Z'],
      ['a', 'M66 238 L134 238 L134 252 L66 252 Z'],
      ['l', 'M90 190 L86 238'], ['l', 'M98 190 L96 238'], ['l', 'M106 190 L106 238'], ['l', 'M114 190 L116 238']
    ],
    lehenga: [
      ['a', 'M72 46 Q38 120 56 206 L66 204 Q54 122 84 54 Z'],
      ['b', 'M76 98 L124 98 L176 252 L24 252 Z'],
      ['a', 'M86 36 Q100 48 114 36 L130 46 L124 88 L76 88 L70 46 Z'],
      ['a', 'M30 236 L170 236 L176 252 L24 252 Z'],
      ['s', 'M76 98 L124 98'], ['s', 'M50 190 L150 190']
    ],
    sharara: [
      ['d', 'M70 140 L100 140 L98 262 L50 262 Z'], ['d', 'M100 140 L130 140 L150 262 L102 262 Z'],
      ['b', 'M84 36 Q100 50 116 36 L132 46 L150 112 L136 116 L128 80 L130 154 L70 154 L72 80 L64 116 L50 112 L68 46 Z'],
      ['s', 'M84 36 Q100 50 116 36'], ['s', 'M100 46 L100 154'], ['s', 'M52 250 L98 250'], ['s', 'M102 250 L148 250']
    ],
    coord: [
      ['d', 'M68 132 L100 132 L98 262 L56 262 Z'], ['d', 'M100 132 L132 132 L144 262 L102 262 Z'],
      ['b', 'M82 38 Q100 52 118 38 L136 50 L146 100 L132 104 L128 80 L128 128 L72 128 L72 80 L68 104 L54 100 L64 50 Z'],
      ['s', 'M82 38 Q100 52 118 38'], ['s', 'M70 128 L130 128']
    ]
  };

  var P = [];

  var FREE_SHIP = 5000, SHIP_FLAT = 99;
  var state = { filter: 'all', sort: 'featured', cart: [], pick: null, size: null, view: 'bag', cust: {}, orderRef: '', busy: false };
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
  var byId = function (id) { return P.filter(function (p) { return p.id === id; })[0]; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function art(p, uid) {
    var motif = p.motif === 'zari'
      ? '<path d="M7 2 L10.5 7 L7 12 L3.5 7Z" fill="' + p.accent + '" opacity=".55"/>'
      : '<circle cx="7" cy="7" r="1.7" fill="' + p.accent + '" opacity=".45"/><circle cx="0" cy="0" r="1.2" fill="' + p.accent + '" opacity=".3"/><circle cx="14" cy="14" r="1.2" fill="' + p.accent + '" opacity=".3"/>';
    var out = '<svg viewBox="0 -20 200 300" preserveAspectRatio="xMidYMax meet" role="img" aria-label="' + esc(p.kind) + ' in ' + esc(p.name) + '">' +
      '<defs><pattern id="m' + uid + '" width="14" height="14" patternUnits="userSpaceOnUse">' + motif + '</pattern></defs>' +
      '<ellipse cx="100" cy="268" rx="62" ry="5" fill="#000" opacity=".12"/>';
    SIL[p.sil].forEach(function (it) {
      var k = it[0], d = it[1];
      if (k === 'b') {
        out += '<path d="' + d + '" fill="' + p.base + '"/><path d="' + d + '" fill="url(#m' + uid + ')"/>';
      } else if (k === 'd') {
        out += '<path d="' + d + '" fill="' + p.base + '"/><path d="' + d + '" fill="#000" opacity=".2"/>';
      } else if (k === 'a') {
        out += '<path d="' + d + '" fill="' + p.accent + '" opacity=".92"/>';
      } else if (k === 's') {
        out += '<path d="' + d + '" fill="none" stroke="' + p.accent + '" stroke-width="2" stroke-linecap="round"/>';
      } else {
        out += '<path d="' + d + '" fill="none" stroke="' + p.accent + '" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>';
      }
    });
    return out + '</svg>';
  }

  function renderHero() {
    var ids = ['dhoop-saree', 'rukmini', 'meher'];
    var picks = [byId('zarina'), byId('rukmini'), byId('meher')];
    $('#hero-arches').innerHTML = picks.map(function (p, i) {
      return '<div class="arch">' + art(p, 'h' + i) + '</div>';
    }).join('');
  }

  function list() {
    var l = P.filter(function (p) { return state.filter === 'all' || p.cat === state.filter; });
    if (state.sort === 'low') l = l.slice().sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'high') l = l.slice().sort(function (a, b) { return b.price - a.price; });
    return l;
  }

  function renderGrid() {
    var l = list();
    $('#grid').innerHTML = l.length ? l.map(function (p) {
      return '<button class="card" data-open="' + p.id + '" aria-label="View ' + esc(p.name) + ', ' + esc(p.kind) + '">' +
        '<div class="arch">' + art(p, 'g' + p.id) + '</div>' +
        '<div class="meta"><span class="tag">' + (p.cat === 'formal' ? 'Occasion' : 'Everyday') + '</span>' +
        '<h3>' + esc(p.name) + '</h3><span class="kind">' + esc(p.kind) + '</span>' +
        '<span class="price">' + fmt(p.price) + '</span></div></button>';
    }).join('') : '<p class="empty">Nothing here yet.</p>';
    document.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === state.filter));
    });
  }

  function saveCart() { try { localStorage.setItem('tt-cart', JSON.stringify(state.cart)); } catch (e) {} }
  function loadCart() {
    try {
      var raw = localStorage.getItem('tt-cart');
      if (raw) {
        var c = JSON.parse(raw);
        if (Array.isArray(c)) state.cart = c.filter(function (i) { return i && i.id && i.size && i.qty > 0; });
      }
    } catch (e) {}
  }

  function totals() {
    var sub = state.cart.reduce(function (n, i) { return n + i.qty * byId(i.id).price; }, 0);
    var ship = (sub === 0 || sub >= FREE_SHIP) ? 0 : SHIP_FLAT;
    return { sub: sub, ship: ship, total: sub + ship };
  }

  function summaryHtml(t) {
    return '<div class="tot sm"><span>Subtotal</span><span>' + fmt(t.sub) + '</span></div>' +
      '<div class="tot sm"><span>Shipping</span><span>' + (t.ship ? fmt(t.ship) : 'Free') + '</span></div>' +
      '<div class="tot"><span>Total</span><strong>' + fmt(t.total) + '</strong></div>';
  }

  var FIELDS = [
    ['name', 'Full name', 'text', 'name', 'full'],
    ['phone', 'Mobile number', 'tel', 'tel-national', 'half'],
    ['email', 'Email', 'email', 'email', 'half'],
    ['address', 'Address', 'text', 'street-address', 'full'],
    ['city', 'City', 'text', 'address-level2', 'half'],
    ['state', 'State', 'text', 'address-level1', 'half'],
    ['pin', 'PIN code', 'text', 'postal-code', 'half']
  ];

  function formHtml() {
    return '<form id="ship-form" class="form" novalidate>' + FIELDS.map(function (f) {
      var extra = (f[0] === 'phone' || f[0] === 'pin') ? ' inputmode="numeric"' : '';
      if (f[0] === 'pin') extra += ' maxlength="6"';
      return '<div class="fld ' + f[4] + '"><label for="f-' + f[0] + '">' + f[1] + '</label>' +
        '<input id="f-' + f[0] + '" data-field="' + f[0] + '" type="' + f[2] + '" autocomplete="' + f[3] + '"' + extra +
        ' value="' + esc(state.cust[f[0]] || '') + '"></div>';
    }).join('') + '<p class="err" id="form-err" role="alert"></p></form>';
  }

  function checkCust(c) {
    var t = function (k) { return String(c[k] || '').trim(); };
    if (t('name').length < 2) return 'Enter your full name.';
    var phone = t('phone').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) return 'Enter a 10-digit Indian mobile number.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t('email'))) return 'Enter a valid email address.';
    if (t('address').length < 5) return 'Enter your full delivery address.';
    if (t('city').length < 2) return 'Enter your city.';
    if (t('state').length < 2) return 'Enter your state.';
    if (!/^[1-9]\d{5}$/.test(t('pin'))) return 'Enter a 6-digit PIN code.';
    return '';
  }

  function renderBag() {
    var count = state.cart.reduce(function (n, i) { return n + i.qty; }, 0);
    $('#bag-count').textContent = count;
    var t = totals();
    var title = $('#drawer-title');

    if (state.view === 'done') {
      title.textContent = 'Order placed';
      $('#lines').innerHTML = '<div class="done"><h3>Thank you' + (state.cust.name ? ', ' + esc(state.cust.name.split(' ')[0]) : '') + '.</h3>' +
        '<p>Your payment is confirmed. Order reference <strong>' + esc(state.orderRef) + '</strong>.</p>' +
        '<p>We will message you on ' + esc(state.cust.phone || 'your mobile number') + ' when it ships.</p></div>';
      $('#sum').innerHTML = '<button class="add" id="back-bag">Continue shopping</button>';
      return;
    }

    if (state.view === 'form' && state.cart.length) {
      title.textContent = 'Delivery and payment';
      $('#lines').innerHTML = formHtml();
      $('#sum').innerHTML = summaryHtml(t) +
        '<button class="add" id="pay">Pay ' + fmt(t.total) + '</button>' +
        '<button class="rm center" id="back-bag">Back to bag</button>' +
        '<p class="pay-by">Secure payment by Razorpay: UPI, cards and net banking.</p>';
      return;
    }

    state.view = 'bag';
    title.textContent = 'Your bag';
    $('#lines').innerHTML = state.cart.length ? state.cart.map(function (i, ix) {
      var p = byId(i.id);
      return '<div class="line"><div class="arch">' + art(p, 'c' + ix + p.id) + '</div><div>' +
        '<h3>' + esc(p.name) + '</h3><div class="sub">' + esc(p.kind) + ' · ' + esc(i.size) + '</div>' +
        '<div class="row"><div class="qty"><button data-dec="' + ix + '" aria-label="Decrease quantity">−</button><span>' + i.qty + '</span><button data-inc="' + ix + '" aria-label="Increase quantity">+</button></div>' +
        '<span>' + fmt(p.price * i.qty) + '</span></div>' +
        '<button class="rm" data-rm="' + ix + '">Remove</button></div></div>';
    }).join('') : '<p class="empty-bag">Your bag is empty.<br>Pick something from the edit.</p>';

    if (!state.cart.length) { $('#sum').innerHTML = ''; return; }
    var left = Math.max(0, FREE_SHIP - t.sub);
    var pct = Math.min(100, Math.round(t.sub / FREE_SHIP * 100));
    $('#sum').innerHTML =
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="ship">' + (left > 0 ? 'Add ' + fmt(left) + ' more for free shipping across India.' : 'Free shipping across India applies to this order.') + '</div>' +
      summaryHtml(t) + '<button class="add" id="checkout">Checkout</button>';
  }

  function formErr(msg) { var el = $('#form-err'); if (el) el.textContent = msg; }
  function setBusy(b) {
    state.busy = b;
    var btn = $('#pay');
    if (btn) { btn.disabled = b; btn.textContent = b ? 'Opening payment…' : 'Pay ' + fmt(totals().total); }
  }

  function startPayment() {
    if (state.busy) return;
    var msg = checkCust(state.cust);
    if (msg) { formErr(msg); return; }
    formErr('');
    setBusy(true);
    fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.cart.map(function (i) { return { id: i.id, size: i.size, qty: i.qty }; }),
        customer: state.cust
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'We could not start the payment. Please try again.');
        return j;
      });
    }).then(openRazorpay).catch(function (e) {
      setBusy(false);
      formErr(e.message || 'We could not start the payment. Please try again.');
    });
  }

  function openRazorpay(o) {
    if (!window.Razorpay) { setBusy(false); formErr('The payment window could not load. Check your connection and try again.'); return; }
    var c = state.cust;
    var rz = new window.Razorpay({
      key: o.keyId, amount: o.amount, currency: o.currency, order_id: o.orderId,
      name: 'Thread and Twill', description: 'Order ' + o.receipt,
      prefill: { name: c.name, email: c.email, contact: String(c.phone || '').replace(/[\s-]/g, '') },
      theme: { color: '#8A1F4C' },
      modal: { ondismiss: function () { setBusy(false); } },
      handler: function (resp) { confirmPayment(resp, o.receipt); }
    });
    rz.on('payment.failed', function (r) {
      setBusy(false);
      formErr((r && r.error && r.error.description) || 'The payment did not go through. Please try again.');
    });
    rz.open();
  }

  function confirmPayment(resp, receipt) {
    fetch('/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('verify');
      state.orderRef = receipt; state.cart = []; saveCart(); state.view = 'done'; state.busy = false; renderBag();
    }).catch(function () {
      setBusy(false);
      formErr('Your payment went through but we could not confirm it here. Please call +91 98888 95390 and quote payment id ' + resp.razorpay_payment_id + '.');
    });
  }

  function openBag() { $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); }
  function closeBag() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); if (!$('#modal').classList.contains('on')) $('#scrim').classList.remove('on'); if (state.view === 'done') state.view = 'bag'; renderBag(); }

  function openModal(id) {
    var p = byId(id);
    state.pick = p; state.size = p.sizes.length === 1 ? p.sizes[0] : null;
    $('#modal').innerHTML = '<div class="sheet"><button class="close" data-close-modal aria-label="Close">×</button>' +
      '<div class="art"><div class="arch">' + art(p, 'm' + p.id) + '</div></div>' +
      '<div class="info"><p class="eyebrow">' + (p.cat === 'formal' ? 'Occasion &amp; formal' : 'Everyday &amp; casual') + '</p>' +
      '<h2 id="m-title">' + esc(p.name) + '</h2><p class="kind" style="color:var(--muted)">' + esc(p.kind) + '</p>' +
      '<p class="price">' + fmt(p.price) + '</p><p class="desc">' + esc(p.desc) + '</p>' +
      '<div><p class="label">Size</p><div class="sizes" id="sizes">' + p.sizes.map(function (s) {
        return '<button class="size" data-size="' + esc(s) + '" aria-pressed="' + (state.size === s) + '">' + esc(s) + '</button>';
      }).join('') + '</div></div><p class="err" id="err" role="alert"></p>' +
      '<button class="add" id="add-bag">Add to bag</button>' +
      '<dl class="details">' + p.det.map(function (d) { return '<dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd>'; }).join('') + '</dl></div></div>';
    $('#modal').classList.add('on'); $('#scrim').classList.add('on');
    var c = $('#modal .close'); if (c) c.focus();
  }
  function closeModal() { $('#modal').classList.remove('on'); if (!$('#drawer').classList.contains('on')) $('#scrim').classList.remove('on'); }

  function addToBag() {
    if (!state.size) { $('#err').textContent = 'Choose a size to add this to your bag.'; return; }
    var hit = state.cart.filter(function (i) { return i.id === state.pick.id && i.size === state.size; })[0];
    if (hit) hit.qty += 1; else state.cart.push({ id: state.pick.id, size: state.size, qty: 1 });
    saveCart(); renderBag(); closeModal(); openBag();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open],[data-filter],[data-size],[data-inc],[data-dec],[data-rm],[data-jump],[data-close-modal],#add-bag,#open-bag,#close-bag,#checkout,#back-bag,#pay,#scrim');
    if (!t) return;
    if (t.hasAttribute('data-open')) openModal(t.getAttribute('data-open'));
    else if (t.hasAttribute('data-filter')) { state.filter = t.getAttribute('data-filter'); renderGrid(); }
    else if (t.hasAttribute('data-size')) {
      state.size = t.getAttribute('data-size');
      document.querySelectorAll('#sizes .size').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
      var er = $('#err'); if (er) er.textContent = '';
    }
    else if (t.hasAttribute('data-inc')) { state.cart[+t.getAttribute('data-inc')].qty += 1; saveCart(); renderBag(); }
    else if (t.hasAttribute('data-dec')) { var ix = +t.getAttribute('data-dec'); state.cart[ix].qty -= 1; if (state.cart[ix].qty <= 0) state.cart.splice(ix, 1); saveCart(); renderBag(); }
    else if (t.hasAttribute('data-rm')) { state.cart.splice(+t.getAttribute('data-rm'), 1); saveCart(); renderBag(); }
    else if (t.hasAttribute('data-jump')) { state.filter = t.getAttribute('data-jump'); renderGrid(); }
    else if (t.hasAttribute('data-close-modal')) closeModal();
    else if (t.id === 'add-bag') addToBag();
    else if (t.id === 'open-bag') openBag();
    else if (t.id === 'close-bag') closeBag();
    else if (t.id === 'checkout') { if (state.cart.length) { state.view = 'form'; renderBag(); var nf = $('#f-name'); if (nf) nf.focus(); } }
    else if (t.id === 'pay') startPayment();
    else if (t.id === 'back-bag') { if (state.view === 'done') closeBag(); else { state.view = 'bag'; renderBag(); } }
    else if (t.id === 'scrim') { closeModal(); closeBag(); }
  });
  $('#sort').addEventListener('change', function (e) { state.sort = e.target.value; renderGrid(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeBag(); } });

  document.addEventListener('input', function (e) {
    var f = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
    if (f) state.cust[f] = e.target.value;
  });
  document.addEventListener('submit', function (e) { e.preventDefault(); startPayment(); });

  loadCart();
  fetch('/api/catalogue').then(function (r) {
    if (!r.ok) throw new Error('catalogue');
    return r.json();
  }).then(function (data) {
    P = data.products; FREE_SHIP = data.config.freeShippingAbove; SHIP_FLAT = data.config.shippingFlat;
    state.cart = state.cart.filter(function (i) { return byId(i.id) && byId(i.id).sizes.indexOf(i.size) !== -1; });
    renderHero(); renderGrid(); renderBag();
  }).catch(function () {
    $('#grid').innerHTML = '<p class="empty">The catalogue could not load. Please refresh the page.</p>';
  });
})();
