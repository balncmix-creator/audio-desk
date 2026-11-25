// Fail closed when a new executable regression is not wired into CI.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function missingTests(files,commands){
 const declared=new Set([...commands.matchAll(/\bnode\s+tests\/([\w.-]+\.cjs)\b/g)].map(m=>m[1]));
 return files.filter(f=>f.endsWith('.cjs')&&f!=='serve-assets.cjs'&&!declared.has(f));
}
assert.deepEqual(missingTests(['a.cjs','b.cjs','serve-assets.cjs'],'node tests/a.cjs'),['b.cjs']);
assert.deepEqual(missingTests(['a.cjs'],'node tests/a.cjs'),[]);
const scripts=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).scripts;
const missing=missingTests(fs.readdirSync(path.join(root,'tests')),scripts['test:ui']+' '+scripts['test:wallpapers']);
assert.deepEqual(missing,[],'Every executable regression must run in the APK pipeline');
const assets=fs.readdirSync(path.join(root,'app/src/main/assets')).filter(f=>/\.(js|css)$/.test(f));
const play=fs.readFileSync(path.join(root,'scripts/prepare-play.cjs'),'utf8');
for(const asset of assets)assert.ok(play.includes("'"+asset+"'"),'Shared UI asset missing from Play asset generator: '+asset);
const serve=fs.readFileSync(path.join(root,'tests/serve-assets.cjs'),'utf8');
for(const asset of assets)assert.ok(serve.includes(asset.replace(/\.(js|css)$/,'')),'Shared UI asset not registered in test server: '+asset);
console.log('PASS: regression registration and shared Android edition asset coverage');
