const fs = require('fs');
const content = fs.readFileSync('src/pages/PrincipalDashboard.tsx', 'utf8');
const idx = content.indexOf('<td className="px-3 py-2.5 text-center border-b border-l border-r border-gray-100">');
console.log('idx:', idx);
if (idx >= 0) {
  console.log('Found at:', idx);
  console.log(content.substring(idx, idx + 500));
}