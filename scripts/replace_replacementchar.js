const fs = require('fs').promises;
const path = require('path');
const root = path.resolve(__dirname, '..');
const exts = new Set(['.html','.js','.css','.md','.txt']);
let changed = 0;
async function walk(dir){
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries){
    const full = path.join(dir, e.name);
    if (e.isDirectory()){
      if (['.git','node_modules','scripts','assets'].includes(e.name)) continue;
      await walk(full);
    } else {
      if (!exts.has(path.extname(e.name).toLowerCase())) continue;
      try {
        let text = await fs.readFile(full, 'utf8');
        if (text.includes('�')){
          const newText = text.split('�').join('à');
          await fs.writeFile(full, newText, 'utf8');
          console.log('Converted:', full);
          changed++;
        }
      } catch (err){
        console.log('Skip unreadable:', full, err.message);
      }
    }
  }
}

walk(root).then(()=>{
  console.log(`Done. Files changed: ${changed}`);
  process.exit(0);
}).catch(err=>{
  console.error(err);
  process.exit(2);
});