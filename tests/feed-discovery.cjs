const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.addInitScript(()=>{
   window.scans=[];
   window.AudioDesk={
    refreshStarted(){},refreshFinished(){},
    discoverPublisherFeeds(seeds,id){
     const sites=JSON.parse(seeds);window.scans.push(sites);
     setTimeout(()=>window.receiveDiscoveredFeeds(id,[
      {name:'Sonic State — RSS',url:'https://sonicstate.com/new-feed.xml',cat:'Plugin releases'},
      {name:'Untrusted — RSS',url:'https://attacker.example.com/feed/',cat:'Plugin releases'},
      {name:'Sonic State — RSS',url:'https://sonicstate.com/new-feed.xml',cat:'Plugin releases'}
     ]),50);
    }
   };
  });
  await page.route('**/*',route=>{
  const localAsset = require('./serve-assets.cjs')(route); if(localAsset)return localAsset;
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[{title:'Verified audio-news feed item',link:'https://example.com/audiodesk-discovery',description:'Sound design and audio software',pubDate:'2026-11-14'}]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  const sources=await page.evaluate(()=>({defaults:defaults.map(f=>f.url),seeds:publisherSeeds.map(f=>f.site),radar:livePublisherFeeds.map(f=>f.url)}));
  assert.ok(sources.defaults.some(u=>u.includes('musehub.com')),'MuseHub must be available at startup');
  assert.ok(sources.seeds.some(u=>new URL(u).hostname.endsWith('musehub.com')),'MuseHub must support native feed discovery');
  assert.ok(sources.defaults.some(u=>u.includes('audiopluginguy.com')),'Audio Plugin Guy must be available at startup');
  assert.ok(sources.seeds.some(u=>new URL(u).hostname.endsWith('audiopluginguy.com')),'Audio Plugin Guy must support native feed discovery');
  assert.ok(sources.defaults.some(u=>u.includes('prosoundweb.com')),'ProSoundWeb must be available at startup');
  assert.ok(sources.seeds.some(u=>new URL(u).hostname.endsWith('prosoundweb.com')),'ProSoundWeb must support native feed discovery');
  assert.equal(sources.defaults.filter(u=>u==='https://rekkerd.org/feed/').length,1,'Rekkerd direct feed must not be duplicated');
  assert.ok(sources.seeds.includes('https://rekkerd.org/'),'Rekkerd publisher discovery must remain enabled');
  assert.ok(sources.radar.includes('https://rekkerd.org/feed/'),'Rekkerd remains in live release radar');
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>document.getElementById('discoveryStatus').textContent.includes('added automatically.'),null,{timeout:16000});
  let auto=await page.evaluate(()=>JSON.parse(localStorage.ar_auto_feeds));
  assert.equal(auto.length,1,'add just one matching, usable publisher feed');
  assert.match(auto[0].url,/sonicstate.com\/new-feed.xml/);
  assert.equal(await page.evaluate(()=>feeds.filter(x=>x.url.includes('new-feed.xml')).length),1,'do not add duplicates');
  await page.locator('#sources [data-remove]').last().click();
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  // Remove the newly discovered feed even if it is not last in the source list.
  const exists=await page.evaluate(()=>feeds.some(x=>x.url.includes('new-feed.xml')));
  if(exists)await page.evaluate(()=>document.querySelectorAll('#sources [data-remove]')[feeds.findIndex(x=>x.url.includes('new-feed.xml'))].click());
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.locator('#discoverFeeds').click();
  await page.waitForFunction(()=>!document.getElementById('discoverFeeds').disabled);
  assert.equal(await page.evaluate(()=>feeds.some(x=>x.url.includes('new-feed.xml'))),false,'removed feed must not return after rescan');
  assert.ok((await page.evaluate(()=>window.scans)).length>=2,'support manual rediscovery');
  assert.deepEqual(errors,[]);
  console.log('PASS: automatic discovery, trusted publisher filtering, duplicates, persistence, removal and rescan');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
