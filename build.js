// Runs on Vercel during deploy. Reads your keys from Vercel Environment Variables and writes keys.js,
// so the keys never have to be stored in the GitHub repository.
const fs = require('fs');
const out = {};
['GEMINI_API_KEY', 'NEWSDATA_API_KEY', 'GOLDAPI_KEY'].forEach(function (name) {
  if (process.env[name]) out[name] = process.env[name];
});
fs.writeFileSync('keys.js', 'window.GOLDPULSE = Object.assign(window.GOLDPULSE || {}, ' + JSON.stringify(out) + ');\n');
console.log('keys.js written with: ' + (Object.keys(out).join(', ') || '(no keys found, check Environment Variables)'));
