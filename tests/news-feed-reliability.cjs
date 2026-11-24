const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const serve=require('./serve-assets.cjs');
const origin='https://appassets.androidplatform.net/assets/';
const qaFeeds=[
 {name:'QA Alpha',url:'https://feeds.example.test/alpha.rss',cat:'Production'},
 {name:'QA Beta',url:'https://feeds.example.test/beta.rss',cat:'Production'}
];
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.refreshEvents=[];
   // Keep Home idle until the test configures exactly two RSS sources.
   window.AudioDesk={
    isLowRamDevice(){return true},
    refreshStarted(){window.refreshEvents.push('started')},
    refreshFinished(){window.refreshEvents.push('finished')}
   };
   localStorage.setItem('ar_last_discovery',Date.now().toString());
  });
  let slowAlpha=false,blockTimeout=false,requests=0;
  await page.route('**/*',async route=>{
   if(serve(route))return;
   const url=route.request().url();
   if(url===origin+'index.html')return route.fulfill({contentType:'text/html',
    body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com')){
    requests++;
    const feed=new URL(url).searchParams.get('rss_url')||'';
    if(feed.includes('timeout.qa.test')){
     if(blockTimeout)await new Promise(r=>setTimeout(r,500));
     return route.fulfill({json:{status:'ok',items:[]} }).catch(()=>{});
    }
    if(feed.includes('alpha.rss')&&slowAlpha)await new Promise(r=>setTimeout(r,450));
    const search=feed.includes('news.google.com/rss/search')||feed.includes('www.bing.com/news/search');
    const fromGoogle=feed.includes('news.google.com');
    const name=search?
     'The same headline about audio post production workflow and sound design':
     feed.includes('alpha.rss')?'Alpha-only example RSS story about post-production':
     'Beta-only example RSS story about production audio';
    const link=search?'https://news.example.test/'+(fromGoogle?'google':'bing'):
      feed.includes('alpha.rss')?'https://stories.example.test/alpha':'https://stories.example.test/beta';
    return route.fulfill({json:{status:'ok',items:[{
     title:name,link,description:'Audio editing workflow and hardware',
     pubDate:'2026-11-24 10:00:00'
    }]}}).catch(()=>{});
   }
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto(origin+'index.html');
  await page.evaluate(config=>{
   feeds.splice(0,feeds.length,...config);
   renderSources();
   setLauncherPage('events',false);
  },qaFeeds);
  await page.waitForFunction(()=>window.refreshEvents.length>=2&&
   !document.getElementById('refresh').disabled);
  assert.equal(await page.locator('#stories .story').count(),2);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.ar_items).length),2);

  // Removing a source DURING a slow in-flight refresh must not re-add it.
  slowAlpha=true;
  await page.locator('#refresh').click();
  await page.waitForFunction(()=>window.refreshEvents.length===3);
  await page.locator('#sources [data-remove="0"]').click();
  await page.waitForFunction(()=>window.refreshEvents.length>=6&&
   !document.getElementById('refresh').disabled,null,{timeout:12000});
  const removal=await page.evaluate(()=>({
   feeds:feeds.map(x=>x.name),titles:items.map(x=>x.title),
   persisted:JSON.parse(localStorage.ar_items).map(x=>x.title),
   refreshEvents:window.refreshEvents
  }));
  assert.deepEqual(removal.feeds,['QA Beta']);
  assert.ok(removal.titles.every(s=>!s.includes('Alpha-only')),
   'slow response from removed source cannot resurrect its stories');
  assert.ok(removal.persisted.every(s=>!s.includes('Alpha-only')),
   'stale source must also stay removed from persistent feed cache');
  assert.equal(removal.refreshEvents.filter(x=>x==='started').length,
   removal.refreshEvents.filter(x=>x==='finished').length,
   'native refresh indicator remains balanced after queued update');

  // RSS can contain syndicated links to the same title. Keep only one story
  // even when multiple index providers use different URLs.
  const deduped=await page.evaluate(()=>{
   const a={title:'Full coverage of a new audio post-production technology update',
    link:'https://provider.example/item/a',date:'2026-11-24',source:'Provider A'};
   const b={...a,link:'https://aggregator.example/redirect/b',source:'Provider B'};
   const c={...a,title:'A genuinely different update',link:'https://provider.example/item/c'};
   return uniqueFeedStories([a,b,c]).map(x=>x.title);
  });
  assert.deepEqual(deduped,[
   'Full coverage of a new audio post-production technology update',
   'A genuinely different update'
  ]);

  const peak=await page.evaluate(async()=>{
   let active=0,max=0;
   await mapFeedsBounded(Array.from({length:45},(_,i)=>i),async n=>{
    active++;max=Math.max(max,active);
    await new Promise(r=>setTimeout(r,5));
    active--;return n;
   });
   return max;
  });
  assert.ok(peak<=12&&peak>1,'parallel RSS cap never exceeds twelve connections');

  // An explicit timeout must ABORT a slow fetch, not just ignore its result.
  blockTimeout=true;
  const timeout=await page.evaluate(async()=>{
   const start=performance.now();
   try{await fetchFeedWithTimeout({name:'Blocked QA RSS',
    url:'https://timeout.qa.test/rss',cat:'Production'},80);
    return {error:'not timed out',ms:performance.now()-start}
   }catch(e){return {error:String(e.message),ms:performance.now()-start}}
  });
  assert.match(timeout.error,/Timed out/);
  assert.ok(timeout.ms<450,'timeout quickly releases the UI instead of waiting for slow feed');

  // Two engines, one syndicated title: preserve one stable URL/key and re-enable
  // the search button. Separate news search must not corrupt saved RSS cache.
  await page.evaluate(()=>{
   document.querySelector('#engineGoogle').checked=true;
   document.querySelector('#engineBing').checked=true;
   document.querySelector('#search').value='audio workflow';
  });
  await page.locator('#webSearch').click();
  await page.waitForFunction(()=>!document.getElementById('webSearch').disabled);
  const search=await page.evaluate(()=>({
   message:document.getElementById('searchStatus').textContent,
   count:items.filter(x=>x.title.includes('The same headline')).length,
   keys:items.filter(x=>x.title.includes('The same headline')).map(x=>x.key),
   persisted:JSON.parse(localStorage.ar_items).map(x=>x.title)
  }));
  assert.match(search.message,/1 unique results/);
  assert.equal(search.count,1,'Google/Bing syndicated headline appears only once');
  assert.equal(search.keys.length,1);
  assert.ok(search.persisted.every(x=>!x.includes('The same headline')),
   'temporary search results must not overwrite RSS cache');
  assert.deepEqual(errors,[],'no uncaught news feed script errors');
  console.log('PASS: remove-during-refresh, queued followup, stable RSS cache, source dedup, 12-connection cap, HTTP abort, merged news search and native loading indicator');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
