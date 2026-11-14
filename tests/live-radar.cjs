const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let liveRequests=0;
  await page.addInitScript(()=>{localStorage.setItem("ar_last_discovery",Date.now().toString());});
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'))});
   if(url.includes('api.rss2json.com')){
    const feed=new URL(url).searchParams.get('rss_url')||'';
    const isLive=feed.includes('when%3A1d')||feed.includes('when:1d')||feed.includes('rekkerd.org/feed/');
    if(isLive){
     liveRequests++;
     const isSample=feed.includes('sample')||feed.includes('Kontakt')||feed.includes('cinematic');
     const id=isSample?'sound-library-01':'plugin-release-01';
     return route.fulfill({json:{status:'ok',items:[{
      title:isSample?'Solar Drift sample library announced':'Avora Conductor X new VST3 plugin released',
      link:'https://publisher.example/'+id,description:isSample?'Original sample library launch':'Audio plugin release',
      pubDate:'2026-11-14 12:00:00'
     }]}});
    }
    return route.fulfill({json:{status:'ok',items:[]}});
   }
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.evaluate(()=>refreshLiveRadar(true));
  await page.waitForFunction(()=>!liveRadarBusy);
  const first=await page.evaluate(()=>items.map(x=>({title:x.title,cat:x.cat,url:x.link})));
  assert.ok(first.some(x=>x.cat==='Sample packs'), 'sample packs appear in live radar');
  assert.ok(first.some(x=>x.cat==='Plugin releases'),'plugins appear in live radar');
  const count=first.length;
  await page.evaluate(()=>refreshLiveRadar(true));
  await page.waitForFunction(()=>!liveRadarBusy);
  assert.equal(await page.evaluate(()=>items.length),count,'duplicate releases are not repeated');
  assert.match(await page.locator('#liveRadarStatus').textContent(),/CHECKED/);
  assert.ok(liveRequests>=4,'live release sources refresh without a full app reload');
  assert.deepEqual(errors,[]);
  console.log('PASS: two-minute sample/plugin radar, regional rotation, publisher check, deduplication, status');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
