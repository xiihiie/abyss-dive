// Combines parts/*.txt into data.js: dedupes prompts and answers, drops junk.
const fs = require('fs');
const junk = new Set(['wergeld-ling', 'pipistrelling', 'kerfuffle-oo']);
const seen = new Set(), out = [];
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
    out.push(q + '|' + ans.join(','));
  }
}
fs.writeFileSync('data.js', 'window.P = ' + JSON.stringify(out) + ';\n');
const n = out.map(l => l.split('|')[1].split(',').length);
console.log('prompts', out.length, 'min', Math.min(...n), 'avg', Math.round(n.reduce((a, b) => a + b) / n.length), 'under50', n.filter(x => x < 50).length);
