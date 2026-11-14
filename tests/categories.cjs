const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const cached=[
    {title:'SUBVERSELAB SVL 8-BIT ORCHESTRAL',link:'https://example.com/kit',key:'kit',
     desc:'CHIP HOUSE, ELECTRO AND HIP HOP KITS. CONSTRUCTION KITS WITH EVERY SOUND.',
     date:'2026-11-13',source:'KVR Audio — New Plugins',cat:'DAWs & plugins',image:''},
    {title:'New synthesizer plug-in released',link:'https://example.com/plugin',key:'plugin',
     desc:'New VST instrument with improved audio synthesis',date:'2026-11-12',
     source:'KVR Audio — New Plugins',cat:'DAWs & plugins',image:''},
    {title:'Film dialogue editing tips',link:'https://example.com/post',key:'post',
     desc:'Dialogue and foley workflow',date:'2026-11-11',
     source:'Production Expert',cat:'Post-production',image:''}
   ];
   localStorage.setItem('ar_items',JSON.stringify(cached));
   localStorage.setItem('ar_saved',JSON.stringify(['kit','post']));
   localStorage.setItem('ar_saved_items',JSON.stringify([cached[0],cached[2]]));
  });
  await page.route('**/*',route=>{
  const localAsset = require('./serve-assets.cjs')(route); if(localAsset)return localAsset;
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  const cats=await page.evaluate(()=>[
   classify({title:'SUBVERSELAB SVL 8-BIT ORCHESTRAL',description:'Hip hop construction kits and sample libraries'}, {cat:'DAWs & plugins'}),
   classify({title:'Free drum sample pack',description:'New drum samples'}, {cat:'Plugin releases'}),
   classify({title:'New Kontakt instrument library',description:'Multi-sampled cinematic strings'}, {cat:'Production'}),
   classify({title:'Reaper DAW update',description:'Version 7 released'}, {cat:'REAPER'}),
   classify({title:'Synth plug-in update',description:'New VST audio software'}, {cat:'DAWs & plugins'}),
   classify({title:'Firmware release for studio audio interface',description:'Drivers updated'}, {cat:'Hardware'}),
   classify({title:'New production workflow released',description:'Music production techniques'}, {cat:'Production'})
  ]);
  assert.deepEqual(cats,['Sample packs','Sample packs','Sample packs','REAPER','DAWs & plugins','Hardware','Production']);
  const stored=await page.evaluate(()=>({
   items:JSON.parse(localStorage.getItem('ar_items')).map(x=>x.cat),
   saved:JSON.parse(localStorage.getItem('ar_saved_items')).map(x=>x.cat)
  }));
  assert.deepEqual(stored.items,['Sample packs','DAWs & plugins','Post Production'],'existing offline cache must be migrated');
  assert.deepEqual(stored.saved,['Sample packs','Post Production'],'bookmarked article category must be migrated');
  assert.equal(await page.locator('[data-filter="Post Production"]').count(),1,'only one post-production filter must exist');
  assert.equal(await page.locator('[data-filter="Post-production"]').count(),0,'legacy duplicate must be removed');
  assert.equal(await page.evaluate(()=>classify({title:'Dialogue editing and ADR',description:'Film sound'}, {cat:'Post-production'})),'Post Production');
  await page.locator('[data-filter="Post Production"]').click();
  assert.equal(await page.locator('.story').count(),1,'old cached post story should be shown in merged filter');
  assert.match(await page.locator('.story').innerText(),/dialogue/i);
  await page.locator('[data-filter="Sample packs"]').click();
  assert.equal(await page.locator('.story').count(),1);
  assert.match(await page.locator('.story').innerText(),/SUBVERSELAB/);
  await page.locator('[data-filter="DAWs & plugins"]').click();
  assert.equal(await page.locator('.story').count(),1);
  assert.match(await page.locator('.story').innerText(),/synthesizer/);
  await page.locator('[data-filter="Saved"]').click();
  assert.equal(await page.locator('.story').count(),2);
  assert.match(await page.locator('#stories').innerText(),/Sample packs/i);
  assert.match(await page.locator('#stories').innerText(),/Post Production/i);
  assert.deepEqual(errors,[]);
  console.log('PASS: unified post-production filter/category, legacy cache/bookmarks, sample packs, DAW articles');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
