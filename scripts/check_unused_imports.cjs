const fs = require('fs');
const path = require('path');

function analyze(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports = new Map();

  let i = 0;
  while (i < lines.length && lines[i].startsWith('import ')) {
    const line = lines[i];
    let combined = line;
    while (!combined.includes(';') && i + 1 < lines.length) {
      i++;
      combined += ' ' + lines[i];
    }
    const m = combined.match(/import\s+(?:(\*\s+as\s+(\w+))|(\w+))?(?:\s*,\s*)?(?:\s*\{([^}]+)\})?\s+from\s+['"][^'"]+['"]/);
    if (m) {
      if (m[2]) imports.set(m[2], line);
      if (m[3]) imports.set(m[3], line);
      if (m[4]) {
        const names = m[4].split(',').map(s => s.trim().split(/\s+as\s+/).pop());
        names.forEach(n => imports.set(n, line));
      }
    }
    i++;
  }

  const codeLines = lines.slice(i).join('\n');
  const unused = [];
  const used = [];
  for (const [name, line] of imports) {
    const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(codeLines)) used.push(name);
    else unused.push(name);
  }
  return { unused, used };
}

const files = [
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/App.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/ViewQuoteScreen.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/PriceDbScreen.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/KeySection.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/TransferScreen.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/Header.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/Toast.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/ConnectionBanner.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/lib/supabase.js',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/lib/sync.js',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/utils/apiKeys.js',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/utils/fileHelper.js',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Test/src/utils/helpers.js',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/utils/styles.jsx',
  'D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/main.jsx',
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const { unused } = analyze(f);
  if (unused.length > 0) {
    console.log(`\n❌ ${path.basename(f)} — ${unused.length} unused imports:`);
    for (const n of unused) console.log(`   - ${n}`);
  } else {
    console.log(`✅ ${path.basename(f)} — clean`);
  }
}
