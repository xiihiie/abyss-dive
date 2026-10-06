// Combines parts/*.txt into data.js. n*.txt = niche (daily pool, window.N); the rest = classic (window.P).
const fs = require('fs');
const junk = new Set(['wergeld-ling', 'pipistrelling', 'kerfuffle-oo', 'three billy board', 'shane 2', 'phpht', 'bys', 'dys', 'android']);
const seen = new Set(), N = [], P = [];
for (const f of fs.readdirSync('parts').sort()) {
  for (let line of fs.readFileSync('parts/' + f, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    let [q, a] = line.split('|');
    q = q.trim().replace('Name a famous scientist invention', 'Name an invention');
    if (seen.has(q)) continue;
    seen.add(q);
    const keys = new Set();
    const ans = a.split(',').map(s => s.trim()).filter(s => {
      const k = s.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!k || junk.has(s) || keys.has(k)) return false;
      keys.add(k); return true;
    });
    (f.startsWith('n') ? N : P).push(q + '|' + ans.join(','));
  }
}
fs.writeFileSync('data.js', 'window.N = ' + JSON.stringify(N) + ';\nwindow.P = ' + JSON.stringify(P) + ';\n');
console.log('niche', N.length, 'classic', P.length);

