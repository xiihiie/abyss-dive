// Each line: "Prompt|answer,answer,..." ordered most common -> rarest. "a/b" = aliases.
const parse = l => { const [q, a] = l.split('|'); return { q: q.trim(), a: a.split(',').map(x => x.trim()).filter(Boolean) }; };
const NICHE = (window.N || []).map(parse);
const CLASSIC = (window.P || []).map(parse);
const PROMPTS = NICHE.concat(CLASSIC);
const norm = s => s.toLowerCase().replace(/^(the|a|an) /, '').replace(/[^a-z0-9]/g, '');
// singular-ish forms so "apples" matches "apple" and "peaches" matches "peach"
const forms = s => { const n = norm(s); return [n, n.replace(/s$/, ''), n.replace(/es$/, '')]; };

// Tier by how far down the list the answer sits. Points: 10/30/60/85/100. Timeout = 0.
const TIERS = [
  { depth: 0.08, max: 0.2, pts: 10, name: 'Bubble', emoji: '🫧', blurb: 'everyone said that', color: '#7fb8e6' },
  { depth: 0.36, max: 0.45, pts: 30, name: 'Minnow', emoji: '🐟', blurb: 'swimming with the crowd', color: '#4fd1c5' },
  { depth: 0.6, max: 0.7, pts: 60, name: 'Jelly', emoji: '🪼', blurb: 'now we are sinking', color: '#b794f4' },
  { depth: 0.82, max: 0.9, pts: 85, name: 'Angler', emoji: '🏮', blurb: 'seriously deep cut', color: '#f6ad55' },
  { depth: 0.97, max: 1, pts: 100, name: 'Leviathan', emoji: '🐋', blurb: 'nobody else got that', color: '#ffd84d' },
];
const TIMEOUT = { depth: 0, pts: 0, m: 0, name: 'Out of time', emoji: '⏱️', blurb: 'the clock ran out', color: '#fc8181' };
const RANKS = [[0, 'Surface skimmer'], [151, 'Reef wanderer'], [251, 'Twilight diver'], [351, 'Midnight lurker'], [450, 'Abyss legend']];
const rank = m => RANKS.filter(r => m >= r[0]).pop()[1];
const SECONDS = 25;
const FULL = 700;                 // points that reach the bottom of the world (a perfect daily)
const METERS = m => Math.round(m * 15.6); // 700 pts ≈ 10,920 m, about the Mariana Trench

// null = empty guess, 'invalid' = not on the list (player must try again)
function score(p, guess) {
  const g = forms(guess);
  if (!g[0]) return null;
  const i = p.a.findIndex(x => x.split('/').some(alias => forms(alias).some(f => g.includes(f))));
  if (i < 0) return 'invalid';
  const r = i / Math.max(1, p.a.length - 1);              // 0 = most common, 1 = rarest
  const t = TIERS.find(t => r <= t.max);
  return { ...t, m: t.pts, r };
}

// mulberry32 seeded by date so the daily dive is the same for everyone
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const today = new Date().toISOString().slice(0, 10);
function dailySet() {
  const pool = NICHE.length >= 7 ? NICHE : PROMPTS;
  const rand = rng(+today.replace(/-/g, ''));
  const idx = [...pool.keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 7).map(i => pool[i]);
}

const $ = id => document.getElementById(id);
let mode, set, at, total, results, timer, left, busy, shown = 0;

// ---- the ocean the whole screen sinks through ----
function buildWorld() {
  const w = $('world');
  const zones = [[0, 'Sunlight zone'], [0.12, 'Twilight zone'], [0.32, 'Midnight zone'], [0.58, 'The abyss'], [0.85, 'The trench']];
  for (const [y, name] of zones) w.insertAdjacentHTML('beforeend', `<div class="zone" style="top:calc(${y * 100}% + 40vh)">${name}</div>`);
  for (let m = 500; m <= 11000; m += 500) w.insertAdjacentHTML('beforeend', `<div class="tick" style="top:${(m / 15.6 / FULL) * 100}%">${m.toLocaleString()} m</div>`);
  const life = [[0.02, 0.12, ['🐟', '🐠', '🐡', '🦈', '🐬', '🐢']], [0.12, 0.32, ['🦑', '🪼', '🐙', '🦐']], [0.32, 0.6, ['🪼', '🦑', '🐋']], [0.6, 1, ['🏮', '🦀', '🪸', '🦴']]];
  for (const [a, b, set] of life) for (let i = 0; i < 9; i++) {
    const top = (a + Math.random() * (b - a)) * 100;
    w.insertAdjacentHTML('beforeend', `<div class="crt" style="top:${top}%;left:${Math.random() * 90}%;animation-delay:-${Math.random() * 6}s">${set[Math.floor(Math.random() * set.length)]}</div>`);
  }
  const snow = $('snow');
  for (let i = 0; i < 40; i++) snow.insertAdjacentHTML('beforeend', `<i style="left:${Math.random() * 100}%;animation-delay:-${Math.random() * 12}s;opacity:${0.2 + Math.random() * 0.5}"></i>`);
}
function sink(ms) {
  const frac = Math.min(1, total / FULL);
  const w = $('world');
  w.style.transitionDuration = ms + 'ms';
  w.style.transform = `translateY(calc(${-frac} * (600vh - 100vh)))`;
  // count the depth readout up over the same duration
  const from = shown, to = METERS(total), t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    shown = Math.round(from + (to - from) * e);
    $('meters').textContent = shown.toLocaleString() + ' m';
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function start(m) {
  mode = m; at = 0; total = 0; results = []; busy = false;
  clearInterval(timer);
  $('bDaily').classList.toggle('on', m === 'daily');
  $('bInf').classList.toggle('on', m === 'inf');
  $('log').innerHTML = ''; $('share').textContent = ''; $('msg').innerHTML = '';
  set = m === 'daily' ? dailySet() : [];
  if (m === 'daily') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('dive3-' + today)); } catch {}
    if (saved) { results = saved; results.forEach(addLog); total = results.reduce((s, r) => s + r.m, 0); sink(1500); return finish(); }
  }
  sink(1200);
  next();
}
function next() {
  busy = false;
  if (mode === 'inf') set[at] = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  $('step').textContent = mode === 'daily' ? `prompt ${at + 1} / 7` : `dive #${at + 1}`;
  const p = $('prompt');
  p.textContent = set[at].q;
  p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
  $('f').classList.remove('hide'); $('timer').classList.remove('hide');
  $('a').value = ''; $('a').focus();
  $('pts').textContent = total + ' pts · ' + rank(total);
  left = SECONDS * 10;
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 100);
}
function tick() {
  $('bar').style.width = (left / (SECONDS * 10)) * 100 + '%';
  $('timer').classList.toggle('low', left <= 50);
  $('secs').textContent = Math.ceil(left / 10) + 's';
  if (left-- <= 0) resolve(TIMEOUT, '—');
}
function resolve(s, guess) {
  clearInterval(timer);
  busy = true;
  const p = set[at];
  const r = { q: p.q, g: guess, m: s.m };
  results.push(r); total += s.m; addLog(r);
  $('f').classList.add('hide'); $('timer').classList.add('hide');
  $('msg').innerHTML = '';
  $('msg').append(`${s.emoji} ${s.name} · ${s.blurb}`, document.createElement('br'), `rarest answer: ${p.a[p.a.length - 1].split('/')[0]}`);
  at++;
  const last = mode === 'daily' && at === 7;
  if (last) { try { localStorage.setItem('dive3-' + today, JSON.stringify(results)); } catch {} }
  dive(s, last ? finish : next);
}
// The whole ocean scrolls up while marine snow streaks past; rarer answers sink further and slower.
function dive(s, done) {
  const ms = 900 + s.depth * 2400;
  if (s.m) document.body.classList.add('diving');
  else shake($('panel'));
  sink(ms);
  setTimeout(() => { document.body.classList.remove('diving'); pop(s); }, ms);
  setTimeout(done, ms + 1300);
}
function addLog(r) {
  const t = TIERS.find(x => x.pts === r.m) || TIMEOUT;
  $('log').insertAdjacentHTML('afterbegin', `<div class="row"><span></span><span style="color:${t.color}">${t.emoji} +${r.m}</span></div>`);
  $('log').firstChild.firstChild.textContent = r.q + ' → ' + r.g;
}
function pop(s) {
  const b = document.createElement('div');
  b.className = 'pop'; b.style.color = s.color;
  b.textContent = `${s.emoji} ${s.name} +${s.m}`;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1800);
  if (s.m >= 85) burst(s.m === 100 ? 34 : 16);
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function burst(n) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement('i');
    b.className = 'bub';
    b.style.left = (35 + Math.random() * 30) + '%';
    b.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
    b.style.animationDuration = (0.8 + Math.random()) + 's';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2000);
  }
}
function finish() {
  clearInterval(timer);
  $('f').classList.add('hide'); $('timer').classList.add('hide');
  $('step').textContent = 'dive complete';
  $('prompt').textContent = `${total} pts · ${rank(total)}`;
  $('pts').textContent = total + ' pts · ' + rank(total);
  const blocks = results.map(r => (TIERS.find(x => x.pts === r.m) || TIMEOUT).emoji).join('');
  $('share').textContent = `Abyss Dive ${today}\n${blocks}\n${total} pts · ${METERS(total).toLocaleString()} m · ${rank(total)}`;
}
$('f').onsubmit = e => {
  e.preventDefault();
  if (busy) return;
  const guess = $('a').value.trim(), s = score(set[at], guess);
  if (!s) return;
  if (s === 'invalid') {
    shake($('a'));
    $('msg').textContent = `🪝 "${guess}" isn't on the list. Try another!`;
    $('a').value = '';
    return;
  }
  resolve(s, guess);
};
$('bDaily').onclick = () => start('daily');
$('bInf').onclick = () => start('inf');
$('bHelp').onclick = () => $('help').classList.toggle('hide');

// ambient bubbles rising past the panel
setInterval(() => {
  const b = document.createElement('i');
  b.className = 'bub amb';
  b.style.left = Math.random() * 100 + '%';
  b.style.animationDuration = (5 + Math.random() * 5) + 's';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 10000);
}, 900);
buildWorld();
start('daily');
