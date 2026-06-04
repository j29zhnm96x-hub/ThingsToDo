const fs = require('fs');
let c = fs.readFileSync('src/modules/utils/i18n.js', 'utf8');

// Fix all multi-byte corruption patterns
const fixes = [
  // Em dash — (U+2014) corrupted as â€" (U+00E2+U+20AC+U+201D)
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u201c', '\u2014'], // en dash variant
  // Bullet • (U+2022) corrupted as â€¢ (U+00E2+U+20AC+U+00A2)
  ['\u00e2\u20ac\u00a2', '\u2022'],
  // Right single quote ' (U+2019) corrupted 
  ['\u00e2\u20ac\u2122', '\u2019'], // â€™ → '
  // Left single quote ' (U+2018)
  ['\u00e2\u20ac\u02dc', '\u2018'], // âŒ˜ → '
  // Euro sign € (U+20AC) corruption
  ['\u00e2\u201a\u00ac', '\u20ac'], // â‚¬ → €
];

let total = 0;
for (const [from, to] of fixes) {
  const count = c.split(from).length - 1;
  if (count > 0) {
    c = c.split(from).join(to);
    total += count;
    console.log(`Fixed ${count}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  }
}

console.log(`Total fixes: ${total}`);

fs.writeFileSync('src/modules/utils/i18n.js', c, 'utf8');

// Verify specific string the user reported
const check = fs.readFileSync('src/modules/utils/i18n.js', 'utf8');
const snimiIdx = check.indexOf('Snimite ili napi\u0161ite');
if (snimiIdx >= 0) {
  const near = check.substring(snimiIdx, snimiIdx + 80);
  console.log('Fixed text:', JSON.stringify(near));
}

// Check syntax
try { require('./src/modules/utils/i18n.js'); console.log('Syntax: OK'); }
catch (e) { console.log('ERROR:', e.message.substring(0, 200)); }
