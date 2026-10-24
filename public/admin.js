(function () {
  'use strict';
  // Everything from customers is shown with textContent, never as HTML, so a
  // name or address cannot run code in this page.
  var $ = function (s) { return document.querySelector(s); };
  var state = { days: 30, data: null, show: 'all', q: '' };

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === '') continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function when(iso) {
    try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return iso; }
  }
  function shortDay(d) {
    try { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' }); }
    catch (e) { return d; }
  }

  function view(name) {
    $('#loading').hidden = name !== 'loading';
    $('#login').hidden = name !== 'login';
    $('#dash').hidden = name !== 'dash';
    $('#top-actions').hidden = name !== 'dash';
  }

  function request(method, path, body) {
    return fetch(path, {
      method: method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
    });
  }

  function load() {
    $('#refresh').disabled = true;
    return request('GET', '/api/admin/orders?days=' + state.days).then(function (r) {
      $('#refresh').disabled = false;
      if (r.status === 401) { view('login'); $('#pw').focus(); return; }
      if (!r.ok) {
        view('dash');
        showBanner(r.body.error || 'Orders could not be loaded. Try again in a moment.');
        return;
      }
      state.data = r.body;
      view('dash');
      render();
    }).catch(function () {
      $('#refresh').disabled = false;
      view('dash');
      showBanner('Orders could not be loaded. Check your connection and try again.');
    });
  }

  function showBanner(msg) {
    var b = $('#banner');
    b.textContent = msg || '';
    b.hidden = !msg;
  }

  function tile(value, label) { return h('div', { class: 'tile' }, h('b', { text: String(value) }), h('span', { text: label })); }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.data.orders.filter(function (o) {
      if (state.show !== 'all' && o.status !== state.show) return false;
      if (!q) return true;
      return (o.name + ' ' + o.phone + ' ' + o.email + ' ' + o.receipt + ' ' + o.items).toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    var d = state.data;
    var mode = $('#mode');
    mode.textContent = d.status.mode === 'live' ? 'LIVE' : 'TEST MODE';
    mode.className = 'mode ' + d.status.mode;

    var notes = [];
    if (d.status.mode === 'test') notes.push('You are using Razorpay test keys, so these are practice orders and no real money moved.');
    if (!d.status.webhook) notes.push('Webhook secret is not set in your host settings.');
    if (d.truncated) notes.push('Showing the most recent 500 orders in this range. Choose a shorter range to see all of them.');
    showBanner(notes.join(' '));

    var t = d.totals;
    var tiles = $('#tiles'); clear(tiles);
    tiles.appendChild(tile(t.paidCount, 'Paid orders'));
    tiles.appendChild(tile(inr(t.revenue), 'Sales'));
    tiles.appendChild(tile(inr(t.average), 'Average order'));
    tiles.appendChild(tile(t.unpaidCount, 'Not paid'));

    var chart = $('#chart'); clear(chart);
    var max = d.daily.reduce(function (m, x) { return Math.max(m, x.revenue); }, 0);
    d.daily.forEach(function (x) {
      var bar = h('div', { class: 'cbar' + (x.revenue ? '' : ' zero'), title: shortDay(x.day) + ': ' + inr(x.revenue) + ', ' + x.orders + (x.orders === 1 ? ' order' : ' orders') });
      bar.style.height = (max ? Math.max(2, Math.round(x.revenue / max * 100)) : 2) + '%';
      chart.appendChild(bar);
    });
    $('#axis-start').textContent = d.daily.length ? shortDay(d.daily[0].day) : '';
    $('#axis-end').textContent = d.daily.length ? shortDay(d.daily[d.daily.length - 1].day) : '';

    var top = $('#top'); clear(top);
    if (!d.topPieces.length) top.appendChild(h('li', { class: 'muted', text: 'No paid orders in this range yet.' }));
    d.topPieces.forEach(function (p) {
      top.appendChild(h('li', null, h('span', { text: p.name }), h('span', { text: p.units + (p.units === 1 ? ' piece' : ' pieces') })));
    });

    $('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    renderRows();
  }

  function renderRows() {
    var rows = $('#rows'); clear(rows);
    var list = filtered();
    if (!list.length) {
      rows.appendChild(h('tr', null, h('td', { class: 'empty-row', colspan: '7', text: state.data.orders.length ? 'No orders match.' : 'No orders in this range yet.' })));
    }
    list.forEach(function (o) {
      rows.appendChild(h('tr', { class: o.status },
        h('td', null, when(o.createdAt)),
        h('td', null, o.receipt || o.id, o.method ? h('small', { text: o.method.toUpperCase() }) : null),
        h('td', null, o.name || '-', o.phone ? h('small', { text: o.phone }) : null, o.email ? h('small', { text: o.email }) : null),
        h('td', { class: 'addr', text: o.address || '-' }),
        h('td', { class: 'items', text: o.items || '-' }),
        h('td', { class: 'num', text: inr(o.amount) }),
        h('td', null, h('span', { class: 'pill ' + o.status, text: o.status === 'paid' ? 'Paid' : 'Not paid' }))
      ));
    });
    $('#count').textContent = 'Showing ' + list.length + ' of ' + state.data.orders.length + ' orders.';
  }

  // CSV that opens cleanly in Excel and cannot run formulas from customer text.
  function cell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCsv() {
    if (!state.data) return;
    var head = ['Date (IST)', 'Order', 'Status', 'Amount (INR)', 'Name', 'Phone', 'Email', 'Address', 'Items', 'Payment method', 'Payment id'];
    var lines = [head.map(cell).join(',')];
    filtered().forEach(function (o) {
      lines.push([o.day + ' ' + when(o.createdAt), o.receipt || o.id, o.status, o.amount, o.name, o.phone, o.email, o.address, o.items, o.method, o.paymentId].map(cell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'thread-and-twill-orders.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(value))); });
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#login-btn');
    btn.disabled = true;
    $('#login-err').textContent = '';
    request('POST', '/api/admin/login', { password: $('#pw').value }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { $('#login-err').textContent = r.body.error || 'Could not sign in. Try again.'; return; }
      $('#pw').value = '';
      view('loading');
      load();
    }).catch(function () {
      btn.disabled = false;
      $('#login-err').textContent = 'Could not reach the server. Check your connection.';
    });
  });
  $('#signout').addEventListener('click', function () {
    request('POST', '/api/admin/logout').then(function () { state.data = null; view('login'); });
  });
  $('#refresh').addEventListener('click', load);
  $('#csv').addEventListener('click', downloadCsv);
  $('#search').addEventListener('input', function (e) { state.q = e.target.value; if (state.data) renderRows(); });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-days],[data-show]');
    if (!t) return;
    if (t.hasAttribute('data-days')) {
      state.days = Number(t.getAttribute('data-days'));
      setPressed('[data-days]', 'data-days', state.days);
      load();
    } else {
      state.show = t.getAttribute('data-show');
      setPressed('[data-show]', 'data-show', state.show);
      if (state.data) renderRows();
    }
  });

  load();
})();
