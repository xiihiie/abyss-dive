// Each line: "Prompt|answer,answer,..." ordered most common -> rarest. "a/b" = aliases.
const parse = l => { const [q, a] = l.split('|'); return { q: q.trim(), a: a.split(',').map(x => x.trim()).filter(Boolean) }; };
const NICHE = (window.N || []).map(parse);
const CLASSIC = (window.P || []).map(parse);
const PROMPTS = NICHE.concat(CLASSIC);
const norm = s => s.toLowerCase().replace(/^(the|a|an) /, '').replace(/[^a-z0-9]/g, '');
// singular-ish forms so "apples" matches "apple" and "peaches" matches "peach"
const forms = s => { const n = norm(s); return [n, n.replace(/s$/, ''), n.replace(/es$/, '')]; };

// Tier by how far down the list the answer sits. Points: 10/30/60/85/100. Timeout = 0.
// depth = how far down the ocean that answer dives (0 = surface, 1 = trench floor)
const TIERS = [
  { depth: 0.1, max: 0.2, pts: 10, name: 'Bubble', emoji: '🫧', blurb: 'everyone said that', color: '#7fb8e6' },
  { depth: 0.32, max: 0.45, pts: 30, name: 'Minnow', emoji: '🐟', blurb: 'swimming with the crowd', color: '#4fd1c5' },
  { depth: 0.56, max: 0.7, pts: 60, name: 'Jelly', emoji: '🪼', blurb: 'now we are sinking', color: '#c39bff' },
  { depth: 0.8, max: 0.9, pts: 85, name: 'Angler', emoji: '🏮', blurb: 'seriously deep cut', color: '#f6ad55' },
  { depth: 0.98, max: 1, pts: 100, name: 'Leviathan', emoji: '🐋', blurb: 'nobody else got that', color: '#ffd84d' },
];
const TIMEOUT = { depth: 0.02, pts: 0, m: 0, name: 'Out of time', emoji: '⏱️', blurb: 'the clock ran out', color: '#fc8181' };
const tierOf = (i, n) => TIERS.find(t => i / Math.max(1, n - 1) <= t.max);
const RANKS = [[0, 'Surface skimmer'], [151, 'Reef wanderer'], [251, 'Twilight diver'], [351, 'Midnight lurker'], [450, 'Abyss legend']];
const rank = m => RANKS.filter(r => m >= r[0]).pop()[1];
const SECONDS = 25;
const FLOOR = 11000; // metres at the bottom of the world, about the Mariana Trench

// null = empty guess, 'invalid' = not on the list (player must try again)
function score(p, guess) {
  const g = forms(guess);
  if (!g[0]) return null;
  const i = p.a.findIndex(x => x.split('/').some(alias => forms(alias).some(f => g.includes(f))));
  if (i < 0) return 'invalid';
  const t = tierOf(i, p.a.length);
  return { ...t, m: t.pts };
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

// ---- the ocean the whole screen dives through ----
// A marker at depth f sits mid-screen when the world is scrolled to f.
const at_ = f => `top:calc(${f} * (100% - 100vh) + 50vh)`;
function buildWorld() {
  const w = $('world');
  const zones = [[0, 'Sunlight zone'], [0.1, 'Twilight zone'], [0.3, 'Midnight zone'], [0.55, 'The abyss'], [0.8, 'The trench']];
  for (const [f, name] of zones) w.insertAdjacentHTML('beforeend', `<div class="zone" style="${at_(f + 0.03)}">${name}</div>`);
  for (let m = 500; m < FLOOR; m += 500) w.insertAdjacentHTML('beforeend', `<div class="tick" style="${at_(m / FLOOR)}">${m.toLocaleString()} m</div>`);
  const life = [[0, 0.1, ['🐟', '🐠', '🐡', '🐬', '🐢', '🦈']], [0.1, 0.3, ['🦑', '🪼', '🐙', '🦐', '🐋']], [0.3, 0.55, ['🪼', '🦑', '🐙']], [0.55, 1, ['🏮', '🦀', '🪸', '🦴', '🐚']]];
  for (const [a, b, kinds] of life) for (let i = 0; i < 10; i++) {
    const f = a + Math.random() * (b - a), size = 26 + Math.random() * 26;
    w.insertAdjacentHTML('beforeend', `<div class="crt" style="${at_(f)};left:${4 + Math.random() * 86}%;font-size:${size}px;animation-delay:-${Math.random() * 7}s">${kinds[Math.floor(Math.random() * kinds.length)]}</div>`);
  }
  const snow = $('snow');
  for (let i = 0; i < 50; i++) snow.insertAdjacentHTML('beforeend', `<i style="left:${Math.random() * 100}%;animation-delay:-${Math.random() * 12}s;opacity:${0.15 + Math.random() * 0.5}"></i>`);
}
// Scroll the world so depth f (0..1) is in view, counting the metre readout along the way.
function sinkTo(f, ms, ease) {
  const w = $('world');
  w.style.transition = `transform ${ms}ms ${ease}`;
  w.style.transform = `translateY(${-f * (w.offsetHeight - innerHeight)}px)`;
  const from = shown, to = Math.round(f * FLOOR), t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    shown = Math.round(from + (to - from) * e);
    $('meters').textContent = shown.toLocaleString() + ' m';
    $('bigdepth').textContent = shown.toLocaleString() + ' m';
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function start(m) {
  mode = m; at = 0; total = 0; results = []; busy = false;
  clearInterval(timer);
  document.body.classList.remove('diving', 'deep');
  $('bDaily').classList.toggle('on', m === 'daily');
  $('bInf').classList.toggle('on', m === 'inf');
  $('rounds').innerHTML = ''; $('share').textContent = ''; $('msg').innerHTML = '';
  $('catch').classList.add('hide');
  set = m === 'daily' ? dailySet() : [];
  sinkTo(0, 800, 'ease-out');
  if (m === 'daily') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('dive3-' + today)); } catch {}
    if (saved) { results = saved; results.forEach((r, i) => addRound(r, i + 1)); total = results.reduce((s, r) => s + r.m, 0); return finish(); }
  }
  next();
}
function next() {
  busy = false;
  if (mode === 'inf') set[at] = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  $('step').textContent = mode === 'daily' ? `Prompt ${at + 1} / 7` : `Dive #${at + 1}`;
  const p = $('prompt');
  p.textContent = set[at].q;
  p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
  $('f').classList.remove('hide'); $('timer').classList.remove('hide');
  $('a').value = ''; $('a').focus();
  $('pts').textContent = total + ' pts';
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
  results.push(r); total += s.m;
  $('f').classList.add('hide'); $('timer').classList.add('hide');
  $('msg').innerHTML = '';
  at++;
  const last = mode === 'daily' && at === 7;
  if (last) { try { localStorage.setItem('dive3-' + today, JSON.stringify(results)); } catch {} }
  dive(s, () => {
    addRound(r, results.length);
    $('msg').append(`${s.emoji} ${s.name} · ${s.blurb}`);
    last ? finish() : next();
  });
}
// Each answer is a dive: the panel fades, the whole ocean scrolls up to that tier's depth
// (rarer = deeper and slower), the catch is revealed, then you're reeled back to the surface.
function dive(s, done) {
  const down = 1000 + s.depth * 2600, hold = 1500, up = 900 + s.depth * 700;
  document.body.classList.add('diving');
  $('bigtier').textContent = '';
  sinkTo(s.depth, down, 'cubic-bezier(.45,0,.25,1)');
  setTimeout(() => {
    document.body.classList.add('deep');
    $('bigtier').textContent = `${s.emoji} ${s.name} +${s.m}`;
    $('bigtier').style.color = s.color;
    if (s.m >= 85) burst(s.m === 100 ? 40 : 18);
    if (!s.m) shake($('bigtier'));
  }, down);
  setTimeout(() => {
    document.body.classList.remove('deep');
    sinkTo(0, up, 'cubic-bezier(.6,0,.4,1)');
  }, down + hold);
  setTimeout(() => { document.body.classList.remove('diving'); done(); }, down + hold + up);
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function burst(n) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement('i');
    b.className = 'bub';
    b.style.left = (30 + Math.random() * 40) + '%';
    b.style.setProperty('--dx', (Math.random() * 260 - 130) + 'px');
    b.style.animationDuration = (0.9 + Math.random()) + 's';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }
}

// ---- the catch: every round, tap to browse all answers by tier ----
function addRound(r, n) {
  $('catch').classList.remove('hide');
  const t = TIERS.find(x => x.pts === r.m) || TIMEOUT;
  const row = document.createElement('div');
  row.className = 'round';
  row.innerHTML = '<button class="rhead"><span class="rn"></span><span class="rmid"><span class="rq"></span><span class="rg"></span></span><span class="rp"></span></button><div class="rbody hide"></div>';
  row.querySelector('.rn').textContent = n;
  row.querySelector('.rq').textContent = r.q;
  row.querySelector('.rg').textContent = `${t.emoji} ${r.g}`;
  const rp = row.querySelector('.rp'); rp.textContent = '+' + r.m; rp.style.color = t.color;
  row.querySelector('.rhead').onclick = () => openCatch(row, r);
  $('rounds').prepend(row);
}
function openCatch(row, r) {
  const body = row.querySelector('.rbody');
  row.classList.toggle('open', body.classList.toggle('hide') === false);
  if (body.dataset.ready) return;
  body.dataset.ready = '1';
  const p = PROMPTS.find(x => x.q === r.q);
  if (!p) return;
  // rarest first, like a leaderboard of deep cuts
  const all = p.a.map((a, i) => ({ names: a.split('/'), t: tierOf(i, p.a.length) })).reverse();
  const mine = forms(r.g);
  const isMine = a => a.names.some(x => forms(x).some(f => f && mine.includes(f)));
  let filter = 'all', query = '', page = 0;
  const PER = 100;
  body.innerHTML = '<div class="chips"></div><input class="search" placeholder="Search all answers…" aria-label="Search all answers"><div class="alist"></div><div class="pager"><span class="count"></span><span><button class="prev">Previous</button> <button class="next">Next</button></span></div>';
  const chips = body.querySelector('.chips');
  const opts = [{ id: 'all', label: 'All', color: '#e6f4ff', n: all.length },
    ...TIERS.slice().reverse().map(t => ({ id: t.name, label: `${t.emoji} ${t.name}`, color: t.color, n: all.filter(a => a.t === t).length }))].filter(o => o.n);
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'chip' + (o.id === 'all' ? ' on' : '');
    b.style.setProperty('--c', o.color);
    b.textContent = `${o.label} ${o.n}`;
    b.onclick = () => { filter = o.id; page = 0; chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); draw(); };
    chips.append(b);
  }
  body.querySelector('.search').oninput = e => { query = norm(e.target.value); page = 0; draw(); };
  body.querySelector('.prev').onclick = () => { page--; draw(); };
  body.querySelector('.next').onclick = () => { page++; draw(); };
  function draw() {
    const list = all.filter(a => (filter === 'all' || a.t.name === filter) && (!query || a.names.some(x => norm(x).includes(query))));
    const max = Math.max(0, Math.ceil(list.length / PER) - 1);
    page = Math.min(Math.max(0, page), max);
    const box = body.querySelector('.alist');
    box.innerHTML = '';
    for (const a of list.slice(page * PER, page * PER + PER)) {
      const d = document.createElement('div');
      d.className = 'ans' + (isMine(a) ? ' mine' : '');
      d.innerHTML = '<span class="ae"></span><span class="an"></span><span class="ap"></span>';
      d.querySelector('.ae').textContent = a.t.emoji;
      d.querySelector('.an').textContent = a.names[0] + (isMine(a) ? '  ← your answer' : '');
      const ap = d.querySelector('.ap'); ap.textContent = '+' + a.t.pts; ap.style.color = a.t.color;
      box.append(d);
    }
    body.querySelector('.count').textContent = list.length ? `${page * PER + 1}–${Math.min(list.length, (page + 1) * PER)} of ${list.length} answers` : 'No answers match';
    body.querySelector('.prev').disabled = page === 0;
    body.querySelector('.next').disabled = page >= max;
  }
  draw();
}

function finish() {
  clearInterval(timer);
  $('f').classList.add('hide'); $('timer').classList.add('hide');
  $('step').textContent = 'Dive complete';
  $('prompt').textContent = `${total} pts · ${rank(total)}`;
  $('pts').textContent = total + ' pts';
  const blocks = results.map(r => (TIERS.find(x => x.pts === r.m) || TIMEOUT).emoji).join('');
  $('share').textContent = `Abyss Dive ${today}\n${blocks}\n${total} pts · ${rank(total)}`;
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

buildWorld();
start('daily');
