(function () {
  var M = window.MIZAN || {};
  var A = M.assets || 'assets';

  // Nav border on scroll
  var nav = document.querySelector('.nav');
  function onScroll() { nav && nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Tour tabs
  var screens = [
    { t: 'Your month at a glance', p: 'Balance, expenses, income and remittances for any period, with trends, top categories and the people you pay most.', d: 'desktop-dashboard-light', m: 'devices/dashboard-light' },
    { t: 'Every payment, already filed', p: 'Search, filter and edit. Add cash spending by hand and export everything to CSV whenever you need it.', d: 'desktop-transactions', m: 'devices/transactions-light' },
    { t: 'Bills you never forget', p: 'Rent, utilities, school fees and salaries in a checklist that resets each month and ticks itself off from your SMS.', d: 'desktop-dashboard-dark', m: 'devices/monthly-light' },
    { t: 'Your spending on a calendar', p: 'See exactly where money went on any day, week or month, and spot the expensive weekends.', d: 'desktop-calendar', m: 'devices/calendar-light' },
    { t: 'Zakat without the spreadsheet', p: 'Counts down to Ramadan, checks your savings against the nisab with live gold and silver prices, and keeps a record for every year.', d: 'desktop-zakat', m: 'devices/zakat-light' }
  ];
  var tabs = document.querySelectorAll('.tour-tabs [role=tab]');
  var panel = document.getElementById('tour-panel');
  function show(i, focus) {
    var s = screens[i]; if (!s || !panel) return;
    tabs.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    if (focus) tabs[i].focus();
    panel.setAttribute('aria-labelledby', 'tab-' + i);
    panel.classList.add('swap');
    setTimeout(function () {
      document.getElementById('tour-title').textContent = s.t;
      document.getElementById('tour-text').textContent = s.p;
      var d = document.getElementById('tour-desk'), m = document.getElementById('tour-phone');
      d.src = A + '/' + s.d + '.webp'; d.alt = s.t + ' on desktop';
      m.src = A + '/' + s.m + '.webp'; m.alt = s.t + ' on iPhone';
      panel.classList.remove('swap');
    }, 180);
  }
  tabs.forEach(function (b, i) {
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener('click', function () { show(i); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show((i + 1) % tabs.length, true);
      if (e.key === 'ArrowLeft') show((i - 1 + tabs.length) % tabs.length, true);
    });
  });
  // Preload tour images
  screens.forEach(function (s) { [s.d, s.m].forEach(function (n) { var im = new Image(); im.src = A + '/' + n + '.webp'; }); });

  // Beta form
  var form = document.getElementById('beta-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('beta-msg');
    var email = form.email.value.trim();
    msg.className = 'beta-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Enter a valid email address, like you@example.com.'; msg.classList.add('err'); return; }
    if (!M.endpoint || M.endpoint.indexOf('%%') === 0) { msg.textContent = "You're on the list. We'll email you when hosted Mizan opens."; msg.classList.add('ok'); form.reset(); return; }
    var btn = form.querySelector('button'); btn.disabled = true; msg.textContent = 'Adding you…';
    var body = new FormData(); body.append('action', 'mizan_beta'); body.append('email', email); body.append('website', form.website.value); body.append('nonce', M.nonce);
    fetch(M.endpoint, { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.success) { msg.textContent = "You're on the list. We'll email you when hosted Mizan opens."; msg.classList.add('ok'); form.reset(); }
        else { msg.textContent = (j && j.data) || 'That did not work. Please try again.'; msg.classList.add('err'); }
      })
      .catch(function () { msg.textContent = 'Could not reach the server. Check your connection and try again.'; msg.classList.add('err'); })
      .finally(function () { btn.disabled = false; });
  });
})();
