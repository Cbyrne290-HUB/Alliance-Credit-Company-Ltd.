// CURSOR
const cursor = document.getElementById('cursor');
const ring   = document.getElementById('cursorRing');
if (cursor && ring) {
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
  });
  (function followRing() {
    rx += (mx - rx) * 0.1; ry += (my - ry) * 0.1;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(followRing);
  })();
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hover'); ring.classList.add('hover'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hover'); ring.classList.remove('hover'); });
  });
}

// NAV
const nav = document.getElementById('nav');
if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40));

// BURGER
const burger   = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
if (burger && navLinks) {
  burger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const s = burger.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
      s[0].style.transform = 'rotate(45deg) translate(4px,4px)';
      s[1].style.opacity = '0';
      s[2].style.transform = 'rotate(-45deg) translate(4px,-4px)';
    } else {
      s.forEach(x => { x.style.transform = ''; x.style.opacity = ''; });
    }
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }));
}

// CALCULATOR
const APR = 0.415;
function monthlyRate() { return Math.pow(1 + APR, 1/12) - 1; }
function calcMonthly(p, n) { const r = monthlyRate(); return p * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1); }
function euro(n) { return '€' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fillSlider(s) { const pct = ((+s.value - +s.min) / (+s.max - +s.min)) * 100; s.style.setProperty('--pct', pct + '%'); }

function runCalc() {
  const amtS = document.getElementById('amtSlider');
  const durS = document.getElementById('durSlider');
  if (!amtS) return;
  const amt = +amtS.value, dur = +durS.value;
  const monthly = calcMonthly(amt, dur);
  const weekly  = monthly * 12 / 52;
  const total   = monthly * dur;
  const cost    = total - amt;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('resWeekly',  euro(weekly));
  set('resMonthly', euro(monthly));
  set('resAnnual',  (APR * 100).toFixed(2) + '%');
  set('resCost',    euro(cost));
  set('resTotal',   euro(total));
  const ai = document.getElementById('amtInput'); if (ai) ai.value = amt;
  const di = document.getElementById('durInput'); if (di) di.value = dur;
  fillSlider(amtS); fillSlider(durS);
}

function initCalc() {
  const amtS = document.getElementById('amtSlider'); if (!amtS) return;
  const durS = document.getElementById('durSlider');
  const amtI = document.getElementById('amtInput');
  const durI = document.getElementById('durInput');
  amtS.addEventListener('input', () => { if (amtI) amtI.value = amtS.value; runCalc(); });
  durS.addEventListener('input', () => { if (durI) durI.value = durS.value; runCalc(); });
  if (amtI) amtI.addEventListener('change', () => { let v = Math.min(Math.max(+amtI.value||500,500),2000); amtI.value=v; amtS.value=v; runCalc(); });
  if (durI) durI.addEventListener('change', () => { let v = Math.min(Math.max(+durI.value||12,12),60);   durI.value=v; durS.value=v; runCalc(); });
  runCalc();
}

// REVEAL
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

document.addEventListener('DOMContentLoaded', () => { initCalc(); initReveal(); });