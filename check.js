const content = require('fs').readFileSync('index.html', 'utf8'); const start = content.indexOf('<aside'); const end = content.indexOf('</aside>'); console.log(content.substring(start, end));
