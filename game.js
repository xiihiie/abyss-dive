// Each line: "Prompt|answer,answer,..." ordered most common -> rarest. "a/b" = aliases.
const parse = l => { const [q, a] = l.split('|'); return { q: q.trim(), a: a.split(',').map(x => x.trim()).filter(Boolean) }; };
const NICHE = (window.N || []).map(parse);
const CLASSIC = (window.P || []).map(parse);
const PROMPTS = NICHE.concat(CLASSIC);
const norm = s => s.toLowerCase().replace(/^(the|a|an) /, '').replace(/[^a-z0-9]/g, '');
// singular-ish forms so "apples" matches "apple" and "peaches" matches "peach"
const forms = s => { const n = norm(s); return [n, n.replace(/s$/, ''), n.replace(/es$/, '')]; };

// Tier by how far down the list the answer sits. Points: 10/30/60/85/100, miss = 0.
const TIERS = [
  { max: 0.2, pts: 10, name: 'Bubble', emoji: '🫧', blurb: 'everyone said that', color: '#7fb8e6' },
  { max: 0.45, pts: 30, name: 'Minnow', emoji: '🐟', blurb: 'swimming with the crowd', color: '#4fd1c5' },
  { max: 0.7, pts: 60, name: 'Jelly', emoji: '🪼', blurb: 'now we are sinking', color: '#b794f4' },
  { max: 0.9, pts: 85, name: 'Angler', emoji: '🏮', blurb: 'seriously deep cut', color: '#f6ad55' },
  { max: 1, pts: 100, name: 'Leviathan', emoji: '🐋', blurb: 'nobody else got that', color: '#ffd84d' },
];
const MISS = { pts: 0, name: 'Snagged', emoji: '🪝', blurb: 'not on the list', color: '#fc8181' };
const RANKS = [[0, 'Surface skimmer'], [151, 'Reef wanderer'], [251, 'Twilight diver'], [351, 'Midnight lurker'], [450, 'Abyss legend']];
const rank = m => RANKS.filter(r => m >= r[0]).pop()[1];

function score(p, guess) {
  const g = forms(guess);
  if (!g[0]) return null;
  const i = p.a.findIndex(x => x.split('/').some(alias => forms(alias).some(f => g.includes(f))));
  if (i < 0) return { ...MISS, m: 0 };
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
let mode, set, at, total, results;

function start(m) {
  mode = m; at = 0; total = 0; results = [];
  $('bDaily').classList.toggle('on', m === 'daily');
  $('bInf').classList.toggle('on', m === 'inf');
  $('log').innerHTML = ''; $('share').textContent = ''; $('msg').innerHTML = '';
  set = m === 'daily' ? dailySet() : [];
  if (m === 'daily') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('dive2-' + today)); } catch {}
    if (saved) { results = saved; results.forEach(addLog); total = results.reduce((s, r) => s + r.m, 0); return finish(); }
  }
  next();
}
function next() {
  if (mode === 'inf') set[at] = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  $('step').textContent = mode === 'daily' ? `prompt ${at + 1} / 7` : `dive #${at + 1}`;
  const p = $('prompt');
  p.textContent = set[at].q;
  p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
  $('f').classList.remove('hide');
  $('a').value = ''; $('a').focus();
  draw();
}
function draw() {
  $('depth').textContent = total + ' pts · ' + rank(total);
  // daily max is 700; unlimited keeps sinking but the visuals cap there
  const t = Math.min(1, total / 700);
  document.body.style.setProperty('--sink', t);
  $('hookwrap').style.transform = `translateY(${t * 55}vh)`;
}
function addLog(r) {
  const t = TIERS.find(x => x.pts === r.m) || MISS;
  $('log').insertAdjacentHTML('afterbegin', `<div class="row"><span></span><span style="color:${t.color}">${t.emoji} +${r.m}</span></div>`);
  $('log').firstChild.firstChild.textContent = r.q + ' → ' + r.g;
}
function pop(s) {
  // tier badge that floats up from the hook
  const b = document.createElement('div');
  b.className = 'pop'; b.style.color = s.color;
  b.textContent = `${s.emoji} ${s.name} +${s.m}`;
  $('hookwrap').appendChild(b);
  setTimeout(() => b.remove(), 1600);
  const h = $('hookbody');
  h.classList.remove('tug', 'snag'); void h.offsetWidth;
  h.classList.add(s.m ? 'tug' : 'snag');
  if (s.m >= 85) burst(s.m === 100 ? 30 : 14);
}
function burst(n) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement('i');
    b.className = 'bub';
    b.style.left = (40 + Math.random() * 20) + '%';
    b.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
    b.style.animationDuration = (0.8 + Math.random()) + 's';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2000);
  }
}
function finish() {
  $('f').classList.add('hide');
  $('step').textContent = 'dive complete';
  $('prompt').textContent = `${total} pts · ${rank(total)}`;
  draw();
  const blocks = results.map(r => (TIERS.find(x => x.pts === r.m) || MISS).emoji).join('');
  $('share').textContent = `Abyss Dive ${today}\n${blocks}\n${total} pts · ${rank(total)}`;
}
$('f').onsubmit = e => {
  e.preventDefault();
  const p = set[at], s = score(p, $('a').value);
  if (!s) return;
  const r = { q: p.q, g: $('a').value.trim(), m: s.m };
  results.push(r); total += s.m; addLog(r); pop(s);
  $('msg').innerHTML = '';
  $('msg').append(`${s.emoji} ${s.name} · ${s.blurb}`, document.createElement('br'), `rarest answer: ${p.a[p.a.length - 1].split('/')[0]}`);
  at++;
  if (mode === 'daily' && at === 7) { try { localStorage.setItem('dive2-' + today, JSON.stringify(results)); } catch {} finish(); }
  else next();
};
$('bDaily').onclick = () => start('daily');
$('bInf').onclick = () => start('inf');
$('bHelp').onclick = () => $('help').classList.toggle('hide');

// ambient life: rising bubbles and fish drifting across; deeper dives bring deeper creatures
setInterval(() => {
  const b = document.createElement('i');
  b.className = 'bub amb';
  b.style.left = Math.random() * 100 + '%';
  b.style.animationDuration = (5 + Math.random() * 5) + 's';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 10000);
}, 700);
setInterval(() => {
  const f = document.createElement('div');
  const deep = Math.random() < +(document.body.style.getPropertyValue('--sink') || 0);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  f.className = 'fish' + (Math.random() < 0.5 ? ' rev' : '');
  f.textContent = deep ? pick(['🦑', '🪼', '🐙', '🦈']) : pick(['🐟', '🐠', '🐡', '🦐']);
  f.style.top = (20 + Math.random() * 70) + 'vh';
  f.style.animationDuration = (10 + Math.random() * 10) + 's';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 20000);
}, 3500);
start('daily');
