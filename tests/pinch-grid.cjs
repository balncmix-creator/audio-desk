const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[
    {title:'REAPER workflow tricks',link:'https://example.test/a',description:'REAPER scripts',pubDate:'2026-11-14T10:00:00Z'},
    {title:'Dialogue editing for film',link:'https://example.test/b',description:'Sound editorial Foley workflow',pubDate:'2026-11-14T09:00:00Z'},
    {title:'Cinematic sample pack: Airframe Essentials',link:'https://example.test/c',description:'Cinematic sound effects library sample pack',pubDate:'2026-11-14T08:00:00Z'},
    {title:'New analog synth audio plug-in',link:'https://example.test/d',description:'Virtual instrument released',pubDate:'2026-11-14T07:00:00Z'},
    {title:'Game audio sample pack: Ancient Drums',link:'https://example.test/e',description:'Kontakt sample library for game sound',pubDate:'2026-11-14T06:00:00Z'},
    {title:'Stereo field recording technology',link:'https://example.test/f',description:'Audio hardware and production gear',pubDate:'2026-11-14T05:00:00Z'}
   ]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  await page.evaluate(()=>{localStorage.setItem('ar_last_discovery',String(Date.now()))});
  const pinch=async(from,to)=>{
   await page.evaluate(({from,to})=>{
    const root=document.getElementById('swipeMain');
    const make=positions=>positions.map((x,i)=>new Touch({
     identifier:i+1,target:root,clientX:x,clientY:320,screenX:x,screenY:320
    }));
    const event=(name,positions,changes)=>{
     root.dispatchEvent(new TouchEvent(name,{bubbles:true,cancelable:true,
      touches:make(positions),targetTouches:make(positions),changedTouches:make(changes)}));
    };
    event('touchstart',from,from);event('touchmove',to,to);event('touchend',[],to);
   },{from,to});
  };
  const cols=()=>page.locator('#stories').evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').length);
  assert.equal(await page.evaluate(()=>cardDensity),1);
  await pinch([100,300],[170,225]); // pinch IN: 1 -> 3
  assert.equal(await page.evaluate(()=>cardDensity),3);
  assert.equal(await cols(),3,'three cards must fit across a row');
  assert.equal(await page.locator('[data-card-density="3"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>active),'All','pinch should not switch news tab');
  await pinch([105,310],[172,225]); // pinch IN again: 3 -> 5
  assert.equal(await page.evaluate(()=>cardDensity),5);
  assert.equal(await cols(),5,'five cards must fit across a row');
  const first=page.locator('#stories .story').first();
  await first.click({position:{x:6,y:30}});
  await page.locator('#gridDetail:not([hidden])').waitFor();
  assert.match(await page.locator('#gridDetailBody h2').textContent(),/REAPER workflow tricks/);
  await page.locator('#gridDetailSave').click();
  assert.equal(await page.locator('#gridDetailSave').textContent(),'★ SAVED');
  await page.locator('#gridDetailClose').click();
  assert.equal(await page.locator('#gridDetail').isVisible(),false);

  // Spread OUT to zoom into the cards one grid step at a time.
  await pinch([169,225],[95,300]);
  assert.equal(await page.evaluate(()=>cardDensity),3);
  await pinch([169,225],[95,300]);
  assert.equal(await page.evaluate(()=>cardDensity),1);
  await pinch([169,225],[95,300]);
  assert.equal(await page.evaluate(()=>cardDensity),1,'cannot go below 1 card');
  assert.equal(await page.locator('#stories .story p').first().isVisible(),true,'full articles return in list view');

  // Buttons are an accessible alternative to multitouch and persist on restart.
  await page.locator('[data-card-density="5"]').click();
  assert.equal(await cols(),5);
  await page.reload();
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  assert.equal(await page.evaluate(()=>cardDensity),5,'chosen density survives app restart');
  assert.equal(await cols(),5);
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.evaluate(()=>activeView),'samples');
  assert.equal(await page.locator('#sampleReleases .sample-release-card').count()>0,true);
  const sampleCols=await page.locator('#sampleReleases').evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').length);
  assert.equal(sampleCols,5,'same density is used for the sample-pack releases');
  // A small grid tile still exposes full story and audition controls on tap.
  const sample=page.locator('#sampleReleases .sample-release-card').first();
  await sample.click({position:{x:5,y:10}});
  assert.equal(await page.locator('#gridDetail').isVisible(),true);
  assert.equal(await page.locator('#gridDetailBody .sample-demo-button').count(),1);
  await page.locator('#gridDetailClose').click();

  // Existing horizontal swipe navigation remains available after a pinch.
  await page.locator('[data-card-density="1"]').click();
  await page.locator('[data-filter="All"]').click();
  await page.evaluate(()=>{
   const root=document.getElementById('swipeMain');
   function dispatch(name,x,y){
    const t=new Touch({identifier:1,target:root,clientX:x,clientY:y,screenX:x,screenY:y});
    root.dispatchEvent(new TouchEvent(name,{bubbles:true,cancelable:true,
     touches:name==='touchend'?[]:[t],targetTouches:name==='touchend'?[]:[t],changedTouches:[t]}));
   }
   dispatch('touchstart',325,315);dispatch('touchmove',205,315);dispatch('touchmove',40,315);dispatch('touchend',40,315);
  });
  await page.waitForFunction(()=>!tabAnimationBusy&&document.getElementById('tabSwipePreview').hidden);
  assert.equal(await page.evaluate(()=>active),'REAPER');
  assert.deepEqual(errors,[],'no JavaScript errors on pinch, modal, reload or swipe');
  console.log('PASS: inward pinch 1→3→5, outward spread 5→3→1, column geometry, no tab conflicts, detail/save, persistence, sample pack grid, button alternative');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
