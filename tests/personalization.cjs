const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const serve=require('./serve-assets.cjs');
const assets=path.join(__dirname,'../app/src/main/assets');
const origin='https://appassets.androidplatform.net/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],wallpaperRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Synthetic imagery exercises loading/cropping without pretending to recover originals.
  await page.goto('about:blank');
  const fixture=Buffer.from(await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=1080;c.height=2400;
   const x=c.getContext('2d');x.fillStyle='#142a3f';x.fillRect(0,0,1080,2400);
   x.fillStyle='#30ffca';x.fillRect(750,1100,300,900);return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(origin+'wallpapers/')&&url.endsWith('.webp')){
    wallpaperRequests.push(url);return route.fulfill({contentType:'image/png',body:fixture});
   }
   const local=serve(route);if(local)return local;
   if(url===origin+'index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(assets,'index.html'))});
   if(url.includes('api.rss2json.com'))return route.fulfill({json:{status:'ok',items:[]}});
   if(url.includes('api.github.com'))return route.fulfill({json:{items:[]}});
   return route.abort();
  });
  await page.goto(origin+'index.html');
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.complete);
  assert.equal(wallpaperRequests.filter(u=>!u.includes('/thumbs/')).length,1,'only selected full-size wallpaper loads');
  assert.equal(await page.locator('#wallpaperStage').evaluate(e=>e.getBoundingClientRect().top),0,'wallpaper covers status-bar region');
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>getComputedStyle(e).objectFit),'cover');
  await page.evaluate(()=>openWallpaperPicker());
  assert.equal(await page.locator('.wallpaper-choice').count(),10);
  await page.locator('[data-wallpaper="1"]').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/rainy-neon.webp'));
  assert.equal(await page.locator('#wallpaperStage .wallpaper-image').count(),1,'one resident image');
  const full=wallpaperRequests.filter(u=>!u.includes('/thumbs/'));
  assert.equal(full.length,2,'gallery never fetches the remaining original portraits');
  for(const effect of ['rain','aurora','stars','ocean','studio']){
   await page.locator('#wallpaperEffectSelect').selectOption(effect);
   assert.equal(await page.evaluate(()=>document.body.dataset.wallpaperMotion),effect);
   const first=await page.locator('#wallpaperEffect').evaluate(e=>{
    const a=e.getAnimations()[0];return {name:getComputedStyle(e).animationName,time:a?.currentTime};
   });
   assert.notEqual(first.name,'none');
   await page.waitForTimeout(100);
   const second=await page.locator('#wallpaperEffect').evaluate(e=>e.getAnimations()[0]?.currentTime);
   assert.ok(second>first.time,'wallpaper animation actually advances');
  }
  await page.evaluate(()=>window.launcherWallpaperActive(false));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>window.launcherWallpaperActive(true));
  await page.evaluate(()=>setLauncherPage('apps'));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>setLauncherPage('home'));
  await page.evaluate(()=>openWallpaperPicker());
  await page.locator('#customWallpaperFile').setInputFiles({name:'custom.png',mimeType:'image/png',buffer:fixture});
  await page.waitForFunction(()=>document.querySelector('#customWallpaperStatus').textContent.includes('Saved on this phone'));
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.src.startsWith('blob:')),true);
  await page.locator('#customWallpaperPosition').fill('70');
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.style.objectPosition),'70% center');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage')?.src.startsWith('blob:'));
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.style.objectPosition),'70% center','custom image and crop survive restart');
  await page.evaluate(()=>openWallpaperPicker());
  await page.locator('[data-wallpaper="2"]').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.endsWith('/northern-lights.webp'));
  await page.locator('#customWallpaperRestore').click();
  await page.waitForFunction(()=>document.querySelector('#wallpaperImage').src.startsWith('blob:'));
  await page.locator('#customWallpaperFile').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await page.waitForFunction(()=>!document.querySelector('#customWallpaperChoose').disabled);
  assert.equal(await page.locator('#wallpaperImage').evaluate(e=>e.src.startsWith('blob:')),true,'invalid file preserves current wallpaper');
  await page.evaluate(()=>openClockCustomizer());
  await page.evaluate(()=>Promise.all(['25px "Press Start 2P"','400 25px Silkscreen','700 25px Silkscreen'].map(f=>document.fonts.load(f))));
  for(let i=0;i<10;i++){
   const choice=page.locator(`[data-clock-design="${i}"]`);await choice.click();
   const matches=await page.evaluate(i=>{
    const home=document.querySelector('#launcherClock'),sample=document.querySelector(`.clock-sample[data-design="${i}"]`);
    sample.style.fontSize=getComputedStyle(home).fontSize;
    const fields=['fontFamily','fontWeight','letterSpacing','textShadow','borderTopWidth','borderBottomWidth','paddingTop'];
    const a=getComputedStyle(home),b=getComputedStyle(sample);
    return fields.filter(k=>a[k]!==b[k]).map(k=>[k,a[k],b[k]]);
   },i);
   assert.deepEqual(matches,[],`clock ${i} preview must match home styling`);
   assert.equal(await page.locator(`[data-clock-design="${i}"]`).getAttribute('aria-pressed'),'true');
  }
  await page.setViewportSize({width:320,height:740});
  await page.locator('#clockSizeSlider').fill('110');
  for(const design of [1,4,9]){
   await page.locator(`[data-clock-design="${design}"]`).click();
   assert.equal(await page.locator('#launcherClock').evaluate(e=>e.scrollWidth<=e.parentElement.clientWidth+1),true,'large clock fits narrow phone');
  }
  await page.evaluate(()=>window.launcherBack());
  await page.waitForFunction(()=>document.querySelector('#launcherClockDialog').hidden);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.evaluate(()=>openWallpaperPicker());
  assert.match(await page.locator('#wallpaperMotionStatus').textContent(),/reduced-motion/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.body.classList.add('low-power'));
  assert.equal(await page.locator('#wallpaperEffect').evaluate(e=>getComputedStyle(e).animationTimingFunction),'steps(12)');
  const invalid=await page.evaluate(()=>{localStorage.setItem('ar_wallpaper_v1','garbage');return loadPersonalInt('ar_wallpaper_v1',0,9)});
  assert.equal(invalid,0);
  assert.deepEqual(errors,[]);
  if(process.env.PERSONALIZATION_SCREENSHOT){
   await page.evaluate(()=>openClockCustomizer());
   await page.evaluate(()=>Promise.all(document.querySelector('#launcherClockDialog').getAnimations({subtree:true}).filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
   await page.screenshot({path:process.env.PERSONALIZATION_SCREENSHOT,fullPage:true});
  }
  console.log('PASS: clock preview fidelity/offline fonts, custom-photo persistence/crop, selected-image loading, five visible effects, lifecycle pause, reduced motion and narrow-screen sizing (synthetic image fixtures)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
