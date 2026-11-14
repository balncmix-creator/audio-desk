const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
  const localAsset = require('./serve-assets.cjs')(route); if(localAsset)return localAsset;
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',body:fs.readFileSync(
     path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[
    {title:'REAPER workflow audio scripts',description:'Reaper scripts',link:'https://example.test/reaper',pubDate:'2026-11-14'},
    {title:'Dialogue editing and Foley workflow',description:'Film post-production',link:'https://example.test/foley',pubDate:'2026-11-14'}
   ]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  function swipe(x0,x1){
   return page.evaluate(({x0,x1})=>{
    const el=document.getElementById('swipeMain');
    function send(type,x){
     const t=new Touch({identifier:1,target:el,clientX:x,clientY:320,screenX:x,screenY:320});
     el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
    }
    send('touchstart',x0);send('touchmove',(x0+x1)/2);send('touchmove',x1);send('touchend',x1);
   },{x0,x1});
  }
  await swipe(320,80);
  assert.equal(await page.evaluate(()=>active),'All','horizontal swipe must not change news category');
  assert.equal(await page.locator('#tabSwipePreview').isVisible(),false,'news swipe transition must be off');
  await page.locator('[data-filter="REAPER"]').click();
  assert.equal(await page.evaluate(()=>active),'REAPER');
  await swipe(80,320);
  assert.equal(await page.evaluate(()=>active),'REAPER','reverse swipe must not switch categories');
  await page.locator('[data-filter="Post Production"]').click();
  assert.equal(await page.evaluate(()=>active),'Post Production');
  await page.locator('[data-filter="All"]').click();
  assert.equal(await page.evaluate(()=>active),'All');
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.evaluate(()=>activeView),'samples','explicit resource tabs still work');
  assert.deepEqual(errors,[]);
  console.log('PASS: horizontal news swipes disabled; REAPER, Post Production and Sample Pack category buttons still work');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
