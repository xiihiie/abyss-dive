// Each line: "Prompt|answer,answer,..." ordered most common -> rarest. "a/b" = aliases.
const PROMPTS = (window.P || []).map(l => {
  const [q, a] = l.split('|');
  return { q: q.trim(), a: a.split(',').map(x => x.trim()).filter(Boolean) };
});
const norm = s => s.toLowerCase().replace(/^(the|a|an) /, '').replace(/[^a-z0-9]/g, '');
// singular-ish forms so "apples" matches "apple" and "peaches" matches "peach"
const forms = s => { const n = norm(s); return [n, n.replace(/s$/, ''), n.replace(/es$/, '')]; };

function score(p, guess) {
  const g = forms(guess);
  if (!g[0]) return null;
  const i = p.a.findIndex(x => x.split('/').some(alias => forms(alias).some(f => g.includes(f))));
  if (i < 0) return { m: 0, label: 'not on the list' };
  const r = i / Math.max(1, p.a.length - 1);              // 0 = most common, 1 = rarest
  return { m: Math.round(5 + 95 * r * r), name: p.a[i].split('/')[0], r };
}

// mulberry32 seeded by date so the daily dive is the same for everyone
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const today = new Date().toISOString().slice(0, 10);
function dailySet() {
  const rand = rng(+today.replace(/-/g, ''));
  const idx = [...PROMPTS.keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 7).map(i => PROMPTS[i]);
}

const $ = id => document.getElementById(id);
let mode, set, at, total, results;
const zones = [[0, 'the surface'], [100, 'sunlight zone'], [200, 'twilight zone'], [350, 'midnight zone'], [500, 'the abyss'], [650, 'the trench']];
const zone = m => zones.filter(z => m >= z[0]).pop()[1];

function start(m) {
  mode = m; at = 0; total = 0; results = [];
  $('bDaily').classList.toggle('on', m === 'daily');
  $('bInf').classList.toggle('on', m === 'inf');
  $('log').innerHTML = ''; $('share').textContent = ''; $('msg').textContent = '';
  set = m === 'daily' ? dailySet() : [];
  if (m === 'daily') {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('dive-' + today)); } catch {}
    if (saved) { results = saved; results.forEach(addLog); total = results.reduce((s, r) => s + r.m, 0); return finish(); }
  }
  next();
}
function next() {
  if (mode === 'inf') set[at] = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  $('step').textContent = mode === 'daily' ? `prompt ${at + 1} / 7` : `dive #${at + 1}`;
  $('prompt').textContent = set[at].q;
  $('f').classList.remove('hide');
  $('a').value = ''; $('a').focus();
  draw();
}
function draw() {
  $('depth').textContent = total + 'm · ' + zone(total);
  const t = Math.min(1, total / 700);  // background darkens as you sink
  document.body.style.background = `rgb(${5 - 5 * t},${10 + 20 * (1 - t) - 10 * t},${20 + 40 * (1 - t)})`;
}
function addLog(r) {
  const cls = r.m === 0 ? 'no' : r.m < 30 ? 'meh' : 'ok';
  $('log').insertAdjacentHTML('afterbegin', `<div><span></span><span class="${cls}">${r.m}m</span></div>`);
  $('log').firstChild.firstChild.textContent = r.q + ' → ' + r.g;
}
function finish() {
  $('f').classList.add('hide');
  $('step').textContent = 'dive complete';
  $('prompt').textContent = `You reached ${zone(total)}`;
  draw();
  const blocks = results.map(r => r.m === 0 ? '⬛' : r.m < 30 ? '🟦' : r.m < 70 ? '🟪' : '🐙').join('');
  $('share').textContent = `Abyss Dive ${today}\n${blocks}\n${total}m`;
}
$('f').onsubmit = e => {
  e.preventDefault();
  const p = set[at], s = score(p, $('a').value);
  if (!s) return;
  const r = { q: p.q, g: $('a').value.trim(), m: s.m };
  results.push(r); total += s.m; addLog(r);
  $('msg').textContent = s.m === 0 ? `"${r.g}" isn't on the list. 0m` :
    `${s.m}m · ${s.r < 0.2 ? 'everyone said that' : s.r < 0.6 ? 'not bad' : 'one in a million!'}` +
    ` · rarest: ${p.a[p.a.length - 1].split('/')[0]}`;
  at++;
  if (mode === 'daily' && at === 7) { try { localStorage.setItem('dive-' + today, JSON.stringify(results)); } catch {} finish(); }
  else next();
};
$('bDaily').onclick = () => start('daily');
$('bInf').onclick = () => start('inf');
$('bHelp').onclick = () => $('help').classList.toggle('hide');
start('daily');
