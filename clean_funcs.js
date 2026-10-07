const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/window\.extendPeriod =[\s\S]*?renderEditGrid\(\);\s*\};/g, '');
code = code.replace(/window\.splitPeriod =[\s\S]*?renderEditGrid\(\);\s*\};/g, '');
code = code.replace(/window\.updateGridDataMultiple =[\s\S]*?renderEditGrid\(\);\s*\};/g, '');

fs.writeFileSync('app.js', code);
console.log('Removed extra functions');
