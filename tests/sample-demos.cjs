const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({
  headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']
 });
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.previewLookups=[];
   window.playCalls=[];
   HTMLMediaElement.prototype.play=function(){window.playCalls.push(this.src);return Promise.resolve()};
   window.AudioDesk={
    refreshStarted(){},refreshFinished(){},
    lookupSampleDemo(url,title,id){
     window.previewLookups.push({url,title});
     let result=null;
     if(url.includes('publisher-preview'))result={kind:'audio',url:'https://publisher.example/demo-native.mp3'};
     if(url.includes('soundcloud-preview'))result={kind:'external',url:'https://soundcloud.com/label/sample-pack-demo'};
     setTimeout(()=>window.receiveSampleDemo(id,result),25);
    }
   };
  });
  const articleItems=[
   {title:'Cinematic sample pack with embedded preview',link:'https://publisher.example/feed-demo',
    pubDate:'2026-11-14 12:00:00',description:'Studio quality sample pack for film',
    enclosure:{type:'audio/mpeg',link:'https://publisher.example/demo-rss.mp3'}},
   {title:'New orchestral sample library with publisher preview',link:'https://publisher.example/publisher-preview',
    pubDate:'2026-11-14 11:00:00',description:'Sample library demo on the official publisher page.'},
   {title:'Instrument pack with SoundCloud demo',link:'https://publisher.example/soundcloud-preview',
    pubDate:'2026-11-14 10:00:00',description:'Sample pack audio with external player.'},
   {title:'Sound effects pack without an available demo',link:'https://publisher.example/no-demo',
    pubDate:'2026-11-14 09:00:00',description:'Sound library with no publisher preview.'}
  ];
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.endsWith('/assets/desk-premium.webp'))
    return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:articleItems}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  const classified=await page.evaluate(()=>items.filter(x=>x.cat==='Sample packs').length);
  assert.equal(classified,4,'all sample release items are correctly categorized');
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.locator('#sampleReleaseSection').isVisible(),true);
  assert.equal(await page.locator('#sampleReleases .sample-release-card').count(),4);

  const rss=page.locator('#sampleReleases .sample-release-card').filter({hasText:'Cinematic sample pack with embedded preview'});
  await rss.locator('.sample-demo-button').click();
  assert.equal(await rss.locator('audio').count(),1,'RSS enclosure should offer an in-app player');
  assert.match(await rss.locator('audio').getAttribute('src'),/demo-rss\.mp3/);
  assert.equal((await page.evaluate(()=>window.previewLookups)).length,0,'direct RSS demo needs no page scrape');

  const native=page.locator('#sampleReleases .sample-release-card').filter({hasText:'New orchestral sample library'});
  await native.locator('.sample-demo-button').click();
  await native.locator('audio').waitFor();
  assert.match(await native.locator('audio').getAttribute('src'),/demo-native\.mp3/);
  assert.equal(await native.locator('audio').getAttribute('preload'),'auto');
  assert.ok((await page.evaluate(()=>window.playCalls)).some(x=>x.includes('demo-native.mp3')),'one tap must start playback');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ar_sample_demo_urls')));
  assert.match(stored['https://publisher.example/publisher-preview'].url,/demo-native\.mp3/,'publisher demo persists locally');

  const external=page.locator('#sampleReleases .sample-release-card').filter({hasText:'SoundCloud demo'});
  await external.locator('.sample-demo-button').click();
  await external.locator('.sample-demo-output a[href*="soundcloud.com"]').waitFor();
  assert.equal(await external.locator('audio').count(),0,'external media is not falsely represented as a direct audio file');

  const missing=page.locator('#sampleReleases .sample-release-card').filter({hasText:'without an available demo'});
  await missing.locator('.sample-demo-button').click();
  await missing.locator('.sample-demo-output a[href*="publisher.example/no-demo"]').waitFor();
  assert.equal(await missing.locator('audio').count(),0,'never fabricate a demo');

  await page.locator('[data-filter="Sample packs"]').click();
  assert.equal(await page.locator('.story .sample-demo-button').count(),4,'Sample Pack News also exposes demos');
  const newsArticle=page.locator('.story').filter({hasText:'New orchestral sample library'});
  await newsArticle.locator('.sample-demo-button').click();
  assert.equal(await newsArticle.locator('audio').count(),1,'cached demo works in the news view');
  const lookups=await page.evaluate(()=>window.previewLookups);
  assert.ok(lookups.some(x=>x.title.includes('New orchestral sample library')),'native search must receive exact pack title');
  assert.deepEqual(errors,[]);
  console.log('PASS: real RSS audio, publisher lookup, SoundCloud external fallback, no fabricated audio, cached news & directory preview');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
