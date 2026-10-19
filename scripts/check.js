const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Script } = require('node:vm');
const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules','.git','TeamAi-test','android','vendor']);
function check(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(ignored.has(entry.name)) continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) check(file);
    else if(entry.name.endsWith('.js')) {
      const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
      if(result.status!==0) process.exit(result.status||1);
    } else if(entry.name.endsWith('.html')) {
      for(const match of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new Script(match[1],{filename:file});
    }
  }
}
check(root);
console.log('JavaScript syntax checks passed.');
