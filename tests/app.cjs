const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:393,height:852}});
 await page.addInitScript(()=>{
  window.refreshEvents=[];
  window.AudioDesk={refreshStarted(){window.refreshEvents.push('started')},refreshFinished(){window.refreshEvents.push('finished')}};
 });
 let offline=false,requests=0,watch=false;
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url==='https://appassets.androidplatform.net/assets/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
  if(url.includes('api.rss2json.com')){
   requests++;
   if(offline)return route.abort();
   const title=watch?'Watchlist unique result':'Cached test headline';
   return route.fulfill({json:{status:'ok',items:[{title,link:'https://example.com/'+(watch?'watch':'cached'),description:'Test headline',pubDate:new Date().toISOString()}]}});
  }
  if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
  return route.abort();
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://appassets.androidplatform.net/assets/index.html');
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 await page.waitForTimeout(100);
 assert.deepEqual(errors,[],'app must start without script errors');
 assert.deepEqual(await page.evaluate(()=>window.refreshEvents),['started','finished'],'native indicator needs balanced start/finish callbacks');
 await page.locator('[data-save]').click();
 offline=true;
 await page.locator('#refresh').click();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 await page.waitForTimeout(100);
 assert.deepEqual(await page.evaluate(()=>({cached:JSON.parse(localStorage.ar_items).length,savedKeys:JSON.parse(localStorage.ar_saved).length,visible:document.querySelectorAll('.story').length})),{cached:1,savedKeys:1,visible:1},'offline refresh must preserve cached headlines and bookmarks');
 assert.deepEqual(await page.evaluate(()=>window.refreshEvents),['started','finished','started','finished'],'failed requests must stop the native loading animation');
 offline=false;
 const before=await page.locator('#sources .source').count();
 await page.locator('[data-remove="0"]').click();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 const afterRemove=await page.locator('#sources .source').count();
 await page.reload();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 assert.equal(afterRemove,before-1,'source should be removed immediately');
 assert.equal(await page.locator('#sources .source').count(),afterRemove,'source should stay removed after restart');
 // A successful refresh can replace the entire feed; bookmarks must still exist.
 watch=true;
 await page.locator('#refresh').click();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 await page.locator('[data-filter="Saved"]').click();
 assert.match(await page.locator('#stories').textContent(),/Cached test headline/,'saved articles should survive feed turnover');
 await page.reload();
 await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
 await page.locator('[data-filter="Saved"]').click();
 assert.match(await page.locator('#stories').textContent(),/Cached test headline/,'saved article details should survive restart');
 watch=false;
 await page.locator('[data-view="torrents"]').click();
 await page.waitForFunction(()=>!document.getElementById('refreshTorrent').disabled);
 const initialRequests=requests;
 await page.locator('#refreshTorrent').click();
 await page.waitForFunction(()=>!document.getElementById('refreshTorrent').disabled);
 assert.equal(requests-initialRequests,12,'radar refresh should fetch all twelve feeds');
 const beforeDate=requests;
 await page.locator('#torrentPeriod').selectOption('1d');
 await page.waitForFunction(()=>!document.getElementById('refreshTorrent').disabled);
 assert.equal(requests-beforeDate,12,'changing the date should refetch all twelve feeds');
 await page.waitForTimeout(100);

 watch=true;
 await page.locator('#pluginWatchlist').fill('Test Plugin');
 await page.locator('#scanWatchlist').click();
 await page.waitForFunction(()=>!document.getElementById('scanWatchlist').disabled);
 assert.match(await page.locator('#watchlistStatus').textContent(),/1 indexed mentions found/);
 assert.match(await page.locator('#resourceList').textContent(),/Watchlist unique result/,'scan results must render immediately');
 assert.equal(await page.locator('#resourceList .resource-card').count(),2,'combined results should be deduplicated');
 await page.locator('#pluginWatchlist').fill('');
 await page.locator('#scanWatchlist').click();
 assert.doesNotMatch(await page.locator('#resourceList').textContent(),/Watchlist unique result/,'clearing watchlist should remove old watchlist results');
 assert.deepEqual(errors,[],'no uncaught script errors during interactions');
 console.log('PASS: offline cache, saved article persistence, source removal, radar refresh/date, watchlist display and clearing');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
