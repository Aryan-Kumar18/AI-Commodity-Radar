'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var state = { market: null, news: null, newsFilter: 'All', chartCur: { gold: 'inr', silver: 'inr' }, hover: {}, drawn: {}, animated: {} };

  /* ---------- formatting ---------- */
  var inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  var num2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : '#'; }
  function sign(n) { return n > 0 ? '+' : ''; }
  function chipHtml(pct) {
    if (pct == null || !isFinite(pct)) return '';
    var cls = pct > 0.005 ? 'up' : pct < -0.005 ? 'down' : 'flat';
    var arrow = pct > 0.005 ? '▲' : pct < -0.005 ? '▼' : '■';
    return '<span class="chip ' + cls + '">' + arrow + ' ' + sign(pct) + pct.toFixed(2) + '%</span>';
  }
  function setChip(id, pct) {
    var el = $(id);
    el.className = 'chip';
    el.outerHTML = chipHtml(pct).replace('<span ', '<span id="' + id + '" ');
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
  /* ---------- live status ---------- */
  var live = { mode: 'off', at: 0 };
  function setLive(ok, text) {
    var el = $('liveStatus');
    el.className = 'live ' + (ok ? 'ok' : 'bad');
    $('liveText').textContent = text;
  }
  function ageText(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    if (s < 5) return 'just now';
    if (s < 60) return s + 's ago';
    return Math.floor(s / 60) + ' min ago';
  }
  function tickStatus() {
    if (!live.at && live.mode === 'off') return;
    var age = ageText(Date.now() - live.at);
    var phone = window.innerWidth < 480;
    if (live.mode === 'ok') setLive(true, 'Live · ' + (phone ? '' : 'updated ') + age);
    else if (live.mode === 'stale') setLive(false, 'Delayed · ' + age);
    else setLive(false, 'Offline · retrying');
  }

  // Show a price: count up from zero the first time, then flash green/red whenever it changes.
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var prevVals = {}, latest = {}, counting = {};
  function fUsd(v) { return usd.format(v); }
  function fInr(v) { return inr.format(v); }
  function setPrice(id, fmt, raw) {
    var el = $(id);
    var p = prevVals[id];
    prevVals[id] = raw;
    latest[id] = raw;
    if (counting[id]) return; // the count-up is still running and will land on the newest value
    if (p == null) {
      if (reduce || raw == null) { el.textContent = fmt(raw); return; }
      counting[id] = true;
      var t0 = performance.now(), dur = 900;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(latest[id] * e);
        if (k < 1) requestAnimationFrame(step);
        else { el.textContent = fmt(latest[id]); counting[id] = false; }
      })(t0);
      return;
    }
    el.textContent = fmt(raw);
    if (raw != null && raw !== p) {
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth; // restart the animation
      el.classList.add(raw > p ? 'flash-up' : 'flash-down');
    }
  }

  /* ---------- prices ---------- */
  function renderPrices(d) {
    state.market = d;
    var g = d.gold, s = d.silver, r = d.usdinr;

    setPrice('tGold', fUsd, g.usdPerOz);
    setPrice('tSilver', fUsd, s.usdPerOz);
    setPrice('tFx', function (v) { return '$1 = ₹' + num2.format(v); }, r.price);
    setChip('tGoldChg', g.changePct1d);
    setChip('tSilverChg', s.changePct1d);
    setChip('tFxChg', r.rupeeChange1d);

    // rupee vs dollar (from the Indian point of view: + means the rupee got stronger)
    var rc = r.rupeeChange1d;
    var dir = rc == null || Math.abs(rc) <= 0.005 ? 'flat' : rc > 0 ? 'up' : 'down';
    setPrice('rUsd', function (v) { return '₹' + num2.format(v); }, r.price);
    $('rUsdSub').innerHTML = chipHtml(rc) + '<span>rupee vs yesterday</span>';
    setPrice('rInr', function (v) { return '$' + v.toFixed(5); }, r.perInr);
    $('rInrSub').innerHTML = '<span>₹100 = $' + (r.perInr * 100).toFixed(2) + '</span>';
    $('rMood').className = 'price ' + (dir === 'flat' ? '' : dir);
    $('rMood').textContent = rc == null ? '–' : (dir === 'up' ? '▲ Stronger' : dir === 'down' ? '▼ Weaker' : '■ Steady');
    $('rMoodSub').innerHTML = rc == null ? '' : '<span>' + sign(rc) + rc.toFixed(2) + '% against the dollar today</span>';
    $('rupeeMeta').textContent = 'open.er-api.com · this rate updates about once a day';
    renderRupeeStats(r);

    // gold
    setPrice('g24', fInr, g.inr.retail24k10g);
    $('g24sub').innerHTML = chipHtml(g.changePct1d) + '<span>today</span>';
    setPrice('g22', fInr, g.inr.retail22k10g);
    $('g22sub').innerHTML = chipHtml(g.changePct1d) + '<span>today</span>';
    setPrice('gUsd', fUsd, g.usdPerOz);
    $('gUsdSub').innerHTML = chipHtml(g.changePct1d) + '<span>' + sign(g.change1dUsd) + usd.format(g.change1dUsd) + '</span>';
    $('goldMeta').textContent = g.source;

    // silver
    setPrice('sKg', fInr, s.inr.retailPerKg);
    $('sKgSub').innerHTML = chipHtml(s.changePct1d) + '<span>today</span>';
    setPrice('s10', fInr, s.inr.retailPer10g);
    $('s10sub').innerHTML = chipHtml(s.changePct1d) + '<span>today</span>';
    setPrice('sUsd', fUsd, s.usdPerOz);
    $('sUsdSub').innerHTML = chipHtml(s.changePct1d) + '<span>' + sign(s.change1dUsd) + usd.format(s.change1dUsd) + '</span>';
    $('silverMeta').textContent = s.source;

    $('fDuty').textContent = d.assumptions.importDutyPct + '% + ' + d.assumptions.gstPct + '%';

    // charts are redrawn at most every 30 s, and never while you are hovering over one
    ['gold', 'silver'].forEach(drawIdle);
    renderStats('goldStats', g);
    renderStats('silverStats', s);

    live.mode = d.stale ? 'stale' : 'ok';
    live.at = d.updatedAt;
    tickStatus();
  }

  function drawIdle(metal) {
    if (state.hover[metal]) return;
    if (state.drawn[metal] && Date.now() - state.drawn[metal] < 30 * 1000) return;
    drawChart(metal);
  }

  function renderRupeeStats(r) {
    function pct(v) { return v == null ? '–' : sign(v) + v.toFixed(2) + '%'; }
    function cls(v) { return v == null || Math.abs(v) < 0.005 ? '' : v > 0 ? 'up' : 'down'; }
    var items = [
      ['Rupee · 7-day', pct(r.rupeeChange7d), cls(r.rupeeChange7d)],
      ['Rupee · 30-day', pct(r.rupeeChange30d), cls(r.rupeeChange30d)],
      ['Rupee · 3-month', pct(r.rupeeChange3m), cls(r.rupeeChange3m)],
      ['Strongest (3 mo)', '₹' + num2.format(r.strongest), ''],
      ['Weakest (3 mo)', '₹' + num2.format(r.weakest), ''],
      ['3-month average', '₹' + num2.format(r.avg3m), '']
    ];
    $('rupeeStats').innerHTML = items.map(function (x) {
      return '<div class="stat"><span>' + x[0] + '</span><b' + (x[2] ? ' class="' + x[2] + '"' : '') + '>' + x[1] + '</b></div>';
    }).join('');
  }

  function renderStats(id, m) {
    var i = m.indicators;
    function fmt(v, d) { return v == null ? '–' : v.toFixed(d == null ? 2 : d); }
    function pct(v) { return v == null ? '–' : sign(v) + v.toFixed(2) + '%'; }
    var items = [
      ['7-day', pct(i.change7d)],
      ['30-day', pct(i.change30d)],
      ['RSI (14)', fmt(i.rsi14, 0)],
      ['3-mo high', usd.format(i.high3m)],
      ['3-mo low', usd.format(i.low3m)],
      ['From high', pct(i.pctFromHigh)]
    ];
    $(id).innerHTML = items.map(function (x) { return '<div class="stat"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
  }

  /* ---------- charts (dependency-free SVG) ---------- */
  function drawChart(metal) {
    if (!state.market) return;
    var cur = state.chartCur[metal];
    var pts = state.market[metal].history.map(function (p) { return { t: p.t, v: cur === 'usd' ? p.usd : p.inr }; });
    var host = $(metal + 'Chart');
    state.drawn[metal] = Date.now();
    if (pts.length < 2) { host.innerHTML = '<p class="empty">Not enough data to draw a chart.</p>'; return; }

    var narrow = host.clientWidth > 0 && host.clientWidth < 520; // phones get a taller, simpler chart with readable text
    var W = narrow ? 380 : 760, H = narrow ? 250 : 280, padL = narrow ? 58 : 84, padR = narrow ? 10 : 12, padT = 12, padB = 26;
    var min = Infinity, max = -Infinity;
    pts.forEach(function (p) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; });
    var pad = (max - min) * 0.08 || 1;
    min -= pad; max += pad;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var x = function (t) { return padL + ((t - t0) / (t1 - t0)) * (W - padL - padR); };
    var y = function (v) { return padT + (1 - (v - min) / (max - min)) * (H - padT - padB); };

    var color = metal === 'gold' ? '#e2b94b' : '#c3cad6';
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    var area = d + ' L' + x(t1).toFixed(1) + ' ' + (H - padB) + ' L' + x(t0).toFixed(1) + ' ' + (H - padB) + ' Z';

    var yLabel = function (v) {
      if (narrow) {
        if (cur === 'usd') return v >= 1000 ? '$' + (v / 1000).toFixed(2) + 'k' : '$' + v.toFixed(v < 100 ? 1 : 0);
        return v >= 1e5 ? '₹' + (v / 1e5).toFixed(2) + 'L' : v >= 1000 ? '₹' + (v / 1000).toFixed(1) + 'k' : '₹' + Math.round(v);
      }
      if (cur === 'usd') return '$' + Math.round(v).toLocaleString('en-US');
      return '₹' + Math.round(v).toLocaleString('en-IN');
    };
    var grid = '';
    for (var k = 0; k <= 4; k++) {
      var v = min + ((max - min) * k) / 4;
      grid += '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text class="axis-text" x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + yLabel(v) + '</text>';
    }
    var xl = '';
    [0, 0.5, 1].forEach(function (f, idx) {
      var t = t0 + (t1 - t0) * f;
      xl += '<text class="axis-text" x="' + x(t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle') + '">' +
        new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + '</text>';
    });

    var gid = 'grad-' + metal;
    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + metal + ' price over the last three months">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity="0.28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      grid + xl +
      '<path class="area" d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path class="line" d="' + d + '" stroke="' + color + '"/>' +
      '<line class="cross" id="' + metal + 'X" y1="' + padT + '" y2="' + (H - padB) + '" style="display:none"/>' +
      '<circle id="' + metal + 'Dot" r="4.5" fill="' + color + '" stroke="#0a0a0c" stroke-width="2" style="display:none"/>' +
      '<rect id="' + metal + 'Hit" x="' + padL + '" y="' + padT + '" width="' + (W - padL - padR) + '" height="' + (H - padT - padB) + '" fill="transparent"/>' +
      '</svg><div class="chart-tip" id="' + metal + 'Tip"></div>';

    var svg = host.querySelector('svg'), hit = $(metal + 'Hit'), tip = $(metal + 'Tip'), cx = $(metal + 'X'), dot = $(metal + 'Dot');
    function move(ev) {
      state.hover[metal] = true;
      var rect = svg.getBoundingClientRect();
      var clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      var sx = ((clientX - rect.left) / rect.width) * W;
      var t = t0 + ((sx - padL) / (W - padL - padR)) * (t1 - t0);
      var best = pts[0];
      pts.forEach(function (p) { if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p; });
      var px = x(best.t), py = y(best.v);
      cx.setAttribute('x1', px); cx.setAttribute('x2', px); cx.style.display = '';
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.style.display = '';
      tip.style.display = 'block';
      tip.style.left = (px / W) * 100 + '%';
      tip.style.top = (py / H) * 100 + '%';
      tip.innerHTML = '<small>' + new Date(best.t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '</small>' +
        (cur === 'usd' ? usd.format(best.v) : inr.format(best.v));
    }
    function leave() { state.hover[metal] = false; cx.style.display = 'none'; dot.style.display = 'none'; tip.style.display = 'none'; }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('touchstart', move, { passive: true });
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchend', leave);
    animateIn(metal, host);
  }

  // The chart line draws itself the first time it scrolls into view.
  var chartObs = {};
  function animateIn(metal, host) {
    if (state.animated[metal] === 'done') return;
    var path = host.querySelector('path.line'), area = host.querySelector('path.area');
    if (!path) return;
    if (reduce || !('IntersectionObserver' in window)) { state.animated[metal] = 'done'; return; }
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    if (area) area.style.opacity = 0;
    if (chartObs[metal]) chartObs[metal].disconnect();
    chartObs[metal] = new IntersectionObserver(function (ents, ob) {
      if (!ents[0].isIntersecting) return;
      ob.disconnect();
      state.animated[metal] = 'done';
      var p = host.querySelector('path.line'), a = host.querySelector('path.area');
      if (p) { p.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.2,.7,.2,1)'; p.style.strokeDashoffset = 0; }
      if (a) { a.style.transition = 'opacity 1.2s ease .3s'; a.style.opacity = 1; }
    }, { threshold: 0.25 });
    chartObs[metal].observe(host);
  }

  document.querySelectorAll('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var metal = b.getAttribute('data-metal');
      state.chartCur[metal] = b.getAttribute('data-cur');
      b.parentNode.querySelectorAll('.seg-btn').forEach(function (o) { o.classList.toggle('is-on', o === b); });
      drawChart(metal);
    });
  });

  /* ---------- news ---------- */
  function renderNews(d) {
    state.news = d;
    $('newsMeta').textContent = 'Updated ' + timeAgo(d.updatedAt) + (d.stale ? ' (showing last saved)' : '');
    var tags = ['All'];
    d.items.forEach(function (n) { if (tags.indexOf(n.tag) < 0) tags.push(n.tag); });
    if (tags.indexOf(state.newsFilter) < 0) state.newsFilter = 'All';
    $('newsFilters').innerHTML = tags.map(function (t) {
      return '<button class="chip-btn' + (t === state.newsFilter ? ' is-on' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    $('newsFilters').querySelectorAll('.chip-btn').forEach(function (b) {
      b.addEventListener('click', function () { state.newsFilter = b.getAttribute('data-tag'); renderNews(state.news); });
    });
    var list = d.items.filter(function (n) { return state.newsFilter === 'All' || n.tag === state.newsFilter; });
    $('newsGrid').innerHTML = list.length ? list.map(function (n) {
      return '<article class="card news-card"><span class="topic">' + esc(n.tag) + '</span>' +
        '<a href="' + esc(safeUrl(n.link)) + '" target="_blank" rel="noopener noreferrer">' + esc(n.title) + '</a>' +
        '<p class="meta">' + esc(n.source) + (n.time ? ' · ' + timeAgo(n.time) : '') + '</p></article>';
    }).join('') : '<p class="empty">No headlines for this topic right now.</p>';
    revealAll();
  }

  /* ---------- AI advisor ---------- */
  function adviceCard(id, title, dotClass, a) {
    var cls = a.signal.toLowerCase();
    var label = { BUY: 'Good time to buy', WAIT: 'Wait / hold off', SELL: 'Consider selling' }[a.signal];
    var icon = { BUY: '▲', WAIT: '●', SELL: '▼' }[a.signal];
    var html =
      '<h3><span class="metal-dot ' + dotClass + '"></span>' + title + '</h3>' +
      '<div class="verdict ' + cls + '"><span aria-hidden="true">' + icon + '</span>' + label + '</div>' +
      (a.headline ? '<p class="headline">' + esc(a.headline) + '</p>' : '') +
      '<div class="meter"><span>Confidence</span><div class="meter-bar"><div class="meter-fill" style="width:0%"></div></div><span>' + a.confidence + '%</span></div>';
    if (a.reasons.length) html += '<h4>Why</h4><ul>' + a.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
    if (a.risks.length) html += '<h4>Risks</h4><ul>' + a.risks.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
    if (a.horizon) html += '<p class="horizon">Outlook window: ' + esc(a.horizon) + '</p>';
    $(id).innerHTML = html;
    var fill = $(id).querySelector('.meter-fill');
    if (fill) {
      if (reduce) fill.style.width = a.confidence + '%';
      else requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = a.confidence + '%'; }); });
    }
  }

  function renderAnalysis(d) {
    $('moodText').textContent = d.marketMood || '';
    adviceCard('adviceGold', 'Gold', 'gold-dot', d.gold);
    adviceCard('adviceSilver', 'Silver', 'silver-dot', d.silver);
    $('advisorMeta').textContent = d.source === 'quick'
      ? 'Quick technical read · the AI is analysing the news…'
      : (d.source === 'gemini' ? 'AI · ' : 'Rule-based · ') + 'updated ' + timeAgo(d.generatedAt);
    $('advisorMeta').classList.toggle('pulse-text', d.source === 'quick');
    if (d.source !== 'quick') state.aiShown = true;
    var oldNote = $('moodCard').querySelector('.note');
    if (oldNote) oldNote.remove();
    if (d.note) {
      var p = document.createElement('p');
      p.className = 'note';
      p.textContent = d.note;
      $('moodCard').appendChild(p);
    }
    var kh = d.keyHeadlines || [];
    $('keyHeadlinesCard').hidden = !kh.length;
    $('keyHeadlines').innerHTML = kh.map(function (h) {
      return '<li><span class="effect ' + esc(h.effect) + '">' + esc(h.effect) + '</span><div>' +
        '<a href="' + esc(safeUrl(h.link)) + '" target="_blank" rel="noopener noreferrer">' + esc(h.title) + '</a>' +
        '<p class="why">' + esc(h.why) + ' · ' + esc(h.source) + '</p></div></li>';
    }).join('');
    revealAll();
  }

  /* ---------- scroll animations ---------- */
  var revealIO = ('IntersectionObserver' in window && !reduce)
    ? new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          revealIO.unobserve(e.target);
          var el = e.target;
          el.classList.add('in');
          setTimeout(function () { el.classList.remove('reveal', 'in'); el.style.removeProperty('--d'); }, 1300);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' })
    : null;

  function revealAll() {
    if (!revealIO) return;
    var groups = new Map();
    document.querySelectorAll('.hero .eyebrow, .hero h1, .hero .tick, .section-head, .section .card, .filters, .disclaimer, .key-list li').forEach(function (el) {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      var n = groups.get(el.parentNode) || 0;
      groups.set(el.parentNode, n + 1);
      el.style.setProperty('--d', Math.min(n, 6) * 70 + 'ms');
      el.classList.add('reveal');
      revealIO.observe(el);
    });
  }

  function initNavAndProgress() {
    var nav = document.querySelector('.nav');
    var links = document.querySelectorAll('.nav a');
    if ('IntersectionObserver' in window) {
      var navIO = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute('href') === '#' + e.target.id;
            a.classList.toggle('active', on);
            if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
          });
        });
      }, { rootMargin: '-35% 0px -60% 0px' });
      ['rupee', 'gold', 'silver', 'advisor', 'news'].forEach(function (id) { if ($(id)) navIO.observe($(id)); });
    }
    var bar = $('progress'), ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ')';
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.market) ['gold', 'silver'].forEach(drawChart); }, 250);
  });

  /* ---------- loops ---------- */
  var PRICE_EVERY = 15 * 1000;   // gold & silver refresh
  var priceDelay = PRICE_EVERY;
  var priceTimer = null;

  function loadPrices() {
    return GP.getMarket().then(function (d) {
      renderPrices(d);
      var degraded = d.stale || /^daily/.test(d.gold.source);
      priceDelay = degraded ? Math.min(priceDelay * 2, 2 * 60 * 1000) : PRICE_EVERY; // back off if the source struggles
    }).catch(function (e) {
      live.mode = 'off';
      priceDelay = Math.min(priceDelay * 2, 2 * 60 * 1000);
      tickStatus();
      if (!state.market) {
        $('goldMeta').textContent = 'Could not load prices: ' + e.message;
        $('silverMeta').textContent = 'Could not load prices: ' + e.message;
        $('rupeeMeta').textContent = 'Could not load prices: ' + e.message;
      }
    });
  }
  function schedulePrices() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(function () {
      if (document.hidden) { schedulePrices(); return; } // no point refreshing a background tab
      loadPrices().then(schedulePrices);
    }, priceDelay);
  }
  function loadNews() {
    return GP.getNews().then(renderNews).catch(function (e) {
      if (!state.news) $('newsGrid').innerHTML = '<p class="empty">Could not load news right now. ' + esc(e.message) + '</p>';
    });
  }
  var aiRetries = 0;
  function loadAnalysis() {
    // show a quick technical read straight away; the AI answer replaces it when ready
    if (!state.aiShown) {
      GP.getMarket().then(function (m) { if (!state.aiShown) renderAnalysis(GP.quickRead(m)); }).catch(function () {});
    }
    return GP.getAnalysis().then(function (d) {
      renderAnalysis(d);
      if (d.source === 'gemini') aiRetries = 0;
      else if (aiRetries < 3) { aiRetries++; setTimeout(loadAnalysis, 2.5 * 60 * 1000); } // AI failed: try again in a few minutes
    }).catch(function (e) {
      $('moodText').textContent = 'The AI read could not be generated right now. ' + e.message;
      $('adviceGold').innerHTML = '';
      $('adviceSilver').innerHTML = '';
    });
  }

  revealAll();
  initNavAndProgress();
  loadPrices().then(schedulePrices);
  loadNews();
  loadAnalysis();
  setInterval(tickStatus, 1000);
  setInterval(loadNews, 5 * 60 * 1000);
  setInterval(loadAnalysis, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { priceDelay = PRICE_EVERY; loadPrices().then(schedulePrices); }
  });
})();
