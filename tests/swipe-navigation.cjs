const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args:['--no-sandbox']
 });
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://appassets.androidplatform.net/assets/index.html')
    return route.fulfill({contentType:'text/html',
     body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8')});
   if(url.endsWith('/assets/desk-premium.webp'))
    return route.fulfill({contentType:'image/webp',
     body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desk-premium.webp'))});
   if(url.includes('api.rss2json.com'))
    return route.fulfill({json:{status:'ok',items:[
     {title:'REAPER workflow audio scripts',description:'Reaper scripts update',link:'https://example.test/reaper',pubDate:'2026-11-14'},
     {title:'Dialogue editing and Foley workflow',description:'Film sound post-production',link:'https://example.test/foley',pubDate:'2026-11-14'}
    ]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto('https://appassets.androidplatform.net/assets/index.html');
  await page.evaluate(()=>setLauncherPage('events',false));
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GitHub:'));
  const send=async(stage,x,y)=>{
   return page.evaluate(({stage,x,y})=>{
    const el=document.getElementById('swipeMain');
    const t=new Touch({identifier:0,target:el,clientX:x,clientY:y,screenX:x,screenY:y});
    const touches=stage==='touchend'||stage==='touchcancel'?[]:[t];
    el.dispatchEvent(new TouchEvent(stage,{bubbles:true,cancelable:true,
     touches,targetTouches:touches,changedTouches:[t]}));
   },{stage,x,y});
  };
  const swipe=async(x0,y0,x1,y1)=>{
   await send('touchstart',x0,y0);
   await send('touchmove',x0+(x1-x0)*.5,y0+(y1-y0)*.5);
   await send('touchmove',x1,y1);
   await page.waitForTimeout(40);
   await send('touchend',x1,y1);
   await page.waitForFunction(()=>!tabAnimationBusy&&document.getElementById('tabSwipePreview').hidden,null,{timeout:3500});
  };
  assert.equal(await page.evaluate(()=>active),'All');
  // A vertical gesture should not initiate the horizontal transition.
  await swipe(170,210,176,400);
  assert.equal(await page.evaluate(()=>active),'All','vertical scrolling must not navigate');
  assert.equal(await page.locator('#swipeMain').evaluate(x=>x.style.transform),'');
  // Swiping left reveals the next tab behind a receding/blurred old tab.
  await send('touchstart',337,300);
  await send('touchmove',245,303);
  await page.waitForTimeout(40);
  const during=await page.evaluate(()=>({
   previewVisible:!document.getElementById('tabSwipePreview').hidden,
   title:document.getElementById('tabSwipeTitle').textContent,
   opacity:Number(document.getElementById('swipeMain').style.opacity),
   filter:document.getElementById('swipeMain').style.filter,
   transform:document.getElementById('swipeMain').style.transform
  }));
  assert.equal(during.previewVisible,true,'incoming tab preview must appear underneath');
  assert.match(during.title,/REAPER/);
  assert.ok(during.opacity<1&&during.opacity>0,'outgoing tab fades progressively');
  assert.match(during.filter,/blur\(/,'outgoing tab must blur as it recedes');
  assert.match(during.transform,/scale\(/,'outgoing tab moves back in depth');
  await send('touchmove',64,305);
  await send('touchend',64,305);
  await page.waitForFunction(()=>!tabAnimationBusy&&document.getElementById('tabSwipePreview').hidden,null,{timeout:3500});
  assert.equal(await page.evaluate(()=>active),'REAPER');
  assert.equal(await page.locator('[data-filter="REAPER"]').getAttribute('class'),'active');
  assert.equal(await page.locator('#swipeMain').evaluate(x=>x.style.filter),'','finished swipe should clear effect');

  await swipe(339,315,62,317);
  assert.equal(await page.evaluate(()=>active),'Post Production','another swipe left navigates in order');

  await swipe(45,300,343,301);
  assert.equal(await page.evaluate(()=>active),'REAPER','swipe right returns to previous tab');
  await swipe(45,300,344,301);
  assert.equal(await page.evaluate(()=>active),'All');
  await swipe(45,300,344,301);
  assert.equal(await page.evaluate(()=>active),'All','swipe at first tab must not wrap');

  // Bottom tab strip still scrolls independently; only content takes swipe gestures.
  await page.evaluate(()=>{
   document.getElementById('filters').scrollLeft=300;
  });
  const left=await page.evaluate(()=>document.getElementById('filters').scrollLeft);
  assert.ok(left>0,'the bottom toolbar remains horizontally scrollable');

  // Swiping from the pack directory reaches the preceding resource tab.
  await page.locator('[data-view="samples"]').click();
  assert.equal(await page.evaluate(()=>activeView),'samples');
  await swipe(60,310,343,312);
  assert.equal(await page.evaluate(()=>activeView),'torrents');
  assert.deepEqual(errors,[],'no app JavaScript errors during gestures');
  console.log('PASS: directional swipes, layered blur/fade/depth, end resistance, vertical scroll, dock scroll, sample/resource views');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
