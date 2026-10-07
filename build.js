// Combines parts/*.txt into data.js.
// n*.txt = niche (daily pool, window.N); x*.txt = extra answers appended to an existing prompt; the rest = classic (window.P).
const fs = require('fs');
const junk = new Set(['wergeld-ling', 'pipistrelling', 'kerfuffle-oo', 'three billy board', 'shane 2', 'phpht', 'bys', 'dys', 'android']);
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const prompts = new Map(); // question -> { niche, answers, keys }
const files = fs.readdirSync('parts').sort();
const lines = f => fs.readFileSync('parts/' + f, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.includes('|'));
function add(p, list) {
  for (const s of list.split(',').map(s => s.trim())) {
    const k = key(s);
    if (!k || junk.has(s) || p.keys.has(k)) continue;
    p.keys.add(k); p.answers.push(s);
  }
}
for (const f of files.filter(f => !f.startsWith('x'))) {
  for (const line of lines(f)) {
    let [q, a] = line.split('|');
    q = q.trim().replace('Name a famous scientist invention', 'Name an invention');
    if (prompts.has(q)) continue;
    const p = { niche: f.startsWith('n'), answers: [], keys: new Set() };
    add(p, a); prompts.set(q, p);
  }
}
for (const f of files.filter(f => f.startsWith('x'))) {
  for (const line of lines(f)) {
    const [q, a] = line.split('|');
    const p = prompts.get(q.trim());
    if (!p) { console.warn('no such prompt:', q.trim()); continue; }
    add(p, a);
  }
}
const N = [], P = [];
for (const [q, p] of prompts) (p.niche ? N : P).push(q + '|' + p.answers.join(','));
fs.writeFileSync('data.js', 'window.N = ' + JSON.stringify(N) + ';\nwindow.P = ' + JSON.stringify(P) + ';\n');
console.log('niche', N.length, 'classic', P.length);
