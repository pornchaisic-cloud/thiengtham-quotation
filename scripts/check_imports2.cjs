const fs = require('fs');
const path = require('path');

function check(filePath, suspects) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // remove the import block at the top
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].startsWith('import ')) {
    i++;
  }
  const body = lines.slice(i).join('\n');

  console.log(`\n=== ${path.basename(filePath)} ===`);
  for (const name of suspects) {
    const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    const matches = body.match(re);
    const count = matches ? matches.length : 0;
    if (count === 0) console.log(`  ❌ ${name} — UNUSED`);
    else {
      const lines2 = body.split('\n');
      const where = [];
      for (let j = 0; j < lines2.length; j++) {
        if (re.test(lines2[j])) where.push(`L${i+j+1}`);
      }
      console.log(`  ✅ ${name} — ${count}x (${where.slice(0,3).join(', ')}${where.length>3?'...':''})`);
    }
    // reset regex lastIndex
    re.lastIndex = 0;
  }
}

check('D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/App.jsx',
  ['React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'Capacitor', 'supabase', 'BUCKET_NAME', 'XLSX', 'html2canvas', 'jsPDF', 'Filesystem', 'Directory', 'Share', 'Toast', 'ConnectionBanner', 'Header', 'KeySection', 'TransferScreen', 'PriceDbScreen', 'ViewQuoteScreen', 'saveFileToDevice', 'shareFileNative', 'isNative', 'blobToBase64', 'COMPANY_INFO', 'COMPANY_LOGO', 'INITIAL_PRICE_DB', 'SCREENS', 'genId', 'formatMoney', 'today', 'thaiDateStr', 'getItemNumbers', 'ThaiBaht', 'inputStyle', 'btnSm', 'btnKey', 'Label', 'SumRow', 'getUserApiKeys', 'getAllApiKeys', 'getAnthropicApiKeys', 'getOpenRouterKeys', 'OPENROUTER_BUILTIN_KEY']);

check('D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/components/ViewQuoteScreen.jsx',
  ['React', 'useState', 'ExcelJS', 'html2canvas', 'jsPDF', 'Header', 'saveFileToDevice', 'shareFileNative', 'isNative', 'COMPANY_INFO', 'formatMoney', 'thaiDateStr', 'getItemNumbers', 'ThaiBaht', 'thaiBahtText', 'SCREENS', 'btnSm', 'SumRow', 'inputStyle']);

check('D:/app thiengtham/AI App/ThiengTham2_v7_AI_GPT_Model2/ThiengTham2_v7_AI_GPT_Test/src/main.jsx',
  ['createRoot']);
